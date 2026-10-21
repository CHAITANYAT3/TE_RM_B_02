"""CryptoRadar - Multi-Dataset Cryptocurrency Risk Intelligence Platform (offline Streamlit dashboard).

Run:  streamlit run app.py

The dashboard only displays artifacts produced by `python -m src.train --all`.
Each dataset has its own model; scores are uncalibrated and not comparable across datasets.
"""
from __future__ import annotations

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

from src import artifacts, figures, history_db, scoring
from src import trends as trend_io
from src.config import DATASETS, MODEL_SPECS, default_paths
from src.explain import local_explanation, shap_available
from src.modeling import HEADLINE_METRICS, METRIC_LABELS
from src.narrative import (LIMITATIONS, LIMITATIONS_TITLE, PROXY_STATEMENT, SCORE_NOTE, SEPARATE_MODELS_NOTE,
                           SHAP_STATEMENT, ZERO_ACTIVITY_NOTE)
from src.plots import THEMES

paths = default_paths()
T = THEMES["dark"]

st.set_page_config(page_title="CryptoRadar", page_icon=":satellite:", layout="wide")

st.markdown(
    f"""
    <style>
    .block-container {{ padding-top: 1.6rem; max-width: 1280px; }}
    h1, h2, h3 {{ letter-spacing: -0.01em; }}
    .cr-banner {{ border-left: 4px solid {T['a2']}; background: #16283D; padding: .7rem 1rem;
                  border-radius: 6px; margin: .4rem 0 1rem 0; font-size: .92rem; color: {T['fg']}; }}
    .cr-banner.danger {{ border-left-color: {T['a3']}; }}
    .cr-banner.info {{ border-left-color: {T['a1']}; }}
    .cr-sub {{ color: {T['muted']}; font-size: .95rem; margin-top: -.6rem; }}
    </style>
    """,
    unsafe_allow_html=True,
)


def banner(text: str, kind: str = "warn") -> None:
    cls = {"warn": "", "danger": " danger", "info": " info"}[kind]
    st.markdown(f"<div class='cr-banner{cls}'>{text}</div>", unsafe_allow_html=True)


def show(fig, target=None):
    """Draw a Matplotlib figure in Streamlit, then close it so figures do not accumulate across reruns."""
    (target or st).pyplot(fig)
    plt.close(fig)


def fmt(x, nd=3):
    return "n/a" if x is None or (isinstance(x, float) and pd.isna(x)) else f"{x:.{nd}f}"


def model_banners(key: str) -> None:
    spec = MODEL_SPECS[key]
    if spec["dataset"] == "solrpds":
        banner(PROXY_STATEMENT)
        if spec["role"] == "ablation":
            banner("Ablation model: includes timestamp-derived duration features that are potentially "
                   "label-leaking. Do not read its performance as a fair estimate.", "danger")
    if key == "btc_full":
        banner(ZERO_ACTIVITY_NOTE, "danger")
    if key == "btc_filtered":
        banner("Headline BTC result. Zero-transaction addresses are excluded from this model.", "info")


def pick_model(label="Model", keys=None, key_suffix=""):
    keys = keys or artifacts.trained_keys(paths)
    if not keys:
        st.info("No trained models found. Run `python -m src.train --all` first.")
        st.stop()
    names = {k: f"{MODEL_SPECS[k]['title']} - {MODEL_SPECS[k]['subtitle']}" for k in keys}
    return st.selectbox(label, keys, format_func=lambda k: names[k], key=f"pick_{label}_{key_suffix}")


# --------------------------------------------------------------- cached data
@st.cache_resource(show_spinner="Loading model ...")
def get_model(key: str):
    return scoring.load_model(paths, key)


@st.cache_resource(show_spinner="Loading local dataset ...")
def get_dataset(ds: str):
    """Local data for lookups (read once per session)."""
    from src.features import realcats as rc_feat
    from src.loaders.elliptic import add_degree_features, load_elliptic
    from src.loaders.realcats import load_realcats
    from src.loaders.solrpds import load_solrpds
    if ds == "solrpds":
        df, _ = load_solrpds(paths.data, allow_partial=True)
        return df
    if ds in ("btc", "eth"):
        raw, _ = load_realcats(ds, paths.data)
        return raw
    if ds == "elliptic":
        df, edges, _ = load_elliptic(paths.data)
        return add_degree_features(df, edges)
    raise ValueError(ds)


