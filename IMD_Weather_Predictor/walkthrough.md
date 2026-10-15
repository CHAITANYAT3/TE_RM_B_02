# IMD Weather Prediction & Digital Twin Report

This report outlines the development of the long-term weather prediction model using IMD Pune datasets, directly addressing the provided evaluation parameters.

## Problem Understanding & Clarity
The challenge was to ingest long-term IMD gridded binary data (.grd) for Rainfall, Maximum Temperature, and Minimum Temperature, and utilize this information to create accurate long-term weather predictions. We constrained the problem to a spatio-temporal modeling task over the Indian subcontinent, treating each coordinate in the grid as a localized weather system to be predicted.

## Data Usage & Pre-processing
We automated the retrieval of data from the IMD Pune servers using a custom data pipeline (`data_pipeline.py`). 
- **Parsing**: The raw Unformatted Binary files were parsed using `numpy.fromfile`, accounting for Fortran record markers where present.
- **Alignment**: The high-resolution Rainfall grid (135x129, 0.25° resolution) was downscaled to match the Temperature grids (31x31, 1° resolution) using a spatial mapping function, yielding a cohesive $31 \times 31$ multi-variate geographical grid.
- **Feature Engineering**: A rolling lookback window ($T-3 \dots T$) was generated for each coordinate to predict day $T+1$.

## Model Development & Technical Approach
We implemented a robust Spatio-Temporal predictive engine (`train_model.py`) using Ridge Regression. 
- **Scalability**: By training on the flattened spatial dimension, the model learns a generalized representation of local weather transitions across the entire subcontinent. 
- **Multivariate**: The input features consist of `(Rain, MaxTemp, MinTemp)` across a moving historical window, allowing the model to capture the correlations between temperature shifts and precipitation.

## Digital Twin Concept Implementation
The **Digital Twin** concept is realized by modeling the Indian subcontinent as an interconnected grid of states. Our trained model acts as the "Twin" engine: given the current real-world state of the grid (temperature and rainfall at day $T$), the Twin simulates the evolution of the weather for day $T+1$. Over a long term, this twin can be run autoregressively (feeding predictions back as inputs) to simulate macro-level climate trends for the entire country.

## Prediction Performance & Validation
The model was evaluated (`predict.py`) using unseen test data (e.g., Year 2023) using the following metrics:
- **Root Mean Square Error (RMSE)**: Penalizes large deviations (e.g., extreme rainfall misses).
- **Mean Absolute Error (MAE)**: Measures average expected variance in daily predictions.

*Note: Execution logs provide the exact numerical performance on the localized system.*

## Innovation & Creativity
1. **Automated Binary Ingestion**: Instead of relying on manual GrADS software exports, we built a pure Python binary parser capable of reading Fortran unformatted grids dynamically directly from the IMD archives.
2. **Local-Global Representation**: Rather than a single massive network that requires supercomputing, we flattened the geographical dimension. The model learns the *universal physics* of local weather transitions, allowing it to predict any grid cell efficiently.

## Visualization & Analytics
Below are the visual analytics of the Digital Twin engine running against the unobserved year (2023).

### Time-Series Prediction
The all-India aggregated timeseries of the prediction vs real-world ground truth over the course of the 2023 simulation.

![Timeseries Visualization](/Users/yxshw/.gemini/antigravity/brain/c43d0cdf-2150-4978-925f-46156e55ad8c/timeseries.png)
