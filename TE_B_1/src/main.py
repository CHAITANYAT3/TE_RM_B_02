"""Version 1.2: compare transport modes and identify illustrative savings."""

import csv
import math
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "emission_factors.csv"


def load_factors(file_path=DATA_PATH):
    factors = {}
    with open(file_path, newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            mode = row["mode"].strip().lower()
            factor = float(row["kg_co2_per_passenger_km"])
            if not mode or not math.isfinite(factor) or factor < 0:
                raise ValueError("Invalid emissions factor row.")
            factors[mode] = factor
    if not factors or "car" not in factors:
        raise ValueError("Factors must include at least a car entry.")
    return factors


def estimate_emissions(distance_km, factor):
    if not math.isfinite(distance_km) or distance_km <= 0:
        raise ValueError("Distance must be a positive finite number.")
    if not math.isfinite(factor) or factor < 0:
        raise ValueError("Factor must be a finite nonnegative number.")
    return distance_km * factor


def compare_modes(distance_km, factors):
    return {mode: estimate_emissions(distance_km, factor)
            for mode, factor in factors.items()}


def main():
    try:
        distance = float(input("Enter travel distance (km): "))
        comparison = compare_modes(distance, load_factors())
        print("\nEstimated CO2 emissions per passenger:")
        for mode, emission in sorted(comparison.items()):
            print(f"  {mode.title():8s}: {emission:.3f} kg CO2")
        lowest_mode = min(comparison, key=comparison.get)
        saving = comparison["car"] - comparison[lowest_mode]
        print(f"Lowest example: {lowest_mode.title()} | {saving:.3f} kg less than car")
        print("Note: Factors are illustrative, not official measurements.")
    except (ValueError, KeyError, OSError) as error:
        print(f"Unable to calculate: {error}")


if __name__ == "__main__":
    main()
