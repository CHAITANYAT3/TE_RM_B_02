"""ml_results.py — GET /ml/results

Trains 6 models (Linear, Polynomial, Random Forest, Gradient Boosting,
XGBoost, TFT) for three targets (Temperature_C, Rainfall_mm,
CO2_Emissions_tonnes) using a strict chronological split:
  Train : 2000–2019  (20 samples)
  Test  : 2020–2024  (5 samples)

Returns MAE, RMSE, R², rank-by-RMSE, and per-year predictions for every
target × model combination.  No winner is hard-coded.
"""

import math
from typing import Dict, List, Literal

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from pydantic import BaseModel
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from xgboost import XGBRegressor

from app.data_loader import load_dataset
from app.tft_module import GatedResidualNetwork, LightweightTFT

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

TargetKey = Literal["temp", "rain", "co2"]

_COL: Dict[str, str] = {
    "temp": "Temperature_C",
    "rain": "Rainfall_mm",
    "co2":  "CO2_Emissions_tonnes",
}
_UNIT: Dict[str, str] = {
    "temp": "°C",
    "rain": "mm",
    "co2":  "tonnes",
}

MODEL_KEYS = ["linear", "poly", "rf", "gb", "xgb", "tft"]
MODEL_LABELS = {
    "linear": "Linear Regression",
    "poly":   "Polynomial Regression (degree 2)",
    "rf":     "Random Forest Regression",
    "gb":     "Gradient Boosting Regression",
    "xgb":    "XGBoost Regression",
    "tft":    "TFT (Experimental)",
}


class YearPrediction(BaseModel):
    year: int
    actual: float
    predicted: float


class ModelResult(BaseModel):
    model_key:  str
    model_name: str
    mae:  float
    rmse: float
    r2:   float
    rank: int                          # 1 = lowest RMSE
    predictions: List[YearPrediction]  # 2020–2024 only
    is_experimental: bool = False


class TargetResult(BaseModel):
    target_key:    str               # "temp" | "rain" | "co2"
    target_column: str               # "Temperature_C" etc.
    unit:          str
    train_years:   List[int]         # [2000 .. 2019]
    test_years:    List[int]         # [2020 .. 2024]
    models:        List[ModelResult]


class MLResultsResponse(BaseModel):
    targets: List[TargetResult]


# ---------------------------------------------------------------------------
# TFT helper (reuses architecture from tft_module)
# ---------------------------------------------------------------------------

def _run_tft(train_df, test_df, df_full, col: str) -> List[float]:
    """Train TFT and return 5 predictions for 2020–2024 as raw column values."""
    torch.manual_seed(42)
    np.random.seed(42)

    features = ["Temperature_C", "Rainfall_mm", "CO2_Emissions_tonnes"]

    train_feats = train_df[features].to_numpy()
    scaler_x = StandardScaler().fit(train_feats)
    scaler_y = StandardScaler().fit(train_df[col].to_numpy().reshape(-1, 1))

    all_scaled = scaler_x.transform(df_full[features].to_numpy())
    train_scaled = all_scaled[: len(train_df)]

    lookback = 3

    def build_seqs(scaled, source_col_vals):
        X, y = [], []
        for i in range(lookback, len(scaled)):
            X.append(scaled[i - lookback : i])
            y.append(source_col_vals[i])
        return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

    X_tr, y_tr = build_seqs(train_scaled, train_df[col].to_numpy())

    # Build test windows using the full chronological series
    test_start_idx = len(train_df)   # index of 2020 in df_full
    X_te_list, y_te_list = [], []
    for i in range(test_start_idx, test_start_idx + len(test_df)):
        X_te_list.append(all_scaled[i - lookback : i])
        y_te_list.append(df_full[col].iloc[i])
    X_te = np.array(X_te_list, dtype=np.float32)
    y_te_actual = np.array(y_te_list, dtype=np.float32)

    y_tr_norm = scaler_y.transform(y_tr.reshape(-1, 1)).flatten()

    X_tr_t = torch.tensor(X_tr, dtype=torch.float32)
    y_tr_t = torch.tensor(y_tr_norm, dtype=torch.float32).unsqueeze(1)
    X_te_t = torch.tensor(X_te, dtype=torch.float32)

    model = LightweightTFT(num_features=len(features), d_model=16, num_heads=2)
    opt = optim.Adam(model.parameters(), lr=0.015, weight_decay=1e-4)
    loss_fn = nn.MSELoss()

    model.train()
    for _ in range(50):
        opt.zero_grad()
        preds, _ = model(X_tr_t)
        loss = loss_fn(preds, y_tr_t)
        loss.backward()
        opt.step()

    model.eval()
    with torch.no_grad():
        out, _ = model(X_te_t)
        preds_norm = out.numpy().reshape(-1, 1)
        preds_raw = scaler_y.inverse_transform(preds_norm).flatten()

    return [round(float(p), 4) for p in preds_raw]


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

