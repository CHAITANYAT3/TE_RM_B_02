import pandas as pd

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
    confusion_matrix
)

from imblearn.pipeline import Pipeline
from imblearn.over_sampling import SMOTE


RANDOM_STATE = 42
DATA_PATH = "data/creditcard.csv"


def evaluate_model(name, model, X_train, y_train, X_test, y_test):

    # Train
    model.fit(X_train, y_train)

    # Predictions
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

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

    cm = confusion_matrix(
        y_test,
        y_pred
    )

    print(f"\n{name}")
    print("-" * 60)
    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1-score : {f1:.4f}")
    print(f"PR-AUC   : {pr_auc:.4f}")
    print("Confusion Matrix:")
    print(cm)

    return {
        "Model": name,
        "Accuracy": accuracy,
        "Precision": precision,
        "Recall": recall,
        "F1": f1,
        "PR_AUC": pr_auc
    }


def main():

    # ---------------------------------------------------------
    # Load data
    # ---------------------------------------------------------

    df = pd.read_csv(DATA_PATH)

    X = df.drop("Class", axis=1)
    y = df["Class"]

    # ---------------------------------------------------------
    # Stratified train-test split
    # ---------------------------------------------------------

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        stratify=y,
        random_state=RANDOM_STATE
    )

    print("Training samples:", len(X_train))
    print("Testing samples :", len(X_test))

    # ---------------------------------------------------------
    # Models
    # ---------------------------------------------------------

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

    results = []

    # ---------------------------------------------------------
    # 1. Models WITHOUT SMOTE
    # ---------------------------------------------------------

    print("\n==============================")
    print("MODELS WITHOUT SMOTE")
    print("==============================")

    for model_name, model in models.items():

        # Logistic Regression needs scaling.
        if model_name == "Logistic Regression":

            pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("model", model)
            ])

        else:

            pipeline = model

        result = evaluate_model(
            f"{model_name} - Without SMOTE",
            pipeline,
            X_train,
            y_train,
            X_test,
            y_test
        )

        results.append(result)

    # ---------------------------------------------------------
    # 2. Models WITH SMOTE
    # ---------------------------------------------------------

    print("\n==============================")
    print("MODELS WITH SMOTE")
    print("==============================")

    for model_name, model in models.items():

        # Scaling is important before SMOTE for Logistic Regression.
        # Tree models do not require scaling, but SMOTE is still
        # performed only on the training data.
        if model_name == "Logistic Regression":

            pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("smote", SMOTE(random_state=RANDOM_STATE)),
                ("model", model)
            ])

        else:

            pipeline = Pipeline([
                ("smote", SMOTE(random_state=RANDOM_STATE)),
                ("model", model)
            ])

        result = evaluate_model(
            f"{model_name} - With SMOTE",
            pipeline,
            X_train,
            y_train,
            X_test,
            y_test
        )

        results.append(result)

    # ---------------------------------------------------------
    # Save comparison table
    # ---------------------------------------------------------

    results_df = pd.DataFrame(results)

    results_df = results_df.sort_values(
        by="PR_AUC",
        ascending=False
    )

    results_df.to_csv(
        "results/v1_2_model_comparison.csv",
        index=False
    )

    # ---------------------------------------------------------
    # Programmatic best model selection
    # ---------------------------------------------------------

    best_model = results_df.iloc[0]

    print("\n==============================")
    print("BEST MODEL")
    print("==============================")

    print("Model   :", best_model["Model"])
    print("PR-AUC  :", f"{best_model['PR_AUC']:.4f}")
    print("F1-score:", f"{best_model['F1']:.4f}")

    # Save best model information
    best_model_df = pd.DataFrame([best_model])

    best_model_df.to_csv(
        "results/v1_2_best_model.csv",
        index=False
    )

    print("\nComparison saved to:")
    print("results/v1_2_model_comparison.csv")

    print("\nBest model saved to:")
    print("results/v1_2_best_model.csv")


if __name__ == "__main__":
    main()