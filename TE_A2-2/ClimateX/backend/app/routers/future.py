"""
GET /predict/future?target=temp|rain|co2&year=2025..2040

Rules:
  - Only Linear Regression and Polynomial Regression (deg 2) are used.
  - Train on 2000-2019, pick winner by lowest RMSE on 2020-2024.
  - Refit winner on all 2000-2024, project 2025-2040.
  - Polynomial gets checked: if prediction strictly decreases at any
    point after 2024, we fall back to Linear and say why.
  - Rainfall: if R² ≤ 0.05 on the test window, predict mean with wide band.
  - 95% prediction interval computed from in-sample residual std of the
    refitted-full model (conservative; grows slightly with time-distance
    to keep the fan shape visual).
"""

import math
from typing import List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures

from app.data_loader import load_dataset

router = APIRouter(prefix="/predict", tags=["Future Prediction v2"])


# ── Response shapes ────────────────────────────────────────────────────────────

class FutureYearPoint(BaseModel):
    year: int
    value: float
    lower: float
    upper: float


class ObservedPoint(BaseModel):
    year: int
    value: float


class MilestoneInfo(BaseModel):
    threshold_label: str
    year_reached: Optional[int]
    reached: bool


class FutureResponse(BaseModel):
    target: str                        # "temp" | "rain" | "co2"
    unit: str
    label: str
    model_name: str
    training_period: str               # "2000–2024 (refitted)"
    test_rmse: float
    selected_year: int
    selected_value: float
    selected_lower: float
    selected_upper: float
    change_from_2024: float
    observed: List[ObservedPoint]      # 2000–2024
    future: List[FutureYearPoint]      # 2025–2040
    linear_future: List[FutureYearPoint]    # always present for toggle
    poly_future: List[FutureYearPoint]      # always present for toggle
    no_trend_note: Optional[str]
    fallback_note: Optional[str]       # why polynomial was rejected
    milestones: List[MilestoneInfo]    # temp only; empty list otherwise


# ── Column / unit maps ─────────────────────────────────────────────────────────

_COL = {"temp": "Temperature_C", "rain": "Rainfall_mm", "co2": "CO2_Emissions_tonnes"}
_UNIT = {"temp": "°C", "rain": "mm", "co2": "tonnes"}
_LABEL = {
    "temp": "Annual Mean Temperature",
    "rain": "Annual Rainfall",
    "co2": "CO₂ Emissions",
}

# z-score for 95% two-sided PI
_Z95 = 1.96


# ── Helper: fit + predict + compute PI ────────────────────────────────────────

def _build_poly_pipe():
    return make_pipeline(PolynomialFeatures(degree=2, include_bias=False), LinearRegression())


