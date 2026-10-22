# Department of CSE-Data Science | APSIT
## Research Prototype: IMD Weather Predictor & Digital Twin Engine

### 1. Project Title
**Spatio-Temporal Weather Predictor and Digital Twin Simulation Engine for the Indian Subcontinent using High-Resolution IMD Gridded Observations**

### 2. Problem Statement
Forecasting regional and pan-India weather patterns requires handling high-volume, multi-decadal gridded binary meteorological data. Numerical weather prediction (NWP) models require excessive computational power and exhibit operational lag. This research prototype formulates a rapid, scalable machine learning digital twin engine capable of ingesting raw IMD binary archives, learning spatial and seasonal dynamics, and providing multi-day weather simulations.

### 3. Key Objectives
- **Direct Binary Parsing**: Ingest Fortran binary `.grd` datasets directly from IMD Pune.
- **Multi-Resolution Harmonization**: Downsample 0.25° rainfall grids to match 1.0° temperature grids.
- **Spatio-Temporal Feature Learning**: Combine local 3x3 spatial context, cyclical seasonal encodings, and diurnal temperature ranges.
- **Interactive Digital Twin**: Interactive Streamlit portal featuring multi-city lookups and 20-day forecasts.

### 4. Project Structure
```
Research_Prototype/
├── README.md
├── data/
│   └── README.md
├── src/
│   ├── data_pipeline.py
│   ├── train_model.py
│   ├── evaluate.py
│   ├── validator.py
│   ├── visualize.py
│   └── app.py
├── notebooks/
│   └── exploratory_analysis.ipynb
├── results/
│   ├── metrics_summary.json
│   └── timeseries.png
├── docs/
│   └── technical_documentation.md
├── tests/
│   └── test_validation.py
├── requirements.txt
└── .gitignore
```

### 5. Quick Installation & Execution
```bash
# Clone and enter directory
cd Research_Prototype

# Install requirements
pip install -r requirements.txt

# Run data pipeline
python src/data_pipeline.py --start 2022 --end 2023

# Train model
python src/train_model.py

# Evaluate model
python src/evaluate.py

# Launch web prototype
streamlit run src/app.py

# Run test suite
pytest tests/
```

### 6. Results
- **Rainfall (mm)**: RMSE 4.12 mm | MAE 1.45 mm | $R^2 = 0.782$
- **Max Temp (°C)**: RMSE 1.84 °C | MAE 1.32 °C | $R^2 = 0.891$
- **Min Temp (°C)**: RMSE 1.62 °C | MAE 1.18 °C | $R^2 = 0.908$

Detailed technical specifications, system architecture diagrams, and mathematical formulations are documented in [`docs/technical_documentation.md`](docs/technical_documentation.md).
