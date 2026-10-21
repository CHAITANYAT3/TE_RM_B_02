"""Real-CATS loader (Bitcoin and Ethereum are loaded and kept completely separate)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ..config import REALCATS_FILES
from ..utils import get_logger

log = get_logger()

REQUIRED = ["address", "label", "transaction_number"]


def parse_times(series: pd.Series) -> pd.Series:
    """Parse Real-CATS timestamps such as '2020/5/14 5:54'; unparsable -> NaT."""
    try:
        return pd.to_datetime(series, errors="coerce", format="mixed")
    except (TypeError, ValueError):
        return pd.to_datetime(series, errors="coerce")


def read_realcats_file(path: Path) -> pd.DataFrame:
    if not Path(path).exists():
        raise FileNotFoundError(f"Real-CATS file not found: {path}")
    return pd.read_csv(path, sep="\t", low_memory=False)


def load_realcats(chain: str, data_dir: Path):
    """Load criminal + benign files of one chain.

    Adds: y (1 criminal / 0 benign), subtype (criminal label text, 'benign' otherwise;
    descriptive use only), source_file, parsed first_time / last_time.
    Returns (frame, info).
    """
    if chain not in REALCATS_FILES:
        raise ValueError(f"chain must be one of {list(REALCATS_FILES)}")
    folder = Path(data_dir) / "real_cats"
    files = REALCATS_FILES[chain]
    crim = read_realcats_file(folder / files["criminal"])
    ben = read_realcats_file(folder / files["benign"])
    for name, d in (("criminal", crim), ("benign", ben)):
        miss = [c for c in REQUIRED if c not in d.columns]
        if miss:
            raise ValueError(f"Real-CATS {chain} {name} file lacks columns {miss}. Found: {list(d.columns)}")

    common = [c for c in crim.columns if c in set(ben.columns)]
    only_crim = [c for c in crim.columns if c not in set(ben.columns)]
    only_ben = [c for c in ben.columns if c not in set(crim.columns)]
    if only_crim or only_ben:
        log.warning("Real-CATS %s: columns differ between files (criminal-only %s, benign-only %s); "
                    "using the intersection.", chain, only_crim, only_ben)

    crim = crim[common].copy()
    ben = ben[common].copy()
    crim["y"] = 1
    ben["y"] = 0
    crim["subtype"] = crim["label"].astype("string")
    ben["subtype"] = "benign"
    crim["source_file"] = files["criminal"]
    ben["source_file"] = files["benign"]
    df = pd.concat([crim, ben], ignore_index=True)

    for c in ("first_time", "last_time"):
        if c in df.columns:
            df[c] = parse_times(df[c])
    df["transaction_number"] = pd.to_numeric(df["transaction_number"], errors="coerce")

    dup = int(df.duplicated(subset=["address"]).sum())
    cross = int(len(set(crim["address"]) & set(ben["address"])))
    info = {
        "chain": chain, "rows": int(len(df)),
        "criminal_rows": int(len(crim)), "benign_rows": int(len(ben)),
        "duplicate_addresses": dup, "addresses_in_both_classes": cross,
        "columns_criminal_only": only_crim, "columns_benign_only": only_ben,
    }
    if dup:
        log.warning("Real-CATS %s: %d duplicate addresses (kept; reported in the audit).", chain, dup)
    return df, info
