import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import argparse

def plot_timeseries(y_true, y_pred, out_path="results/timeseries.png"):
    """
    Plots spatial mean timeseries comparing actual vs predicted weather variables across India.
    """
    T = y_true.shape[0] // 961
    if T * 961 != y_true.shape[0]:
        print("Warning: Adjusting spatial array length")
        T = y_true.shape[0] // 961
        y_true = y_true[:T*961]
        y_pred = y_pred[:T*961]
        
    y_true_st = y_true.reshape((T, 961, 3)).mean(axis=1)
    y_pred_st = y_pred.reshape((T, 961, 3)).mean(axis=1)
    
    channels = ["Rainfall (mm)", "Max Temp (°C)", "Min Temp (°C)"]
    fig, axes = plt.subplots(3, 1, figsize=(12, 10))
    
    for i, name in enumerate(channels):
        axes[i].plot(y_true_st[:, i], label='Actual IMD Observation', color='#2563EB', alpha=0.8, linewidth=1.8)
        axes[i].plot(y_pred_st[:, i], label='Digital Twin Prediction', color='#DC2626', alpha=0.8, linestyle='--', linewidth=1.8)
        axes[i].set_title(f"All-India Aggregate {name} (Simulation vs Ground Truth)", fontsize=12, fontweight='bold')
        axes[i].set_ylabel(name, fontsize=10)
        axes[i].legend(loc="upper right")
        axes[i].grid(True, linestyle=":", alpha=0.6)
        
    plt.tight_layout()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    plt.savefig(out_path, dpi=200)
    plt.close()
    print(f"Timeseries plot saved to {out_path}")

def plot_spatial_heatmap(y_true, y_pred, timestep=150, out_path="results/heatmap.png"):
    """
    Renders 2D spatial distribution comparison for a specific day.
    """
    T = y_true.shape[0] // 961
    y_true_grid = y_true.reshape((T, 31, 31, 3))
    y_pred_grid = y_pred.reshape((T, 31, 31, 3))
    
    channels = ["Rainfall (mm)", "Max Temp (°C)", "Min Temp (°C)"]
    fig, axes = plt.subplots(3, 2, figsize=(12, 14))
    
    for i, name in enumerate(channels):
        sns.heatmap(y_true_grid[timestep, :, :, i], ax=axes[i, 0], cmap="viridis", cbar=True)
        axes[i, 0].set_title(f"Actual {name} (Day {timestep})")
        axes[i, 0].axis('off')
        
        sns.heatmap(y_pred_grid[timestep, :, :, i], ax=axes[i, 1], cmap="viridis", cbar=True)
        axes[i, 1].set_title(f"Predicted {name} (Day {timestep})")
        axes[i, 1].axis('off')
        
    plt.tight_layout()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    plt.savefig(out_path, dpi=200)
    plt.close()
    print(f"Heatmap visualization saved to {out_path}")

def main():
    parser = argparse.ArgumentParser(description="Generate Visualizations")
    parser.add_argument("--data_dir", type=str, default="data")
    parser.add_argument("--out_dir", type=str, default="results")
    args = parser.parse_args()
    
    pred_path = os.path.join(args.data_dir, "predictions_2023.npy")
    actual_path = os.path.join(args.data_dir, "actuals_2023.npy")
    
    if os.path.exists(pred_path) and os.path.exists(actual_path):
        y_pred = np.load(pred_path)
        y_true = np.load(actual_path)
        plot_timeseries(y_true, y_pred, os.path.join(args.out_dir, "timeseries.png"))
    else:
        print(f"Evaluation arrays not found in {args.data_dir}. Run evaluation first.")

if __name__ == "__main__":
    main()
