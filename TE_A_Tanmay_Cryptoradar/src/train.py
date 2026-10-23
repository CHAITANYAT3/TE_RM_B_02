"""Train all CryptoRadar models.

    python -m src.train --all

Separate models per dataset (never merged):
  solrpds_primary, solrpds_ablation   (inactivity-based rug-pull proxy label)
  btc_filtered (headline), btc_full   (Real-CATS Bitcoin)
  eth                                 (Real-CATS Ethereum)
  elliptic, elliptic_degree           (labelled transactions only; unknown excluded)
"""
from __future__ import annotations

import argparse
import platform
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

from . import figures, modeling, trends
from .config import DATASETS, ELLIPTIC_STEPS, MODEL_SPECS, SEED, SPLIT_FRACS, Paths, default_paths
from .explain import compute_shap, save_shap, shap_available
from .features import elliptic as ell_feat
from .features import realcats as rc_feat
from .features import solrpds as sol_feat
from .loaders.elliptic import add_degree_features, load_elliptic
from .loaders.realcats import load_realcats
from .loaders.solrpds import load_solrpds
from .narrative import PROXY_STATEMENT
from .splits import (assert_chronological, assert_group_disjoint, chrono_split, elliptic_split,
                     split_summary)
from .utils import get_logger, write_json

log = get_logger()


# ------------------------------------------------------------------ helpers
def _versions() -> dict:
    import sklearn
    v = {"python": sys.version.split()[0], "platform": platform.platform(), "pandas": pd.__version__,
         "numpy": np.__version__, "scikit_learn": sklearn.__version__}
    try:
        import xgboost
        v["xgboost"] = xgboost.__version__
    except Exception:
        v["xgboost"] = None
    try:
        import shap
        v["shap"] = shap.__version__
    except Exception:
        v["shap"] = None
    return v


def _report_only_scores(pipe, X_zero: pd.DataFrame, y_zero: np.ndarray, thr: float, in_sample: bool) -> dict:
    """Scores for zero-activity addresses, reported separately (never mixed into split metrics)."""
    out = {"label": "report-only / no observed on-chain activity", "in_sample_training_rows": in_sample,
           "n": int(len(X_zero))}
    if len(X_zero) == 0:
        return out
    p = pipe.predict_proba(X_zero)[:, 1]
    for name, v in (("criminal", 1), ("benign", 0)):
        m = y_zero == v
        out[f"n_{name}"] = int(m.sum())
        out[f"share_above_threshold_{name}"] = float((p[m] >= thr).mean()) if m.any() else None
        out[f"mean_score_{name}"] = float(p[m].mean()) if m.any() else None
    return out


def _zero_pct(df: pd.DataFrame) -> dict:
    out = {}
    for name, y in (("criminal", 1), ("benign", 0)):
        m = df["y"] == y
        n = int(m.sum())
        z = int((m & df["zero_activity"]).sum())
        out[name] = {"n": n, "zero_transaction_n": z, "zero_transaction_pct": float(100 * z / max(n, 1))}
    return out


def finalize_model(paths: Paths, key: str, results: dict, pipelines: dict, meta: dict, metrics_extra: dict,
                   X_explain: pd.DataFrame, skip_shap: bool) -> None:
    """Persist model, metadata, metrics and SHAP for one trained model."""
    spec = MODEL_SPECS[key]
    report_only = metrics_extra.pop("_report_only_X", None)
    meta = {"key": key, **spec, "dataset_name": DATASETS[spec["dataset"]], "seed": SEED,
            "probability_wording": "uncalibrated model probability (no calibration map fitted)",
            "trained_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "versions": _versions(), **meta}
    if spec["dataset"] == "solrpds":
        meta["positive_class_statement"] = PROXY_STATEMENT
        meta["label_name"] = "inactivity-based rug-pull proxy label"
    if spec["role"] == "ablation" and spec["dataset"] == "solrpds":
        meta["leakage_warning"] = "potentially label-leaking timestamp-derived duration features"

    if results.get("skipped"):
        log.warning("[%s] SKIPPED: %s", key, results["skipped"])
        write_json(paths.metrics / f"{key}_metrics.json", {**results, **metrics_extra, "key": key})
        return

    main = results["main_model"]
    pipe = pipelines[main]
    entry = results["models"][main]
    meta.update({"main_model": main, "backend": results["backend"], "threshold": entry["threshold"],
                 "threshold_source": entry["threshold_source"]})
    paths.models.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, paths.models / f"{key}.joblib")
    write_json(paths.models / f"{key}_meta.json", meta)

    if report_only is not None:
        Xz, yz, in_sample = report_only
        results["report_only_zero_activity"] = _report_only_scores(pipe, Xz, yz, entry["threshold"], in_sample)

    if not skip_shap:
        if len(X_explain) == 0:
            log.warning("[%s] no rows available for SHAP", key)
        else:
            sh = compute_shap(pipe, X_explain)
            save_shap(sh, key, paths.shap)
    write_json(paths.metrics / f"{key}_metrics.json", {**results, **metrics_extra, "key": key})
    t = entry["test"]
    log.info("[%s] main=%s thr=%.4f | val PR-AUC=%s | test PR-AUC=%s F1=%s", key, main, entry["threshold"],
             entry["validation"].get("pr_auc"), t.get("pr_auc"), t.get("f1"))


