"""Temporal Fusion Transformer (TFT) Experimental Forecasting Module for ClimateX.

Implements a lightweight, self-contained Temporal Fusion Transformer architecture
using PyTorch to forecast annual Temperature_C from historical multi-variate
time-series inputs:
- Temperature_C
- Rainfall_mm
- CO2_Emissions_tonnes

IMPORTANT SCIENTIFIC AND VALIDATION CONSTRAINTS:
- Only 25 annual observations exist (2000–2024).
- Chronological split: 2000–2019 (20 samples -> 17 sequence windows of length 3)
  and 2020–2024 (5 samples -> 5 test sequence windows).
- Deep temporal transformer architectures (Lim et al., 2021) typically require
  hundreds to thousands of sequence steps across entities to learn multi-head
  attention and gated residual networks without catastrophic overfitting.
- Status is formally flagged as 'insufficient_data' to strictly prevent
  fabricating reliability or claiming production readiness.
"""

import math
from typing import Dict, List, Optional
import numpy as np
import pandas as pd
from pydantic import BaseModel
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import torch
import torch.nn as nn
import torch.optim as optim

from app.data_loader import load_dataset


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class TFTDataSufficiency(BaseModel):
    total_observations: int
    training_samples: int
    testing_samples: int
    lookback_window: int
    training_sequences: int
    testing_sequences: int
    recommended_minimum: int
    sufficiency_percentage: float
    status: str


class TFTVariableImportance(BaseModel):
    feature_name: str
    weight: float
    percentage: float


class TFTArchitectureInfo(BaseModel):
    model_name: str
    paradigm: str
    lookback_window: int
    input_features: List[str]
    target_feature: str
    hidden_dimension: int
    attention_heads: int
    parameter_count: int


class TFTExperimentalMetrics(BaseModel):
    mae: float
    mse: float
    rmse: float
    r2: float
    training_loss: float


class TFTYearlyPrediction(BaseModel):
    year: int
    actual: float
    predicted: float
    error: float


class TFTExperimentalResponse(BaseModel):
    model_name: str
    status: str
    status_label: str
    is_reliable: bool
    data_sufficiency: TFTDataSufficiency
    architecture: TFTArchitectureInfo
    metrics: TFTExperimentalMetrics
    variable_selection_weights: List[TFTVariableImportance]
    yearly_predictions: List[TFTYearlyPrediction]
    scientific_disclaimer: str
    limitations: List[str]


# ─── Lightweight TFT PyTorch Model Architecture ──────────────────────────────

