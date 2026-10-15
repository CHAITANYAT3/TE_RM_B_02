from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.data_loader import load_dataset, get_dataset_summary

router = APIRouter()


class DatasetSummary(BaseModel):
    observation_count: int
    start_year: int
    end_year: int
    column_names: List[str]
    average_temperature: float
    average_rainfall: float
    average_co2: float


@router.get("/dataset", response_model=DatasetSummary)
def get_dataset():
    """Return basic dataset information and summary statistics."""
    try:
        df = load_dataset()
        summary = get_dataset_summary(df)
        return DatasetSummary(**summary)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
