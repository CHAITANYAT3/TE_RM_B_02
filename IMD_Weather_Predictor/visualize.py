import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import argparse

def plot_timeseries(y_true, y_pred, out_path):
    # Calculate average across the spatial grid (since input was flattened, we just mean over all points per timestep if it was kept spatio-temporal)
    # Actually, y_pred shape is (N, 3), where N is Time*Space. 
    # To get time-series, we reshape back to (Time, Space, 3)
    # The predict.py flattened it as (Time-3) * 961
    T = y_true.shape[0] // 961
    if T * 961 != y_true.shape[0]:
        print("Warning: Shape mismatch, falling back to simple averaging")
        T = y_true.shape[0] // 961
        y_true = y_true[:T*961]
        y_pred = y_pred[:T*961]
        
    y_true_st = y_true.reshape((T, 961, 3)).mean(axis=1) # Mean across spatial grid
    y_pred_st = y_pred.reshape((T, 961, 3)).mean(axis=1)
    
    channels = ["Rainfall (mm)", "Max Temp (C)", "Min Temp (C)"]
    fig, axes = plt.subplots(3, 1, figsize=(12, 10))
    
    for i, name in enumerate(channels):
        axes[i].plot(y_true_st[:, i], label='Actual', color='blue', alpha=0.7)
        axes[i].plot(y_pred_st[:, i], label='Predicted', color='red', alpha=0.7)
        axes[i].set_title(f"All-India Average {name} (2023 Digital Twin Simulation)")
        axes[i].set_ylabel(name)
        axes[i].legend()
        axes[i].grid(True)
        
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()
    print(f"Saved timeseries plot to {out_path}")

def plot_heatmap(y_true, y_pred, timestep, out_path):
    # Reconstruct the grid for a specific timestep
    # T*961
    T = y_true.shape[0] // 961
    y_true_grid = y_true.reshape((T, 31, 31, 3))
    y_pred_grid = y_pred.reshape((T, 31, 31, 3))
    
    channels = ["Rainfall (mm)", "Max Temp (C)", "Min Temp (C)"]
    fig, axes = plt.subplots(3, 2, figsize=(12, 14))
    
    for i, name in enumerate(channels):
        sns.heatmap(y_true_grid[timestep, :, :, i], ax=axes[i, 0], cmap="viridis", cbar=True)
        axes[i, 0].set_title(f"Actual {name} (Day {timestep})")
        axes[i, 0].axis('off')
        
        sns.heatmap(y_pred_grid[timestep, :, :, i], ax=axes[i, 1], cmap="viridis", cbar=True)
        axes[i, 1].set_title(f"Predicted {name} (Day {timestep})")
        axes[i, 1].axis('off')
        
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()
    print(f"Saved heatmap to {out_path}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir", type=str, default="processed_data")
    parser.add_argument("--out_dir", type=str, default="/Users/yxshw/.gemini/antigravity/brain/c43d0cdf-2150-4978-925f-46156e55ad8c")
    args = parser.parse_args()
    
    pred_path = os.path.join(args.data_dir, "predictions_2023.npy")
    actual_path = os.path.join(args.data_dir, "actuals_2023.npy")
    
    if not os.path.exists(pred_path):
        print(f"Predictions not found at {pred_path}")
        return
        
    y_pred = np.load(pred_path)
    y_true = np.load(actual_path)
    
    os.makedirs(args.out_dir, exist_ok=True)
    
    plot_timeseries(y_true, y_pred, os.path.join(args.out_dir, "timeseries.png"))
    # plot_heatmap(y_true, y_pred, timestep=150, out_path=os.path.join(args.out_dir, "heatmap.png"))

if __name__ == "__main__":
    main()
