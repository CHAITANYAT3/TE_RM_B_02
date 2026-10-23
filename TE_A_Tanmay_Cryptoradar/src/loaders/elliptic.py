"""Elliptic loader.

The features file is headerless: column 0 = txId, column 1 = time_step,
columns 2-94 = 93 local features, columns 95-166 = 72 aggregated neighbourhood features.
Class mapping: '1' -> illicit (1), '2' -> licit (0), 'unknown' -> -1 (never used for supervised work).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ..config import ELLIPTIC_FILES
from ..utils import get_logger

log = get_logger()

N_COLS = 167
LOCAL_NAMES = [f"local_{i:02d}" for i in range(1, 94)]    # columns 2..94
AGG_NAMES = [f"agg_{i:02d}" for i in range(1, 73)]        # columns 95..166
FEATURE_NAMES = LOCAL_NAMES + AGG_NAMES
ALL_NAMES = ["txId", "time_step"] + FEATURE_NAMES
CLASS_MAP = {"1": 1, "2": 0, "unknown": -1}


def read_features(path: Path) -> pd.DataFrame:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Elliptic features file not found: {path}")
    # peek at the width so we can build an efficient dtype map
    width = pd.read_csv(path, header=None, nrows=1).shape[1]
    if width != N_COLS:
        raise ValueError(f"Expected {N_COLS} columns in {path.name}, found {width}.")
    dtypes = {0: "int64", 1: "int16"}
    dtypes.update({i: "float32" for i in range(2, N_COLS)})
    df = pd.read_csv(path, header=None, dtype=dtypes)
    df.columns = ALL_NAMES
    return df


def read_classes(path: Path) -> pd.DataFrame:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Elliptic classes file not found: {path}")
    cls = pd.read_csv(path, dtype=str)
    cls.columns = [c.strip() for c in cls.columns]
    if not {"txId", "class"} <= set(cls.columns):
        raise ValueError(f"Classes file needs columns txId, class; found {list(cls.columns)}")
    cls["txId"] = cls["txId"].str.strip().astype("int64")
    raw = cls["class"].str.strip().str.lower()
    unexpected = sorted(set(raw.unique()) - set(CLASS_MAP))
    if unexpected:
        raise ValueError(f"Unexpected Elliptic class values: {unexpected}")
    cls["y"] = raw.map(CLASS_MAP).astype("int8")
    return cls[["txId", "y"]]


def read_edges(path: Path) -> pd.DataFrame:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Elliptic edge list not found: {path}")
    e = pd.read_csv(path, dtype="int64")
    e.columns = ["txId1", "txId2"]
    return e


def load_elliptic(data_dir: Path):
    """Return (frame, edges, info). `y` is 1/0 for labelled rows and -1 for unknown."""
    folder = Path(data_dir) / "elliptic"
    feats = read_features(folder / ELLIPTIC_FILES["features"])
    cls = read_classes(folder / ELLIPTIC_FILES["classes"])
    edges = read_edges(folder / ELLIPTIC_FILES["edges"])
    df = feats.merge(cls, on="txId", how="left")
    n_no_class = int(df["y"].isna().sum())
    df["y"] = df["y"].fillna(-1).astype("int8")   # missing class row -> treated as unknown, never as licit
    info = {
        "n_transactions": int(len(df)), "n_edges": int(len(edges)),
        "n_without_class_row": n_no_class,
        "duplicate_txids": int(df["txId"].duplicated().sum()),
    }
    return df, edges, info


def add_degree_features(df: pd.DataFrame, edges: pd.DataFrame) -> pd.DataFrame:
    """Add in/out degree computed from the edge list only (no labels involved)."""
    out_deg = edges["txId1"].value_counts()
    in_deg = edges["txId2"].value_counts()
    df = df.copy()
    df["out_degree"] = df["txId"].map(out_deg).fillna(0).astype("float32")
    df["in_degree"] = df["txId"].map(in_deg).fillna(0).astype("float32")
    return df
