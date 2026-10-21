"""Real-CATS feature preparation for Bitcoin and Ethereum (kept separate).

Units
-----
BTC amounts are stored in satoshi (inferred from the paired USD columns and
verified at runtime by the audit's implied-price check) and are converted to BTC.
ETH amounts are stored in Wei and are converted to ETH. BTC and ETH values are never mixed.

Leakage control
---------------
The following are never model features: address, label, label subtype,
watchback_checked, gs_checked, etherscan_checked, every *_transaction_id column,
and any collection / verification / source / annotation flag. Absolute timestamps
(first_time, last_time) are used for splitting only.
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd

# ---- unit conversion tables ------------------------------------------------
BTC_SAT_COLS = ["balance", "total_received_BTC", "total_sent_BTC", "transaction_fee",
                "max_sent_amount", "min_sent_amount", "max_received_amount", "min_received_amount"]
BTC_SAT2_COLS = ["received_Variance_BTC", "sent_Variance_BTC", "transaction_fee_Variance"]
SAT_PER_BTC = 1e8

ETH_WEI_COLS = ["balance", "total_received_ETH", "total_sent_ETH", "transaction_fee",
                "max_sent_amount", "min_sent_amount", "max_received_amount", "min_received_amount"]
ETH_WEI2_COLS = ["received_Variance_ETH", "sent_Variance_ETH", "transaction_fee_Variance"]
ETH_GWEI_COLS = ["total_gasP_set"]            # sum of gas prices, Wei -> Gwei
ETH_GWEI2_COLS = ["gasP_set_Variance"]        # Wei^2 -> Gwei^2
WEI_PER_ETH = 1e18

# ---- leakage exclusion -----------------------------------------------------
EXACT_EXCLUDE = {
    "address", "label", "subtype", "y", "source_file",
    "first_time", "last_time",
    "watchback_checked", "gs_checked", "etherscan_checked",
    "zero_activity", "dated",
}
PATTERN_EXCLUDE = re.compile(r"(_transaction_id$|_checked$|source|annot|verif|collect|provenance)", re.IGNORECASE)


def is_excluded(col: str) -> bool:
    return col in EXACT_EXCLUDE or bool(PATTERN_EXCLUDE.search(col))


def excluded_columns(df: pd.DataFrame) -> dict:
    """Columns present in df that are excluded from the feature set, with the reason."""
    out = {}
    for c in df.columns:
        if c in EXACT_EXCLUDE:
            out[c] = "identifier, label/target, split-only timestamp, or collection/verification flag"
        elif PATTERN_EXCLUDE.search(c):
            out[c] = "matches leakage pattern (transaction id / checked flag / source / annotation)"
        elif not pd.api.types.is_numeric_dtype(df[c]):
            out[c] = "non-numeric"
    return out


def convert_units(df: pd.DataFrame, chain: str) -> pd.DataFrame:
    """Return a copy with BTC (from satoshi) or ETH (from Wei) units applied."""
    df = df.copy()

    def _scale(cols, factor):
        for c in cols:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce").astype("float64") / factor

    if chain == "btc":
        _scale(BTC_SAT_COLS, SAT_PER_BTC)
        _scale(BTC_SAT2_COLS, SAT_PER_BTC ** 2)
    elif chain == "eth":
        _scale(ETH_WEI_COLS, WEI_PER_ETH)
        _scale(ETH_WEI2_COLS, WEI_PER_ETH ** 2)
        _scale(ETH_GWEI_COLS, 1e9)
        _scale(ETH_GWEI2_COLS, 1e18)
    else:
        raise ValueError("chain must be 'btc' or 'eth'")
    return df


def prepare(df: pd.DataFrame, chain: str) -> pd.DataFrame:
    """Unit-convert and add `zero_activity` / `dated` flags.

    zero_activity: transaction_number == 0 (or missing) -> no observed on-chain activity.
    dated: first_time is available (needed for chronological splitting).
    """
    out = convert_units(df, chain)
    tx = pd.to_numeric(out["transaction_number"], errors="coerce").fillna(0)
    out["zero_activity"] = tx <= 0
    out["dated"] = out["first_time"].notna() if "first_time" in out.columns else False
    return out


def select_feature_columns(df: pd.DataFrame) -> list:
    cols = [c for c in df.columns if not is_excluded(c) and pd.api.types.is_numeric_dtype(df[c])]
    return cols


def assert_no_leakage(feature_names) -> None:
    bad = [c for c in feature_names if is_excluded(c)]
    if bad:
        raise AssertionError(f"Leakage/identifier columns found among features: {bad}")


def feature_matrix(df: pd.DataFrame, feature_names) -> pd.DataFrame:
    """Select features in a fixed order; absent columns become NaN (imputed later)."""
    X = pd.DataFrame(index=df.index)
    for c in feature_names:
        X[c] = pd.to_numeric(df[c], errors="coerce").astype("float64") if c in df.columns else np.nan
    return X
