"""Elliptic features: the 165 provided features (93 local + 72 aggregated).

txId and time_step are never features. The degree ablation adds in/out degree
derived from the edge list (no label information is involved).
"""
from __future__ import annotations

import pandas as pd

from ..loaders.elliptic import AGG_NAMES, FEATURE_NAMES, LOCAL_NAMES

DEGREE_FEATURES = ["in_degree", "out_degree"]
BASE_FEATURES = list(FEATURE_NAMES)
DEGREE_ABLATION_FEATURES = BASE_FEATURES + DEGREE_FEATURES


def feature_matrix(df: pd.DataFrame, names) -> pd.DataFrame:
    missing = [c for c in names if c not in df.columns]
    if missing:
        raise KeyError(f"Elliptic frame lacks features {missing[:5]}{'...' if len(missing) > 5 else ''}")
    return df[list(names)].astype("float32")


__all__ = ["BASE_FEATURES", "DEGREE_FEATURES", "DEGREE_ABLATION_FEATURES", "LOCAL_NAMES", "AGG_NAMES",
           "feature_matrix"]