# --------------------------------------------------------------- pages
def page_overview():
    st.title("CryptoRadar")
    st.markdown("<p class='cr-sub'>Multi-dataset cryptocurrency risk intelligence. Research prototype for "
                "cybercrime trend analysis: scams and rug-pull fraud.</p>", unsafe_allow_html=True)
    banner(SEPARATE_MODELS_NOTE, "info")
    summary = artifacts.load_summary(paths)
    audit = artifacts.load_audit(paths)
    if not summary:
        st.warning("No training summary found. Run `python -m src.data_audit` and `python -m src.train --all`.")
        return
    st.subheader("Models")
    st.caption("Metrics are per model on that model's own test split. Rows are not comparable across datasets "
               "and are never averaged.")
    rows = []
    for key, r in summary["models"].items():
        spec = MODEL_SPECS[key]
        if r["status"] != "trained":
            rows.append({"Model": spec["title"], "Variant": spec["subtitle"], "Status": f"skipped: {r['reason']}"})
            continue
        rows.append({"Model": spec["title"], "Variant": spec["subtitle"], "Algorithm": r["main_model"],
                     "Val PR-AUC": fmt(r["validation"].get("pr_auc")), "Test PR-AUC": fmt(r["test"].get("pr_auc")),
                     "Test F1": fmt(r["test"].get("f1")), "Test precision": fmt(r["test"].get("precision")),
                     "Test recall": fmt(r["test"].get("recall")), "Test ROC-AUC": fmt(r["test"].get("roc_auc")),
                     "Test MCC": fmt(r["test"].get("mcc")), "Test n": r["test"].get("n")})
    st.dataframe(pd.DataFrame(rows), hide_index=True)
    if summary.get("failed"):
        st.error(f"Some datasets failed during training: {summary['failed']}")
    if audit:
        st.subheader("Data audit")
        d = audit["datasets"]
        c = st.columns(4)
        if "solrpds" in d:
            s = d["solrpds"]
            c[0].metric("SolRPDS rows", f"{s['rows']:,}")
            c[0].caption(f"proxy-positive: {s['label_counts']['inactive_proxy_positive']:,}")
        for col, ch in ((c[1], "btc"), (c[2], "eth")):
            if ch in d:
                z = d[ch]["zero_activity"]
                col.metric(f"Real-CATS {ch.upper()} rows", f"{d[ch]['rows']:,}")
                col.caption(f"zero-tx criminal {z['criminal']['zero_transaction_pct']:.1f}% | "
                            f"benign {z['benign']['zero_transaction_pct']:.1f}%")
        if "elliptic" in d:
            e = d["elliptic"]
            c[3].metric("Elliptic transactions", f"{e['rows']:,}")
            c[3].caption(f"unknown (excluded): {e['class_counts']['unknown']:,}")


def _local_explain(pipe, X_row, key):
    if not shap_available():
        st.info("Install `shap` to see local explanations.")
        return None
    try:
        exp = local_explanation(pipe, X_row, top_k=10)
    except Exception as exc:  # pragma: no cover
        st.warning(f"SHAP explanation unavailable: {exc}")
        return None
    st.markdown("**Top feature contributions (SHAP, associative)**")
    st.dataframe(exp, hide_index=True)
    st.bar_chart(exp.set_index("feature")["shap_value"])
    st.caption(SHAP_STATEMENT)
    return exp


