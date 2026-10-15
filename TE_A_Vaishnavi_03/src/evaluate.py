import matplotlib
matplotlib.use("Agg")
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def main():
    model_path = Path("results/model.joblib")

    if not model_path.exists():
        raise FileNotFoundError(
            "Trained model not found. Run 'python -m src.train' first."
        )

    artifact = joblib.load(model_path)

    model = artifact["model"]
    X_test = artifact["test_data"]["X_test"]
    y_test = artifact["test_data"]["y_test"]

    # Generate predictions
    y_pred = model.predict(X_test)

    # Calculate evaluation metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)

    print("=" * 60)
    print("TEST SET EVALUATION")
    print("=" * 60)

    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1-score : {f1:.4f}")

    # ROC-AUC
    if hasattr(model, "predict_proba"):
        y_probability = model.predict_proba(X_test)[:, 1]
        roc_auc = roc_auc_score(y_test, y_probability)

        print(f"ROC-AUC  : {roc_auc:.4f}")

    print()
    print("Classification Report")
    print("=" * 60)
    print(classification_report(
        y_test,
        y_pred,
        target_names=["Plaque Absent", "Plaque Present"],
        zero_division=0,
    ))

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)

    print("Confusion Matrix")
    print("=" * 60)
    print(cm)

    # Save confusion matrix figure
    results_dir = Path("results")
    results_dir.mkdir(exist_ok=True)

    display = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=["Plaque Absent", "Plaque Present"],
    )

    display.plot()
    plt.title("Plaque Classification - Confusion Matrix")
    plt.tight_layout()

    figure_path = results_dir / "confusion_matrix.png"
    plt.savefig(figure_path, dpi=300)
    plt.close()

    print()
    print(f"Saved confusion matrix to: {figure_path}")


if __name__ == "__main__":
    main()