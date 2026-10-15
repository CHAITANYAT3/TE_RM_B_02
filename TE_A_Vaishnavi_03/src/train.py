from pathlib import Path

import joblib
from sklearn.model_selection import cross_val_score, train_test_split

from src.models import get_models
from src.preprocess import load_config, load_data, preprocess_data


def main():
    config = load_config()

    # Load and preprocess the dataset
    df = load_data(config)
    X, y = preprocess_data(df, config)

    # Split the data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=config["test_size"],
        random_state=config["seed"],
        stratify=y,
    )

    print("Dataset information")
    print("=" * 60)
    print(f"Total samples: {len(X)}")
    print(f"Training samples: {len(X_train)}")
    print(f"Testing samples: {len(X_test)}")
    print(f"Number of features: {X.shape[1]}")
    print()

    # Create the models
    models = get_models(config["seed"])

    results = {}

    print("5-Fold Cross-Validation Results")
    print("=" * 60)

    # Compare all four models using F1 score
    for name, model in models.items():

        scores = cross_val_score(
            model,
            X_train,
            y_train,
            cv=config["cv_folds"],
            scoring="f1",
        )

        mean_score = scores.mean()
        std_score = scores.std()

        results[name] = mean_score

        print(
            f"{name}: "
            f"F1 = {mean_score:.4f} "
            f"+/- {std_score:.4f}"
        )

    # Select the model with the highest mean F1 score
    best_model_name = max(results, key=results.get)

    print()
    print("=" * 60)
    print(f"Selected model: {best_model_name}")
    print("=" * 60)

    # Train the selected model on the complete training set
    best_model = models[best_model_name]
    best_model.fit(X_train, y_train)

    # Create the results directory if it doesn't exist
    results_dir = Path(config["results_dir"])
    results_dir.mkdir(exist_ok=True)

    # Save the trained model and feature information
    model_path = results_dir / "model.joblib"

    joblib.dump(
        {
            "model": best_model,
            "features": list(X.columns),
            "target": config["target"],
            "test_data": {
                "X_test": X_test,
                "y_test": y_test,
            },
        },
        model_path,
    )

    print(f"Saved trained model to: {model_path}")


if __name__ == "__main__":
    main()