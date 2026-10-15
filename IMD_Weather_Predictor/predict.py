import os
import numpy as np
import argparse
import pickle
from sklearn.metrics import mean_squared_error, mean_absolute_error
from train_model import extract_features

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir", type=str, default="processed_data")
    parser.add_argument("--model_path", type=str, default="model.pkl")
    parser.add_argument("--test_year", type=int, default=2023)
    args = parser.parse_args()
    
    test_file = os.path.join(args.data_dir, f"weather_{args.test_year}.npy")
    if not os.path.exists(test_file):
        print(f"Test file {test_file} not found.")
        return
        
    print(f"Loading test data from {test_file}...")
    test_data = np.load(test_file)
    print(f"Test data shape: {test_data.shape}")
    
    X_test, y_test_transformed = extract_features(test_data, lookback=3)
    
    print("Loading model...")
    with open(args.model_path, 'rb') as f:
        model = pickle.load(f)
        
    print("Generating predictions...")
    y_pred_transformed = model.predict(X_test)
    
    # Convert log(1+rain) back to actual rainfall mm
    y_test_actual = np.copy(y_test_transformed)
    y_test_actual[:, 0] = np.expm1(y_test_transformed[:, 0]) # Rain
    
    y_pred_actual = np.copy(y_pred_transformed)
    y_pred_actual[:, 0] = np.maximum(0, np.expm1(y_pred_transformed[:, 0])) # Rain
    
    channels = ["Rainfall (mm)", "Max Temp (°C)", "Min Temp (°C)"]
    
    print("\n--- Enhanced Evaluation Results ---")
    for i, name in enumerate(channels):
        rmse = np.sqrt(mean_squared_error(y_test_actual[:, i], y_pred_actual[:, i]))
        mae = mean_absolute_error(y_test_actual[:, i], y_pred_actual[:, i])
        print(f"{name}:")
        print(f"  RMSE: {rmse:.2f}")
        print(f"  MAE:  {mae:.2f}")

    print("\nSaving predictions for visualization...")
    np.save(os.path.join(args.data_dir, "predictions_2023.npy"), y_pred_actual)
    np.save(os.path.join(args.data_dir, "actuals_2023.npy"), y_test_actual)
    print("Digital Twin evaluation completed successfully.")

if __name__ == "__main__":
    main()
