"""What-If Climate Scenarios Router for ClimateX.

Allows exploratory assessment of hypothetical climate scenarios using empirical
multivariate regression relationships fitted on the historical 2000–2024 dataset.

SCIENTIFIC SAFETY:
- Results are strictly labeled as 'Hypothetical Scenario'.
- Statistical correlation does NOT imply causation.
- Calculations are exploratory estimates derived from historical observational data,
  not deterministic or coupled general circulation climate models (GCMs).
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression
import pandas as pd

from app.data_loader import load_dataset

router = APIRouter(prefix="/scenarios", tags=["What-If Scenarios"])


# ─── Pydantic Response Schemas ───────────────────────────────────────────────

class BaselineData(BaseModel):
    name: str
    year_or_period: str
    temperature: float
    co2_tonnes: float
    rainfall_mm: float


class ScenarioResult(BaseModel):
    co2_change_percent: float
    rainfall_change_percent: float
    scenario_co2_tonnes: float
    scenario_rainfall_mm: float
    estimated_temperature: float
    temperature_difference: float
    status: str  # "Hypothetical Scenario"


class ModelDetails(BaseModel):
    model_name: str
    intercept: float
    beta_co2: float
    beta_rainfall: float
    r2_score: float
    method_explanation: str


class WhatIfResponse(BaseModel):
    scenario_title: str
    baseline: BaselineData
    scenario: ScenarioResult
    model_details: ModelDetails
    scientific_disclaimer: str
    causation_warning: str


# ─── Model & Dataset Cache ───────────────────────────────────────────────────

def _fit_scenario_model():
    """Fits multiple linear regression: Temperature ~ CO2 + Rainfall."""
    df = load_dataset()
    df = df.sort_values("Year").reset_index(drop=True)

    X = df[["CO2_Emissions_tonnes", "Rainfall_mm"]]
    y = df["Temperature_C"]

    lr = LinearRegression().fit(X, y)
    r2 = float(lr.score(X, y))

    # Baseline: Latest observed year (2024)
    last_row = df.iloc[-1]
    base_2024 = {
        "name": "2024 Observed Baseline",
        "year_or_period": "2024",
        "temperature": round(float(last_row["Temperature_C"]), 4),
        "co2_tonnes": round(float(last_row["CO2_Emissions_tonnes"]), 0),
        "rainfall_mm": round(float(last_row["Rainfall_mm"]), 2),
    }

    return df, lr, r2, base_2024


@router.get("/what-if", response_model=WhatIfResponse)
def compute_what_if_scenario(
    co2_change: float = Query(
        default=0.0,
        ge=-100.0,
        le=200.0,
        description="Percentage change in CO2 emissions (-100% to +200%)",
    ),
    rainfall_change: float = Query(
        default=0.0,
        ge=-100.0,
        le=200.0,
        description="Percentage change in rainfall (-100% to +200%)",
    ),
):
    try:
        df, lr, r2, base_2024 = _fit_models_cached()

        base_co2 = base_2024["co2_tonnes"]
        base_rain = base_2024["rainfall_mm"]
        base_temp = base_2024["temperature"]

        # Calculate scenario inputs
        scen_co2 = base_co2 * (1.0 + (co2_change / 100.0))
        scen_rain = base_rain * (1.0 + (rainfall_change / 100.0))

        # Model predicted baseline vs predicted scenario
        # Delta = Beta_CO2 * Delta_CO2 + Beta_Rain * Delta_Rain
        beta_co2 = float(lr.coef_[0])
        beta_rain = float(lr.coef_[1])

        delta_co2 = scen_co2 - base_co2
        delta_rain = scen_rain - base_rain

        temp_delta = (beta_co2 * delta_co2) + (beta_rain * delta_rain)
        scen_temp = base_temp + temp_delta

        method_explanation = (
            "Estimated using Multiple Linear Regression fitted on the 2000–2024 India Climate dataset "
            f"(R² = {r2:.4f}). Temperature sensitivity: +{beta_co2 * 1e8:.4f}°C per 100M tonnes of CO₂. "
            "Empirically, annual monsoon precipitation exhibits weak direct linear correlation with annual national mean temperature (r = 0.0300), "
            "making greenhouse emissions the dominant statistical driver in the observational record."
        )

        scientific_disclaimer = (
            "Hypothetical Scenario: Future values and scenario adjustments are model-based exploratory estimates "
            "derived from observational correlations in the 2000–2024 dataset. They should not be interpreted as exact, "
            "authoritative climate forecasts or physical earth-system simulations."
        )

        causation_warning = (
            "Statistical correlation does not establish direct causation. Real climate feedback involves complex atmospheric, "
            "oceanic, and planetary dynamics not fully captured by simple linear regressions."
        )

        return WhatIfResponse(
            scenario_title=f"What-If: CO₂ {co2_change:+.1f}%, Rainfall {rainfall_change:+.1f}%",
            baseline=BaselineData(
                name=base_2024["name"],
                year_or_period=base_2024["year_or_period"],
                temperature=base_2024["temperature"],
                co2_tonnes=base_2024["co2_tonnes"],
                rainfall_mm=base_2024["rainfall_mm"],
            ),
            scenario=ScenarioResult(
                co2_change_percent=round(co2_change, 2),
                rainfall_change_percent=round(rainfall_change, 2),
                scenario_co2_tonnes=round(scen_co2, 0),
                scenario_rainfall_mm=round(scen_rain, 2),
                estimated_temperature=round(scen_temp, 4),
                temperature_difference=round(temp_delta, 4),
                status="Hypothetical Scenario",
            ),
            model_details=ModelDetails(
                model_name="Multivariate Observational Regression",
                intercept=round(float(lr.intercept_), 4),
                beta_co2=float(beta_co2),
                beta_rainfall=float(beta_rain),
                r2_score=round(r2, 4),
                method_explanation=method_explanation,
            ),
            scientific_disclaimer=scientific_disclaimer,
            causation_warning=causation_warning,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario error: {str(e)}")


def _fit_models_cached():
    return _fit_scenario_model()
