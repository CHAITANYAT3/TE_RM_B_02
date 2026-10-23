"""Small shared helpers."""
from __future__ import annotations

import hashlib
import json
import logging
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def get_logger(name: str = "cryptoradar") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


def sanitize(obj):
    """Recursively convert numpy/pandas objects to JSON-safe values (NaN/inf -> None)."""
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [sanitize(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return sanitize(obj.tolist())
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if obj is pd.NaT:
        return None
    if isinstance(obj, pd.Timestamp):
        return None if pd.isna(obj) else obj.isoformat()
    if isinstance(obj, Path):
        return str(obj)
    return obj


def write_json(path, obj) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(sanitize(obj), fh, indent=2, ensure_ascii=False)


def read_json(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def signed_log1p(x):
    """sign(x) * log1p(|x|); works on arrays and DataFrames."""
    return np.sign(x) * np.log1p(np.abs(x))


def safe_div(a, b):
    """Element-wise a / b with NaN where b is 0 or either input is NaN."""
    a = np.asarray(a, dtype="float64")
    b = np.asarray(b, dtype="float64")
    shape = np.broadcast(a, b).shape
    out = np.full(shape, np.nan, dtype="float64")
    a_b, b_b = np.broadcast_to(a, shape), np.broadcast_to(b, shape)
    ok = (b_b != 0) & ~np.isnan(b_b) & ~np.isnan(a_b)
    out[ok] = a_b[ok] / b_b[ok]
    return out


def hash_payload(payload: dict) -> str:
    blob = json.dumps(sanitize(payload), sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()[:16]


def seconds_since_epoch(series: pd.Series) -> pd.Series:
    """Datetime series -> float seconds (NaT stays NaN). Robust across pandas versions."""
    return (series - pd.Timestamp("1970-01-01")) / pd.Timedelta(seconds=1)
