"""Readers for everything training saved. The dashboard and the PDF only read through here,
so neither can display a number that training did not produce."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from .config import MODEL_SPECS, Paths
from .utils import read_json


def metrics_path(paths: Paths, key: str) -> Path:
    return paths.metrics / f"{key}_metrics.json"


def meta_path(paths: Paths, key: str) -> Path:
    return paths.models / f"{key}_meta.json"


def model_path(paths: Paths, key: str) -> Path:
    return paths.models / f"{key}.joblib"


def load_metrics(paths: Paths, key: str):
    p = metrics_path(paths, key)
    return read_json(p) if p.exists() else None


def load_meta(paths: Paths, key: str):
    p = meta_path(paths, key)
    return read_json(p) if p.exists() else None


def load_summary(paths: Paths):
    p = paths.metrics / "summary.json"
    return read_json(p) if p.exists() else None


def load_audit(paths: Paths):
    p = paths.audit / "audit.json"
    return read_json(p) if p.exists() else None


def load_importance(paths: Paths, key: str):
    p = paths.shap / f"{key}_importance.csv"
    return pd.read_csv(p) if p.exists() else None


def trained_keys(paths: Paths) -> list:
    """Model keys that have a saved, usable model (skipped/failed ones are excluded)."""
    return [k for k in MODEL_SPECS if model_path(paths, k).exists() and meta_path(paths, k).exists()]


def metric_keys(paths: Paths) -> list:
    """Model keys that have a metrics file (including ones whose training was skipped)."""
    return [k for k in MODEL_SPECS if metrics_path(paths, k).exists()]
