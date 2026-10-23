"""Scoring of new rows with a saved model. Output is a *model risk score*: an uncalibrated model probability."""
from __future__ import annotations

import joblib
import pandas as pd

from . import artifacts
from .config import MODEL_SPECS, Paths
from .features import elliptic as ell_feat
from .features import realcats as rc_feat
from .features import solrpds as sol_feat
from .loaders.solrpds import clean_solrpds_frame
from .narrative import ABOVE, BELOW
from .utils import hash_payload


def load_model(paths: Paths, key: str):
    meta = artifacts.load_meta(paths, key)
    mp = artifacts.model_path(paths, key)
    if meta is None or not mp.exists():
        raise FileNotFoundError(f"No trained model for '{key}'. Run: python -m src.train --all")
    return joblib.load(mp), meta


def build_features(key: str, raw: pd.DataFrame, meta: dict) -> pd.DataFrame:
    """Raw frame (in the dataset's original schema/units) -> model feature matrix in training order."""
    ds = MODEL_SPECS[key]["dataset"]
    names = meta["feature_names"]
    if ds == "solrpds":
        df = clean_solrpds_frame(raw) if "y" not in raw.columns else raw
        full = sol_feat.build_ablation(df) if key == "solrpds_ablation" else sol_feat.build_primary(df)
        return full[names]
    if ds in ("btc", "eth"):
        prep = rc_feat.prepare(raw, ds)
        return rc_feat.feature_matrix(prep, names)
    if ds == "elliptic":
        return ell_feat.feature_matrix(raw, names)
    raise ValueError(ds)


def score_features(pipeline, meta: dict, X: pd.DataFrame) -> pd.DataFrame:
    p = pipeline.predict_proba(X)[:, 1]
    out = pd.DataFrame({"model_risk_score": p}, index=X.index)
    thr = float(meta["threshold"])
    out["threshold"] = thr
    out["above_threshold"] = out["model_risk_score"] >= thr
    out["indication"] = out["above_threshold"].map({True: ABOVE, False: BELOW})
    return out


def row_hash(row: pd.Series) -> str:
    return hash_payload({k: (None if pd.isna(v) else v) for k, v in row.items()})
