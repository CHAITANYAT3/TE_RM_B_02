# Smart EV Charging Stations Powered by Solar Renewable Energy

## Experiment 7: Prototype Development, Version Control, Technical Documentation, and Reproducible Research

### Problem
EV charging demand can vary over time, while solar generation changes with irradiance and weather. This prototype uses the supplied PV/EV dataset to build a baseline classifier that predicts the dataset's `Optimal_Charging_Decision` label from the available charging, solar, battery, grid and demand features.

### Datasets
- `data/PV_EV_Charging_Dataset.csv`: 1000 rows, 20 columns. Main modelling dataset; target is `Optimal_Charging_Decision`.
- `data/smart_ev.csv`: 1000 rows, 11 columns. Supporting dataset with EV demand, grid load, renewable generation, load balance and operational-efficiency fields. It is included for descriptive analysis/future extension, not mixed into the main model because its schema and target differ.

### Prototype
A Random Forest baseline with a fixed random seed, an 80/20 stratified train/test split, numeric median imputation, and one-hot encoding for categorical features. The output includes accuracy, confusion matrix, classification report and a JSON results file.

### Setup and execution
1. Install Python 3.10 or newer.
2. Open a terminal in this project folder.
3. (Recommended) Create a virtual environment: `python -m venv .venv`
4. Activate it on Windows: `.venv\\Scripts\\activate`
5. Install dependencies: `python -m pip install -r requirements.txt`
6. Run: `python src/prototype.py`
7. Read `results/evaluation.json`.

### Version control commands
```bash
git init
git add .
git commit -m "V1.0 Initial project setup and datasets"
git add src/prototype.py requirements.txt
git commit -m "V1.1 Add data preprocessing and baseline model"
git add results/
git commit -m "V1.2 Add model evaluation results"
git add README.md docs/
git commit -m "V1.3 Add technical documentation"
git tag v2.0
```
Make each commit after the described work is actually completed. Do not claim these commits already exist; create them in your own Git repository.

### Important interpretation
The model score is a baseline result on the supplied dataset only. A high score does not prove real-world performance. The target may be synthetically generated or strongly determined by existing features; validate the label-generation process, check for leakage, and test on real station data before deployment. This prototype is not a live charger controller and does not physically operate charging hardware.