def page_scoring():
    st.title("Risk scoring")
    key = pick_model("Model")
    spec = MODEL_SPECS[key]
    model_banners(key)
    st.caption(SCORE_NOTE)
    pipe, meta = get_model(key)
    ds = spec["dataset"]
    modes = ["Look up in local data", "Upload file"] + (["Manual entry"] if key == "solrpds_primary" else [])
    mode = st.radio("Input", modes, horizontal=True)
    raw = None
    ref = None
    if mode == "Look up in local data":
        data = get_dataset(ds)
        if ds == "solrpds":
            q = st.text_input("Liquidity pool address")
            if q:
                hit = data[data["LIQUIDITY_POOL_ADDRESS"] == q.strip()]
                if hit.empty:
                    st.warning("Pool address not found in the local SolRPDS data.")
                else:
                    raw, ref = hit.head(25), f"pool:{q.strip()}"
        elif ds in ("btc", "eth"):
            q = st.text_input("Address")
            if q:
                hit = data[data["address"] == q.strip()]
                if hit.empty:
                    st.warning("Address not found in the local Real-CATS data.")
                else:
                    raw, ref = hit.head(1), f"address:{q.strip()}"
        else:
            q = st.number_input("Transaction id (txId)", min_value=0, step=1, value=0)
            if q:
                hit = data[data["txId"] == int(q)]
                if hit.empty:
                    st.warning("txId not found in the local Elliptic data.")
                else:
                    raw, ref = hit.head(1), f"txId:{int(q)}"
    elif mode == "Upload file":
        if ds == "elliptic":
            st.info("Elliptic scoring uses look-up by txId (the features file is headerless and very wide).")
        else:
            up = st.file_uploader("CSV / TSV in the dataset's original column layout", type=["csv", "tsv", "json"])
            if up is not None:
                try:
                    if up.name.endswith(".json"):
                        raw = pd.read_json(up, lines=True, convert_dates=False)
                    else:
                        raw = pd.read_csv(up, sep=None, engine="python")
                    if ds in ("btc", "eth") and "first_time" in raw.columns:
                        from src.loaders.realcats import parse_times
                        raw["first_time"] = parse_times(raw["first_time"])
                    ref = f"upload:{up.name}"
                except Exception as exc:
                    st.error(f"Could not read the file: {exc}")
    else:  # manual SolRPDS
        c = st.columns(3)
        added = c[0].number_input("TOTAL_ADDED_LIQUIDITY", min_value=0.0, value=1000.0)
        removed = c[1].number_input("TOTAL_REMOVED_LIQUIDITY", min_value=0.0, value=0.0)
        mint = c[2].selectbox("Quote mint", ["wrapped SOL", "USDC", "other"])
        c = st.columns(3)
        adds = c[0].number_input("NUM_LIQUIDITY_ADDS", min_value=0, value=1)
        rems = c[1].number_input("NUM_LIQUIDITY_REMOVES", min_value=0, value=0)
        ratio = c[2].number_input("ADD_TO_REMOVE_RATIO", min_value=0.0, value=float(added / removed) if removed else 0.0)
        from src.features.solrpds import USDC_MINT, WSOL_MINT
        raw = pd.DataFrame([{
            "LIQUIDITY_POOL_ADDRESS": "manual", "MINT": {"wrapped SOL": WSOL_MINT, "USDC": USDC_MINT}.get(mint, "other"),
            "TOTAL_ADDED_LIQUIDITY": added, "TOTAL_REMOVED_LIQUIDITY": removed, "NUM_LIQUIDITY_ADDS": adds,
            "NUM_LIQUIDITY_REMOVES": rems, "ADD_TO_REMOVE_RATIO": ratio,
            "FIRST_POOL_ACTIVITY_TIMESTAMP": pd.Timestamp.now(), "INACTIVITY_STATUS": "Active"}])  # placeholder, unused
        ref = "manual"

    if raw is None or len(raw) == 0:
        return
    try:
        X = scoring.build_features(key, raw, meta)
    except Exception as exc:
        st.error(f"Could not build features from this input: {exc}")
        return
    res = scoring.score_features(pipe, meta, X)
    first = res.iloc[0]
    c = st.columns(3)
    c[0].metric("Model risk score (uncalibrated)", f"{first['model_risk_score']:.4f}")
    c[1].metric("Decision threshold", f"{first['threshold']:.4f}")
    c[2].markdown(f"**{first['indication']}**")
    if len(res) > 1:
        st.dataframe(pd.concat([raw.reset_index(drop=True).iloc[:, :6], res.reset_index(drop=True)], axis=1))
        st.download_button("Download scores (CSV)", res.to_csv(index=False).encode(), "cryptoradar_scores.csv")
    exp = _local_explain(pipe, X.iloc[[0]], key)
    if st.checkbox("Save first row to prediction history", value=True, key=f"save_{key}_{ref}"):
        if st.button("Save now"):
            drivers = (exp[["feature", "shap_value"]].head(5).to_dict("records") if exp is not None else None)
            rid = history_db.log_prediction(
                paths.db, dataset=ds, model_key=key, model_version=meta.get("trained_at_utc"), input_ref=ref,
                input_hash=scoring.row_hash(X.iloc[0]), score=float(first["model_risk_score"]),
                threshold=float(first["threshold"]), top_drivers=drivers)
            st.success(f"Saved as history record #{rid}")


