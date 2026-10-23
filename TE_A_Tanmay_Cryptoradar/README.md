# CryptoRadar - Multi-Dataset Cryptocurrency Risk Intelligence Platform

Academic prototype for **"Cybercrime Trend Analysis Using Machine Learning: Cryptocurrency Scams and Rug-Pull Fraud."**
Runs fully offline on your local copies of SolRPDS, Real-CATS and Elliptic.

## What it does

| Dataset | Models (each trained separately, never merged) |
|---|---|
| SolRPDS | `solrpds_primary` (excludes outcome-related timestamp fields) and `solrpds_ablation` (adds timestamp-derived duration features; **potentially label-leaking**) |
| Real-CATS BTC | `btc_filtered` (**headline**, zero-transaction addresses excluded) and `btc_full` (zero-activity addresses are training-only, flagged report-only) |
| Real-CATS ETH | `eth` |
| Elliptic | `elliptic` (165 provided features) and `elliptic_degree` (ablation: + in/out degree from the edge list) |

Also: SHAP explainability, trend analysis, a dark Streamlit dashboard, SQLite prediction history, an automated PDF report, and unit tests.

### Terminology (used everywhere)
* SolRPDS target = **inactivity-based rug-pull proxy label**, `y = (INACTIVITY_STATUS == "Inactive")`.
  *The positive class is an inactivity-based proxy derived from SolRPDS, not an independently verified rug-pull ground truth.*
* Outputs are a **model probability / model risk score / model-indicated risk**. They are **uncalibrated** and are not comparable across datasets.

## Install

Python 3.10 - 3.12.

```bash
cd crypto_radar
python -m venv .venv
# macOS / Linux:
source .venv/bin/activate
# Windows PowerShell:
#   .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Put your data here (exact names)

```
data/solrpds/2021.json
data/solrpds/2022.json
data/solrpds/2023.json
data/solrpds/Jan_2024-Nov_2024.json
data/real_cats/CB.tsv          # BTC criminal
data/real_cats/BB.tsv          # BTC benign
data/real_cats/CE.tsv          # ETH criminal
data/real_cats/BE.tsv          # ETH benign
data/elliptic/elliptic_txs_features.csv
data/elliptic/elliptic_txs_classes.csv
data/elliptic/elliptic_txs_edgelist.csv
```

All four SolRPDS files are partitions of one dataset and **must all be present** (they are concatenated).
The loader accepts NDJSON (one JSON object per line, as in your samples) or a JSON array.

## Run, in this order

```bash
python -m src.data_audit        # 1. audit of YOUR full data -> outputs/audit/audit.json (+ console summary)
python -m src.train --all       # 2. trains every model, SHAP, trends, figures
pytest -q                       # 3. unit tests (also: python -m unittest discover -s tests -t .)
python generate_report.py       # 4. PDF -> outputs/reports/CryptoRadar_Research_Report.pdf
streamlit run app.py            # 5. dashboard at http://localhost:8501
```

Useful options: `python -m src.train --only elliptic btc` (subset), `--fast` (smaller models, debugging).
`--skip-shap` and `--allow-partial-solrpds` exist for debugging only; do not use them for reported results.

## Methodology in brief

* **Splits (time-aware).** SolRPDS and Real-CATS: chronological 60/20/20 on first-activity time (SolRPDS grouped by pool,
  so one pool never straddles splits). Elliptic: time steps 1-29 train, 30-34 validation, 35-49 test; `unknown` is excluded
  from train/validation/test and kept only for descriptive trend statistics.
* **No leakage.** Imputation (and log/scaling for the logistic baseline) is fitted on training data only. The decision threshold
  (max F1 on validation) is chosen on validation only. The test split is scored once.
* **Excluded from all Real-CATS features:** `address`, `label`/subtype, `watchback_checked`, `gs_checked`, `etherscan_checked`,
  all `*_transaction_id` columns, and any `*_checked` / source / annotation / verification / collection column.
  Absolute timestamps are used for splitting only. Subtype is used only for trend analysis.
* **SolRPDS primary** excludes `LAST_SWAP_TIMESTAMP`, `LAST_SWAP_TX_ID`, `LAST_POOL_ACTIVITY_TIMESTAMP` and everything derived from them.
* **Real-CATS zero-activity addresses** (no transactions, no timestamps): kept only in `btc_full` as training-only rows and
  marked *report-only / no observed on-chain activity*; excluded from `btc_filtered` and from `eth`. They are scored separately as a
  report-only diagnostic. `btc_full` and `btc_filtered` metrics are never averaged or combined.
* **Units.** BTC: satoshi to BTC (/1e8). ETH: Wei to ETH (/1e18). The audit prints the implied USD-per-coin as a sanity check.
* **Metrics.** PR-AUC (average precision), F1, precision, recall, ROC-AUC, MCC for the positive class, with train (in-sample),
  validation, test and the test-minus-validation gap. Accuracy is not a headline metric.
* **Algorithms.** XGBoost (main), with logistic regression and random forest baselines on identical splits. If `xgboost` is missing the
  main model falls back to random forest and this is recorded in the model metadata.

## Outputs

```
models/<key>.joblib, models/<key>_meta.json     fitted pipeline + features, exclusions, threshold, split rules
outputs/audit/audit.json                          runtime data audit
outputs/metrics/<key>_metrics.json, summary.json  all metrics
outputs/shap/<key>_importance.csv, *_shap_sample.npz
outputs/trends/*.csv
outputs/figures/{dark,light}/*.png
outputs/reports/CryptoRadar_Research_Report.pdf
outputs/cryptoradar.db                            SQLite prediction history
```

## Dashboard notes

* The platform is offline: it scores addresses, pools and transactions that exist in your local files (look-up), uploaded rows in the
  dataset's original layout, or (SolRPDS primary) manually entered values. It cannot fetch live chain data.
* Pages: Overview, Risk scoring, Model performance, Explainability, Trend analysis, Prediction history, Labels and limitations, Research report.

## Troubleshooting

* `Missing SolRPDS partitions ...` - put all four JSON files in `data/solrpds/`.
* `the 'shap' package is not installed` - `pip install -r requirements.txt`.
* A split reported as single-class or empty (see the log and `split_summary` in each metrics file) means that
  time range has no positives or negatives; affected metrics are reported as `n/a` rather than invented.
