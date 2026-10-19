"""Version 1.0: basic travel CO2 estimator (illustrative factor)."""

CAR_KG_PER_KM = 0.192  # Example factor, kg CO2 per passenger-km


def estimate_car_emissions(distance_km):
    if distance_km <= 0:
        raise ValueError("Distance must be greater than zero.")
    return distance_km * CAR_KG_PER_KM


def main():
    try:
        distance = float(input("Enter travel distance (km): "))
        emission = estimate_car_emissions(distance)
        print(f"Estimated car CO2 emissions: {emission:.3f} kg")
        print("Note: Factor is illustrative, not an official measurement.")
    except ValueError as error:
        print(f"Invalid input: {error}")


if __name__ == "__main__":
    main()
