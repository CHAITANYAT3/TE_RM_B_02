# Wind Farm Renewable Energy Generation Optimization Prototype

## Purpose
This prototype accepts a cleaned wind-farm dataset and demonstrates how data science can support renewable-energy generation optimization.

The workflow is:

```text
Upload Dataset
      ↓
Data Validation & Preprocessing
      ↓
Feature Selection
      ↓
Random Forest Power Prediction
      ↓
MAE / RMSE / R² Evaluation
      ↓
Identify Top 10% High-Generation Records
      ↓
Compare High-Generation Operating Profile
      ↓
Data-Driven Optimization Insights
```

## Important interpretation
The prototype identifies **historical operating conditions associated with higher generation**. It does not claim that changing a sensor value will causally increase power, and it does not send control commands to a turbine. Any operational recommendation must be validated against turbine engineering constraints.

## Target
`power_29_avg`

## Main prototype inputs
The application automatically selects useful numeric sensor/wind variables while excluding direct power-derived columns to reduce target leakage.

## Run
```bash
pip install -r requirements.txt
streamlit run src/app.py
```

Then upload `cleaned_data.xlsx`.