def run_model(paths, key, X, y, split, meta, metrics_extra, fast, skip_shap, train_mask=None):
    y = pd.Series(np.asarray(y).astype(int), index=X.index)
    tr = (split == "train") if train_mask is None else train_mask
    va, te = split == "val", split == "test"
    log.info("[%s] training: train=%d val=%d test=%d", key, int(tr.sum()), int(va.sum()), int(te.sum()))
    metrics_extra = dict(metrics_extra)
    metrics_extra["training_set"] = {"n": int(tr.sum()), "n_pos": int(y[tr].sum()),
                                     "n_neg": int(tr.sum() - y[tr].sum()),
                                     "note": "rows actually used to fit the model"}
    results, pipes = modeling.train_and_evaluate(X[tr], y[tr].to_numpy(), X[va], y[va].to_numpy(),
                                                 X[te], y[te].to_numpy(), fast=fast)
    X_explain = X[te] if te.any() else (X[va] if va.any() else X[tr])
    finalize_model(paths, key, results, pipes, meta, metrics_extra, X_explain, skip_shap)
    return results


# ------------------------------------------------------------------ SolRPDS
def run_solrpds(paths, fast, skip_shap, allow_partial):
    df, info = load_solrpds(paths.data, allow_partial=allow_partial)
    log.info("SolRPDS: %d rows from %s", len(df), info["files_found"])
    split, sinfo = chrono_split(df, "FIRST_POOL_ACTIVITY_TIMESTAMP", group_col="LIQUIDITY_POOL_ADDRESS",
                                fracs=SPLIT_FRACS)
    df["_split_time"] = df.groupby("LIQUIDITY_POOL_ADDRESS")["FIRST_POOL_ACTIVITY_TIMESTAMP"].transform("min")
    assert_group_disjoint(df, split, "LIQUIDITY_POOL_ADDRESS")
    assert_chronological(df, split, "_split_time")
    ssum = split_summary(split, df["y"], "solrpds")

    trends.save_csv(trends.solrpds_monthly(df), paths.trends, "solrpds_monthly")
    trends.save_csv(trends.solrpds_by_source(df), paths.trends, "solrpds_by_source")

    common_extra = {"split_summary": ssum, "split_info": sinfo, "load_info": info,
                    "data_notes": {"proxy_statement": PROXY_STATEMENT,
                                   "n_undated_excluded": sinfo["n_undated"]}}
    primary = sol_feat.build_primary(df)
    sol_feat.assert_primary_is_clean(primary.columns)
    run_model(paths, "solrpds_primary", primary, df["y"], split,
              {"feature_names": list(primary.columns), "excluded_features": sol_feat.EXCLUDED_FROM_PRIMARY,
               "split_rule": "chronological on pool-level earliest FIRST_POOL_ACTIVITY_TIMESTAMP, grouped by pool",
               "split_info": sinfo},
              dict(common_extra), fast, skip_shap)

    have = [c for c in ("LAST_POOL_ACTIVITY_TIMESTAMP", "LAST_SWAP_TIMESTAMP") if c in df.columns]
    if len(have) == 2:
        abl = sol_feat.build_ablation(df)
        run_model(paths, "solrpds_ablation", abl, df["y"], split,
                  {"feature_names": list(abl.columns),
                   "excluded_features": {k: v for k, v in sol_feat.EXCLUDED_FROM_PRIMARY.items()
                                         if k in ("LAST_SWAP_TX_ID", "FIRST_POOL_ACTIVITY_TIMESTAMP",
                                                  "LIQUIDITY_POOL_ADDRESS", "MINT", "INACTIVITY_STATUS")},
                   "split_rule": "same as primary", "split_info": sinfo},
                  dict(common_extra), fast, skip_shap)
    else:
        log.warning("Ablation skipped: timestamp columns missing from the data")


