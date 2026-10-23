import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
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


def build_models():

    models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000,
            random_state=RANDOM_STATE
        ),

        "Decision Tree": DecisionTreeClassifier(
            random_state=RANDOM_STATE
        ),

        "Random Forest": RandomForestClassifier(
            n_estimators=100,
            random_state=RANDOM_STATE,
            n_jobs=-1
        )
    }

    return models


def build_pipeline(model_name, use_smote):

    models = build_models()
    model = models[model_name]

    steps = []

    if model_name == "Logistic Regression":
        steps.append(("scaler", StandardScaler()))

    if use_smote:
        steps.append(
            ("smote", SMOTE(random_state=RANDOM_STATE))
        )

    steps.append(("model", model))

    return Pipeline(steps)


def calculate_metrics(y_true, y_pred, y_prob):

    return {
        "Accuracy": accuracy_score(y_true, y_pred),
        "Precision": precision_score(
            y_true,
            y_pred,
            zero_division=0
        ),
        "Recall": recall_score(
            y_true,
            y_pred,
            zero_division=0
        ),
        "F1": f1_score(
            y_true,
            y_pred,
            zero_division=0
        ),
        "PR_AUC": average_precision_score(
            y_true,
            y_prob
        )
    }


def main():

    # =========================================================
    # 1. Load dataset
    # =========================================================

    df = pd.read_csv(DATA_PATH)

    X = df.drop("Class", axis=1)
    y = df["Class"]

    feature_columns = X.columns.tolist()

    # =========================================================
    # 2. Stratified train/test split
    # =========================================================

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        stratify=y,
        random_state=RANDOM_STATE
    )

    # =========================================================
    # 3. Train/validation split
    # =========================================================

    X_train_sub, X_validation, y_train_sub, y_validation = train_test_split(
        X_train,
        y_train,
        test_size=0.20,
        stratify=y_train,
        random_state=RANDOM_STATE
    )

    print("Training samples    :", len(X_train_sub))
    print("Validation samples  :", len(X_validation))
    print("Test samples        :", len(X_test))

    # =========================================================
    # 4. Compare six models on validation set
    # =========================================================

    configurations = [
        ("Logistic Regression", False),
        ("Logistic Regression", True),
        ("Decision Tree", False),
        ("Decision Tree", True),
        ("Random Forest", False),
        ("Random Forest", True)
    ]

    validation_results = []
    validation_probabilities = {}

    print("\n===== VALIDATION MODEL COMPARISON =====")

    for model_name, use_smote in configurations:

        smote_text = "With SMOTE" if use_smote else "Without SMOTE"
        configuration_name = f"{model_name} - {smote_text}"

        print(f"\nTraining: {configuration_name}")

        pipeline = build_pipeline(
            model_name,
            use_smote
        )

        pipeline.fit(
            X_train_sub,
            y_train_sub
        )

        validation_prob = pipeline.predict_proba(
            X_validation
        )[:, 1]

        validation_pred = (
            validation_prob >= 0.5
        ).astype(int)

        metrics = calculate_metrics(
            y_validation,
            validation_pred,
            validation_prob
        )

        validation_results.append({
            "Model": configuration_name,
            **metrics
        })

        validation_probabilities[
            configuration_name
        ] = validation_prob

    validation_df = pd.DataFrame(
        validation_results
    )

    validation_df = validation_df.sort_values(
        by=["PR_AUC", "F1"],
        ascending=False
    )

    validation_df.to_csv(
        "results/v1_3_validation_comparison.csv",
        index=False
    )

    # =========================================================
    # 5. Programmatic model selection
    # =========================================================

    best_row = validation_df.iloc[0]

    best_model_name = best_row["Model"]

    print("\n===== SELECTED MODEL =====")
    print("Model :", best_model_name)
    print("PR-AUC:", f"{best_row['PR_AUC']:.4f}")
    print("F1    :", f"{best_row['F1']:.4f}")

    # =========================================================
    # 6. Precision-Recall curves
    # =========================================================

    plt.figure(figsize=(8, 6))

    for configuration_name, probabilities in validation_probabilities.items():

        precision_values, recall_values, _ = precision_recall_curve(
            y_validation,
            probabilities
        )

        pr_auc = average_precision_score(
            y_validation,
            probabilities
        )

        plt.plot(
            recall_values,
            precision_values,
            label=f"{configuration_name} (AP={pr_auc:.3f})"
        )

    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("V1.3 Precision-Recall Curves")
    plt.legend(fontsize=8)
    plt.grid(True)
    plt.tight_layout()

    plt.savefig(
        "results/v1_3_pr_curves.png",
        dpi=300
    )

    plt.close()

    # =========================================================
    # 7. Build selected model again using full training data
    # =========================================================

    if " - With SMOTE" in best_model_name:
        selected_model_name = best_model_name.replace(
            " - With SMOTE",
            ""
        )
        selected_use_smote = True

    else:
        selected_model_name = best_model_name.replace(
            " - Without SMOTE",
            ""
        )
        selected_use_smote = False

    final_pipeline = build_pipeline(
        selected_model_name,
        selected_use_smote
    )

    final_pipeline.fit(
        X_train,
        y_train
    )

    # =========================================================
    # 8. Test set predictions
    # =========================================================

    test_probabilities = final_pipeline.predict_proba(
        X_test
    )[:, 1]

    # Default threshold
    default_threshold = 0.50

    test_predictions_default = (
        test_probabilities >= default_threshold
    ).astype(int)

    default_metrics = calculate_metrics(
        y_test,
        test_predictions_default,
        test_probabilities
    )

    # =========================================================
    # 9. Threshold analysis on validation set
    # =========================================================

    selected_validation_probabilities = validation_probabilities[
        best_model_name
    ]

    thresholds = np.arange(
        0.10,
        0.91,
        0.05
    )

    threshold_rows = []

    for threshold in thresholds:

        validation_predictions = (
            selected_validation_probabilities >= threshold
        ).astype(int)

        threshold_precision = precision_score(
            y_validation,
            validation_predictions,
            zero_division=0
        )

        threshold_recall = recall_score(
            y_validation,
            validation_predictions,
            zero_division=0
        )

        threshold_f1 = f1_score(
            y_validation,
            validation_predictions,
            zero_division=0
        )

        threshold_rows.append({
            "Threshold": threshold,
            "Precision": threshold_precision,
            "Recall": threshold_recall,
            "F1": threshold_f1
        })

    threshold_df = pd.DataFrame(
        threshold_rows
    )

    threshold_df.to_csv(
        "results/v1_3_threshold_analysis.csv",
        index=False
    )

    # Best threshold based on validation F1
    best_threshold_row = threshold_df.loc[
        threshold_df["F1"].idxmax()
    ]

    best_threshold = float(
        best_threshold_row["Threshold"]
    )

    print("\n===== SELECTED THRESHOLD =====")
    print(
        "Threshold:",
        f"{best_threshold:.2f}"
    )
    print(
        "Validation F1:",
        f"{best_threshold_row['F1']:.4f}"
    )

    # =========================================================
    # 10. Plot threshold analysis
    # =========================================================

    plt.figure(figsize=(8, 6))

    plt.plot(
        threshold_df["Threshold"],
        threshold_df["Precision"],
        marker="o",
        label="Precision"
    )

    plt.plot(
        threshold_df["Threshold"],
        threshold_df["Recall"],
        marker="o",
        label="Recall"
    )

    plt.plot(
        threshold_df["Threshold"],
        threshold_df["F1"],
        marker="o",
        label="F1-score"
    )

    plt.xlabel("Classification Threshold")
    plt.ylabel("Score")
    plt.title("V1.3 Threshold Analysis")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()

    plt.savefig(
        "results/v1_3_threshold_analysis.png",
        dpi=300
    )

    plt.close()

    # =========================================================
    # 11. Final test predictions using selected threshold
    # =========================================================

    final_test_predictions = (
        test_probabilities >= best_threshold
    ).astype(int)

    final_metrics = calculate_metrics(
        y_test,
        final_test_predictions,
        test_probabilities
    )

    print("\n===== FINAL TEST RESULTS =====")
    print("Selected model:", best_model_name)

    for metric_name, value in final_metrics.items():
        print(
            f"{metric_name}: {value:.4f}"
        )

    # =========================================================
    # 12. Save final metrics
    # =========================================================

    final_results = pd.DataFrame([{
        "Model": best_model_name,
        "Threshold": best_threshold,
        **final_metrics
    }])

    final_results.to_csv(
        "results/v1_3_final_metrics.csv",
        index=False
    )

    # =========================================================
    # 13. Save final confusion matrix
    # =========================================================

    final_cm = confusion_matrix(
        y_test,
        final_test_predictions
    )

    print("\nFinal Confusion Matrix:")
    print(final_cm)

    display = ConfusionMatrixDisplay(
        confusion_matrix=final_cm,
        display_labels=["Legitimate", "Fraud"]
    )

    display.plot()

    plt.title(
        "V1.3 Selected Model - Confusion Matrix"
    )

    plt.tight_layout()

    plt.savefig(
        "results/v1_3_confusion_matrix.png",
        dpi=300
    )

    plt.close()

    # =========================================================
    # 14. Save selected model
    # =========================================================

    joblib.dump(
        final_pipeline,
        "results/best_model.joblib"
    )

    # =========================================================
    # 15. Save model metadata
    # =========================================================

    metadata = {
        "model": best_model_name,
        "threshold": best_threshold,
        "random_state": RANDOM_STATE,
        "feature_columns": feature_columns
    }

    with open(
        "results/model_metadata.json",
        "w"
    ) as file:

        json.dump(
            metadata,
            file,
            indent=4
        )

    print("\nV1.3 files saved successfully.")


if __name__ == "__main__":
    main()