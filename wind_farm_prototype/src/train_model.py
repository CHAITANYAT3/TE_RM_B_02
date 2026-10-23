import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

DATA_PATH = "data/cleaned_data.xlsx"
RESULTS_DIR = "results"
TARGET = "power_29_avg"

FEATURES = [
    "wind_speed_3_avg",
    "wind_speed_4_avg",
    "sensor_15_avg",
    "sensor_16_avg",
    "sensor_23_avg",
    "sensor_24_avg",
    "sensor_25_avg",
    "sensor_45",
    "sensor_50",
]

os.makedirs(RESULTS_DIR, exist_ok=True)

df = pd.read_excel(DATA_PATH)
df["time_stamp"] = pd.to_datetime(df["time_stamp"])
df = df.sort_values("time_stamp").reset_index(drop=True)

train_df = df[df["train_test"].eq("train")].copy()
pred_df = df[df["train_test"].eq("prediction")].copy()

# Remove rows with missing values in the selected prototype variables.
train_df = train_df.dropna(subset=FEATURES + [TARGET])
pred_df = pred_df.dropna(subset=FEATURES)

# Chronological 80/20 validation.
split = int(len(train_df) * 0.80)
tr = train_df.iloc[:split]
va = train_df.iloc[split:]

X_tr, y_tr = tr[FEATURES], tr[TARGET]
X_va, y_va = va[FEATURES], va[TARGET]

models = {
    "Linear Regression": LinearRegression(),
    "Random Forest": RandomForestRegressor(
        n_estimators=250,
        max_depth=18,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    ),
}

metrics = []
for name, model in models.items():
    model.fit(X_tr, y_tr)
    p = model.predict(X_va)
    metrics.append({
        "model": name,
        "MAE": mean_absolute_error(y_va, p),
        "RMSE": np.sqrt(mean_squared_error(y_va, p)),
        "R2": r2_score(y_va, p),
    })

metrics_df = pd.DataFrame(metrics)
metrics_df.to_csv(f"{RESULTS_DIR}/model_metrics.csv", index=False)

# Final model for the prototype: Random Forest, trained on all available training rows.
final_model = models["Random Forest"]
final_model.fit(train_df[FEATURES], train_df[TARGET])

if len(pred_df):
    pred_values = final_model.predict(pred_df[FEATURES])
    predictions = pred_df[["time_stamp", "asset_id", "id"]].copy()
    predictions["predicted_power_29_avg"] = pred_values
    # The supplied prediction rows contain the target; retain it only for post-hoc comparison.
    if TARGET in pred_df.columns:
        predictions["actual_power_29_avg"] = pred_df[TARGET].values
    predictions.to_csv(f"{RESULTS_DIR}/predictions.csv", index=False)

joblib.dump({"model": final_model, "features": FEATURES, "target": TARGET},
            f"{RESULTS_DIR}/wind_power_model.joblib")

print("\nModel evaluation:")
print(metrics_df.to_string(index=False))
print(f"\nTraining rows: {len(train_df)}")
print(f"Prediction rows: {len(pred_df)}")
print(f"Saved outputs in: {RESULTS_DIR}/")
