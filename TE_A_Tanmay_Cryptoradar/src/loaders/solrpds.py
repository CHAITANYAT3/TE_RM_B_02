"""SolRPDS loader.

The four yearly files are partitions of one dataset and are concatenated.
The uploaded samples are NDJSON (one JSON object per line); a JSON array is
accepted too. Column names are inspected, never assumed: missing required
columns raise a clear error.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ..config import SOLRPDS_FILES
from ..utils import get_logger

log = get_logger()

ID_COLS = ["LIQUIDITY_POOL_ADDRESS", "MINT"]
NUMERIC_COLS = [
    "TOTAL_ADDED_LIQUIDITY", "TOTAL_REMOVED_LIQUIDITY",
    "NUM_LIQUIDITY_ADDS", "NUM_LIQUIDITY_REMOVES", "ADD_TO_REMOVE_RATIO",
]
TIME_COLS = ["FIRST_POOL_ACTIVITY_TIMESTAMP", "LAST_POOL_ACTIVITY_TIMESTAMP", "LAST_SWAP_TIMESTAMP"]
STATUS_COL = "INACTIVITY_STATUS"
# Needed for the primary model, splitting and labelling.
REQUIRED_COLS = ID_COLS + NUMERIC_COLS + ["FIRST_POOL_ACTIVITY_TIMESTAMP", STATUS_COL]
NULL_STRINGS = {"null", "none", "nan", "", "nat"}


class SchemaError(ValueError):
    pass


def _read_partition(path: Path) -> pd.DataFrame:
    with open(path, "r", encoding="utf-8") as fh:
        head = fh.read(2048).lstrip()
    if head.startswith("["):  # JSON array
        return pd.read_json(path, convert_dates=False)
    return pd.read_json(path, lines=True, convert_dates=False)


def clean_solrpds_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Type-clean a raw SolRPDS frame and add the proxy label `y`.

    y = 1 iff INACTIVITY_STATUS == 'Inactive'. This is an
    inactivity-based rug-pull proxy label, not verified ground truth.
    """
    df = df.copy()
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        raise SchemaError(
            f"SolRPDS data is missing required columns {missing}. Columns found: {list(df.columns)}"
        )
    for col in df.columns:
        if df[col].dtype == object or str(df[col].dtype).startswith(("str", "string")):
            s = df[col].astype("string")
            df[col] = s.mask(s.str.strip().str.lower().isin(NULL_STRINGS))
    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    for col in TIME_COLS:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    status = df[STATUS_COL].astype("string").str.strip().str.lower()
    is_inactive = (status == "inactive").fillna(False).to_numpy(dtype=bool)
    is_active = (status == "active").fillna(False).to_numpy(dtype=bool)
    df["y"] = np.where(is_inactive, 1, np.where(is_active, 0, -1)).astype("int8")
    return df


def load_solrpds(data_dir: Path, allow_partial: bool = False):
    """Load and concatenate the SolRPDS partitions.

    Returns (frame, info). Rows whose INACTIVITY_STATUS is neither Active nor
    Inactive are dropped and counted. Exact duplicate rows are dropped and counted.
    """
    folder = Path(data_dir) / "solrpds"
    found, missing = [], []
    for name in SOLRPDS_FILES:
        (found if (folder / name).exists() else missing).append(name)
    if not found:
        raise FileNotFoundError(f"No SolRPDS files found in {folder}. Expected: {list(SOLRPDS_FILES)}")
    if missing and not allow_partial:
        raise FileNotFoundError(
            f"Missing SolRPDS partitions {missing} in {folder}. All four files are partitions of the same "
            "dataset and must be loaded together (use --allow-partial-solrpds only for sample/debug runs)."
        )
    if missing:
        log.warning("PARTIAL SolRPDS load: missing %s", missing)

    parts, rows_per_file = [], {}
    for name in found:
        raw = _read_partition(folder / name)
        raw["source_file"] = name
        rows_per_file[name] = int(len(raw))
        parts.append(raw)
    # outer union of columns; schema differences between files are recorded
    col_sets = {n: set(p.columns) for n, p in zip(found, parts)}
    all_cols = set().union(*col_sets.values())
    schema_diffs = {n: sorted(all_cols - c) for n, c in col_sets.items() if all_cols - c}
    raw_all = pd.concat(parts, ignore_index=True, sort=False)

    df = clean_solrpds_frame(raw_all)
    n0 = len(df)
    dedup_cols = [c for c in df.columns if c != "source_file"]
    df = df.drop_duplicates(subset=dedup_cols).reset_index(drop=True)
    n_dup = n0 - len(df)
    bad = int((df["y"] == -1).sum())
    df = df[df["y"] != -1].reset_index(drop=True)
    pm_dups = int(df.duplicated(subset=ID_COLS).sum())

    info = {
        "files_found": found, "files_missing": missing, "rows_per_file": rows_per_file,
        "schema_differences": schema_diffs, "exact_duplicates_dropped": n_dup,
        "rows_dropped_unknown_status": bad, "pool_mint_duplicate_rows": pm_dups,
        "partial_load": bool(missing),
        "columns": list(df.columns),
    }
    return df, info
