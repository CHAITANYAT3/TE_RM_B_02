"""Future Temperature Prediction Router for ClimateX.

Generates model-based estimates for future years (2025–2040)
using the best-performing parametric models (Polynomial Regression degree 2, Linear Regression)
trained on historical data.

IMPORTANT MODEL RULE:
Tree-based models (Random Forest, Gradient Boosting) are excluded from future extrapolation
because decision tree partitioning produces flat horizontal step functions outside
training bounds. Continuous parametric regressors (Polynomial/Linear) are mathematically
sound for extrapolating warming trends.
"""

from typing import Dict, List, Optional
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures

from app.data_loader import load_dataset

router = APIRouter(prefix="/prediction", tags=["Future Prediction"])


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class TrendPoint(BaseModel):
    year: int
    temperature: float
    status: str  # "Historical" or "Estimated"


class FuturePredictionResponse(BaseModel):
    parameter: str
    input_feature: str
    selected_year: int
    estimated_temperature: float
    model_used: str
    training_period: str
    temperature_change_from_2000: float
    temperature_change_from_2024: float
    historical_data: List[TrendPoint]
    future_series: List[TrendPoint]
    all_model_estimates: Dict[str, float]
    extrapolation_rationale: str
    scientific_disclaimer: str


# ─── Model Cache / Estimators ────────────────────────────────────────────────

def _fit_models():
    """Fits Polynomial and Linear models on historical data."""
    df = load_dataset()
    df = df.sort_values("Year").reset_index(drop=True)

    # Historical data points (2000–2024)
    hist_points = [
        TrendPoint(
            year=int(row["Year"]),
            temperature=round(float(row["Temperature_C"]), 4),
            status="Historical",
        )
        for _, row in df.iterrows()
    ]

    # Train on validated 2000–2019 baseline (consistent with ML model comparison)
    train_df = df[(df["Year"] >= 2000) & (df["Year"] <= 2019)].copy()
    X_train = train_df[["Year"]]
    y_train = train_df["Temperature_C"]

    # Model 1: Polynomial Regression (degree 2) - Best validation model (RMSE: 0.1789)
    poly_model = make_pipeline(
        PolynomialFeatures(degree=2, include_bias=False),
        LinearRegression(),
    )
    poly_model.fit(X_train, y_train)

    # Model 2: Linear Regression - Runner-up validation model (RMSE: 0.1791)
    linear_model = LinearRegression()
    linear_model.fit(X_train, y_train)

    return df, hist_points, poly_model, linear_model


@router.get("/temperature", response_model=FuturePredictionResponse)
def predict_temperature(
    year: int = Query(default=2030, ge=2025, le=2040, description="Target future year (2025-2040)"),
    model_type: Optional[str] = Query(default="polynomial", description="Model: 'polynomial' or 'linear'"),
):
    try:
        df, hist_points, poly_model, linear_model = _fit_models()

        # Generate predictions for the specific requested year
        input_year_df = pd.DataFrame({"Year": [year]})
        poly_pred = float(poly_model.predict(input_year_df)[0])
        linear_pred = float(linear_model.predict(input_year_df)[0])

        all_estimates = {
            "Polynomial Regression (degree 2)": round(poly_pred, 4),
            "Linear Regression": round(linear_pred, 4),
        }

        if model_type and model_type.lower() == "linear":
            chosen_model_name = "Linear Regression"
            chosen_pred = linear_pred
        else:
            chosen_model_name = "Polynomial Regression (degree 2)"
            chosen_pred = poly_pred

        # Generate future series from 2025 through 2040
        future_years = list(range(2025, 2041))
        future_years_df = pd.DataFrame({"Year": future_years})
        active_model = linear_model if (model_type and model_type.lower() == "linear") else poly_model
        future_preds = active_model.predict(future_years_df)

        future_series = [
            TrendPoint(
                year=yr,
                temperature=round(float(p), 4),
                status="Estimated",
            )
            for yr, p in zip(future_years, future_preds)
        ]

        temp_2000 = float(df[df["Year"] == 2000]["Temperature_C"].values[0])
        temp_2024 = float(df[df["Year"] == 2024]["Temperature_C"].values[0])

        change_from_2000 = round(chosen_pred - temp_2000, 4)
        change_from_2024 = round(chosen_pred - temp_2024, 4)

        extrapolation_rationale = (
            "Tree-based models (Random Forest and Gradient Boosting) partition feature space "
            "into orthogonal leaves and cannot extrapolate trends beyond the boundary of training data "
            "(they produce a constant flat prediction). Polynomial Regression (degree 2) was the best-performing "
            "model in chronological validation (RMSE 0.1789°C) and is parametric, allowing it to smoothly "
            "extrapolate the underlying warming trajectory into 2025–2040."
        )

        scientific_disclaimer = (
            "Future values are model-based estimates derived from historical data "
            "and should not be interpreted as exact climate forecasts."
        )

        return FuturePredictionResponse(
            parameter="Temperature",
            input_feature="Year",
            selected_year=year,
            estimated_temperature=round(chosen_pred, 4),
            model_used=chosen_model_name,
            training_period="2000–2019 (Validated Model Baseline)",
            temperature_change_from_2000=change_from_2000,
            temperature_change_from_2024=change_from_2024,
            historical_data=hist_points,
            future_series=future_series,
            all_model_estimates=all_estimates,
            extrapolation_rationale=extrapolation_rationale,
            scientific_disclaimer=scientific_disclaimer,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