# ------------------------------------------------------------------ Real-CATS
def run_realcats(chain, paths, fast, skip_shap):
    raw, info = load_realcats(chain, paths.data)
    df = rc_feat.prepare(raw, chain)
    features = rc_feat.select_feature_columns(df)
    rc_feat.assert_no_leakage(features)
    excluded = rc_feat.excluded_columns(df)
    zero_pct = _zero_pct(df)
    log.info("Real-CATS %s: %d rows, %d features; zero-transaction criminal %.1f%% / benign %.1f%%", chain.upper(),
             len(df), len(features), zero_pct["criminal"]["zero_transaction_pct"],
             zero_pct["benign"]["zero_transaction_pct"])

    # trends use every row (descriptive); undated rows appear as 'undated'
    trends.save_csv(trends.realcats_subtype_by_year(df), paths.trends, f"realcats_{chain}_subtype_by_year")
    trends.save_csv(trends.realcats_class_by_year(df), paths.trends, f"realcats_{chain}_class_by_year")

    active = df[(~df["zero_activity"]) & df["dated"]]
    zero = df[df["zero_activity"]]
    n_active_undated = int(((~df["zero_activity"]) & (~df["dated"])).sum())
    split_active, sinfo = chrono_split(active, "first_time", fracs=SPLIT_FRACS)
    assert_chronological(active, split_active, "first_time")
    ssum = split_summary(split_active, active["y"], f"{chain}")
    X_active = rc_feat.feature_matrix(active, features)
    X_zero = rc_feat.feature_matrix(zero, features)

    base_meta = {"feature_names": features, "excluded_features": excluded,
                 "unit_conversion": ("satoshi -> BTC; variances /1e16" if chain == "btc"
                                     else "Wei -> ETH; variances /1e36; gas price sums Wei -> Gwei"),
                 "split_rule": "chronological on first_time (dated addresses with >=1 observed transaction)",
                 "split_info": sinfo}
    extra = {"split_summary": ssum, "split_info": sinfo, "load_info": info,
             "data_notes": {"zero_activity_pct": zero_pct,
                            "active_but_undated_excluded": n_active_undated,
                            "zero_activity_rows": int(len(zero)),
                            "zero_activity_label": "report-only / no observed on-chain activity"}}

    def _extra(role_text, in_sample):
        e = {k: (dict(v) if isinstance(v, dict) else v) for k, v in extra.items()}
        e["data_notes"]["zero_activity_role"] = role_text
        e["_report_only_X"] = (X_zero, zero["y"].to_numpy(), in_sample)
        return e

    if chain == "btc":
        run_model(paths, "btc_filtered", X_active, active["y"], split_active, dict(base_meta),
                  _extra("excluded from this model; scored as report-only diagnostic (never seen in training)",
                         False), fast, skip_shap)
        # Full model: zero-activity rows are TRAINING-ONLY (no timestamps -> never placed in val/test)
        X_full = pd.concat([X_active, X_zero])
        y_full = pd.concat([active["y"], zero["y"]])
        split_full = pd.concat([split_active, pd.Series("zero_activity_train_only", index=zero.index)])
        train_mask = split_full.isin(["train", "zero_activity_train_only"])
        meta_full = dict(base_meta, split_rule=base_meta["split_rule"] +
                         "; zero-activity rows (no timestamps) are training-only and flagged report-only")
        run_model(paths, "btc_full", X_full, y_full, split_full, meta_full,
                  _extra("training-only rows; their scores below are in-sample report-only diagnostics", True),
                  fast, skip_shap, train_mask=train_mask)
    else:
        run_model(paths, "eth", X_active, active["y"], split_active, dict(base_meta),
                  _extra("excluded from this model; scored as report-only diagnostic (never seen in training)",
                         False), fast, skip_shap)