def compute_ml_results() -> MLResultsResponse:
    df = load_dataset().sort_values("Year").reset_index(drop=True)

    train_df = df[(df["Year"] >= 2000) & (df["Year"] <= 2019)].copy()
    test_df  = df[(df["Year"] >= 2020) & (df["Year"] <= 2024)].copy()

    train_df["Year_c"] = train_df["Year"] - 2000
    test_df["Year_c"]  = test_df["Year"]  - 2000

    X_tr_raw = train_df[["Year"]]
    X_te_raw = test_df[["Year"]]
    X_tr_c   = train_df[["Year_c"]]
    X_te_c   = test_df[["Year_c"]]

    train_years = [int(y) for y in train_df["Year"]]
    test_years  = [int(y) for y in test_df["Year"]]

    target_results: List[TargetResult] = []

    for tkey in ("temp", "rain", "co2"):
        col  = _COL[tkey]
        unit = _UNIT[tkey]
        y_tr = train_df[col]
        y_te = test_df[col].to_numpy()

        # --- Classical model definitions ---
        classical = {
            "linear": (LinearRegression(),                                         X_tr_raw, X_te_raw),
            "poly":   (make_pipeline(PolynomialFeatures(degree=2, include_bias=False), LinearRegression()), X_tr_c, X_te_c),
            "rf":     (RandomForestRegressor(n_estimators=100, random_state=42),   X_tr_raw, X_te_raw),
            "gb":     (GradientBoostingRegressor(n_estimators=100, random_state=42), X_tr_raw, X_te_raw),
            "xgb":    (XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42, verbosity=0), X_tr_raw, X_te_raw),
        }

        raw: Dict[str, List[float]] = {}
        metrics: Dict[str, dict] = {}

        for key, (est, Xtr, Xte) in classical.items():
            est.fit(Xtr, y_tr)
            preds = est.predict(Xte)
            raw[key] = [round(float(p), 4) for p in preds]
            mse = float(mean_squared_error(y_te, preds))
            metrics[key] = {
                "mae":  round(float(mean_absolute_error(y_te, preds)), 4),
                "rmse": round(math.sqrt(mse), 4),
                "r2":   round(float(r2_score(y_te, preds)), 4),
            }

        # --- TFT ---
        tft_preds = _run_tft(train_df, test_df, df, col)
        raw["tft"] = tft_preds
        mse_tft = float(mean_squared_error(y_te, tft_preds))
        metrics["tft"] = {
            "mae":  round(float(mean_absolute_error(y_te, tft_preds)), 4),
            "rmse": round(math.sqrt(mse_tft), 4),
            "r2":   round(float(r2_score(y_te, tft_preds)), 4),
        }

        # --- Rank by RMSE (ascending, no tie-breaking preference) ---
        ranked = sorted(MODEL_KEYS, key=lambda k: metrics[k]["rmse"])

        model_results: List[ModelResult] = []
        for rank, key in enumerate(ranked, start=1):
            year_preds = [
                YearPrediction(
                    year=test_years[i],
                    actual=round(float(y_te[i]), 4),
                    predicted=raw[key][i],
                )
                for i in range(len(test_years))
            ]
            model_results.append(
                ModelResult(
                    model_key=key,
                    model_name=MODEL_LABELS[key],
                    mae=metrics[key]["mae"],
                    rmse=metrics[key]["rmse"],
                    r2=metrics[key]["r2"],
                    rank=rank,
                    predictions=year_preds,
                    is_experimental=(key == "tft"),
                )
            )

        # Re-sort by key order for stable output
        model_results.sort(key=lambda m: MODEL_KEYS.index(m.model_key))

        target_results.append(
            TargetResult(
                target_key=tkey,
                target_column=col,
                unit=unit,
                train_years=train_years,
                test_years=test_years,
                models=model_results,
            )
        )

    return MLResultsResponse(targets=target_results)
