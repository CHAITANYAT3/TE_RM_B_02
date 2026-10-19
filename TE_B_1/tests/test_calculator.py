"""Experiment 7 reproducibility tests for the example calculations."""
import math
import unittest
from src.main import compare_modes, estimate_emissions, load_factors, make_bar_chart


class TestCO2Prototype(unittest.TestCase):
    def test_load_example_csv(self):
        factors = load_factors()
        self.assertEqual(factors["car"], 0.192)
        self.assertEqual(factors["bus"], 0.082)
        self.assertEqual(factors["train"], 0.041)

    def test_example_emissions(self):
        totals = compare_modes(10.0, load_factors())
        self.assertAlmostEqual(totals["car"], 1.920)
        self.assertAlmostEqual(totals["bus"], 0.820)
        self.assertAlmostEqual(totals["train"], 0.410)

    def test_reject_zero_or_negative_distance(self):
        for distance in (0.0, -1.0):
            with self.subTest(distance=distance):
                with self.assertRaises(ValueError):
                    estimate_emissions(distance, 0.192)

    def test_reject_nan(self):
        with self.assertRaises(ValueError):
            estimate_emissions(math.nan, 0.192)

    def test_chart_text(self):
        self.assertIn("Car", make_bar_chart(compare_modes(10, load_factors())))


if __name__ == "__main__":
    unittest.main()