def page_performance():
    st.title("Model performance")
    keys = artifacts.metric_keys(paths)
    if not keys:
        st.info("No metrics found. Run `python -m src.train --all`.")
        return
    key = pick_model("Model", keys, "perf")
    model_banners(key)
    m = artifacts.load_metrics(paths, key)
    if m.get("skipped"):
        st.warning(f"Training was skipped: {m['skipped']}")
        return
    main = m["main_model"]
    e = m["models"][main]
    st.caption(f"Main algorithm: {main} ({m['backend']}). Probabilities are uncalibrated. "
               f"Threshold {e['threshold']:.4f} ({e['threshold_source']}), chosen on the validation split only.")
    ss = m["split_summary"]
    st.markdown("**Split sizes**")
    split_tbl = {s: {"rows": v["n"], "positives": v["n_pos"], "negatives": v["n_neg"],
                     "positive rate": fmt(v["pos_rate"])} for s, v in ss.items()}
    ts = m.get("training_set")
    if ts and ts["n"] != ss["train"]["n"]:
        split_tbl["train (actually used, incl. zero-activity training-only rows)"] = {
            "rows": ts["n"], "positives": ts["n_pos"], "negatives": ts["n_neg"],
            "positive rate": fmt(ts["n_pos"] / ts["n"] if ts["n"] else None)}
    st.dataframe(pd.DataFrame(split_tbl).T)
    tbl = pd.DataFrame({
        "Train (in-sample)": {METRIC_LABELS[k]: fmt(e["train_in_sample"].get(k)) for k in HEADLINE_METRICS},
        "Validation": {METRIC_LABELS[k]: fmt(e["validation"].get(k)) for k in HEADLINE_METRICS},
        "Test": {METRIC_LABELS[k]: fmt(e["test"].get(k)) for k in HEADLINE_METRICS},
        "Test minus validation": {METRIC_LABELS[k]: fmt(e["test_minus_validation"].get(k)) for k in HEADLINE_METRICS},
    })
    st.markdown("**Headline metrics**")
    st.dataframe(tbl)
    st.caption(f"Calibration diagnostics (model is not recalibrated): test Brier {fmt(e['test'].get('brier'))}, "
               f"test ECE {fmt(e['test'].get('ece_10bin'))}.")
    figs = figures.model_figures(paths, key, "dark", only=("pr_curve", "confusion", "metric_gap", "zero_activity"))
    c = st.columns(2)
    for i, name in enumerate(("pr_curve", "confusion", "metric_gap", "zero_activity")):
        if name in figs:
            show(figs[name], c[i % 2])
    with st.expander("Baseline models on the same splits"):
        base = [{"Algorithm": n, **{METRIC_LABELS[k]: fmt(v["test"].get(k)) for k in HEADLINE_METRICS}}
                for n, v in m["models"].items()]
        st.dataframe(pd.DataFrame(base), hide_index=True)
    ro = m.get("report_only_zero_activity")
    if ro and ro.get("n"):
        st.markdown("**Report-only: zero-activity addresses (no observed on-chain activity)**")
        banner(ZERO_ACTIVITY_NOTE)
        st.dataframe(pd.DataFrame([ro]), hide_index=True)


def page_explain():
    st.title("Explainability (SHAP)")
    banner(SHAP_STATEMENT, "info")
    keys = [k for k in artifacts.metric_keys(paths) if artifacts.load_importance(paths, k) is not None]
    if not keys:
        st.info("No SHAP outputs found. Run `python -m src.train --all` (without --skip-shap).")
        return
    key = pick_model("Model", keys, "shap")
    model_banners(key)
    figs = figures.model_figures(paths, key, "dark", only=("shap_bar", "shap_beeswarm"))
    c = st.columns(2)
    if "shap_bar" in figs:
        show(figs["shap_bar"], c[0])
    if "shap_beeswarm" in figs:
        show(figs["shap_beeswarm"], c[1])
    st.dataframe(artifacts.load_importance(paths, key).head(30), hide_index=True)


