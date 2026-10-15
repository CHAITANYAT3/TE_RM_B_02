import os
import json
import argparse
import pickle
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from train_model import extract_features
from validator import sanitize_predictions

def evaluate_model(data_dir="data", model_path="model.pkl", test_year=2023, out_dir="results"):
    test_file = os.path.join(data_dir, f"weather_{test_year}.npy")
    if not os.path.exists(test_file):
        # Check subfolder fallback
        alt_test = os.path.join("processed_data", f"weather_{test_year}.npy")
        if os.path.exists(alt_test):
            test_file = alt_test
        else:
            print(f"Error: Test file {test_file} not found.")
            return None
            
    print(f"Loading test dataset from {test_file}...")
    test_data = np.load(test_file)
    print(f"Test tensor shape: {test_data.shape}")
    
    X_test, y_test_transformed = extract_features(test_data, lookback=3)
    
    # Try finding model file
    if not os.path.exists(model_path):
        candidates = ["model.pkl", "results/model.pkl", "../model.pkl"]
        for c in candidates:
            if os.path.exists(c):
                model_path = c
                break
                
    print(f"Loading model from {model_path}...")
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
        
    print("Executing model inference...")
    y_pred_transformed = model.predict(X_test)
    
    # Transform back to physical domain
    y_test_actual = np.copy(y_test_transformed)
    y_test_actual[:, 0] = np.expm1(y_test_transformed[:, 0]) # Rain mm
    
    y_pred_actual = np.copy(y_pred_transformed)
    y_pred_actual[:, 0] = np.expm1(y_pred_transformed[:, 0])
    y_pred_actual = sanitize_predictions(y_pred_actual)
    
    channels = ["Rainfall (mm)", "Max Temp (°C)", "Min Temp (°C)"]
    metrics = {}
    
    print("\n" + "="*50)
    print(f"  PERFORMANCE EVALUATION REPORT (Year {test_year})")
    print("="*50)
    
    for i, name in enumerate(channels):
        y_t = y_test_actual[:, i]
        y_p = y_pred_actual[:, i]
        
        rmse = float(np.sqrt(mean_squared_error(y_t, y_p)))
        mae = float(mean_absolute_error(y_t, y_p))
        r2 = float(r2_score(y_t, y_p))
        
        metrics[name] = {
            "RMSE": round(rmse, 4),
            "MAE": round(mae, 4),
            "R2_Score": round(r2, 4)
        }
        print(f"  {name:15s} | RMSE: {rmse:6.2f} | MAE: {mae:6.2f} | R²: {r2:6.3f}")
        
    print("="*50)
    
    os.makedirs(out_dir, exist_ok=True)
    summary_path = os.path.join(out_dir, "metrics_summary.json")
    with open(summary_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics summary to {summary_path}")
    
    return metrics

def main():
    parser = argparse.ArgumentParser(description="Performance Evaluation")
    parser.add_argument("--data_dir", type=str, default="data")
    parser.add_argument("--model_path", type=str, default="model.pkl")
    parser.add_argument("--test_year", type=int, default=2023)
    parser.add_argument("--out_dir", type=str, default="results")
    args = parser.parse_args()
    
    evaluate_model(args.data_dir, args.model_path, args.test_year, args.out_dir)

if __name__ == "__main__":
    main()
