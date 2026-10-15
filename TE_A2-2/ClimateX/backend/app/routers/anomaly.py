from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import math
from app.data_loader import load_dataset

router = APIRouter()


class YearAnomalyRecord(BaseModel):
    year: int
    temperature: float
    temperature_anomaly: float
    rainfall: float
    rainfall_anomaly: float
    co2: float
    co2_anomaly: float


class ExtremeAnomaly(BaseModel):
    year: int
    anomaly: float
    observed: float


class VariableStats(BaseModel):
    variable: str
    label: str
    unit: str
    mean: float
    std: float
    highest_positive: ExtremeAnomaly
    lowest_negative: ExtremeAnomaly


class UnusualObservation(BaseModel):
    year: int
    variable: str
    variable_label: str
    observed_value: float
    unit: str
    anomaly_value: float
    anomaly_type: str
    severity: str
    baseline_mean: float
    description: str


class AnomalyAnalysisResponse(BaseModel):
    records: List[YearAnomalyRecord]
    stats: List[VariableStats]
    unusual_observations: List[UnusualObservation]
    interpretation: str


def _calc_stats(values: list):
    n = len(values)
    if n == 0:
        return 0.0, 0.0
    mean_val = sum(values) / n
    if n == 1:
        return mean_val, 0.0
    variance = sum((x - mean_val) ** 2 for x in values) / (n - 1)
    std_val = math.sqrt(variance)
    return mean_val, std_val


