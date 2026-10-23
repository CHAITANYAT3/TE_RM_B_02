"""Chronological, group-aware and time-step splits.

Nothing here looks at labels when choosing cut points: cuts depend on time only.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import ELLIPTIC_STEPS, SPLIT_FRACS
from .utils import get_logger, seconds_since_epoch

log = get_logger()
SPLITS = ("train", "val", "test")


def chrono_split(df: pd.DataFrame, time_col: str, group_col: str | None = None,
                 fracs=SPLIT_FRACS):
    """Assign each row to train / val / test by time quantiles.

    If group_col is given, every row of a group takes the group's earliest time, so a group
    (e.g. one SolRPDS pool listed under several mints) can never straddle two splits.
    Rows with missing time get the label 'undated' and are never silently placed in a split.

    Returns (split Series aligned to df.index, info dict).
    """
    if abs(sum(fracs) - 1.0) > 1e-9:
        raise ValueError("fracs must sum to 1")
    t = df[time_col]
    if group_col is not None:
        t = t.groupby(df[group_col]).transform("min")
    secs = seconds_since_epoch(t)
    valid = secs.notna()
    split = pd.Series("undated", index=df.index, dtype="object")
    info = {"time_col": time_col, "group_col": group_col, "fracs": list(fracs),
            "n_undated": int((~valid).sum())}
    if valid.sum() == 0:
        info["cut_train_val"] = info["cut_val_test"] = None
        return split, info
    q1 = secs[valid].quantile(fracs[0])
    q2 = secs[valid].quantile(fracs[0] + fracs[1])
    split[valid & (secs <= q1)] = "train"
    split[valid & (secs > q1) & (secs <= q2)] = "val"
    split[valid & (secs > q2)] = "test"
    epoch = pd.Timestamp("1970-01-01")
    info["cut_train_val"] = (epoch + pd.Timedelta(seconds=float(q1))).isoformat()
    info["cut_val_test"] = (epoch + pd.Timedelta(seconds=float(q2))).isoformat()
    for s in SPLITS:
        m = split == s
        if m.any():
            info[f"{s}_time_range"] = [t[m].min().isoformat(), t[m].max().isoformat()]
    return split, info


def elliptic_split(time_step: pd.Series, steps=ELLIPTIC_STEPS) -> pd.Series:
    """train: 1-29, val: 30-34, test: 35-49 (inclusive). Anything else -> 'outside'."""
    split = pd.Series("outside", index=time_step.index, dtype="object")
    for name in SPLITS:
        lo, hi = steps[name]
        split[(time_step >= lo) & (time_step <= hi)] = name
    return split


def split_summary(split: pd.Series, y: pd.Series, name: str = "") -> dict:
    """Row and class counts per split; warns when a split is empty or single-class."""
    out = {}
    for s in SPLITS:
        m = split == s
        n = int(m.sum())
        pos = int(y[m].sum()) if n else 0
        out[s] = {"n": n, "n_pos": pos, "n_neg": n - pos,
                  "pos_rate": (pos / n) if n else None}
        if n == 0:
            log.warning("[%s] %s split is EMPTY", name, s)
        elif pos == 0 or pos == n:
            log.warning("[%s] %s split has a single class (n=%d, positives=%d)", name, s, n, pos)
    return out


def assert_chronological(df: pd.DataFrame, split: pd.Series, time_col: str) -> None:
    """Latest train time <= earliest val time <= ... earliest test time (with tolerance for ties)."""
    ranges = {}
    for s in SPLITS:
        t = df.loc[split == s, time_col]
        if len(t):
            ranges[s] = (t.min(), t.max())
    order = [s for s in SPLITS if s in ranges]
    for a, b in zip(order[:-1], order[1:]):
        if ranges[a][1] > ranges[b][0]:
            raise AssertionError(f"Chronology violated: max({a})={ranges[a][1]} > min({b})={ranges[b][0]}")


def assert_group_disjoint(df: pd.DataFrame, split: pd.Series, group_col: str) -> None:
    seen = {}
    for s in SPLITS:
        groups = set(df.loc[split == s, group_col].dropna().unique())
        for other, og in seen.items():
            inter = groups & og
            if inter:
                raise AssertionError(f"{len(inter)} {group_col} values appear in both {other} and {s}")
        seen[s] = groups
