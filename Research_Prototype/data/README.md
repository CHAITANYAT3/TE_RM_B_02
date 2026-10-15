# Data Directory

This folder stores raw and processed IMD gridded datasets:
- Raw binary `.grd` files from IMD Pune (Rainfall at 0.25 deg, Max/Min temperature at 1.0 deg).
- Preprocessed `.npy` tensors: `weather_YYYY.npy` with shape `(Days, Channels=3, Lat=31, Lon=31)`.

> Note: Due to size constraints, raw `.grd` and `.npy` binaries are ignored in git via `.gitignore`. Sample download scripts can be executed using `src/data_pipeline.py`.
