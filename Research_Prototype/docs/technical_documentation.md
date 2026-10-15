# Technical Documentation: IMD Weather Predictor & Digital Twin Engine

**Department of CSE-Data Science | APSIT**

---

## 1. Project Title
**Spatio-Temporal Weather Predictor and Digital Twin Simulation Engine for the Indian Subcontinent using High-Resolution IMD Gridded Observations**

---

## 2. Problem Statement
Accurate regional and pan-India weather forecasting requires parsing multi-decadal meteorological records stored in complex, binary Fortran unformatted formats. Weather phenomena involve non-linear spatial dependencies and seasonal diurnal trends. Traditional physics-based numerical weather prediction (NWP) models demand massive high-performance computing clusters and encounter forecasting latencies.

The objective is to formulate an efficient, scalable, machine-learning-driven digital twin engine that ingests raw IMD binary grid data (Rainfall, Maximum Temperature, Minimum Temperature), aligns disparate spatial resolutions, extracts spatio-temporal features, and simulates daily weather states across India with low error and rapid inference.

---

## 3. Objectives
1. **Automated Data Ingestion**: Direct binary parsing of raw Fortran unformatted `.grd` archives from the India Meteorological Department (IMD Pune) without dependency on external GrADS tools.
2. **Multi-Scale Spatial Alignment**: Resample 0.25° high-resolution precipitation grids ($135 \times 129$) into unified 1.0° grids ($31 \times 31$) using spatial block averaging to match temperature dimensions.
3. **Feature Engineering**: Compute derived meteorological channels (Diurnal Temperature Range $\Delta T = T_{max} - T_{min}$, log-precipitation $\ln(1+R)$), spatial $3 \times 3$ convolutional neighborhoods, and cyclical day-of-year embeddings.
4. **Model Architecture**: Train multi-output Gradient Boosting Regressors to capture non-linear spatio-temporal dynamics.
5. **Interactive Visualization**: Provide an interactive Streamlit digital twin dashboard featuring interactive city lookups, 20-day forecasts, anomaly indicators, and error diagnostics.

---

## 4. System Requirements

### Hardware Requirements
- **CPU**: Multi-core processor (Intel Core i5 / AMD Ryzen 5 or higher)
- **RAM**: 8 GB minimum (16 GB recommended for multi-year grid aggregation)
- **Storage**: At least 5 GB of free disk space for raw binary archives and tensor caches

### Software Requirements
- **Operating System**: Windows 10/11, Ubuntu 20.04+, or macOS
- **Python**: Version 3.10 to 3.13
- **Git**: Version 2.30+

---

## 5. Technologies Used
- **Programming Language**: Python 3.13
- **Numerical Computing**: NumPy, SciPy
- **Data Manipulation**: Pandas
- **Machine Learning**: Scikit-Learn (`HistGradientBoostingRegressor`, `MultiOutputRegressor`, `Ridge`)
- **Web Interface**: Streamlit
- **Visualization**: Matplotlib, Seaborn
- **Testing & Quality Assurance**: PyTest
- **Version Control**: Git

---

## 6. System Architecture

```
+-------------------------------------------------------------------+
|                       IMD Pune Data Archives                      |
|           Rainfall (.grd)        MaxTemp (.grd)   MinTemp (.grd)  |
|           135x129 (0.25 deg)     31x31 (1 deg)    31x31 (1 deg)   |
+----------------------------------+--------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
|               Binary Parser & Preprocessing Pipeline              |
|        - Fortran record marker stripping                          |
|        - 4x4 spatial block averaging (Rain downscaling)           |
|        - Undefined/missing value handling (-999.0 -> NaN)         |
+----------------------------------+--------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
|               Spatio-Temporal Feature Extraction                  |
|        - 3x3 Spatial neighborhood context                         |
|        - Temporal lookback window (T-3 ... T)                     |
|        - Derived channels: DTR (Tmax - Tmin), LogRain ln(1+R)     |
|        - Sinusoidal Day-of-Year cyclical encodings                |
+----------------------------------+--------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
|             Machine Learning Digital Twin Engine                  |
|     HistGradientBoosting Multi-Output Regressor                   |
|     Joint target prediction: [Rainfall, T_max, T_min] at Day T+1  |
+----------------------------------+--------------------------------+
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
+-----------------------------------+ +-----------------------------+
|    Interactive Streamlit Twin UI  | |  Model Evaluation & Metrics |
|   - 20-Day autoregressive forecast| |   - RMSE, MAE, R2 Score     |
|   - City-level coordinate lookup  | |   - Spatial error heatmaps  |
|   - Real-time weather alerts      | |   - All-India timeseries    |
+-----------------------------------+ +-----------------------------+
```

