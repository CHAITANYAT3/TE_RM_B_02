import pytest
import numpy as np
import sys
import os

# Add src to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

from validator import validate_coordinates, validate_weather_tensor, sanitize_predictions

def test_validate_coordinates_valid():
    lat_idx, lon_idx = validate_coordinates(19.0760, 72.8777) # Mumbai
    assert 0 <= lat_idx < 31
    assert 0 <= lon_idx < 31

def test_validate_coordinates_out_of_bounds():
    with pytest.raises(ValueError):
        validate_coordinates(5.0, 72.0) # Too far south
        
    with pytest.raises(ValueError):
        validate_coordinates(20.0, 105.0) # Too far east

def test_validate_coordinates_type_error():
    with pytest.raises(TypeError):
        validate_coordinates("invalid", 72.0)

def test_validate_weather_tensor_valid():
    sample_tensor = np.zeros((10, 3, 31, 31), dtype=np.float32)
    assert validate_weather_tensor(sample_tensor) is True

def test_validate_weather_tensor_invalid_shape():
    sample_tensor = np.zeros((10, 2, 31, 31))
    with pytest.raises(ValueError):
        validate_weather_tensor(sample_tensor)

def test_sanitize_predictions():
    # Unsanitized predictions: negative rain, max temp < min temp
    raw_pred = np.array([
        [-5.0, 22.0, 28.0],
        [15.0, 35.0, 25.0]
    ])
    sanitized = sanitize_predictions(raw_pred)
    assert sanitized[0, 0] == 0.0 # Rain non-negative
    assert sanitized[0, 1] >= sanitized[0, 2] # MaxTemp >= MinTemp
    assert sanitized[1, 0] == 15.0
