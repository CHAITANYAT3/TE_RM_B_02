import pandas as pd
from pathlib import Path

DATASET_PATH = Path(__file__).parent.parent / "data" / "india_climate_2000_2024_exp5.csv"

REQUIRED_COLUMNS = ["Year", "Temperature_C", "Rainfall_mm", "CO2_Emissions_tonnes"]


def load_dataset() -> pd.DataFrame:
    """Load and validate the India climate dataset."""
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at: {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)

    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")

    return df


def get_dataset_summary(df: pd.DataFrame) -> dict:
    """Return summary statistics from the dataset."""
    return {
        "observation_count": len(df),
        "start_year": int(df["Year"].min()),
        "end_year": int(df["Year"].max()),
        "column_names": list(df.columns),
        "average_temperature": round(float(df["Temperature_C"].mean()), 4),
        "average_rainfall": round(float(df["Rainfall_mm"].mean()), 2),
        "average_co2": round(float(df["CO2_Emissions_tonnes"].mean()), 0),
    }
