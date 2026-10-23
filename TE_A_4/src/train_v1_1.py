import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    average_precision_score,
    confusion_matrix,
    ConfusionMatrixDisplay,
    precision_recall_curve
)

from imblearn.pipeline import Pipeline
from imblearn.over_sampling import SMOTE


RANDOM_STATE = 42
DATA_PATH = "data/creditcard.csv"


def main():
    # Load dataset
    df = pd.read_csv(DATA_PATH)

    # Separate features and target
    X = df.drop("Class", axis=1)
    y = df["Class"]

    # ---------------------------------------------------------
    # IMPORTANT:
    # Split BEFORE scaling and SMOTE.
    # This prevents data leakage.
    # ---------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        stratify=y,
        random_state=RANDOM_STATE
    )

    print("Original training samples:", len(X_train))
    print("Original testing samples:", len(X_test))

    print("\nTraining class distribution before SMOTE:")
    print(y_train.value_counts())

    # ---------------------------------------------------------
    # Pipeline:
    # 1. StandardScaler is fitted only on training data.
    # 2. SMOTE is applied only to training data.
    # 3. Logistic Regression is trained on the transformed data.
    # ---------------------------------------------------------
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("smote", SMOTE(random_state=RANDOM_STATE)),
        (
            "model",
            LogisticRegression(
                max_iter=1000,
                random_state=RANDOM_STATE
            )
        )
    ])

    # Train
    pipeline.fit(X_train, y_train)

    print("\nV1.1 pipeline trained successfully.")

    # Predictions
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    # Metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(
        y_test,
        y_pred,
        zero_division=0
    )
    recall = recall_score(
        y_test,
        y_pred,
        zero_division=0
    )
    f1 = f1_score(
        y_test,
        y_pred,
        zero_division=0
    )
    pr_auc = average_precision_score(
        y_test,
        y_prob
    )

    print("\n===== V1.1 SMOTE RESULTS =====")
    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1-score : {f1:.4f}")
    print(f"PR-AUC   : {pr_auc:.4f}")

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)

    print("\nConfusion Matrix:")
    print(cm)

    # ---------------------------------------------------------
    # Save metrics
    # ---------------------------------------------------------
    results = pd.DataFrame({
        "Model": ["Logistic Regression + SMOTE"],
        "Accuracy": [accuracy],
        "Precision": [precision],
        "Recall": [recall],
        "F1": [f1],
        "PR_AUC": [pr_auc]
    })

    results.to_csv(
        "results/v1_1_metrics.csv",
        index=False
    )

    # ---------------------------------------------------------
    # Save confusion matrix
    # ---------------------------------------------------------
    display = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=["Legitimate", "Fraud"]
    )

    display.plot()
    plt.title(
        "V1.1 Logistic Regression + SMOTE - Confusion Matrix"
    )
    plt.tight_layout()

    plt.savefig(
        "results/v1_1_confusion_matrix.png",
        dpi=300
    )

    plt.close()

    # ---------------------------------------------------------
    # Save Precision-Recall curve
    # ---------------------------------------------------------
    precision_values, recall_values, _ = precision_recall_curve(
        y_test,
        y_prob
    )

    plt.figure(figsize=(7, 5))

    plt.plot(
        recall_values,
        precision_values,
        label=f"PR-AUC = {pr_auc:.4f}"
    )

    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title(
        "V1.1 Logistic Regression + SMOTE - Precision-Recall Curve"
    )

    plt.legend()
    plt.grid(True)
    plt.tight_layout()

    plt.savefig(
        "results/v1_1_pr_curve.png",
        dpi=300
    )

    plt.close()

    print("\nResults saved in the results/ folder.")


if __name__ == "__main__":
    main()