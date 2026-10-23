from pathlib import Path
import numpy as np
import pandas as pd
import streamlit as st

from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    f1_score,
)

st.set_page_config(
    page_title="Wind Farm Optimization",
    page_icon="🌬️",
    layout="wide",
)

st.title("🌬️ Wind Farm Renewable Energy Optimization")
st.write(
    "Upload a cleaned wind-farm dataset. The prototype predicts generated power "
    "using four regression models and converts the continuous prediction into "
    "High/Normal-Low generation classes to calculate Accuracy and F1 Score."
)

uploaded = st.file_uploader(
    "Upload cleaned wind-farm dataset (.xlsx or .csv)",
    type=["xlsx", "csv"],
)

if uploaded is None:
    st.info("Upload your cleaned dataset to start the analysis.")
    st.stop()

try:
    df = (
        pd.read_csv(uploaded)
        if uploaded.name.lower().endswith(".csv")
        else pd.read_excel(uploaded)
    )
except Exception as e:
    st.error(f"Could not read the dataset: {e}")
    st.stop()

st.subheader("1. Dataset Overview")
c1, c2, c3 = st.columns(3)
c1.metric("Rows", f"{len(df):,}")
c2.metric("Columns", f"{len(df.columns):,}")
c3.metric("Missing Values", f"{int(df.isna().sum().sum()):,}")
st.dataframe(df.head(10), use_container_width=True)

TARGET = "power_29_avg"

if TARGET not in df.columns:
    st.error(
        f"Target column `{TARGET}` was not found. "
        "This prototype expects the generated-power column `power_29_avg`."
    )
    st.stop()

# -------------------------------------------------------------------
# Feature selection
# -------------------------------------------------------------------
# Exclude the target, power-derived variables, identifiers, and timestamp.
# This reduces target leakage when predicting power_29_avg.
excluded = {
    TARGET,
    "power_29_max",
    "power_29_min",
    "power_29_std",
    "power_30_avg",
    "power_30_max",
    "power_30_min",
    "power_30_std",
    "time_stamp",
    "id",
    "asset_id",
    "train_test",
}

features = [
    c
    for c in df.select_dtypes(include=np.number).columns
    if c not in excluded
]

features = [
    c
    for c in features
    if df[c].nunique(dropna=True) > 1
    and df[c].isna().mean() <= 0.40
]

if not features:
    st.error("No usable numeric input features were found.")
    st.stop()

work = df[features + [TARGET]].copy()
work = work.replace([np.inf, -np.inf], np.nan)
work[TARGET] = pd.to_numeric(work[TARGET], errors="coerce")

for col in features:
    work[col] = pd.to_numeric(work[col], errors="coerce")

work = work.dropna(subset=[TARGET])
work[features] = work[features].fillna(work[features].median())

# Preserve chronological order if a timestamp exists.
if "time_stamp" in df.columns:
    times = pd.to_datetime(df["time_stamp"], errors="coerce")
    work["__time"] = times.loc[work.index]
    work = work.sort_values("__time").drop(columns="__time")

if len(work) < 20:
    st.error("Dataset is too small for reliable model validation. At least 20 valid rows are recommended.")
    st.stop()

st.subheader("2. Data Preprocessing")
st.write(f"**Target:** `{TARGET}`")
st.write(f"**Input features:** {len(features)}")
st.write(", ".join(features))
st.write(f"**Valid records after preprocessing:** {len(work):,}")

# -------------------------------------------------------------------
# Train/validation split
# -------------------------------------------------------------------
# An 80/20 chronological split is used when the timestamp is available.
# Since work was sorted above, this is appropriate for time-ordered data.
split = int(len(work) * 0.80)

if split < 10 or len(work) - split < 5:
    st.error("Dataset is too small for the selected 80/20 validation split.")
    st.stop()

train = work.iloc[:split].copy()
valid = work.iloc[split:].copy()

# Use NumPy arrays for model fitting/prediction.
X_train = train[features].to_numpy(dtype=float)
X_valid = valid[features].to_numpy(dtype=float)
y_train = train[TARGET].to_numpy(dtype=float)
y_valid = valid[TARGET].to_numpy(dtype=float)

