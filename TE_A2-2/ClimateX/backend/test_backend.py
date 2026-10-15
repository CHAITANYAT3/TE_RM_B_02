"""Automated Validation Suite for ClimateX Advanced ML Models.

Tests:
1. Dataset loading and integrity (2000-2024).
2. XGBoost regression model training and chronological metrics (MAE, MSE, RMSE, R²).
3. Inclusion of XGBoost alongside the 4 existing models without removals.
4. Temporal Fusion Transformer (TFT) multi-variate execution (Temp, Rain, CO2).
5. TFT data sufficiency evaluation and 'insufficient_data' status verification.
6. Future temperature prediction endpoints continuity.
"""

import unittest
from app.data_loader import load_dataset
from app.ml_temperature import compute_temperature_ml_comparison
from app.tft_module import compute_tft_experimental
from app.routers.prediction import _fit_models


class TestClimateXMLModels(unittest.TestCase):

    def test_dataset_integrity(self):
        """Validates that dataset is 2000-2024 and contains all required features."""
        df = load_dataset()
        self.assertEqual(len(df), 25)
        self.assertEqual(int(df["Year"].min()), 2000)
        self.assertEqual(int(df["Year"].max()), 2024)
        for col in ["Year", "Temperature_C", "Rainfall_mm", "CO2_Emissions_tonnes"]:
            self.assertIn(col, df.columns)

    def test_ml_comparison_models_and_xgboost(self):
        """Validates that 5 models are present (4 existing + XGBoost) and sorted by RMSE."""
        res = compute_temperature_ml_comparison()

        model_names = [m.model for m in res.model_comparison]
        expected_models = [
            "Linear Regression",
            "Polynomial Regression (degree 2)",
            "Random Forest Regression",
            "Gradient Boosting Regression",
            "XGBoost Regression",
        ]
        for exp in expected_models:
            self.assertIn(exp, model_names, f"Model {exp} must be present in model comparison.")

        # Total count must be 5
        self.assertEqual(len(res.model_comparison), 5)

        # Ensure all metrics are computed and valid
        xgb_metric = next(m for m in res.model_comparison if m.model == "XGBoost Regression")
        self.assertGreater(xgb_metric.mae, 0.0)
        self.assertGreater(xgb_metric.mse, 0.0)
        self.assertGreater(xgb_metric.rmse, 0.0)
        self.assertIsNotNone(xgb_metric.r2)

        # Check ranking order (ascending RMSE)
        for i in range(len(res.model_comparison) - 1):
            self.assertLessEqual(
                res.model_comparison[i].rmse,
                res.model_comparison[i + 1].rmse,
                "Models must be sorted by lowest RMSE ascending."
            )

        # Yearly test predictions must exist for 2020-2024
        self.assertEqual(len(res.yearly_predictions), 5)
        for yp in res.yearly_predictions:
            self.assertIn("XGBoost Regression", yp.predictions)
            self.assertIn("Polynomial Regression (degree 2)", yp.predictions)
            self.assertIn("Linear Regression", yp.predictions)
            self.assertIn("Random Forest Regression", yp.predictions)
            self.assertIn("Gradient Boosting Regression", yp.predictions)

    def test_tft_experimental_module(self):
        """Validates TFT architecture, multi-variate inputs, and data sufficiency check."""
        tft = compute_tft_experimental()

        # Must flag status as 'insufficient_data' and is_reliable=False
        self.assertEqual(tft.status, "insufficient_data")
        self.assertFalse(tft.is_reliable)
        self.assertIn("Insufficient Data", tft.status_label)

        # Verify multi-variate features used
        self.assertIn("Temperature (°C)", tft.architecture.input_features)
        self.assertIn("Rainfall (mm)", tft.architecture.input_features)
        self.assertIn("CO₂ Emissions (tonnes)", tft.architecture.input_features)

        # Verify variable selection weights
        self.assertEqual(len(tft.variable_selection_weights), 3)
        total_pct = sum(w.percentage for w in tft.variable_selection_weights)
        self.assertAlmostEqual(total_pct, 100.0, delta=1.0)

        # Verify computed metrics exist
        self.assertGreater(tft.metrics.mae, 0.0)
        self.assertGreater(tft.metrics.rmse, 0.0)
        self.assertIsNotNone(tft.metrics.r2)

        # Verify data sufficiency telemetry
        self.assertEqual(tft.data_sufficiency.total_observations, 25)
        self.assertEqual(tft.data_sufficiency.training_samples, 20)
        self.assertEqual(tft.data_sufficiency.testing_samples, 5)
        self.assertEqual(tft.data_sufficiency.recommended_minimum, 250)
        self.assertEqual(tft.data_sufficiency.sufficiency_percentage, 10.0)

    def test_future_prediction_continuity(self):
        """Validates that existing future prediction model fitting remains fully operational."""
        df, hist_points, poly_model, linear_model = _fit_models()
        self.assertEqual(len(hist_points), 25)
        self.assertIsNotNone(poly_model)
        self.assertIsNotNone(linear_model)


if __name__ == "__main__":
    unittest.main()