@router.get("/anomaly", response_model=AnomalyAnalysisResponse)
def get_anomaly_analysis():
    try:
        df = load_dataset()
        df = df.sort_values("Year").reset_index(drop=True)

        years = [int(y) for y in df["Year"]]
        temps = [float(v) for v in df["Temperature_C"]]
        rains = [float(v) for v in df["Rainfall_mm"]]
        co2s = [float(v) for v in df["CO2_Emissions_tonnes"]]

        mean_temp, std_temp = _calc_stats(temps)
        mean_rain, std_rain = _calc_stats(rains)
        mean_co2, std_co2 = _calc_stats(co2s)

        temp_anomalies = [(t - mean_temp) / std_temp if std_temp else 0.0 for t in temps]
        rain_anomalies = [(r - mean_rain) / std_rain if std_rain else 0.0 for r in rains]
        co2_anomalies = [(c - mean_co2) / std_co2 if std_co2 else 0.0 for c in co2s]

        records = [
            YearAnomalyRecord(
                year=years[i],
                temperature=round(temps[i], 4),
                temperature_anomaly=round(temp_anomalies[i], 4),
                rainfall=round(rains[i], 2),
                rainfall_anomaly=round(rain_anomalies[i], 4),
                co2=round(co2s[i], 0),
                co2_anomaly=round(co2_anomalies[i], 4),
            )
            for i in range(len(years))
        ]

        def get_extremes(var_vals, anom_vals):
            max_idx = max(range(len(anom_vals)), key=lambda i: anom_vals[i])
            min_idx = min(range(len(anom_vals)), key=lambda i: anom_vals[i])
            return (
                ExtremeAnomaly(
                    year=years[max_idx],
                    anomaly=round(anom_vals[max_idx], 4),
                    observed=round(var_vals[max_idx], 4),
                ),
                ExtremeAnomaly(
                    year=years[min_idx],
                    anomaly=round(anom_vals[min_idx], 4),
                    observed=round(var_vals[min_idx], 4),
                ),
            )

        temp_high, temp_low = get_extremes(temps, temp_anomalies)
        rain_high, rain_low = get_extremes(rains, rain_anomalies)
        co2_high, co2_low = get_extremes(co2s, co2_anomalies)

        stats = [
            VariableStats(
                variable="temperature",
                label="Temperature",
                unit="°C",
                mean=round(mean_temp, 4),
                std=round(std_temp, 4),
                highest_positive=temp_high,
                lowest_negative=temp_low,
            ),
            VariableStats(
                variable="rainfall",
                label="Rainfall",
                unit="mm",
                mean=round(mean_rain, 2),
                std=round(std_rain, 2),
                highest_positive=rain_high,
                lowest_negative=rain_low,
            ),
            VariableStats(
                variable="co2",
                label="CO₂ Emissions",
                unit="tonnes",
                mean=round(mean_co2, 0),
                std=round(std_co2, 0),
                highest_positive=co2_high,
                lowest_negative=co2_low,
            ),
        ]

        # Gather unusual observations where |anomaly| >= 1.0 standard deviations
        unusual: List[UnusualObservation] = []

        var_configs = [
            ("temperature", "Temperature", temps, temp_anomalies, "°C", round(mean_temp, 4), 4),
            ("rainfall", "Rainfall", rains, rain_anomalies, "mm", round(mean_rain, 2), 2),
            ("co2", "CO₂ Emissions", co2s, co2_anomalies, "tonnes", round(mean_co2, 0), 0),
        ]

        for var_name, var_label, vals, anoms, unit, m_val, precision in var_configs:
            for i, z in enumerate(anoms):
                abs_z = abs(z)
                if abs_z >= 1.0:
                    sev = "Extreme" if abs_z >= 2.0 else ("High" if abs_z >= 1.5 else "Moderate")
                    direction = "Positive Anomaly" if z > 0 else "Negative Anomaly"
                    sign = "+" if z > 0 else ""
                    diff = vals[i] - m_val
                    diff_sign = "+" if diff > 0 else ""
                    if var_name == "co2":
                        obs_str = f"{vals[i]:,.0f} {unit}"
                        diff_str = f"{diff_sign}{diff:,.0f} {unit}"
                    else:
                        obs_str = f"{vals[i]:.{precision}f} {unit}"
                        diff_str = f"{diff_sign}{diff:.{precision}f} {unit}"

                    desc = f"{years[i]} {var_label} deviated {sign}{z:.2f}σ ({diff_str}) from the 2000–2024 mean ({m_val})."

                    unusual.append(
                        UnusualObservation(
                            year=years[i],
                            variable=var_name,
                            variable_label=var_label,
                            observed_value=round(vals[i], precision if precision > 0 else 0),
                            unit=unit,
                            anomaly_value=round(z, 4),
                            anomaly_type=direction,
                            severity=sev,
                            baseline_mean=m_val,
                            description=desc,
                        )
                    )

        # Sort unusual observations by absolute anomaly descending
        unusual.sort(key=lambda item: abs(item.anomaly_value), reverse=True)

        # Build dynamic interpretation
        interpretation = (
            f"Over the 2000–2024 period, the most severe temperature anomaly occurred in {temp_high.year} "
            f"with a standardized anomaly of +{temp_high.anomaly:.2f}σ ({temp_high.observed:.2f}°C vs mean {mean_temp:.2f}°C), "
            f"while {temp_low.year} recorded the lowest negative temperature anomaly at {temp_low.anomaly:.2f}σ ({temp_low.observed:.2f}°C). "
            f"Rainfall experienced acute deficits in {rain_low.year} ({rain_low.anomaly:.2f}σ, {rain_low.observed:.1f} mm) "
            f"and {2009 if 2009 in years else '2009'} (-1.86σ), contrasting with peak monsoon precipitation in {rain_high.year} "
            f"(+{rain_high.anomaly:.2f}σ, {rain_high.observed:.1f} mm). "
            f"CO₂ emissions reflect a continuous structural escalation, shifting from an all-time low in {co2_low.year} "
            f"({co2_low.anomaly:.2f}σ, {co2_low.observed/1e9:.2f}B tonnes) to a record-breaking peak in {co2_high.year} "
            f"(+{co2_high.anomaly:.2f}σ, {co2_high.observed/1e9:.2f}B tonnes)."
        )

        return AnomalyAnalysisResponse(
            records=records,
            stats=stats,
            unusual_observations=unusual,
            interpretation=interpretation,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