st.write(f"Training records: **{len(train):,}** | Validation records: **{len(valid):,}**")

# -------------------------------------------------------------------
# Model training
# -------------------------------------------------------------------
st.subheader("3. Four Regression Models")

with st.spinner("Training Linear Regression..."):
    # Linear Regression: one main wind-speed predictor.
    X_train_linear = train[["wind_speed_3_avg"]].to_numpy(dtype=float)
    X_valid_linear = valid[["wind_speed_3_avg"]].to_numpy(dtype=float)

    linear_model = LinearRegression()
    linear_model.fit(X_train_linear, y_train)
    linear_pred = linear_model.predict(X_valid_linear)

with st.spinner("Training Multiple Linear Regression..."):
    multiple_model = LinearRegression()
    multiple_model.fit(X_train, y_train)
    multiple_pred = multiple_model.predict(X_valid)

with st.spinner("Training Decision Tree Regression..."):
    tree_model = DecisionTreeRegressor(
        max_depth=15,
        random_state=42,
    )
    tree_model.fit(X_train, y_train)
    tree_pred = tree_model.predict(X_valid)

with st.spinner("Training Random Forest Regression..."):
    random_forest_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        random_state=42,
        n_jobs=-1,
    )
    random_forest_model.fit(X_train, y_train)
    random_forest_pred = random_forest_model.predict(X_valid)

st.success("All four models were trained successfully.")

# -------------------------------------------------------------------
# Classification threshold
# -------------------------------------------------------------------
# Accuracy/F1 are not regression metrics. We derive a binary generation
# class from the training-set median so that the validation set remains
# independent of the threshold.
threshold = float(np.median(y_train))

def evaluate_model(name, actual, predicted):
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)

    mae = mean_absolute_error(actual, predicted)
    mse = mean_squared_error(actual, predicted)
    rmse = np.sqrt(mse)
    r2 = r2_score(actual, predicted)

    actual_class = (actual >= threshold).astype(int)
    predicted_class = (predicted >= threshold).astype(int)

    accuracy = accuracy_score(actual_class, predicted_class)
    f1 = f1_score(
        actual_class,
        predicted_class,
        zero_division=0,
    )

    return {
        "Model": name,
        "MAE": mae,
        "MSE": mse,
        "RMSE": rmse,
        "R2 Score": r2,
        "Accuracy": accuracy,
        "F1 Score": f1,
    }

results = [
    evaluate_model(
        "Linear Regression",
        y_valid,
        linear_pred,
    ),
    evaluate_model(
        "Multiple Linear Regression",
        y_valid,
        multiple_pred,
    ),
    evaluate_model(
        "Decision Tree Regression",
        y_valid,
        tree_pred,
    ),
    evaluate_model(
        "Random Forest Regression",
        y_valid,
        random_forest_pred,
    ),
]

results_df = pd.DataFrame(results)

# -------------------------------------------------------------------
# Model comparison
# -------------------------------------------------------------------
st.subheader("4. Model Performance Comparison")

st.caption(
    "MAE, MSE, RMSE and R² evaluate continuous power prediction. "
    "Accuracy and F1 Score evaluate High vs Normal/Low generation "
    "after converting predicted power into two classes."
)

display_results = results_df.copy()
metric_cols = [
    "MAE",
    "MSE",
    "RMSE",
    "R2 Score",
    "Accuracy",
    "F1 Score",
]
display_results[metric_cols] = display_results[metric_cols].round(4)

st.dataframe(display_results, use_container_width=True)

st.download_button(
    "Download Model Comparison CSV",
    display_results.to_csv(index=False).encode("utf-8"),
    "model_comparison_results.csv",
    "text/csv",
)

# -------------------------------------------------------------------
# Best models
# -------------------------------------------------------------------
best_r2_idx = results_df["R2 Score"].idxmax()
best_acc_idx = results_df["Accuracy"].idxmax()
best_f1_idx = results_df["F1 Score"].idxmax()

