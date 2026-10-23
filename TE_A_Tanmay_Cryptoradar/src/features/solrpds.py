"""SolRPDS feature engineering.

PRIMARY model: liquidity amounts and event counts only. It excludes
LAST_SWAP_TIMESTAMP, LAST_SWAP_TX_ID, every LAST_* timestamp and every
duration/lag derived from them, because the inactivity outcome may be defined
or strongly determined by them.

ABLATION model: primary features + timestamp-derived duration features,
reported separately and labelled "potentially label-leaking".

All transformations are stateless (row-wise), so nothing is fitted on test data.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ..utils import safe_div, signed_log1p

WSOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

PRIMARY_FEATURES = [
    "total_added_liquidity", "total_removed_liquidity",
    "num_liquidity_adds", "num_liquidity_removes", "add_to_remove_ratio",
    "log_added_liquidity", "log_removed_liquidity", "log_add_to_remove_ratio",
    "net_liquidity_signed_log", "removed_share_of_flow",
    "count_ratio_adds_to_removes", "total_events",
    "log_avg_add_size", "log_avg_remove_size", "removed_exceeds_added",
    "mint_is_wsol", "mint_is_usdc",
]
DURATION_FEATURES = [
    "pool_active_duration_hours",          # LAST_POOL_ACTIVITY - FIRST_POOL_ACTIVITY
    "swap_after_first_pool_hours",         # LAST_SWAP - FIRST_POOL_ACTIVITY
    "swap_after_last_pool_hours",          # LAST_SWAP - LAST_POOL_ACTIVITY
    "has_swap_timestamp",
]
ABLATION_FEATURES = PRIMARY_FEATURES + DURATION_FEATURES

# Raw columns that must never reach the primary model.
FORBIDDEN_IN_PRIMARY_SUBSTRINGS = ("last_swap", "swap_after", "pool_active_duration",
                                   "last_pool", "has_swap")
EXCLUDED_FROM_PRIMARY = {
    "LAST_SWAP_TIMESTAMP": "may define/strongly determine the inactivity outcome",
    "LAST_SWAP_TX_ID": "identifier tied to the last swap; may define the outcome",
    "LAST_POOL_ACTIVITY_TIMESTAMP": "outcome-related timestamp (duration features are ablation-only)",
    "FIRST_POOL_ACTIVITY_TIMESTAMP": "used for chronological splitting and trends only, not as a feature",
    "LIQUIDITY_POOL_ADDRESS": "identifier",
    "MINT": "identifier (only the USDC / wrapped-SOL indicator flags are used)",
    "INACTIVITY_STATUS": "the target itself",
}


def build_primary(df: pd.DataFrame) -> pd.DataFrame:
    added = df["TOTAL_ADDED_LIQUIDITY"].astype("float64").clip(lower=0)
    removed = df["TOTAL_REMOVED_LIQUIDITY"].astype("float64").clip(lower=0)
    adds = df["NUM_LIQUIDITY_ADDS"].astype("float64")
    rems = df["NUM_LIQUIDITY_REMOVES"].astype("float64")
    ratio = df["ADD_TO_REMOVE_RATIO"].astype("float64")
    mint = df["MINT"].astype("string") if "MINT" in df.columns else pd.Series(pd.NA, index=df.index, dtype="string")

    out = pd.DataFrame(index=df.index)
    out["total_added_liquidity"] = added
    out["total_removed_liquidity"] = removed
    out["num_liquidity_adds"] = adds
    out["num_liquidity_removes"] = rems
    out["add_to_remove_ratio"] = ratio
    out["log_added_liquidity"] = np.log1p(added)
    out["log_removed_liquidity"] = np.log1p(removed)
    out["log_add_to_remove_ratio"] = np.log1p(ratio.clip(lower=0))
    out["net_liquidity_signed_log"] = signed_log1p(added - removed)
    out["removed_share_of_flow"] = safe_div(removed, added + removed)
    out["count_ratio_adds_to_removes"] = safe_div(adds, rems)
    out["total_events"] = adds + rems
    out["log_avg_add_size"] = np.log1p(safe_div(added, adds))
    out["log_avg_remove_size"] = np.log1p(safe_div(removed, rems))
    out["removed_exceeds_added"] = (removed > added).astype("float64")
    out["mint_is_wsol"] = (mint == WSOL_MINT).fillna(False).astype("float64")
    out["mint_is_usdc"] = (mint == USDC_MINT).fillna(False).astype("float64")
    return out[PRIMARY_FEATURES]


def build_duration(df: pd.DataFrame) -> pd.DataFrame:
    first = df["FIRST_POOL_ACTIVITY_TIMESTAMP"]
    last_pool = df.get("LAST_POOL_ACTIVITY_TIMESTAMP")
    last_swap = df.get("LAST_SWAP_TIMESTAMP")
    nan = pd.Series(np.nan, index=df.index)
    hour = pd.Timedelta(hours=1)
    out = pd.DataFrame(index=df.index)
    out["pool_active_duration_hours"] = ((last_pool - first) / hour) if last_pool is not None else nan
    out["swap_after_first_pool_hours"] = ((last_swap - first) / hour) if last_swap is not None else nan
    out["swap_after_last_pool_hours"] = (
        ((last_swap - last_pool) / hour) if (last_swap is not None and last_pool is not None) else nan
    )
    out["has_swap_timestamp"] = (last_swap.notna().astype("float64") if last_swap is not None else nan)
    return out[DURATION_FEATURES]


def build_ablation(df: pd.DataFrame) -> pd.DataFrame:
    return pd.concat([build_primary(df), build_duration(df)], axis=1)[ABLATION_FEATURES]


def assert_primary_is_clean(columns) -> None:
    bad = [c for c in columns if any(s in c.lower() for s in FORBIDDEN_IN_PRIMARY_SUBSTRINGS)]
    if bad:
        raise AssertionError(f"Outcome-related timestamp features found in primary model: {bad}")