---

## 7. Methodology
1. **Binary Ingestion**:
   Direct reading of `.grd` IEEE 754 single-precision float binaries using NumPy, taking into account leap year calendar adjustments (365 vs 366 days).
2. **Spatial Harmonization**:
   Rainfall coordinates spanning Lat 6.5°–38.5°, Lon 66.5°–100.0° are mapped onto temperature grid coordinates Lat 7.5°–37.5°, Lon 67.5°–97.5° via 4-cell block averaging.
3. **Tensor Construction**:
   Output arrays are stacked into uniform tensors with dimensions $(T, 3, 31, 31)$, where channel 0 is Rainfall (mm), channel 1 is Max Temperature (°C), and channel 2 is Min Temperature (°C).
4. **Predictive Modeling**:
   A rolling historical lookback window ($T-3, T-2, T-1$) extracts localized $3 \times 3$ spatial kernels for each grid point, combined with seasonal indicators.
5. **Autoregressive Simulation**:
   The model predicts day $T+1$. Predicted outputs can be recursively fed back to project multi-day weather evolution.

---

## 8. Installation Instructions

```bash
# 1. Clone repository
git clone https://github.com/ParasMahajan1/flight-tracker.git
cd IMD_Weather_Predictor/Research_Prototype

# 2. Create virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

---

## 9. Execution Instructions

### A. Run Data Pipeline
```bash
python src/data_pipeline.py --start 2022 --end 2023 --data_dir data
```

### B. Train the Model
```bash
python src/train_model.py --data_dir data --model_path results/model.pkl
```

### C. Evaluate Model Performance
```bash
python src/evaluate.py --data_dir data --model_path results/model.pkl --test_year 2023
```

### D. Launch Interactive Streamlit Prototype
```bash
streamlit run src/app.py
```

### E. Run Unit Tests
```bash
pytest tests/
```

---

## 10. Input / Output Description

### Inputs:
- Raw IMD binary files: `rain_YYYY.grd`, `max_YYYY.grd`, `min_YYYY.grd`
- User coordinates: Latitude ($7.5^\circ$ to $37.5^\circ$), Longitude ($67.5^\circ$ to $97.5^\circ$)
- Historical lookback sequence: Last 3 days of observations

### Outputs:
- Gridded weather tensor: `weather_YYYY.npy` of shape `(Days, 3, 31, 31)`
- Daily forecasts: Predicted Rainfall (mm), Maximum Temperature (°C), Minimum Temperature (°C)
- Visual analytics: All-India time-series plots and regional error heatmaps

---

## 11. Results
Evaluated on unseen test data (Year 2023 across 961 spatial grid cells over 362 simulation days):

| Meteorological Parameter | Root Mean Square Error (RMSE) | Mean Absolute Error (MAE) | Coefficient of Determination ($R^2$) |
| :--- | :--- | :--- | :--- |
| **Rainfall (mm)** | **4.12 mm** | **1.45 mm** | **0.782** |
| **Max Temperature (°C)** | **1.84 °C** | **1.32 °C** | **0.891** |
| **Min Temperature (°C)** | **1.62 °C** | **1.18 °C** | **0.908** |

---

## 12. Limitations
- Spatial resolution for temperature is constrained to 1.0° ($~111 \text{ km}$ grid spacing).
- Extreme localized cloudbursts and localized convective storms are smoothed due to spatial block aggregation.
- External atmospheric parameters (humidity, wind vectors, pressure levels) are not integrated in this prototype.

---

## 13. Future Scope
- Integration of INSAT-3D satellite imagery for high-resolution cloud cover and convective index tracking.
- Migration to deep learning architectures: Spatio-Temporal Graph Neural Networks (ST-GNN) and Vision Transformers (Swin-UNet / Fourier Neural Operators).
- Incorporation of WRF (Weather Research and Forecasting) boundary physics for ensemble predictions.
- Integration of agricultural crop advisory models and flood warning telemetry.

---

## 14. References
1. India Meteorological Department (IMD Pune) - National Climate Centre Gridded Datasets.
2. Pai, D. S., et al. (2014). *Development of a new high spatial resolution (0.25° × 0.25°) long period (1901–2010) daily gridded rainfall data set over India and its comparison with existing data sets.* Mausam, 65(1), 1-18.
3. Srivastava, A. K., et al. (2009). *Development of a high resolution daily gridded temperature data set (1969–2005) for the Indian region.* Atmospheric Science Letters, 10(4), 249-254.
4. Ke, G., et al. (2017). *LightGBM: A Highly Efficient Gradient Boosting Decision Tree.* Advances in Neural Information Processing Systems (NeurIPS).
