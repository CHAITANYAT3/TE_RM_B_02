# Technical Documentation

## 1. Project Title
The Role of Data Science in Optimizing Renewable Energy Generation from Wind Farms.

## 2. Problem Statement
Wind-farm generation varies with wind conditions and equipment operating conditions. A data-science prototype can learn relationships between wind/sensor measurements and generated power to support better forecasting and operational planning.

## 3. Objectives
- Prepare the supplied cleaned wind-farm dataset for modelling.
- Identify relevant wind and sensor variables.
- Build a baseline and machine-learning forecasting model.
- Evaluate model performance with standard regression metrics.
- Generate predictions for the supplied prediction records.
- Provide a simple prototype interface.
- Maintain a reproducible project structure and version history.

## 4. System Requirements
- Python 3.10+
- 8 GB RAM or more recommended
- VS Code / Jupyter / Google Colab
- Git and GitHub
- Windows/Linux/macOS

## 5. Technologies
Python, Pandas, NumPy, Scikit-learn, Joblib, Streamlit, Jupyter Notebook, Git/GitHub.

## 6. System Architecture
```text
Cleaned Excel Dataset
        |
        v
Data Loading + Timestamp Parsing
        |
        v
Train / Prediction Split
        |
        v
Feature Selection + Missing-Value Handling
        |
        v
Chronological Validation
        |
        +-------------------+
        |                   |
        v                   v
Linear Regression     Random Forest
        |                   |
        +---------+---------+
                  v
        MAE / RMSE / R2
                  |
                  v
       Final Random Forest
                  |
        +---------+---------+
        |                   |
        v                   v
 Prediction CSV       Streamlit Prototype
```

## 7. Methodology
1. Load `data/cleaned_data.xlsx`.
2. Convert `time_stamp` to datetime and sort chronologically.
3. Use the existing `train_test` field to identify training and prediction records.
4. Use wind-speed and operational sensor features.
5. Remove incomplete rows for selected features.
6. Reserve the last 20% of training records as chronological validation data.
7. Train Linear Regression as a baseline.
8. Train Random Forest Regressor as the machine-learning prototype.
9. Compare MAE, RMSE and R².
10. Train the final Random Forest on all training records.
11. Generate predictions for rows marked `prediction`.
12. Save metrics, predictions and the model artifact.

## 8. Input / Output
Input: wind-speed and sensor measurements.

Output:
- `results/model_metrics.csv`
- `results/predictions.csv`
- `results/wind_power_model.joblib`

## 9. Results
Run `python src/train_model.py` to generate the actual evaluation values from the supplied dataset. Do not manually type or assume metrics before execution.

## 10. Limitations
The prototype uses one asset, predicts one power variable, and does not include live weather forecasts, maintenance schedules, grid constraints or market information.

## 11. Future Scope
Real-time data ingestion, weather forecast integration, time-series lag features, model comparison, uncertainty estimation, and constrained generation optimization can be added.

## 12. Reproducibility
Use `requirements.txt`, the fixed random seed, the documented folder structure, and Git version history. Another user can clone the repository, install dependencies, run the training script, and reproduce the generated artifacts.