class GatedResidualNetwork(nn.Module):
    """Lightweight GRN with ELU activation, linear transformations, and GLU gating."""

    def __init__(self, d_model: int):
        super().__init__()
        self.fc1 = nn.Linear(d_model, d_model)
        self.elu = nn.ELU()
        self.fc2 = nn.Linear(d_model, d_model)
        self.gate = nn.Linear(d_model, d_model)
        self.sigmoid = nn.Sigmoid()
        self.layer_norm = nn.LayerNorm(d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        a = self.elu(self.fc1(x))
        a = self.fc2(a)
        g = self.sigmoid(self.gate(x))
        out = residual + (a * g)
        return self.layer_norm(out)


class VariableSelectionNetwork(nn.Module):
    """Computes softmax attention weights across multi-variate feature inputs."""

    def __init__(self, num_features: int, d_model: int):
        super().__init__()
        self.num_features = num_features
        self.feature_embeds = nn.ModuleList([
            nn.Linear(1, d_model) for _ in range(num_features)
        ])
        self.weight_layer = nn.Linear(num_features * d_model, num_features)
        self.softmax = nn.Softmax(dim=-1)

    def forward(self, x: torch.Tensor):
        # x: (batch_size, seq_len, num_features)
        batch_size, seq_len, _ = x.shape
        embedded = []
        for i in range(self.num_features):
            feat_slice = x[:, :, i:i+1]  # (batch, seq, 1)
            emb = self.feature_embeds[i](feat_slice)  # (batch, seq, d_model)
            embedded.append(emb)

        # Concatenate across features to compute selection weights
        concat_emb = torch.cat(embedded, dim=-1)  # (batch, seq, num_features * d_model)
        selection_weights = self.softmax(self.weight_layer(concat_emb))  # (batch, seq, num_features)

        # Weighted combination of embedded representations
        combined = torch.zeros(batch_size, seq_len, embedded[0].shape[-1], device=x.device)
        for i in range(self.num_features):
            w = selection_weights[:, :, i:i+1]
            combined += w * embedded[i]

        return combined, selection_weights


class LightweightTFT(nn.Module):
    """Self-contained, lightweight Temporal Fusion Transformer for multi-variate forecasting."""

    def __init__(self, num_features: int = 3, d_model: int = 16, num_heads: int = 2):
        super().__init__()
        self.vsn = VariableSelectionNetwork(num_features, d_model)
        self.self_attn = nn.MultiheadAttention(embed_dim=d_model, num_heads=num_heads, batch_first=True)
        self.grn = GatedResidualNetwork(d_model)
        self.head = nn.Linear(d_model, 1)

    def forward(self, x: torch.Tensor):
        # x: (batch_size, seq_len, num_features)
        vsn_out, weights = self.vsn(x)
        attn_out, _ = self.self_attn(vsn_out, vsn_out, vsn_out)
        grn_out = self.grn(attn_out)
        # Use representation from the latest lookback time step to predict next horizon
        last_step = grn_out[:, -1, :]  # (batch_size, d_model)
        out = self.head(last_step)     # (batch_size, 1)
        return out, weights


# ─── Training & Computation Function ─────────────────────────────────────────

def compute_tft_experimental() -> TFTExperimentalResponse:
    """Executes a real lightweight TFT training and diagnostics evaluation.

    Returns computed metrics while clearly classifying status as insufficient_data.
    """
    torch.manual_seed(42)
    np.random.seed(42)

    df = load_dataset().sort_values("Year").reset_index(drop=True)
    features = ["Temperature_C", "Rainfall_mm", "CO2_Emissions_tonnes"]
    target_col = "Temperature_C"

    train_df = df[(df["Year"] >= 2000) & (df["Year"] <= 2019)].copy()
    test_df = df[(df["Year"] >= 2020) & (df["Year"] <= 2024)].copy()

    train_feats_np = train_df[features].to_numpy()
    train_target_np = train_df[target_col].to_numpy().reshape(-1, 1)

    scaler_features = StandardScaler()
    scaler_features.fit(train_feats_np)

    scaler_target = StandardScaler()
    scaler_target.fit(train_target_np)

    train_scaled = scaler_features.transform(train_feats_np)
    all_scaled = scaler_features.transform(df[features].to_numpy())

    lookback_window = 3

    def build_sequences(scaled_arr: np.ndarray, source_df: pd.DataFrame):
        X, y, yrs = [], [], []
        for i in range(lookback_window, len(scaled_arr)):
            X.append(scaled_arr[i - lookback_window : i])
            y.append(source_df[target_col].iloc[i])
            yrs.append(int(source_df["Year"].iloc[i]))
        return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32), yrs

    X_train_raw, y_train_raw, train_years = build_sequences(train_scaled, train_df)

    # For testing, build windows from the entire chronological series to allow 2020..2024 lookback
    X_all_raw, y_all_raw, all_years = build_sequences(all_scaled, df)
    test_mask = [y in range(2020, 2025) for y in all_years]
    X_test_raw = X_all_raw[test_mask]
    y_test_raw = y_all_raw[test_mask]
    test_years_actual = [y for y, m in zip(all_years, test_mask) if m]

    # Convert to tensors
    X_train_tensor = torch.tensor(X_train_raw, dtype=torch.float32)
    # Target normalized for training stability
    y_train_norm = scaler_target.transform(y_train_raw.reshape(-1, 1)).flatten()
    y_train_tensor = torch.tensor(y_train_norm, dtype=torch.float32).unsqueeze(1)

    X_test_tensor = torch.tensor(X_test_raw, dtype=torch.float32)

    # Initialize model
    model = LightweightTFT(num_features=len(features), d_model=16, num_heads=2)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.015, weight_decay=1e-4)

    # Train model for 50 epochs
    model.train()
    total_loss = 0.0
    for _ in range(50):
        optimizer.zero_grad()
        preds, _ = model(X_train_tensor)
        loss = criterion(preds, y_train_tensor)
        loss.backward()
        optimizer.step()
        total_loss = float(loss.item())

    # Evaluation on test set
    model.eval()
    with torch.no_grad():
        test_preds_norm, selection_weights = model(X_test_tensor)
        test_preds_norm_np = test_preds_norm.numpy().reshape(-1, 1)
        test_preds_c = scaler_target.inverse_transform(test_preds_norm_np).flatten()

        # Variable selection weights averaged across test sequences & time steps
        avg_weights = selection_weights.mean(dim=(0, 1)).numpy()

    # Calculate real evaluation metrics
    mae = float(mean_absolute_error(y_test_raw, test_preds_c))
    mse = float(mean_squared_error(y_test_raw, test_preds_c))
    rmse = float(math.sqrt(mse))
    r2 = float(r2_score(y_test_raw, test_preds_c))

    # Weight distribution
    total_w = float(np.sum(avg_weights))
    if total_w <= 0:
        total_w = 1.0
    feature_label_map = {
        "Temperature_C": "Temperature (°C)",
        "Rainfall_mm": "Rainfall (mm)",
        "CO2_Emissions_tonnes": "CO₂ Emissions (tonnes)",
    }
    var_importance = [
        TFTVariableImportance(
            feature_name=feature_label_map.get(feat, feat),
            weight=round(float(w), 4),
            percentage=round(float((w / total_w) * 100), 1),
        )
        for feat, w in zip(features, avg_weights)
    ]

    yearly_preds = [
        TFTYearlyPrediction(
            year=int(yr),
            actual=round(float(act), 4),
            predicted=round(float(prd), 4),
            error=round(float(prd - act), 4),
        )
        for yr, act, prd in zip(test_years_actual, y_test_raw, test_preds_c)
    ]

    param_count = sum(p.numel() for p in model.parameters() if p.requires_grad)

    total_obs = len(df)
    train_obs = len(train_df)
    test_obs = len(test_df)
    recommended_min = 250
    sufficiency_pct = round((total_obs / recommended_min) * 100, 1)

    data_sufficiency = TFTDataSufficiency(
        total_observations=total_obs,
        training_samples=train_obs,
        testing_samples=test_obs,
        lookback_window=lookback_window,
        training_sequences=len(X_train_raw),
        testing_sequences=len(X_test_raw),
        recommended_minimum=recommended_min,
        sufficiency_percentage=sufficiency_pct,
        status="insufficient_data",
    )

    architecture_info = TFTArchitectureInfo(
        model_name="Temporal Fusion Transformer (Lightweight Experimental)",
        paradigm="Multi-Horizon Deep Temporal Attention & Variable Selection",
        lookback_window=lookback_window,
        input_features=["Temperature (°C)", "Rainfall (mm)", "CO₂ Emissions (tonnes)"],
        target_feature="Temperature (°C)",
        hidden_dimension=16,
        attention_heads=2,
        parameter_count=param_count,
    )

    metrics = TFTExperimentalMetrics(
        mae=round(mae, 4),
        mse=round(mse, 6),
        rmse=round(rmse, 4),
        r2=round(r2, 4),
        training_loss=round(total_loss, 6),
    )

    scientific_disclaimer = (
        "Temporal Fusion Transformers (Lim et al., 2021) are designed for large multi-horizon sequence datasets "
        "comprising hundreds to thousands of temporal steps. With only 25 annual observations (2000–2024), "
        "training sequence windows (17 samples) are drastically outnumbered by model parameters (~2,000+), "
        "introducing severe risk of variance instability and overfitting. Consequently, TFT is marked as "
        "an experimental prototype, and these results must NOT be treated as scientifically sound climate forecasts."
    )

    limitations = [
        f"Data Scarcity: Only {total_obs} annual observations exist ({sufficiency_pct}% of the recommended {recommended_min}+ samples for deep temporal attention).",
        f"Severe Parameter Disparity: The lightweight TFT contains {param_count} trainable parameters for only {len(X_train_raw)} training sequence windows.",
        "Lack of Intra-Annual Seasonality: Annual granularity eliminates sub-annual seasonal patterns (such as monsoon onset and dry-season cycles) essential for multi-head temporal attention.",
        "Overfitting & Random Seed Sensitivity: On micro-datasets, transformer gradients are highly sensitive to weight initialization, producing non-generalizable test results."
    ]

    return TFTExperimentalResponse(
        model_name="Temporal Fusion Transformer (TFT)",
        status="insufficient_data",
        status_label="Insufficient Data for Reliable TFT Training",
        is_reliable=False,
        data_sufficiency=data_sufficiency,
        architecture=architecture_info,
        metrics=metrics,
        variable_selection_weights=var_importance,
        yearly_predictions=yearly_preds,
        scientific_disclaimer=scientific_disclaimer,
        limitations=limitations,
    )
