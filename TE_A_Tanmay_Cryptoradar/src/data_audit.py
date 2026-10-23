"""Runtime audit of the datasets that are actually on disk.

    python -m src.data_audit

Writes outputs/audit/audit.json and prints a readable summary. It verifies the
assumptions the models rely on (units, zero-activity share, label values, time ranges,
class counts per split) on YOUR data instead of trusting sample files.
"""
from __future__ import annotations

import argparse
import platform
import sys

import numpy as np
import pandas as pd

from .config import ELLIPTIC_STEPS, Paths, default_paths
from .features import realcats as rc_feat
from .loaders.elliptic import load_elliptic
from .loaders.realcats import load_realcats
from .loaders.solrpds import TIME_COLS, load_solrpds
from .utils import get_logger, write_json

log = get_logger()


def _num_summary(s: pd.Series) -> dict:
    s = pd.to_numeric(s, errors="coerce")
    return {"min": s.min(), "median": s.median(), "max": s.max(), "n_null": int(s.isna().sum())}


def audit_solrpds(paths: Paths, allow_partial: bool) -> dict:
    df, info = load_solrpds(paths.data, allow_partial=allow_partial)
    out = {"load_info": info, "rows": int(len(df)),
           "unique_pools": int(df["LIQUIDITY_POOL_ADDRESS"].nunique()),
           "unique_mints": int(df["MINT"].nunique()),
           "label_name": "inactivity-based rug-pull proxy label",
           "label_counts": {"inactive_proxy_positive": int((df["y"] == 1).sum()),
                            "active_negative": int((df["y"] == 0).sum())},
           "label_counts_by_file": {f: {"inactive": int(((df.source_file == f) & (df.y == 1)).sum()),
                                        "active": int(((df.source_file == f) & (df.y == 0)).sum())}
                                    for f in info["files_found"]},
           "status_values": sorted(df["INACTIVITY_STATUS"].astype(str).unique().tolist()),
           "numeric": {c: _num_summary(df[c]) for c in
                       ["TOTAL_ADDED_LIQUIDITY", "TOTAL_REMOVED_LIQUIDITY", "NUM_LIQUIDITY_ADDS",
                        "NUM_LIQUIDITY_REMOVES", "ADD_TO_REMOVE_RATIO"]},
           "time_ranges": {c: [df[c].min(), df[c].max(), int(df[c].isna().sum())]
                           for c in TIME_COLS if c in df.columns}}
    first = df["FIRST_POOL_ACTIVITY_TIMESTAMP"]
    out["first_activity_by_year"] = first.dt.year.value_counts().sort_index().to_dict()
    return out


def audit_realcats(chain: str, paths: Paths) -> dict:
    raw, info = load_realcats(chain, paths.data)
    df = rc_feat.prepare(raw, chain)
    zero = df["zero_activity"]
    pct = {}
    for name, y in (("criminal", 1), ("benign", 0)):
        m = df["y"] == y
        pct[name] = {"n": int(m.sum()), "zero_transaction_n": int((m & zero).sum()),
                     "zero_transaction_pct": float(100 * (m & zero).sum() / max(m.sum(), 1)),
                     "undated_n": int((m & ~df["dated"]).sum()),
                     "active_but_undated_n": int((m & ~zero & ~df["dated"]).sum())}
    # implied coin price sanity check for the unit assumption (satoshi / Wei)
    coin = "total_received_BTC" if chain == "btc" else "total_received_ETH"
    raw_units = rc_feat.convert_units(raw, chain)
    ok = (raw_units[coin] > 0) & (pd.to_numeric(raw_units["total_received_USD"], errors="coerce") > 0)
    implied = (pd.to_numeric(raw_units.loc[ok, "total_received_USD"], errors="coerce") / raw_units.loc[ok, coin])
    leak_cols = {}
    for c in ("watchback_checked", "gs_checked", "etherscan_checked"):
        if c in df.columns:
            leak_cols[c] = pd.crosstab(df["y"], df[c]).to_dict()
    active = df[~zero & df["dated"]]
    out = {
        "load_info": info, "rows": int(len(df)),
        "class_counts": {"criminal": int((df.y == 1).sum()), "benign": int((df.y == 0).sum())},
        "zero_activity": pct,
        "subtype_counts": df.loc[df.y == 1, "subtype"].astype(str).value_counts().to_dict(),
        "time_range_first_time": {c: [df.loc[df.y == y, "first_time"].min(), df.loc[df.y == y, "first_time"].max()]
                                  for c, y in (("criminal", 1), ("benign", 0))},
        "implied_usd_per_coin_median": float(implied.median()) if len(implied) else None,
        "implied_usd_per_coin_p05_p95": ([float(implied.quantile(.05)), float(implied.quantile(.95))]
                                         if len(implied) else None),
        "unit_assumption": "satoshi -> BTC (/1e8)" if chain == "btc" else "Wei -> ETH (/1e18)",
        "leakage_flag_crosstabs": leak_cols,
        "excluded_columns": rc_feat.excluded_columns(df),
        "n_model_features": len(rc_feat.select_feature_columns(df)),
        "activity_filtered_rows": {"criminal": int((active.y == 1).sum()), "benign": int((active.y == 0).sum())},
    }
    return out


