"""
Input validation utilities and robust data sanitization for the IMD Digital Twin pipeline.
Ensures tensor bounds, valid latitude/longitude coordinates, and temporal ranges.
"""

import numpy as np

GRID_MIN_LAT = 7.5
GRID_MAX_LAT = 37.5
GRID_MIN_LON = 67.5
GRID_MAX_LON = 97.5
GRID_SIZE = 31

def validate_coordinates(lat, lon):
    """
    Validates geographical coordinates within the Indian subcontinent IMD grid.
    Raises ValueError if coordinates fall outside bounds.
    """
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        raise TypeError("Coordinates must be numeric (int or float).")
        
    if not (GRID_MIN_LAT <= lat <= GRID_MAX_LAT):
        raise ValueError(f"Latitude {lat}° is out of bounds [{GRID_MIN_LAT}°, {GRID_MAX_LAT}°].")
        
    if not (GRID_MIN_LON <= lon <= GRID_MAX_LON):
        raise ValueError(f"Longitude {lon}° is out of bounds [{GRID_MIN_LON}°, {GRID_MAX_LON}°].")
        
    # Map to nearest grid index (0 to 30)
    lat_idx = int(round(lat - GRID_MIN_LAT))
    lon_idx = int(round(lon - GRID_MIN_LON))
    lat_idx = max(0, min(GRID_SIZE - 1, lat_idx))
    lon_idx = max(0, min(GRID_SIZE - 1, lon_idx))
    return lat_idx, lon_idx

def validate_weather_tensor(tensor):
    """
    Validates weather tensor shape, dimensions, and numerical validity.
    Expected shape: (Time, Channels=3, Lat=31, Lon=31)
    """
    if not isinstance(tensor, np.ndarray):
        raise TypeError("Input tensor must be a numpy ndarray.")
        
    if tensor.ndim != 4:
        raise ValueError(f"Expected 4D array (T, C, H, W), got {tensor.ndim}D.")
        
    T, C, H, W = tensor.shape
    if C != 3:
        raise ValueError(f"Expected 3 channels (Rain, MaxTemp, MinTemp), got {C}.")
    if H != GRID_SIZE or W != GRID_SIZE:
        raise ValueError(f"Expected spatial dimensions ({GRID_SIZE}, {GRID_SIZE}), got ({H}, {W}).")
    if T < 4:
        raise ValueError(f"Expected at least 4 days of observations for lookback=3, got {T}.")
        
    return True

def sanitize_predictions(y_pred):
    """
    Ensures predictions satisfy physical constraints:
    - Non-negative rainfall
    - Max temperature >= Min temperature
    - Plausible temperature ranges for subcontinent (-15°C to 60°C)
    """
    clean_pred = np.copy(y_pred)
    # Rainfall >= 0
    clean_pred[:, 0] = np.maximum(0.0, clean_pred[:, 0])
    
    # Ensure Tmax >= Tmin
    mask = clean_pred[:, 1] < clean_pred[:, 2]
    if np.any(mask):
        avg = (clean_pred[mask, 1] + clean_pred[mask, 2]) / 2.0
        clean_pred[mask, 1] = avg + 1.0
        clean_pred[mask, 2] = avg - 1.0
        
    # Clip extreme unphysical temperature anomalies
    clean_pred[:, 1] = np.clip(clean_pred[:, 1], -15.0, 60.0)
    clean_pred[:, 2] = np.clip(clean_pred[:, 2], -25.0, 50.0)
    return clean_pred
