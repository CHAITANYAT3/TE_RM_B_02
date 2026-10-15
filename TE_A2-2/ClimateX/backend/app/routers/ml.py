from fastapi import APIRouter, HTTPException, Query
from app.ml_temperature import (
    TargetKey,
    TemperatureMLResponse,
    compute_ml_comparison,
    compute_temperature_ml_comparison,
)
from app.tft_module import TFTExperimentalResponse, compute_tft_experimental
from app.ml_results import MLResultsResponse, compute_ml_results

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.get("/results", response_model=MLResultsResponse)
def get_ml_results():
    """Train 6 models (Linear, Polynomial, RF, GB, XGBoost, TFT) for all three
    targets (Temperature, Rainfall, CO2) with a 2000–2019 train / 2020–2024
    test chronological split.

    Returns MAE, RMSE, R², rank (rank 1 = lowest RMSE), and the 2020–2024
    predictions for every target × model combination.  No winner is forced.
    """
    try:
        return compute_ml_results()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML results error: {str(e)}") from e


@router.get("/temperature", response_model=TemperatureMLResponse)
def get_temperature_ml_comparison():
    """Returns chronological ML model comparison metrics, best model,
    and actual vs predicted test values for annual Temperature prediction.

    Kept for backward compatibility – equivalent to ``GET /ml/metrics?target=temp``.
    """
    try:
        return compute_temperature_ml_comparison()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML comparison error: {str(e)}")


@router.get("/metrics", response_model=TemperatureMLResponse)
def get_ml_metrics(
    target: TargetKey = Query(
        default="temp",
        description=(
            "Climate variable to predict. "
            "``temp`` = Temperature_C (°C), "
            "``rain`` = Rainfall_mm (mm), "
            "``co2`` = CO2_Emissions_tonnes (tonnes)."
        ),
    ),
):
    """Returns chronological ML model comparison for the requested climate target.

    Five regression models are trained on 2000-2019 and evaluated on 2020-2024.
    The best model is selected by lowest RMSE. TFT results are included for
    ``target=temp`` only.
    """
    try:
        return compute_ml_comparison(target)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"ML metrics error for target '{target}': {str(e)}",
        )


@router.get("/tft", response_model=TFTExperimentalResponse)
def get_tft_experimental_analysis():
    """Returns experimental Temporal Fusion Transformer diagnostics and data sufficiency status."""
    try:
        return compute_tft_experimental()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TFT analysis error: {str(e)}")
