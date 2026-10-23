"""
Smart EV Charging Station Powered by Solar Energy
Experiment 7: prototype + reproducible ML baseline.
Run from project root: python src/prototype.py
"""
from pathlib import Path
import json
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "PV_EV_Charging_Dataset.csv"
RESULTS = ROOT / "results"
RESULTS.mkdir(exist_ok=True)

def main():
    df = pd.read_csv(DATA)
    target = "Optimal_Charging_Decision"
    if target not in df.columns:
        raise ValueError(f"Dataset must contain target column: {target}")
    X, y = df.drop(columns=[target]), df[target]
    numeric = X.select_dtypes(exclude="object").columns.tolist()
    categorical = X.select_dtypes(include="object").columns.tolist()
    preprocessing = ColumnTransformer([
        ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric),
        ("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore"))
        ]), categorical)
    ])
    pipeline = Pipeline([
        ("preprocessing", preprocessing),
        ("model", RandomForestClassifier(
            n_estimators=200, random_state=42, class_weight="balanced"
        ))
    ])
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    report = classification_report(y_test, predictions, zero_division=0)
    matrix = confusion_matrix(y_test, predictions)
    print("SMART SOLAR EV CHARGING - BASELINE RESULTS")
    print(f"Dataset rows: {len(df)}")
    print(f"Training rows: {len(X_train)} | Test rows: {len(X_test)}")
    print(f"Accuracy: {accuracy:.4f}")
    print("Confusion matrix:")
    print(matrix)
    print("Classification report:")
    print(report)
    output = {
        "rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "accuracy": float(accuracy),
        "confusion_matrix": matrix.tolist(),
        "classification_report": report
    }
    (RESULTS / "evaluation.json").write_text(json.dumps(output, indent=2))
    print(f"Saved results to {RESULTS / 'evaluation.json'}")

if __name__ == "__main__":
    main()
