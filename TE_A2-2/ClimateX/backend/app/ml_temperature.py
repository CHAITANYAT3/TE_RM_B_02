"""Machine Learning service for ClimateX Climate Prediction.

Predicts annual Temperature_C / Rainfall_mm / CO2_Emissions_tonnes using Year
as the sole input feature across 5 regression models:
  1. Linear Regression
  2. Polynomial Regression (degree 2, centred at Year-2000)
  3. Random Forest Regression
  4. Gradient Boosting Regression
  5. XGBoost Regression

Plus an experimental Temporal Fusion Transformer (temperature target only).

Validation Strategy:
  - Chronological Time-Aware Split (no temporal leakage):
      Training Period : 2000–2019  (20 samples)
      Testing  Period : 2020–2024  (5 samples)
  - Evaluation Metrics: MAE, MSE, RMSE, R²
  - Best Model Selection: Lowest RMSE on test set
"""

import math
from typing import Dict, List, Literal, Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures
from xgboost import XGBRegressor

from app.data_loader import load_dataset
from app.tft_module import TFTExperimentalResponse, compute_tft_experimental

# Supported target keys ---------------------------------------------------------
TargetKey = Literal["temp", "rain", "co2"]

_COLUMN_MAP: Dict[str, str] = {
    "temp": "Temperature_C",
    "rain": "Rainfall_mm",
    "co2": "CO2_Emissions_tonnes",
}

_UNIT_MAP: Dict[str, str] = {
    "temp": "°C",
    "rain": "mm",
    "co2": "tonnes",
}


# ─── Pydantic Response Schemas ─────────────────────────────────────────────────

class PeriodInfo(BaseModel):
    start_year: int
    end_year: int
    total_years: int


class ModelMetrics(BaseModel):
    model: str
    mae: float
    mse: float
    rmse: float
    r2: float
    rank: int
    model_type: str
    viva_notes: str


class BestModelInfo(BaseModel):
    model: str
    selection_criterion: str
    mae: float
    mse: float
    rmse: float
    r2: float
    summary: str


class YearlyPrediction(BaseModel):
    year: int
    actual: float
    predictions: Dict[str, float]


class ModelPredictionSeries(BaseModel):
    model: str
    predicted_values: List[float]
    errors: List[float]


class TemperatureMLResponse(BaseModel):
    target_variable: str
    input_feature: str
    validation_strategy: str
    training_period: PeriodInfo
    testing_period: PeriodInfo
    model_comparison: List[ModelMetrics]
    best_model: BestModelInfo
    yearly_predictions: List[YearlyPrediction]
    model_series: List[ModelPredictionSeries]
    viva_insights: List[str]
    tft_experimental: Optional[TFTExperimentalResponse] = None


# ─── Generic ML Computation ───────────────────────────────────────────────────

