import argparse

import joblib
import pandas as pd


def main():
    parser = argparse.ArgumentParser(
        description="Predict Plaque from dermatological signs."
    )

    parser.add_argument(
        "--signs",
        required=True,
        help="Comma-separated signs, e.g. Papule,Erythema,Scale",
    )

    args = parser.parse_args()

    artifact = joblib.load("results/model.joblib")

    model = artifact["model"]
    features = artifact["features"]

    supplied_signs = {
        sign.strip()
        for sign in args.signs.split(",")
        if sign.strip()
    }

    input_data = pd.DataFrame(
        [
            {
                feature: int(feature in supplied_signs)
                for feature in features
            }
        ]
    )

    prediction = model.predict(input_data)[0]

    if prediction == 1:
        print("Predicted Plaque: PRESENT")
    else:
        print("Predicted Plaque: ABSENT")


if __name__ == "__main__":
    main()