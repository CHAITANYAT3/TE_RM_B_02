import pytest

from src.predict import validate_features


def test_valid_features():

    values = [0] * 30

    result = validate_features(values)

    assert result.shape == (1, 30)


def test_wrong_feature_count():

    values = [0] * 29

    with pytest.raises(ValueError):
        validate_features(values)


def test_non_numeric_value():

    values = [0] * 29 + ["abc"]

    with pytest.raises(ValueError):
        validate_features(values)


def test_nan_value():

    values = [0] * 29 + [float("nan")]

    with pytest.raises(ValueError):
        validate_features(values)