def compute_ml_comparison(target: TargetKey = "temp") -> TemperatureMLResponse:
    """Train 5 regression models on 2000-2019 and evaluate on 2020-2024.

    Parameters
    ----------
    target : TargetKey
        Which climate variable to predict – ``"temp"``, ``"rain"``, or ``"co2"``.

    Returns
    -------
    TemperatureMLResponse
        Full comparison result in the existing response shape.
    """
    col = _COLUMN_MAP[target]
    unit = _UNIT_MAP[target]

    df = load_dataset()
    df = df.sort_values("Year").reset_index(drop=True)

    # Chronological time-aware split (no random leakage)
    train_df = df[(df["Year"] >= 2000) & (df["Year"] <= 2019)].copy()
    test_df  = df[(df["Year"] >= 2020) & (df["Year"] <= 2024)].copy()

    # Centre Year at 2000 to improve polynomial numerical stability
    train_df = train_df.copy()
    test_df  = test_df.copy()
    train_df["Year_c"] = train_df["Year"] - 2000
    test_df["Year_c"]  = test_df["Year"]  - 2000

    X_train_raw = train_df[["Year"]]
    X_test_raw  = test_df[["Year"]]
    X_train_c   = train_df[["Year_c"]]
    X_test_c    = test_df[["Year_c"]]

    y_train      = train_df[col]
    y_test       = test_df[col]
    test_years   = [int(y) for y in test_df["Year"]]
    actual_vals  = [round(float(v), 4) for v in y_test]

    # ── Model definitions ──────────────────────────────────────────────────────
    # Each entry has: estimator, X_train, X_test, type str, viva str
    model_defs = {
        "Linear Regression": dict(
            estimator=LinearRegression(),
            X_tr=X_train_raw,
            X_te=X_test_raw,
            type_str="Parametric Linear (y = β₀ + β₁·Year)",
            viva=(
                "Fits a straight line via Ordinary Least Squares (OLS). "
                "Successfully extrapolates a constant monotone trend into test years."
            ),
        ),
        "Polynomial Regression (degree 2)": dict(
            estimator=make_pipeline(
                PolynomialFeatures(degree=2, include_bias=False),
                LinearRegression(),
            ),
            X_tr=X_train_c,   # centred Year (Year – 2000)
            X_te=X_test_c,
            type_str="Quadratic Curve (y = β₀ + β₁·(Year−2000) + β₂·(Year−2000)²)",
            viva=(
                "Centring Year at 2000 reduces multicollinearity between the linear "
                "and quadratic terms. Captures non-linear curvature / acceleration "
                "in the target trend over time."
            ),
        ),
        "Random Forest Regression": dict(
            estimator=RandomForestRegressor(n_estimators=100, random_state=42),
            X_tr=X_train_raw,
            X_te=X_test_raw,
            type_str="Non-parametric Ensemble (100 Decision Trees with Bagging)",
            viva=(
                "Tree-based regressors use step-functions and cannot extrapolate "
                "beyond training bounds [2000, 2019]. They predict a flat constant "
                "value for all test years."
            ),
        ),
        "Gradient Boosting Regression": dict(
            estimator=GradientBoostingRegressor(n_estimators=100, random_state=42),
            X_tr=X_train_raw,
            X_te=X_test_raw,
            type_str="Sequential Boosting Ensemble (Gradient Boosted Trees)",
            viva=(
                "Like Random Forest, boosted trees partition feature space into "
                "orthogonal leaves and cannot extrapolate upward trends outside "
                "the training domain."
            ),
        ),
        "XGBoost Regression": dict(
            estimator=XGBRegressor(
                n_estimators=100,
                max_depth=3,
                learning_rate=0.1,
                random_state=42,
                verbosity=0,
            ),
            X_tr=X_train_raw,
            X_te=X_test_raw,
            type_str="Extreme Gradient Boosted Trees (XGBoost)",
            viva=(
                "Optimises a regularised objective with second-order Taylor gradients. "
                "Being a tree ensemble it cannot extrapolate continuous monotone trends "
                "beyond training bounds [2000, 2019]; predictions are flat for 2020–2024."
            ),
        ),
    }

    comparison_list = []
    raw_predictions: Dict[str, List[float]] = {}

    for name, conf in model_defs.items():
        est = conf["estimator"]
        est.fit(conf["X_tr"], y_train)
        preds = est.predict(conf["X_te"])
        pred_list = [round(float(p), 4) for p in preds]
        raw_predictions[name] = pred_list

        mae  = float(mean_absolute_error(y_test, preds))
        mse  = float(mean_squared_error(y_test, preds))
        rmse = float(math.sqrt(mse))
        r2   = float(r2_score(y_test, preds))

        comparison_list.append({
            "model":      name,
            "mae":        round(mae,  4),
            "mse":        round(mse,  6),
            "rmse":       round(rmse, 4),
            "r2":         round(r2,   4),
            "model_type": conf["type_str"],
            "viva_notes": conf["viva"],
        })

    # Sort ascending by RMSE (lowest = best)
    comparison_list.sort(key=lambda m: m["rmse"])

    model_metrics_list: List[ModelMetrics] = []
    for rank, m in enumerate(comparison_list, start=1):
        model_metrics_list.append(
            ModelMetrics(
                model=m["model"],
                mae=m["mae"],
                mse=m["mse"],
                rmse=m["rmse"],
                r2=m["r2"],
                rank=rank,
                model_type=m["model_type"],
                viva_notes=m["viva_notes"],
            )
        )

    best = model_metrics_list[0]

    # ── Dynamic summary – depends on actual winner, not a fixed sentence ───────
    is_parametric = best.model in ("Linear Regression", "Polynomial Regression (degree 2)")
    is_tree       = best.model in (
        "Random Forest Regression",
        "Gradient Boosting Regression",
        "XGBoost Regression",
    )

    if is_parametric:
        rationale = (
            "Parametric models outperformed tree ensembles because they extrapolate "
            f"the monotone {col.replace('_', ' ')} trend beyond the 2019 training boundary."
        )
    elif is_tree:
        rationale = (
            "A tree ensemble outperformed parametric models — the target variable's "
            f"pattern in the test window was better captured by non-linear step partitions "
            f"than by a straight-line or quadratic extrapolation."
        )
    else:
        rationale = (
            f"{best.model} produced the most accurate out-of-sample predictions "
            f"for {col.replace('_', ' ')} on the 2020–2024 test window."
        )

    best_info = BestModelInfo(
        model=best.model,
        selection_criterion="Lowest Root Mean Squared Error (RMSE) on chronological 2020–2024 test set",
        mae=best.mae,
        mse=best.mse,
        rmse=best.rmse,
        r2=best.r2,
        summary=(
            f"{best.model} achieved the lowest prediction error with an RMSE of "
            f"{best.rmse:.4f} {unit} (MAE: {best.mae:.4f} {unit}, R²: {best.r2:.4f}). "
            f"{rationale}"
        ),
    )

    # ── Yearly actual vs predicted records ─────────────────────────────────────
    yearly_preds: List[YearlyPrediction] = []
    for i, yr in enumerate(test_years):
        preds_for_year = {name: raw_predictions[name][i] for name in model_defs}
        yearly_preds.append(
            YearlyPrediction(year=yr, actual=actual_vals[i], predictions=preds_for_year)
        )

    # ── Per-model prediction series ────────────────────────────────────────────
    model_series: List[ModelPredictionSeries] = []
    for name in model_defs:
        preds = raw_predictions[name]
        errors = [round(p - a, 4) for p, a in zip(preds, actual_vals)]
        model_series.append(
            ModelPredictionSeries(model=name, predicted_values=preds, errors=errors)
        )

    # ── Dynamic viva insights ──────────────────────────────────────────────────
    winning_family = "parametric" if is_parametric else "tree-based"
    viva_insights = [
        (
            "Time-Aware Split vs Random Split: Climate data is intrinsically sequential. "
            "Random train_test_split causes temporal data leakage (look-ahead bias). "
            "Chronological splitting (2000–2019 train, 2020–2024 test) accurately "
            "evaluates true forecasting ability."
        ),
        (
            "Tree Extrapolation Limitation: Tree ensembles (Random Forest, Gradient "
            "Boosting, XGBoost) produce step-function piecewise-constant predictions. "
            "They cannot predict values outside the max/min target in their training "
            "leaves, causing a flat-line prediction for 2020–2024."
        ),
        (
            "Parametric Regression Advantage: Linear and Polynomial (degree 2, centred "
            "at Year−2000) Regression learn continuous functional relationships and can "
            "extrapolate monotone trends beyond the 2019 boundary."
        ),
        (
            f"Winner on {col.replace('_', ' ')} (RMSE criterion): {best.model} "
            f"(RMSE = {best.rmse:.4f} {unit}, R² = {best.r2:.4f}). "
            f"The {winning_family} family performed best on this target."
        ),
        (
            "Metrics Interpretation: RMSE penalises large errors more than MAE. "
            "R² measures proportion of variance explained; negative R² means the model "
            "performs worse than predicting the test-set mean."
        ),
    ]

    # ── TFT (temperature only) ─────────────────────────────────────────────────
    tft_res = compute_tft_experimental() if target == "temp" else None

    return TemperatureMLResponse(
        target_variable=col,
        input_feature="Year",
        validation_strategy=(
            "Chronological time-aware split (Train: 2000–2019, Test: 2020–2024)"
        ),
        training_period=PeriodInfo(start_year=2000, end_year=2019, total_years=20),
        testing_period=PeriodInfo(start_year=2020, end_year=2024, total_years=5),
        model_comparison=model_metrics_list,
        best_model=best_info,
        yearly_predictions=yearly_preds,
        model_series=model_series,
        viva_insights=viva_insights,
        tft_experimental=tft_res,
    )


# ─── Backward-compatible alias (keeps /ml/temperature endpoint working) ────────

def compute_temperature_ml_comparison() -> TemperatureMLResponse:
    """Backward-compatible wrapper – delegates to compute_ml_comparison('temp')."""
    return compute_ml_comparison("temp")
