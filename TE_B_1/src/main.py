"""Version 1.1: read and preprocess example emissions factor data."""

import csv
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "emission_factors.csv"


def load_factors(file_path=DATA_PATH):
    """Load nonnegative example kg CO2 per passenger-km values from CSV."""
    factors = {}
    with open(file_path, newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            mode = row["mode"].strip().lower()
            factor = float(row["kg_co2_per_passenger_km"])
            if not mode or factor < 0:
                raise ValueError("Invalid emissions factor row.")
            factors[mode] = factor
    if not factors:
        raise ValueError("Emissions factors file is empty.")
    return factors


def estimate_car_emissions(distance_km, factors):
    if distance_km <= 0:
        raise ValueError("Distance must be greater than zero.")
    return distance_km * factors["car"]


def main():
    try:
        distance = float(input("Enter travel distance (km): "))
        emission = estimate_car_emissions(distance, load_factors())
        print(f"Estimated car CO2 emissions: {emission:.3f} kg")
        print("Note: CSV factors are illustrative, not official measurements.")
    except (ValueError, KeyError, OSError) as error:
        print(f"Unable to calculate: {error}")


if __name__ == "__main__":
    main()
