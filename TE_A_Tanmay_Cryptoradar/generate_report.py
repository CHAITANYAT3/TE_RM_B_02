"""Formal academic PDF report (ReportLab + Matplotlib).

    python generate_report.py

Every metric, table and chart is read from files saved by `python -m src.train --all`
(and `python -m src.data_audit`). Nothing is hard-coded: missing inputs produce an explicit
"not available" note or an error, never invented numbers.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

from src import artifacts, figures, plots
from src.config import DATASETS, ELLIPTIC_STEPS, MODEL_SPECS, SPLIT_FRACS, Paths, default_paths
from src.modeling import HEADLINE_METRICS, METRIC_LABELS
from src.narrative import (LIMITATIONS, LIMITATIONS_TITLE, PROXY_LABEL_NAME, PROXY_STATEMENT, SCORE_NOTE,
                           SEPARATE_MODELS_NOTE, SHAP_STATEMENT, ZERO_ACTIVITY_NOTE)

NAVY = colors.HexColor("#14263A")
TEAL = colors.HexColor("#1F7A8C")
GRID = colors.HexColor("#C9D3DE")
SHADE = colors.HexColor("#EEF3F7")

_base = getSampleStyleSheet()
BODY = ParagraphStyle("body", parent=_base["BodyText"], fontName="Times-Roman", fontSize=10.2, leading=13.6,
                      alignment=TA_JUSTIFY, spaceAfter=6)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8.2, leading=10.4, alignment=0, spaceAfter=0)
CELL = ParagraphStyle("cell", parent=SMALL, fontName="Helvetica", fontSize=7.8, leading=9.6)
CELLB = ParagraphStyle("cellb", parent=CELL, fontName="Helvetica-Bold", textColor=colors.white)
CAPTION = ParagraphStyle("caption", parent=SMALL, fontName="Times-Italic", textColor=colors.HexColor("#445566"),
                         spaceBefore=2, spaceAfter=8)
H1 = ParagraphStyle("h1", parent=_base["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=18,
                    textColor=NAVY, spaceBefore=14, spaceAfter=8)
H2 = ParagraphStyle("h2", parent=_base["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=14,
                    textColor=TEAL, spaceBefore=10, spaceAfter=5)
H3 = ParagraphStyle("h3", parent=_base["Heading3"], fontName="Helvetica-Bold", fontSize=9.8, leading=12,
                    textColor=NAVY, spaceBefore=6, spaceAfter=3)
TITLE = ParagraphStyle("title", parent=_base["Title"], fontName="Helvetica-Bold", fontSize=24, leading=29,
                       textColor=NAVY, alignment=0, spaceAfter=10)
SUB = ParagraphStyle("sub", parent=BODY, fontName="Helvetica", fontSize=12, leading=16, alignment=0,
                     textColor=colors.HexColor("#33475B"))
NOTE = ParagraphStyle("note", parent=BODY, fontName="Helvetica", fontSize=8.8, leading=11.5, alignment=0,
                      backColor=SHADE, borderColor=TEAL, borderWidth=0.6, borderPadding=6, spaceBefore=4,
                      spaceAfter=10)


def P(text, style=BODY):
    return Paragraph(escape(str(text)), style)


def fmt(x, nd=3):
    return "n/a" if x is None else f"{x:.{nd}f}"


def table(rows, col_widths=None, header=True, zebra=True):
    data = []
    for i, r in enumerate(rows):
        st = CELLB if (header and i == 0) else CELL
        data.append([Paragraph(escape(str(c)), st) for c in r])
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.4, GRID), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), NAVY))
    if zebra:
        for i in range(1 if header else 0, len(rows)):
            if i % 2 == 0:
                style.append(("BACKGROUND", (0, i), (-1, i), SHADE))
    t.setStyle(TableStyle(style))
    return t


def fig_flowable(fig, width_cm):
    png = plots.fig_to_png(fig, dpi=170)
    w, h = ImageReader(io.BytesIO(png)).getSize()
    width = width_cm * cm
    return Image(io.BytesIO(png), width=width, height=width * h / w)


def fig_row(figs, per_row=2):
    """Place figures side by side; returns flowables."""
    out = []
    w = 8.2 if per_row == 2 else 16.0
    for i in range(0, len(figs), per_row):
        row = [fig_flowable(f, w) for f in figs[i:i + per_row]]
        while len(row) < per_row:
            row.append("")
        t = Table([row], colWidths=[(17 / per_row) * cm] * per_row)
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        out.append(t)
    return out


# ----------------------------------------------------------------- page chrome
def _chrome(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#5B6B7C"))
    canvas.drawString(2 * cm, 1.2 * cm, "CryptoRadar - Cybercrime Trend Analysis Using Machine Learning")
    canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {doc.page}")
    canvas.setStrokeColor(GRID)
    canvas.line(2 * cm, 1.6 * cm, A4[0] - 2 * cm, 1.6 * cm)
    canvas.restoreState()


# ----------------------------------------------------------------- sections
def _results_sentence(key, m):
    e = m["models"][m["main_model"]]
    t, v = e["test"], e["validation"]
    return (f"The main model ({m['main_model']}) uses a decision threshold of {e['threshold']:.4f} "
            f"({e['threshold_source']}). On the test split ({t['n']:,} rows, {t['n_pos']:,} positives) it obtained "
            f"PR-AUC {fmt(t.get('pr_auc'))}, F1 {fmt(t.get('f1'))}, precision {fmt(t.get('precision'))} and "
            f"recall {fmt(t.get('recall'))}. On the validation split (n={v['n']:,}) PR-AUC was "
            f"{fmt(v.get('pr_auc'))}. Probabilities are uncalibrated.")


def model_section(paths, key, story):
    spec = MODEL_SPECS[key]
    m = artifacts.load_metrics(paths, key)
    story.append(Paragraph(escape(f"{spec['title']} - {spec['subtitle']}"), H2))
    if spec["dataset"] == "solrpds":
        story.append(P(PROXY_STATEMENT, NOTE))
        if spec["role"] == "ablation":
            story.append(P("This ablation model includes timestamp-derived duration features and is potentially "
                           "label-leaking. It is reported to quantify how much of the result depends on those "
                           "fields and must not be read as a fair performance estimate.", NOTE))
    if key == "btc_full":
        story.append(P(ZERO_ACTIVITY_NOTE, NOTE))
    if key == "btc_filtered":
        story.append(P("Headline BTC result. Metrics here are reported separately from the Full BTC model and "
                       "are never averaged or combined with them.", NOTE))
    if m is None:
        story.append(P("Metrics for this model were not found (training has not produced them)."))
        return
    if m.get("skipped"):
        story.append(P(f"Training was skipped for this model: {m['skipped']}."))
        return
    e = m["models"][m["main_model"]]
    story.append(P(_results_sentence(key, m)))
    ss = m["split_summary"]
    split_rows = [[s, f"{v['n']:,}", f"{v['n_pos']:,}", f"{v['n_neg']:,}", fmt(v["pos_rate"])]
                  for s, v in ss.items()]
    ts = m.get("training_set")
    if ts and ts["n"] != ss["train"]["n"]:
        split_rows.append(["train (actually used, incl. zero-activity training-only rows)", f"{ts['n']:,}",
                           f"{ts['n_pos']:,}", f"{ts['n_neg']:,}", fmt(ts["n_pos"] / ts["n"] if ts["n"] else None)])
    story.append(table([["Split", "Rows", "Positives", "Negatives", "Positive rate"]] + split_rows,
                       [6 * cm, 2.6 * cm, 2.6 * cm, 2.6 * cm, 2.6 * cm]))
    story.append(Spacer(1, 6))
    rows = [["Metric (positive class)", "Train (in-sample)", "Validation", "Test", "Test minus validation"]]
    for k in HEADLINE_METRICS:
        rows.append([METRIC_LABELS[k], fmt(e["train_in_sample"].get(k)), fmt(e["validation"].get(k)),
                     fmt(e["test"].get(k)), fmt(e["test_minus_validation"].get(k))])
    story.append(table(rows, [5.2 * cm, 2.9 * cm, 2.7 * cm, 2.7 * cm, 3.5 * cm]))
    story.append(P(f"Calibration diagnostics on the test split (the model is not recalibrated): Brier score "
                   f"{fmt(e['test'].get('brier'))}, expected calibration error (10 bins) "
                   f"{fmt(e['test'].get('ece_10bin'))}.", CAPTION))
    base = [["Algorithm", *[METRIC_LABELS[k].split(" (")[0] for k in HEADLINE_METRICS]]]
    for n, v in m["models"].items():
        base.append([n + (" (main)" if n == m["main_model"] else ""),
                     *[fmt(v["test"].get(k)) for k in HEADLINE_METRICS]])
    story.append(P("Test-split metrics of every algorithm fitted on identical splits:", SMALL))
    story.append(table(base, [4.2 * cm] + [2.1 * cm] * 6))
    story.append(Spacer(1, 6))
    figs = figures.model_figures(paths, key, "light", only=("pr_curve", "confusion", "zero_activity"))
    sel = [figs[n] for n in ("pr_curve", "confusion") if n in figs]
    story += fig_row(sel)
    if "zero_activity" in figs:
        story += fig_row([figs["zero_activity"]])
    ro = m.get("report_only_zero_activity")
    if ro and ro.get("n"):
        story.append(Paragraph("Report-only: zero-activity addresses (no observed on-chain activity)", H3))
        story.append(P(f"{ro['n']:,} addresses have no observed transactions and no timestamps. "
                       + ("They were training-only rows in this model, so these scores are in-sample "
                          "diagnostics. " if ro.get("in_sample_training_rows") else
                          "They were never seen by this model. ")
                       + "All their features are zero, so the model cannot tell criminal from benign among them; "
                         "the shares below reflect the score assigned to the all-zero feature vector.", SMALL))
        story.append(table([["Class", "Rows", "Share above threshold", "Mean model risk score"],
                            ["criminal", f"{ro.get('n_criminal', 0):,}", fmt(ro.get("share_above_threshold_criminal")),
                             fmt(ro.get("mean_score_criminal"))],
                            ["benign", f"{ro.get('n_benign', 0):,}", fmt(ro.get("share_above_threshold_benign")),
                             fmt(ro.get("mean_score_benign"))]],
                           [3 * cm, 3 * cm, 5 * cm, 5 * cm]))
    story.append(Spacer(1, 8))


def data_section(paths, story):
    audit = artifacts.load_audit(paths)
    story.append(Paragraph("2. Datasets and Data Audit", H1))
    if not audit:
        story.append(P("The audit file was not found. Run python -m src.data_audit before generating the report."))
        return
    d = audit["datasets"]
    if "solrpds" in d:
        s = d["solrpds"]
        story.append(Paragraph("2.1 SolRPDS", H2))
        story.append(P("The yearly SolRPDS files are partitions of one dataset and were loaded and concatenated. "
                       f"The target is the {PROXY_LABEL_NAME}: y = (INACTIVITY_STATUS == 'Inactive')."))
        story.append(P(PROXY_STATEMENT, NOTE))
        li = s["load_info"]
        story.append(table([["Item", "Value"],
                            ["Files loaded", ", ".join(li["files_found"])],
                            ["Files missing", ", ".join(li["files_missing"]) or "none"],
                            ["Rows (after de-duplication)", f"{s['rows']:,}"],
                            ["Exact duplicate rows dropped", f"{li['exact_duplicates_dropped']:,}"],
                            ["Unique pools", f"{s['unique_pools']:,}"],
                            ["Proxy-positive rows (Inactive)", f"{s['label_counts']['inactive_proxy_positive']:,}"],
                            ["Proxy-negative rows (Active)", f"{s['label_counts']['active_negative']:,}"]],
                           [6 * cm, 10 * cm]))
    for ch in ("btc", "eth"):
        if ch in d:
            r = d[ch]
            z = r["zero_activity"]
            story.append(Paragraph(f"2.{2 if ch == 'btc' else 3} Real-CATS {ch.upper()}", H2))
            story.append(P(f"Unit assumption: {r['unit_assumption']}. Implied USD per coin from the dataset's own "
                           f"USD columns (median): {fmt(r['implied_usd_per_coin_median'], 2)}, used as a "
                           "sanity check of that assumption."))
            story.append(table([["Class", "Rows", "Zero-transaction rows", "Zero-transaction share (%)", "Undated rows"],
                                *[[c, f"{z[c]['n']:,}", f"{z[c]['zero_transaction_n']:,}",
                                   f"{z[c]['zero_transaction_pct']:.2f}", f"{z[c]['undated_n']:,}"]
                                  for c in ("criminal", "benign")]],
                               [3 * cm, 3 * cm, 3.6 * cm, 4 * cm, 3 * cm]))
            if ch == "btc":
                story.append(P("A model trained on all addresses may learn that no observed activity means criminal, "
                               "which is not a behavioural fraud signal.", CAPTION))
    if "elliptic" in d:
        e = d["elliptic"]
        story.append(Paragraph("2.4 Elliptic", H2))
        c = e["class_counts"]
        story.append(P(f"{e['rows']:,} transactions, {e['edges_total']:,} edges, time steps "
                       f"{e['time_step_min_max'][0]}-{e['time_step_min_max'][1]}. Class counts: illicit "
                       f"{c['illicit']:,}, licit {c['licit']:,}, unknown {c['unknown']:,}. Unknown transactions "
                       "are not treated as licit and are excluded from training, validation and testing."))
        story.append(table([["Split", "Time steps", "Labelled", "Illicit", "Licit"],
                            *[[k, f"{v['time_steps'][0]}-{v['time_steps'][1]}", f"{v['n_labelled']:,}",
                               f"{v['n_illicit']:,}", f"{v['n_licit']:,}"] for k, v in e["per_split_labelled"].items()]],
                           [3 * cm, 3 * cm, 3 * cm, 3 * cm, 3 * cm]))


def method_section(story):
    story.append(Paragraph("3. Methodology", H1))
    story.append(Paragraph("3.1 Separate models", H2))
    story.append(P(SEPARATE_MODELS_NOTE))
    story.append(Paragraph("3.2 Splits", H2))
    f = SPLIT_FRACS
    story.append(P(f"SolRPDS and Real-CATS use chronological splits on first activity time with fractions "
                   f"{f[0]:.0%} / {f[1]:.0%} / {f[2]:.0%} (train / validation / test). SolRPDS rows are grouped by pool "
                   "address so a pool cannot appear in two splits. Elliptic uses time steps "
                   f"{ELLIPTIC_STEPS['train'][0]}-{ELLIPTIC_STEPS['train'][1]} for training, "
                   f"{ELLIPTIC_STEPS['val'][0]}-{ELLIPTIC_STEPS['val'][1]} for validation and "
                   f"{ELLIPTIC_STEPS['test'][0]}-{ELLIPTIC_STEPS['test'][1]} for testing, labelled transactions only."))
    story.append(Paragraph("3.3 Leakage controls", H2))
    story.append(P("Preprocessing (median imputation, and log scaling plus standardisation for the logistic baseline) "
                   "is fitted on the training split only. The decision threshold is selected on the validation split "
                   "only, and the test split is scored once. Identifiers, label subtypes, collection or verification "
                   "flags (watchback_checked, gs_checked, etherscan_checked), all *_transaction_id columns and absolute "
                   "timestamps are never model features. SolRPDS LAST_SWAP_TIMESTAMP, LAST_SWAP_TX_ID and everything "
                   "derived from them are excluded from the primary model."))
    story.append(Paragraph("3.4 Models and metrics", H2))
    story.append(P("Each dataset is modelled with logistic regression and random forest baselines and a gradient-boosted "
                   "tree main model (XGBoost) with class weighting for imbalance. Hyper-parameters are fixed defaults. "
                   "Headline metrics for the positive class are PR-AUC (average precision), F1, precision, recall, "
                   "ROC-AUC and MCC. Accuracy is not reported as a headline metric because the classes are imbalanced."))
    story.append(P(SCORE_NOTE))


def shap_section(paths, story):
    story.append(Paragraph("5. Explainability (SHAP)", H1))
    story.append(P(SHAP_STATEMENT))
    any_fig = False
    for key in MODEL_SPECS:
        imp = artifacts.load_importance(paths, key)
        if imp is None:
            continue
        any_fig = True
        spec = MODEL_SPECS[key]
        story.append(Paragraph(escape(f"{spec['title']} - {spec['subtitle']}"), H3))
        story.append(table([["Rank", "Feature", "Mean |SHAP|"],
                            *[[int(r["rank"]), r["feature"], f"{r['mean_abs_shap']:.5f}"]
                              for _, r in imp.head(8).iterrows()]], [2 * cm, 9 * cm, 4 * cm]))
        figs = figures.model_figures(paths, key, "light", only=("shap_bar", "shap_beeswarm"))
        sel = [figs[n] for n in ("shap_bar", "shap_beeswarm") if n in figs]
        story += fig_row(sel)
    if not any_fig:
        story.append(P("No SHAP outputs were found. Run training without --skip-shap."))


def trend_section(paths, story):
    story.append(Paragraph("6. Trend Analysis", H1))
    story.append(P("Trends are descriptive counts and shares by period; no model is involved. Datasets are shown "
                   "separately and never merged."))
    figs = figures.trend_figures(paths, "light")
    if "solrpds_monthly" in figs:
        story.append(P(PROXY_STATEMENT, NOTE))
        story += fig_row([figs["solrpds_monthly"]], 1)
    for ch in ("btc", "eth"):
        if f"{ch}_subtype_by_year" in figs:
            story += fig_row([figs[f"{ch}_subtype_by_year"]], 1)
    if "elliptic_by_step" in figs:
        story += fig_row([figs["elliptic_by_step"]], 1)
        story.append(P("Dashed lines mark the train / validation / test boundaries. Unknown transactions are shown "
                       "for description only.", CAPTION))
    if not figs:
        story.append(P("No trend outputs were found. Run python -m src.train --all."))


def limitations_section(story):
    story.append(Paragraph(f"7. {LIMITATIONS_TITLE}", H1))
    for head, body in LIMITATIONS:
        story.append(Paragraph(escape(head), H2))
        story.append(P(body))


def reproducibility_section(paths, story, summary):
    story.append(Paragraph("8. Reproducibility", H1))
    v = summary.get("versions", {})
    story.append(table([["Item", "Value"], *[[k, str(val)] for k, val in v.items()],
                        ["Training summary generated (UTC)", summary.get("generated_utc", "n/a")]], [6 * cm, 10 * cm]))
    story.append(Paragraph("Appendix: model features", H2))
    for key in MODEL_SPECS:
        meta = artifacts.load_meta(paths, key)
        if not meta:
            continue
        names = meta["feature_names"]
        text = (", ".join(names) if len(names) <= 40 else
                f"{len(names)} features: {names[0]} ... {names[-1]} (local_01-local_93, agg_01-agg_72)"
                + (", in_degree, out_degree" if "in_degree" in names else ""))
        story.append(Paragraph(escape(f"{MODEL_SPECS[key]['title']} ({len(names)} features)"), H3))
        story.append(P(text, SMALL))


# ----------------------------------------------------------------- build
def build_report(paths: Paths | None = None, out_path: Path | None = None) -> Path:
    paths = paths or default_paths()
    summary = artifacts.load_summary(paths)
    if not summary or not summary.get("models"):
        raise FileNotFoundError("outputs/metrics/summary.json not found. Run: python -m src.train --all")
    out_path = Path(out_path or (paths.reports / "CryptoRadar_Research_Report.pdf"))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    trained = [k for k, r in summary["models"].items() if r["status"] == "trained"]

    story = []
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("CryptoRadar", TITLE))
    story.append(Paragraph("Multi-Dataset Cryptocurrency Risk Intelligence Platform", SUB))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Cybercrime Trend Analysis Using Machine Learning: Cryptocurrency Scams and "
                           "Rug-Pull Fraud", SUB))
    story.append(Spacer(1, 1.2 * cm))
    story.append(P(f"Academic research prototype. Generated from the training run of "
                   f"{summary.get('generated_utc', 'n/a')} (UTC).", SMALL))
    story.append(PageBreak())

    story.append(Paragraph("Abstract", H1))
    story.append(P("This report documents an offline research prototype that builds separate machine-learning "
                   "models for four cryptocurrency datasets: SolRPDS (Solana liquidity pools), Real-CATS Bitcoin "
                   "addresses, Real-CATS Ethereum addresses and the Elliptic Bitcoin transaction graph. "
                   f"{len(trained)} models were trained in the run that produced this report. All splits are "
                   "time-aware, preprocessing is fitted on training data only, and SHAP is used to explain the main "
                   "model of each dataset. Every number below is read from files saved by the training run. "
                   "No cross-dataset generalisation is claimed."))
    story.append(P(PROXY_STATEMENT, NOTE))

    story.append(Paragraph("1. Scope and Terminology", H1))
    story.append(P("Model outputs are called model probability, model risk score and model-indicated risk. They are "
                   "uncalibrated and are not confirmations of fraud. " + SCORE_NOTE))
    data_section(paths, story)
    method_section(story)

    story.append(Paragraph("4. Results", H1))
    story.append(P("Results are reported per dataset and per model variant. Variants of the same dataset (primary vs "
                   "ablation, activity-filtered vs full) are separate results and are never averaged or merged."))
    for key in ("solrpds_primary", "solrpds_ablation", "btc_filtered", "btc_full", "eth", "elliptic",
                "elliptic_degree"):
        if key in summary["models"]:
            model_section(paths, key, story)
    if summary.get("failed"):
        story.append(P(f"Datasets that failed during training: {summary['failed']}", NOTE))

    shap_section(paths, story)
    trend_section(paths, story)
    limitations_section(story)
    reproducibility_section(paths, story, summary)

    doc = SimpleDocTemplate(str(out_path), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm,
                            bottomMargin=2.2 * cm, title="CryptoRadar Research Report",
                            author="CryptoRadar research prototype")
    doc.build(story, onFirstPage=_chrome, onLaterPages=_chrome)
    return out_path


def main() -> int:
    try:
        out = build_report()
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"Report written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())