def _predict_interval(
    model,
    X_fit: np.ndarray,
    y_fit: np.ndarray,
    X_future: np.ndarray,
    base_sigma: float,
    years_future: np.ndarray,
    center_year: int = 2024,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (preds, lower, upper).  Band grows linearly with years past 2024."""
    preds = model.predict(X_future)
    residuals = y_fit - model.predict(X_fit)
    sigma = float(np.std(residuals, ddof=1))
    if sigma < base_sigma:
        sigma = base_sigma          # minimum floor

    # Fan: add 5% of sigma per year past 2024
    years_ahead = np.maximum(years_future - center_year, 0)
    sigma_fan = sigma * (1 + 0.05 * years_ahead)
    lower = preds - _Z95 * sigma_fan
    upper = preds + _Z95 * sigma_fan
    return preds, lower, upper


@router.get("/future", response_model=FutureResponse)
def predict_future(
    target: str = Query(..., pattern="^(temp|rain|co2)$",
                        description="Variable: temp | rain | co2"),
    year: int = Query(..., ge=2025, le=2040, description="Target future year"),
):
    try:
        col = _COL[target]
        unit = _UNIT[target]
        label = _LABEL[target]

        df = load_dataset().sort_values("Year").reset_index(drop=True)
        df_all = df.copy()

        train = df[(df["Year"] >= 2000) & (df["Year"] <= 2019)]
        test  = df[(df["Year"] >= 2020) & (df["Year"] <= 2024)]

        X_train = train[["Year"]].values
        y_train = train[col].values
        X_test  = test[["Year"]].values
        y_test  = test[col].values

        # ── Fit both models on train, evaluate on test ─────────────────────
        lin = LinearRegression().fit(X_train, y_train)
        lin_rmse = math.sqrt(mean_squared_error(y_test, lin.predict(X_test)))

        poly = _build_poly_pipe().fit(X_train, y_train)
        poly_rmse = math.sqrt(mean_squared_error(y_test, poly.predict(X_test)))

        # ── Rainfall: check for meaningful trend ───────────────────────────
        no_trend_note: Optional[str] = None
        if target == "rain":
            from sklearn.metrics import r2_score
            lin_r2 = r2_score(y_test, lin.predict(X_test))
            if lin_r2 <= 0.05:
                no_trend_note = "No clear trend detected. Predicted as historical mean with wide uncertainty band."

        # ── Pick winner (parametric only) ──────────────────────────────────
        if no_trend_note:
            # mean predictor
            winner_name = "Historical Mean"
            test_rmse = float(lin_rmse)
            use_mean = True
        else:
            use_mean = False
            if poly_rmse <= lin_rmse:
                winner_name = "Polynomial Regression (deg 2)"
                test_rmse = float(poly_rmse)
                winner_model_key = "poly"
            else:
                winner_name = "Linear Regression"
                test_rmse = float(lin_rmse)
                winner_model_key = "linear"

        # ── Refit both on full 2000-2024 ───────────────────────────────────
        X_all = df_all[["Year"]].values
        y_all = df_all[col].values

        lin_full  = LinearRegression().fit(X_all, y_all)
        poly_full = _build_poly_pipe().fit(X_all, y_all)

        future_years = np.arange(2025, 2041)
        X_fut = future_years.reshape(-1, 1)

        base_sigma_rail = float(np.std(y_all, ddof=1)) * 0.15  # 15% of overall std as floor

        lin_preds, lin_lower, lin_upper = _predict_interval(
            lin_full, X_all, y_all, X_fut, base_sigma_rail, future_years)
        poly_preds, poly_lower, poly_upper = _predict_interval(
            poly_full, X_all, y_all, X_fut, base_sigma_rail, future_years)

        # ── Polynomial bend check ──────────────────────────────────────────
        fallback_note: Optional[str] = None
        if not use_mean and winner_model_key == "poly":
            # Check: does polynomial ever decrease after 2024?
            poly_vals = poly_preds  # indices 0=2025 ... 15=2040
            bends_down = any(
                poly_vals[i] < poly_vals[i - 1]
                for i in range(1, len(poly_vals))
            )
            if bends_down:
                fallback_note = (
                    "Polynomial curves downward after 2024 (vertex reached), "
                    "which is physically implausible for this trend. "
                    "Falling back to Linear Regression."
                )
                winner_name = "Linear Regression"
                test_rmse = float(lin_rmse)
                winner_model_key = "linear"

        # ── No-trend: use mean + wide band ────────────────────────────────
        if use_mean:
            mean_val = float(np.mean(y_all))
            mean_std = float(np.std(y_all, ddof=1))
            # Wide band: 2× sigma_fan
            main_preds = np.full(len(future_years), mean_val)
            main_lower = np.full(len(future_years), mean_val - 2 * _Z95 * mean_std)
            main_upper = np.full(len(future_years), mean_val + 2 * _Z95 * mean_std)
        else:
            if winner_model_key == "poly":
                main_preds, main_lower, main_upper = poly_preds, poly_lower, poly_upper
            else:
                main_preds, main_lower, main_upper = lin_preds, lin_lower, lin_upper

        # ── Build response arrays ──────────────────────────────────────────
        def make_future_series(preds, lower, upper) -> List[FutureYearPoint]:
            return [
                FutureYearPoint(
                    year=int(yr),
                    value=round(float(p), 4),
                    lower=round(float(lo), 4),
                    upper=round(float(hi), 4),
                )
                for yr, p, lo, hi in zip(future_years, preds, lower, upper)
            ]

        future_main   = make_future_series(main_preds, main_lower, main_upper)
        future_linear = make_future_series(lin_preds,  lin_lower,  lin_upper)
        future_poly   = make_future_series(poly_preds, poly_lower, poly_upper)

        observed = [
            ObservedPoint(year=int(row["Year"]), value=round(float(row[col]), 4))
            for _, row in df_all.iterrows()
        ]

        # ── Selected year values ───────────────────────────────────────────
        sel_idx = int(year) - 2025
        sel_val   = float(main_preds[sel_idx])
        sel_lower = float(main_lower[sel_idx])
        sel_upper = float(main_upper[sel_idx])

        val_2024 = float(df_all[df_all["Year"] == 2024][col].values[0])
        change_from_2024 = round(sel_val - val_2024, 4)

        # ── Milestones (temp only) ─────────────────────────────────────────
        milestones: List[MilestoneInfo] = []
        if target == "temp":
            val_2000 = float(df_all[df_all["Year"] == 2000][col].values[0])
            for threshold, label_ms in [(1.0, "+1.0 °C above 2000"), (1.5, "+1.5 °C above 2000")]:
                target_val = val_2000 + threshold
                reached_year: Optional[int] = None
                for fp in future_main:
                    if fp.value >= target_val:
                        reached_year = fp.year
                        break
                milestones.append(MilestoneInfo(
                    threshold_label=label_ms,
                    year_reached=reached_year,
                    reached=reached_year is not None,
                ))

        training_period = "2000–2019 (selection) → refitted 2000–2024"

        return FutureResponse(
            target=target,
            unit=unit,
            label=label,
            model_name=winner_name,
            training_period=training_period,
            test_rmse=round(test_rmse, 4),
            selected_year=year,
            selected_value=round(sel_val, 4),
            selected_lower=round(sel_lower, 4),
            selected_upper=round(sel_upper, 4),
            change_from_2024=change_from_2024,
            observed=observed,
            future=future_main,
            linear_future=future_linear,
            poly_future=future_poly,
            no_trend_note=no_trend_note,
            fallback_note=fallback_note,
            milestones=milestones,
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(exc)}")
