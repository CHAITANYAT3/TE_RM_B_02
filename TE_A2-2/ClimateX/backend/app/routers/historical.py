from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.data_loader import load_dataset

router = APIRouter()


class YearRecord(BaseModel):
    year: int
    temperature: float
    rainfall: float
    co2: float


class CorrelationPair(BaseModel):
    label: str
    coefficient: float
    interpretation: str


class HistoricalData(BaseModel):
    records: List[YearRecord]
    mean_temperature: float
    mean_rainfall: float
    mean_co2: float
    correlations: List[CorrelationPair]
    trend_summary: str
    temp_trend: str
    rainfall_pattern: str
    co2_trend: str


def _pearson(x: list, y: list) -> float:
    n = len(x)
    if n < 2:
        return 0.0
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    num = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
    den_x = (sum((xi - mean_x) ** 2 for xi in x)) ** 0.5
    den_y = (sum((yi - mean_y) ** 2 for yi in y)) ** 0.5
    if den_x == 0 or den_y == 0:
        return 0.0
    return round(num / (den_x * den_y), 4)


def _corr_label(r: float) -> str:
    a = abs(r)
    direction = "positive" if r >= 0 else "negative"
    if a >= 0.8:
        strength = "Strong"
    elif a >= 0.5:
        strength = "Moderate"
    elif a >= 0.2:
        strength = "Weak"
    else:
        strength = "Negligible"
    return f"{strength} {direction}"


def _linear_slope(values: list) -> float:
    """Simple linear regression slope over index."""
    n = len(values)
    idx = list(range(n))
    mean_i = (n - 1) / 2
    mean_v = sum(values) / n
    num = sum((i - mean_i) * (v - mean_v) for i, v in zip(idx, values))
    den = sum((i - mean_i) ** 2 for i in idx)
    return num / den if den != 0 else 0.0


@router.get("/historical", response_model=HistoricalData)
def get_historical():
    try:
        df = load_dataset()
        df = df.sort_values("Year").reset_index(drop=True)

        records = [
            YearRecord(
                year=int(row["Year"]),
                temperature=round(float(row["Temperature_C"]), 4),
                rainfall=round(float(row["Rainfall_mm"]), 2),
                co2=round(float(row["CO2_Emissions_tonnes"]), 0),
            )
            for _, row in df.iterrows()
        ]

        temps = [r.temperature for r in records]
        rains = [r.rainfall for r in records]
        co2s = [r.co2 for r in records]

        mean_temp = round(sum(temps) / len(temps), 4)
        mean_rain = round(sum(rains) / len(rains), 2)
        mean_co2 = round(sum(co2s) / len(co2s), 0)

        r_temp_rain = _pearson(temps, rains)
        r_temp_co2 = _pearson(temps, co2s)
        r_rain_co2 = _pearson(rains, co2s)

        correlations = [
            CorrelationPair(
                label="Temperature vs Rainfall",
                coefficient=r_temp_rain,
                interpretation=_corr_label(r_temp_rain),
            ),
            CorrelationPair(
                label="Temperature vs CO₂",
                coefficient=r_temp_co2,
                interpretation=_corr_label(r_temp_co2),
            ),
            CorrelationPair(
                label="Rainfall vs CO₂",
                coefficient=r_rain_co2,
                interpretation=_corr_label(r_rain_co2),
            ),
        ]

        # Auto-generate trend direction text
        temp_slope = _linear_slope(temps)
        rain_slope = _linear_slope(rains)
        co2_slope = _linear_slope(co2s)

        temp_trend = "rising" if temp_slope > 0.01 else ("falling" if temp_slope < -0.01 else "stable")
        rainfall_pattern = "increasing" if rain_slope > 0.5 else ("decreasing" if rain_slope < -0.5 else "variable")
        co2_trend = "rising sharply" if co2_slope > 50_000_000 else ("rising" if co2_slope > 0 else "declining")

        all_corrs = [("Temp vs Rain", r_temp_rain), ("Temp vs CO₂", r_temp_co2), ("Rain vs CO₂", r_rain_co2)]
        strongest = max(all_corrs, key=lambda x: abs(x[1]))
        weakest = min(all_corrs, key=lambda x: abs(x[1]))

        trend_summary = (
            f"India's temperature shows a {temp_trend} trend over 2000–2024 "
            f"(slope: {temp_slope:+.3f}°C/yr). Rainfall has been {rainfall_pattern}. "
            f"CO₂ emissions are {co2_trend}. "
            f"The strongest correlation is between {strongest[0]} (r={strongest[1]:.3f}), "
            f"while {weakest[0]} shows the weakest relationship (r={weakest[1]:.3f})."
        )

        return HistoricalData(
            records=records,
            mean_temperature=mean_temp,
            mean_rainfall=mean_rain,
            mean_co2=mean_co2,
            correlations=correlations,
            trend_summary=trend_summary,
            temp_trend=temp_trend,
            rainfall_pattern=rainfall_pattern,
            co2_trend=co2_trend,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