def audit_elliptic(paths: Paths) -> dict:
    df, edges, info = load_elliptic(paths.data)
    steps = sorted(df["time_step"].unique().tolist())
    labelled = df[df["y"] >= 0]
    per_split = {}
    for name, (lo, hi) in ELLIPTIC_STEPS.items():
        m = (labelled["time_step"] >= lo) & (labelled["time_step"] <= hi)
        per_split[name] = {"time_steps": [lo, hi], "n_labelled": int(m.sum()),
                           "n_illicit": int((labelled.loc[m, "y"] == 1).sum()),
                           "n_licit": int((labelled.loc[m, "y"] == 0).sum())}
    ids = set(df["txId"])
    both = int((edges["txId1"].isin(ids) & edges["txId2"].isin(ids)).sum())
    return {"load_info": info, "rows": int(len(df)),
            "n_feature_columns": 165, "feature_nulls": int(df.drop(columns=["txId"]).isna().sum().sum()),
            "time_step_min_max": [min(steps), max(steps)], "n_time_steps": len(steps),
            "class_counts": {"illicit": int((df.y == 1).sum()), "licit": int((df.y == 0).sum()),
                             "unknown": int((df.y == -1).sum())},
            "per_split_labelled": per_split,
            "edges_total": int(len(edges)), "edges_with_both_endpoints_in_features": both}


def run_audit(paths: Paths, only=None, allow_partial: bool = False) -> dict:
    only = only or ["solrpds", "btc", "eth", "elliptic"]
    paths.make_dirs()
    report = {"environment": {"python": sys.version.split()[0], "platform": platform.platform(),
                              "pandas": pd.__version__, "numpy": np.__version__},
              "datasets": {}, "errors": {}}
    jobs = {"solrpds": lambda: audit_solrpds(paths, allow_partial),
            "btc": lambda: audit_realcats("btc", paths),
            "eth": lambda: audit_realcats("eth", paths),
            "elliptic": lambda: audit_elliptic(paths)}
    for key in only:
        log.info("Auditing %s ...", key)
        try:
            report["datasets"][key] = jobs[key]()
        except Exception as exc:  # keep auditing the others
            log.error("Audit of %s failed: %s", key, exc)
            report["errors"][key] = f"{type(exc).__name__}: {exc}"
    write_json(paths.audit / "audit.json", report)
    return report


def print_summary(report: dict) -> None:
    d = report["datasets"]
    print("\n==================== DATA AUDIT ====================")
    if "solrpds" in d:
        s = d["solrpds"]
        print(f"[SolRPDS] files={s['load_info']['files_found']} missing={s['load_info']['files_missing']}")
        print(f"  rows={s['rows']:,} unique_pools={s['unique_pools']:,} "
              f"duplicates_dropped={s['load_info']['exact_duplicates_dropped']}")
        print(f"  inactivity-based rug-pull proxy label: {s['label_counts']}")
        print("  The positive class is an inactivity-based proxy, not verified ground truth.")
    for ch in ("btc", "eth"):
        if ch in d:
            r = d[ch]
            z = r["zero_activity"]
            print(f"[Real-CATS {ch.upper()}] rows={r['rows']:,} classes={r['class_counts']}")
            print(f"  zero-transaction criminal: {z['criminal']['zero_transaction_n']:,}/{z['criminal']['n']:,} "
                  f"({z['criminal']['zero_transaction_pct']:.2f}%)")
            print(f"  zero-transaction benign:   {z['benign']['zero_transaction_n']:,}/{z['benign']['n']:,} "
                  f"({z['benign']['zero_transaction_pct']:.2f}%)")
            print(f"  implied USD per coin (median): {r['implied_usd_per_coin_median']}  [{r['unit_assumption']}]")
    if "elliptic" in d:
        e = d["elliptic"]
        print(f"[Elliptic] rows={e['rows']:,} classes={e['class_counts']} edges={e['edges_total']:,}")
        for k, v in e["per_split_labelled"].items():
            print(f"  {k}: steps {v['time_steps']} labelled={v['n_labelled']:,} illicit={v['n_illicit']:,}")
    for k, v in report["errors"].items():
        print(f"[ERROR] {k}: {v}")
    print("====================================================\n")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Audit the local datasets")
    ap.add_argument("--only", nargs="*", choices=["solrpds", "btc", "eth", "elliptic"])
    ap.add_argument("--allow-partial-solrpds", action="store_true",
                    help="debug only: allow fewer than the four SolRPDS partitions")
    a = ap.parse_args(argv)
    paths = default_paths()
    rep = run_audit(paths, a.only, a.allow_partial_solrpds)
    print_summary(rep)
    print(f"Audit written to {paths.audit / 'audit.json'}")
    return 1 if rep["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