def page_trends():
    st.title("Trend analysis")
    st.caption("Descriptive counts and shares by period; no model involved. Datasets are shown separately.")
    tabs = st.tabs(["SolRPDS", "Real-CATS BTC", "Real-CATS ETH", "Elliptic"])
    figs = figures.trend_figures(paths, "dark")
    with tabs[0]:
        banner(PROXY_STATEMENT)
        if "solrpds_monthly" in figs:
            show(figs["solrpds_monthly"])
            st.dataframe(trend_io.read_csv(paths.trends, "solrpds_monthly"), hide_index=True)
        else:
            st.info("Run training to generate SolRPDS trends.")
    for tab, ch in ((tabs[1], "btc"), (tabs[2], "eth")):
        with tab:
            f = figs.get(f"{ch}_subtype_by_year")
            if f is None:
                st.info("Run training to generate Real-CATS trends.")
                continue
            show(f)
            st.caption("Years come from first_time; addresses without observed activity have no date and appear as 'undated'.")
            st.dataframe(trend_io.read_csv(paths.trends, f"realcats_{ch}_subtype_by_year"), hide_index=True)
    with tabs[3]:
        if "elliptic_by_step" in figs:
            show(figs["elliptic_by_step"])
            st.caption("Dashed lines mark the train / validation / test boundaries (steps 29|30 and 34|35). "
                       "Unknown transactions are shown for description only.")
            st.dataframe(trend_io.read_csv(paths.trends, "elliptic_by_time_step"), hide_index=True)
        else:
            st.info("Run training to generate Elliptic trends.")


def page_history():
    st.title("Prediction history")
    n = history_db.count(paths.db)
    st.caption(f"{n} saved predictions in `outputs/cryptoradar.db`. Scores are uncalibrated model probabilities.")
    keys = ["(all)"] + list(MODEL_SPECS)
    sel = st.selectbox("Filter by model", keys)
    df = history_db.read_history(paths.db, 1000, None if sel == "(all)" else sel)
    st.dataframe(df, hide_index=True)
    if len(df):
        st.download_button("Download history (CSV)", df.to_csv(index=False).encode(), "prediction_history.csv")


def page_methods():
    st.title(LIMITATIONS_TITLE)
    for head, body in LIMITATIONS:
        st.subheader(head)
        st.write(body)
    st.subheader("Split rules")
    st.write("SolRPDS and Real-CATS: chronological 60/20/20 on first activity time (SolRPDS grouped by pool). "
             "Elliptic: time steps 1-29 train, 30-34 validation, 35-49 test; unknown excluded. "
             "Preprocessing is fitted on the training split only; the threshold is chosen on validation only.")


def page_report():
    st.title("Research report")
    st.write("Builds the formal PDF from saved training outputs only.")
    out = paths.reports / "CryptoRadar_Research_Report.pdf"
    if st.button("Generate PDF report"):
        try:
            import generate_report
            generate_report.build_report(paths, out)
            st.success(f"Report written to {out}")
        except Exception as exc:
            st.error(f"Report generation failed: {exc}")
    if out.exists():
        st.download_button("Download PDF", out.read_bytes(), out.name, mime="application/pdf")


PAGES = {"Overview": page_overview, "Risk scoring": page_scoring, "Model performance": page_performance,
         "Explainability": page_explain, "Trend analysis": page_trends, "Prediction history": page_history,
         "Labels and limitations": page_methods, "Research report": page_report}


def main():
    st.sidebar.markdown("### CryptoRadar")
    st.sidebar.caption("Multi-dataset cryptocurrency risk intelligence")
    page = st.sidebar.radio("Navigate", list(PAGES), label_visibility="collapsed")
    st.sidebar.divider()
    st.sidebar.caption("Separate models per dataset. Scores are uncalibrated and not comparable across datasets.")
    PAGES[page]()


main()