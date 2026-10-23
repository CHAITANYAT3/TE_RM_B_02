"""Model training and evaluation.

Rules enforced here
-------------------
* Preprocessing (imputer, and log/scaler for the logistic baseline) is fitted on the TRAIN split only.
* The decision threshold is chosen on the VALIDATION split only.
* The TEST split is scored once, after fitting and thresholding.
* No accuracy metric is reported. Headline metrics: PR-AUC (average precision), F1, precision,
  recall, ROC-AUC, MCC for the positive class.
* Outputs are uncalibrated model probabilities.
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, brier_score_loss, f1_score,
                             matthews_corrcoef, precision_recall_curve, precision_score,
                             recall_score, roc_auc_score)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

from .config import SEED
from .utils import get_logger, signed_log1p

log = get_logger()

HEADLINE_METRICS = ["pr_auc", "f1", "precision", "recall", "roc_auc", "mcc"]
METRIC_LABELS = {"pr_auc": "PR-AUC (average precision)", "f1": "F1 (positive class)",
                 "precision": "Precision", "recall": "Recall", "roc_auc": "ROC-AUC", "mcc": "MCC"}

try:  # XGBoost is the main model; if it is not installed we fall back and say so in the metadata.
    from xgboost import XGBClassifier
    HAS_XGB = True
except Exception:  # pragma: no cover - depends on environment
    XGBClassifier = None
    HAS_XGB = False


# ------------------------------------------------------------------ pipeline
def make_preprocessor(kind: str) -> Pipeline:
    """kind='tree': median imputation. kind='lr': imputation -> signed log1p -> standardisation."""
    steps = [("impute", SimpleImputer(strategy="median", keep_empty_features=True))]
    if kind == "lr":
        steps.append(("log", FunctionTransformer(signed_log1p, feature_names_out="one-to-one")))
        steps.append(("scale", StandardScaler()))
    pre = Pipeline(steps)
    pre.set_output(transform="pandas")
    return pre


def build_estimators(y_train: np.ndarray, fast: bool = False, seed: int = SEED, use_early_stopping=True):
    pos = int(np.sum(y_train))
    neg = int(len(y_train) - pos)
    spw = float(neg / max(pos, 1))
    est = {
        "logistic_regression": ("lr", LogisticRegression(max_iter=2000, class_weight="balanced")),
        "random_forest": ("tree", RandomForestClassifier(
            n_estimators=100 if fast else 300, min_samples_leaf=2, class_weight="balanced_subsample",
            n_jobs=-1, random_state=seed)),
    }
    if HAS_XGB:
        est["xgboost"] = ("tree", XGBClassifier(
            n_estimators=150 if fast else 600, max_depth=6, learning_rate=0.05, subsample=0.8,
            colsample_bytree=0.8, scale_pos_weight=spw, tree_method="hist", n_jobs=-1,
            random_state=seed, eval_metric="aucpr",
            early_stopping_rounds=30 if use_early_stopping else None))
    return est


def main_model_name() -> str:
    return "xgboost" if HAS_XGB else "random_forest"


# ------------------------------------------------------------------ metrics
def expected_calibration_error(y, p, bins: int = 10):
    y = np.asarray(y, dtype=float)
    p = np.asarray(p, dtype=float)
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges[1:-1]), 0, bins - 1)
    ece = 0.0
    for b in range(bins):
        m = idx == b
        if m.any():
            ece += m.mean() * abs(y[m].mean() - p[m].mean())
    return float(ece)


def compute_metrics(y, p, threshold: float) -> dict:
    """Threshold-free and thresholded metrics. Undefined metrics are None (never silently 0)."""
    y = np.asarray(y).astype(int)
    p = np.asarray(p, dtype=float)
    n = int(len(y))
    n_pos = int(y.sum())
    n_neg = n - n_pos
    m = {"n": n, "n_pos": n_pos, "n_neg": n_neg, "threshold": float(threshold)}
    if n == 0:
        return {**m, **{k: None for k in HEADLINE_METRICS}, "note": "empty split"}
    pred = (p >= threshold).astype(int)
    m["tp"] = int(((pred == 1) & (y == 1)).sum())
    m["fp"] = int(((pred == 1) & (y == 0)).sum())
    m["tn"] = int(((pred == 0) & (y == 0)).sum())
    m["fn"] = int(((pred == 0) & (y == 1)).sum())
    both = n_pos > 0 and n_neg > 0
    m["pr_auc"] = float(average_precision_score(y, p)) if n_pos > 0 else None
    m["roc_auc"] = float(roc_auc_score(y, p)) if both else None
    if n_pos > 0:
        m["precision"] = float(precision_score(y, pred, zero_division=0))
        m["recall"] = float(recall_score(y, pred, zero_division=0))
        m["f1"] = float(f1_score(y, pred, zero_division=0))
    else:
        m["precision"] = m["recall"] = m["f1"] = None
    m["mcc"] = float(matthews_corrcoef(y, pred)) if both else None
    m["brier"] = float(brier_score_loss(y, p))
    m["ece_10bin"] = expected_calibration_error(y, p)
    if not both:
        m["note"] = "single-class split: ROC-AUC/MCC undefined" + ("" if n_pos else "; no positives")
    return m


def choose_threshold(y_val, p_val):
    """Threshold maximising F1 for the positive class on the validation split only."""
    y_val = np.asarray(y_val).astype(int)
    if len(y_val) == 0 or y_val.sum() == 0 or y_val.sum() == len(y_val):
        return 0.5, "default 0.5 (validation split empty or single-class)"
    prec, rec, thr = precision_recall_curve(y_val, p_val)
    f1 = 2 * prec[:-1] * rec[:-1] / np.maximum(prec[:-1] + rec[:-1], 1e-12)
    i = int(np.nanargmax(f1))
    return float(thr[i]), "maximises validation F1"


def gaps(val: dict, test: dict) -> dict:
    """test minus validation for each headline metric (None if either is undefined)."""
    out = {}
    for k in HEADLINE_METRICS:
        a, b = val.get(k), test.get(k)
        out[k] = (b - a) if (a is not None and b is not None) else None
    return out


def curve_points(y, p, max_points: int = 400):
    y = np.asarray(y).astype(int)
    if len(y) == 0 or y.sum() == 0:
        return None
    prec, rec, _ = precision_recall_curve(y, p)
    if len(prec) > max_points:
        idx = np.unique(np.linspace(0, len(prec) - 1, max_points).astype(int))
        prec, rec = prec[idx], rec[idx]
    return {"precision": prec.tolist(), "recall": rec.tolist(), "prevalence": float(y.mean())}


# ------------------------------------------------------------------ training
def _fit_one(name, kind, est, Xtr, ytr, Xva, yva):
    pre = make_preprocessor(kind)
    pre.fit(Xtr)                                   # TRAIN ONLY
    Xtr_t = pre.transform(Xtr)
    val_ok = len(yva) > 0 and 0 < int(np.sum(yva)) < len(yva)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        if name == "xgboost":
            if val_ok:
                est.fit(Xtr_t, ytr, eval_set=[(pre.transform(Xva), yva)], verbose=False)
            else:
                est.set_params(early_stopping_rounds=None)
                est.fit(Xtr_t, ytr)
        else:
            est.fit(Xtr_t, ytr)
    return Pipeline([("pre", pre), ("clf", est)])


def _score(pipe, X):
    if len(X) == 0:
        return np.array([])
    return pipe.predict_proba(X)[:, 1]


def train_and_evaluate(X_tr, y_tr, X_va, y_va, X_te, y_te, fast=False, seed=SEED):
    """Fit logistic regression, random forest and (if installed) XGBoost on identical splits.

    Returns (results, pipelines). The main model is XGBoost (random forest if xgboost is missing).
    results['skipped'] is set (with a reason) when training is impossible, e.g. a single-class train split.
    """
    y_tr = np.asarray(y_tr).astype(int)
    y_va = np.asarray(y_va).astype(int)
    y_te = np.asarray(y_te).astype(int)
    if len(y_tr) == 0 or y_tr.sum() == 0 or y_tr.sum() == len(y_tr):
        return {"skipped": "training split is empty or single-class"}, {}

    val_ok = len(y_va) > 0 and 0 < int(y_va.sum()) < len(y_va)
    estimators = build_estimators(y_tr, fast=fast, seed=seed, use_early_stopping=val_ok)
    main = main_model_name()
    results = {"main_model": main, "backend": "xgboost" if HAS_XGB else "random_forest (xgboost not installed)",
               "models": {}}
    pipelines = {}
    for name, (kind, est) in estimators.items():
        log.info("  fitting %s ...", name)
        pipe = _fit_one(name, kind, est, X_tr, y_tr, X_va, y_va)
        p_tr, p_va, p_te = _score(pipe, X_tr), _score(pipe, X_va), _score(pipe, X_te)
        thr, thr_src = choose_threshold(y_va, p_va)
        m_va = compute_metrics(y_va, p_va, thr)
        m_te = compute_metrics(y_te, p_te, thr)         # test scored once, with the validation threshold
        entry = {
            "threshold": thr, "threshold_source": thr_src,
            "train_in_sample": compute_metrics(y_tr, p_tr, thr),
            "validation": m_va, "test": m_te, "test_minus_validation": gaps(m_va, m_te),
        }
        if name == "xgboost" and getattr(est, "best_iteration", None) is not None and val_ok:
            entry["best_iteration"] = int(est.best_iteration)
        if hasattr(est, "feature_importances_"):
            imp = pd.Series(est.feature_importances_, index=list(X_tr.columns)).sort_values(ascending=False)
            entry["native_importance_top"] = {k: float(v) for k, v in imp.head(20).items()}
        results["models"][name] = entry
        pipelines[name] = pipe
        if name == main:
            results["curves"] = {"validation": curve_points(y_va, p_va), "test": curve_points(y_te, p_te)}
    return results, pipelines
