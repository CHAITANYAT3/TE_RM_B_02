import os
import numpy as np
import argparse
import pickle
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error

def extract_features(data, lookback=3):
    """
    Enhanced Spatio-Temporal Feature Extractor
    data shape: (Time, 3, H=31, W=31) -> 0: Rain, 1: Max Temp, 2: Min Temp
    """
    T, C, H, W = data.shape
    
    # 1. Add derived channels: DTR (Tmax - Tmin) and LogRain log(1 + Rain)
    rain = np.maximum(0, np.nan_to_num(data[:, 0], nan=0.0))
    tmax = np.nan_to_num(data[:, 1], nan=25.0)
    tmin = np.nan_to_num(data[:, 2], nan=15.0)
    dtr = tmax - tmin
    log_rain = np.log1p(rain)
    
    # Combined feature tensor: (Time, 5, H, W)
    # Channels: 0: Rain, 1: MaxTemp, 2: MinTemp, 3: DTR, 4: LogRain
    tensor = np.stack([rain, tmax, tmin, dtr, log_rain], axis=1)
    
    # 2. Pad spatial dimensions for 3x3 neighborhood extraction
    padded_tensor = np.pad(tensor, ((0, 0), (0, 0), (1, 1), (1, 1)), mode='edge')
    
    X, Y = [], []
    
    # Coordinate grids
    lon_grid, lat_grid = np.meshgrid(np.linspace(0, 1, W), np.linspace(0, 1, H))
    
    for t in range(lookback, T):
        doy = t % 365
        sin_doy = np.sin(2 * np.pi * doy / 365.25)
        cos_doy = np.cos(2 * np.pi * doy / 365.25)
        
        # Targets for day t: [LogRain, MaxTemp, MinTemp]
        y_t = np.stack([log_rain[t], tmax[t], tmin[t]], axis=-1).reshape(H*W, 3)
        
        # Build features for each pixel
        # Extract past `lookback` days of 3x3 neighborhood across all 5 channels
        past_slices = []
        for l in range(lookback, 0, -1):
            past_t = t - l
            for dy in range(3):
                for dx in range(3):
                    # Slice (H, W) neighborhood
                    neigh = padded_tensor[past_t, :, dy:dy+H, dx:dx+W] # (5, H, W)
                    past_slices.append(neigh)
        
        # Stack past spatial slices: (lookback * 9 * 5, H, W) -> transpose to (H*W, N_feat)
        spatial_feats = np.stack(past_slices, axis=0).reshape(-1, H, W).transpose(1, 2, 0).reshape(H*W, -1)
        
        # Spatial location & Temporal features
        loc_feats = np.stack([lat_grid.ravel(), lon_grid.ravel(), 
                              np.full(H*W, sin_doy), np.full(H*W, cos_doy)], axis=1)
        
        x_t = np.hstack([spatial_feats, loc_feats])
        
        # Keep non-nan targets
        valid = ~np.isnan(y_t).any(axis=1)
        X.append(x_t[valid])
        Y.append(y_t[valid])
        
    X = np.vstack(X)
    Y = np.vstack(Y)
    return X, Y

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir", type=str, default="processed_data")
    parser.add_argument("--model_path", type=str, default="model.pkl")
    args = parser.parse_args()
    
    print("Loading datasets...")
    train_data = []
    for file in sorted(os.listdir(args.data_dir)):
        if file.endswith(".npy") and "2023" not in file:
            arr = np.load(os.path.join(args.data_dir, file))
            train_data.append(arr)
            print(f"Loaded {file} shape: {arr.shape}")
            
    if not train_data:
        print("Fallback: Using 2023 for training...")
        train_data.append(np.load(os.path.join(args.data_dir, "weather_2023.npy")))
        
    combined_train = np.concatenate(train_data, axis=0)
    print(f"Combined train data shape: {combined_train.shape}")
    
    print("Extracting 3D Spatio-Temporal features...")
    X_train, y_train = extract_features(combined_train, lookback=3)
    print(f"X_train shape: {X_train.shape}, y_train shape: {y_train.shape}")
    
    print("Training Enhanced Gradient Boosting Digital Twin Model...")
    base_model = HistGradientBoostingRegressor(max_iter=100, learning_rate=0.08, max_depth=8, random_state=42)
    model = MultiOutputRegressor(base_model)
    model.fit(X_train, y_train)
    print("Training complete!")
    
    with open(args.model_path, 'wb') as f:
        pickle.dump(model, f)
        
    print(f"Model saved to {args.model_path}")

if __name__ == "__main__":
    main()
