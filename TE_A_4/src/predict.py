import json
import sys
import joblib
import numpy as np


MODEL_PATH = "results/best_model.joblib"
METADATA_PATH = "results/model_metadata.json"


def validate_features(values):

    if len(values) != 30:
        raise ValueError(
            "Exactly 30 feature values are required."
        )

    try:
        numeric_values = [
            float(value)
            for value in values
        ]

    except ValueError:
        raise ValueError(
            "All feature values must be numeric."
        )

    array = np.array(
        numeric_values,
        dtype=float
    )

    if not np.all(np.isfinite(array)):
        raise ValueError(
            "Feature values must be finite numbers."
        )

    return array.reshape(1, -1)


def main():

    if len(sys.argv) != 31:
        print(
            "Usage: py src\\predict.py "
            "<30 feature values>"
        )
        sys.exit(1)

    values = sys.argv[1:]

    try:
        features = validate_features(values)

    except ValueError as error:
        print("Input Error:", error)
        sys.exit(1)

    # Load model
    model = joblib.load(MODEL_PATH)

    # Load metadata
    with open(
        METADATA_PATH,
        "r"
    ) as file:

        metadata = json.load(file)

    threshold = metadata["threshold"]

    # Prediction probability
    probability = model.predict_proba(
        features
    )[0, 1]

    prediction = int(
        probability >= threshold
    )

    print("\n===== FRAUD PREDICTION =====")
    print(
        f"Fraud probability: {probability:.4f}"
    )

    print(
        f"Decision threshold: {threshold:.2f}"
    )

    if prediction == 1:
        print("Prediction: FRAUD")
    else:
        print("Prediction: LEGITIMATE")


if __name__ == "__main__":
    main()