b1, b2, b3 = st.columns(3)
b1.metric(
    "Best R² Model",
    results_df.loc[best_r2_idx, "Model"],
    f"{results_df.loc[best_r2_idx, 'R2 Score']:.4f}",
)
b2.metric(
    "Best Accuracy Model",
    results_df.loc[best_acc_idx, "Model"],
    f"{results_df.loc[best_acc_idx, 'Accuracy']:.4f}",
)
b3.metric(
    "Best F1 Model",
    results_df.loc[best_f1_idx, "Model"],
    f"{results_df.loc[best_f1_idx, 'F1 Score']:.4f}",
)

# -------------------------------------------------------------------
# Classification explanation
# -------------------------------------------------------------------
st.subheader("5. Accuracy and F1 Score Definition")

st.write(
    f"The training-set median power value ({threshold:.4f}) is used as the "
    "classification threshold."
)

c1, c2 = st.columns(2)
c1.info("0 = Normal/Low Power Generation")
c2.success("1 = High Power Generation")

# -------------------------------------------------------------------
# Optimization analysis
# -------------------------------------------------------------------
st.subheader("6. How Data Science Optimizes Wind Generation")

st.write(
    "The prototype learns relationships between wind/sensor conditions and "
    "generated power. It compares historical operating conditions associated "
    "with the highest generation and ranks important predictive variables. "
    "This is an optimization-support analysis, not a direct turbine-control command."
)

q90 = float(work[TARGET].quantile(0.90))
high = work[work[TARGET] >= q90]

overall = work[features].median()
high_med = high[features].median()

rows = []

for i, f in enumerate(features):
    overall_value = overall[f]
    high_value = high_med[f]

    if pd.isna(overall_value) or pd.isna(high_value):
        difference = np.nan
    elif overall_value == 0:
        difference = np.nan
    else:
        difference = (
            (high_value - overall_value)
            / abs(overall_value)
            * 100
        )

    rows.append(
        {
            "Feature": f,
            "Overall Median": overall_value,
            "High-Generation Median": high_value,
            "Difference (%)": difference,
            "Random Forest Importance":
                random_forest_model.feature_importances_[i],
        }
    )

profile = pd.DataFrame(rows)

profile["Absolute Difference (%)"] = profile["Difference (%)"].abs()

profile = profile.sort_values(
    "Random Forest Importance",
    ascending=False,
)

p1, p2 = st.columns(2)
p1.metric(
    "High-generation threshold (top 10%)",
    f"{q90:.4f}",
)
p2.metric(
    "High-generation records",
    f"{len(high):,}",
)

st.dataframe(
    profile.head(15).round(4),
    use_container_width=True,
)

# -------------------------------------------------------------------
# Feature importance
# -------------------------------------------------------------------
st.subheader("7. Random Forest Feature Importance")

importance = profile[
    ["Feature", "Random Forest Importance"]
].copy()

importance = importance.sort_values(
    "Random Forest Importance",
    ascending=False,
)

st.bar_chart(
    importance.set_index("Feature")
)

st.download_button(
    "Download Feature Importance CSV",
    importance.to_csv(index=False).encode("utf-8"),
    "feature_importance.csv",
    "text/csv",
)

# -------------------------------------------------------------------
# Optimization insights
# -------------------------------------------------------------------
st.subheader("8. Optimization Insights")

for _, row in profile.head(5).iterrows():
    difference = row["Difference (%)"]

    if pd.isna(difference):
        continue

    direction = "higher" if difference > 0 else "lower"

    st.write(
        f"• **{row['Feature']}** is an important predictive variable. "
        f"In high-generation historical records, its median was "
        f"**{direction}** than the overall median "
        f"({difference:.2f}%)."
    )



# -------------------------------------------------------------------
# Actual vs predicted chart
# -------------------------------------------------------------------
st.subheader("10. Actual vs Predicted Power")

chart_df = pd.DataFrame(
    {
        "Actual Power": y_valid,
        "Random Forest Predicted Power": random_forest_pred,
    }
)

st.line_chart(chart_df)

# -------------------------------------------------------------------
# Final status
# -------------------------------------------------------------------
st.success(
    "Optimization-support workflow completed: "
    "dataset → preprocessing → four-model training → "
    "regression evaluation → High/Normal-Low classification → "
    "Accuracy/F1 → model comparison → feature importance → "
    "optimization insights → predictions."
)