# ------------------------------------------------------------------ Elliptic
def run_elliptic(paths, fast, skip_shap):
    df, edges, info = load_elliptic(paths.data)
    log.info("Elliptic: %d transactions, %d edges", len(df), len(edges))
    trends.save_csv(trends.elliptic_by_time_step(df, edges), paths.trends, "elliptic_by_time_step")
    lab = df[df["y"] >= 0].copy()                   # unknown excluded from train / val / test
    split = elliptic_split(lab["time_step"])
    ssum = split_summary(split, lab["y"], "elliptic")
    extra = {"split_summary": ssum, "load_info": info,
             "split_info": {"steps": ELLIPTIC_STEPS},
             "data_notes": {"unknown_excluded_n": int((df["y"] == -1).sum()),
                            "labelled_n": int(len(lab))}}
    meta = {"feature_names": ell_feat.BASE_FEATURES,
            "excluded_features": {"txId": "identifier", "time_step": "used for splitting only"},
            "split_rule": "time_step: train 1-29, validation 30-34, test 35-49; unknown excluded",
            "split_info": {"steps": ELLIPTIC_STEPS}}
    run_model(paths, "elliptic", ell_feat.feature_matrix(lab, ell_feat.BASE_FEATURES), lab["y"], split, meta,
              dict(extra), fast, skip_shap)
    lab2 = add_degree_features(lab, edges)
    meta2 = dict(meta, feature_names=ell_feat.DEGREE_ABLATION_FEATURES)
    run_model(paths, "elliptic_degree", ell_feat.feature_matrix(lab2, ell_feat.DEGREE_ABLATION_FEATURES),
              lab2["y"], split, meta2, dict(extra), fast, skip_shap)


# ------------------------------------------------------------------ driver
def write_summary(paths: Paths, failed: dict) -> dict:
    from . import artifacts
    rows = {}
    for key in MODEL_SPECS:
        m = artifacts.load_metrics(paths, key)
        if m is None:
            continue
        if m.get("skipped"):
            rows[key] = {"status": "skipped", "reason": m["skipped"]}
            continue
        e = m["models"][m["main_model"]]
        rows[key] = {"status": "trained", "main_model": m["main_model"], "backend": m["backend"],
                     "threshold": e["threshold"], "validation": e["validation"], "test": e["test"],
                     "test_minus_validation": e["test_minus_validation"]}
    summary = {"generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "models": rows, "failed": failed, "versions": _versions()}
    write_json(paths.metrics / "summary.json", summary)
    return summary


def run_all(paths: Paths, only=None, fast=False, skip_shap=False, allow_partial=False) -> dict:
    only = only or ["solrpds", "btc", "eth", "elliptic"]
    paths.make_dirs()
    jobs = {"solrpds": lambda: run_solrpds(paths, fast, skip_shap, allow_partial),
            "btc": lambda: run_realcats("btc", paths, fast, skip_shap),
            "eth": lambda: run_realcats("eth", paths, fast, skip_shap),
            "elliptic": lambda: run_elliptic(paths, fast, skip_shap)}
    failed = {}
    for name in only:
        log.info("=== %s ===", name)
        try:
            jobs[name]()
        except Exception as exc:
            log.exception("Dataset %s failed", name)
            failed[name] = f"{type(exc).__name__}: {exc}"
    summary = write_summary(paths, failed)
    try:
        written = figures.render_all(paths)
        log.info("Wrote %d figure files", len(written))
    except Exception as exc:
        log.exception("Figure rendering failed")
        failed["figures"] = f"{type(exc).__name__}: {exc}"
        summary["failed"] = failed
        write_json(paths.metrics / "summary.json", summary)
    return summary


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Train CryptoRadar models")
    ap.add_argument("--all", action="store_true", help="train every dataset")
    ap.add_argument("--only", nargs="*", choices=["solrpds", "btc", "eth", "elliptic"])
    ap.add_argument("--fast", action="store_true", help="smaller models (debug)")
    ap.add_argument("--skip-shap", action="store_true", help="skip SHAP (debug only; SHAP is required for results)")
    ap.add_argument("--allow-partial-solrpds", action="store_true",
                    help="debug only: allow fewer than the four SolRPDS partitions")
    a = ap.parse_args(argv)
    if not a.all and not a.only:
        ap.error("pass --all or --only <dataset ...>")
    if not a.skip_shap and not shap_available():
        print("ERROR: the 'shap' package is not installed. Run: pip install -r requirements.txt "
              "(or pass --skip-shap for a debug run).", file=sys.stderr)
        return 2
    if not modeling.HAS_XGB:
        log.warning("xgboost is not installed: the main model falls back to random forest (recorded in metadata).")
    paths = default_paths()
    summary = run_all(paths, None if a.all else a.only, a.fast, a.skip_shap, a.allow_partial_solrpds)
    print(f"\nSummary written to {paths.metrics / 'summary.json'}")
    if summary["failed"]:
        print("FAILED:", summary["failed"])
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
