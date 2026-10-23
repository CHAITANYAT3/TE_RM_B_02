"""Builds figures strictly from saved training outputs (metrics JSON, SHAP NPZ/CSV, trend CSVs)."""
from __future__ import annotations

from pathlib import Path

from . import artifacts, plots
from . import trends as trend_io
from .config import MODEL_SPECS, Paths
from .explain import load_shap_sample
from .narrative import PROXY_STATEMENT

SOLRPDS_FOOTER = PROXY_STATEMENT


def _footer(key: str):
    return SOLRPDS_FOOTER if MODEL_SPECS[key]["dataset"] == "solrpds" else None


def model_figures(paths: Paths, key: str, theme: str, only=None) -> dict:
    """name -> matplotlib Figure for one model (only those whose inputs exist).

    `only` restricts which figures are built, so callers never create figures they will not
    display or close (unclosed pyplot figures trigger matplotlib's "more than 20 figures" warning)."""
    def want(name):
        return only is None or name in only

    figs = {}
    m = artifacts.load_metrics(paths, key)
    if not m or m.get("skipped"):
        return figs
    spec = MODEL_SPECS[key]
    main = m["main_model"]
    entry = m["models"][main]
    foot = _footer(key)
    curves = m.get("curves") or {}
    if want("pr_curve") and any(curves.values()):
        figs["pr_curve"] = plots.fig_pr_curve(
            {k: v for k, v in curves.items() if v}, theme, f"{spec['title']}: precision-recall", foot)
    if want("confusion"):
        figs["confusion"] = plots.fig_confusion(entry["test"], theme, f"{spec['title']}: test", foot)
    if want("metric_gap"):
        figs["metric_gap"] = plots.fig_metric_gap(entry["validation"], entry["test"], theme,
                                                  f"{spec['title']}: validation vs test", foot)
    imp = artifacts.load_importance(paths, key) if want("shap_bar") else None
    if imp is not None:
        figs["shap_bar"] = plots.fig_shap_bar(imp, theme, f"{spec['title']}: mean |SHAP|", footer=foot)
    s = load_shap_sample(key, paths.shap) if want("shap_beeswarm") else None
    if s is not None:
        figs["shap_beeswarm"] = plots.fig_shap_beeswarm(s["values"], s["X"], theme, f"{spec['title']}: SHAP summary",
                                                        footer=foot)
    zero = (m.get("data_notes") or {}).get("zero_activity_pct")
    if zero and want("zero_activity"):
        figs["zero_activity"] = plots.fig_zero_activity(zero, theme, f"{spec['title']}: zero-transaction share")
    return figs


def trend_figures(paths: Paths, theme: str) -> dict:
    figs = {}
    monthly = trend_io.read_csv(paths.trends, "solrpds_monthly")
    if monthly is not None and len(monthly):
        figs["solrpds_monthly"] = plots.fig_solrpds_monthly(monthly, theme, SOLRPDS_FOOTER)
    for chain in ("btc", "eth"):
        t = trend_io.read_csv(paths.trends, f"realcats_{chain}_subtype_by_year")
        if t is not None and len(t):
            figs[f"{chain}_subtype_by_year"] = plots.fig_subtype_by_year(
                t, theme, f"Real-CATS {chain.upper()}: criminal addresses by first-seen year")
    e = trend_io.read_csv(paths.trends, "elliptic_by_time_step")
    if e is not None and len(e):
        figs["elliptic_by_step"] = plots.fig_elliptic_steps(e, theme)
    return figs


def render_all(paths: Paths) -> list:
    """Write PNGs for every model and trend, in dark and light themes."""
    written = []
    for theme in ("dark", "light"):
        out = Path(paths.figures) / theme
        out.mkdir(parents=True, exist_ok=True)
        for key in artifacts.metric_keys(paths):
            for name, fig in model_figures(paths, key, theme).items():
                p = out / f"{key}_{name}.png"
                plots.save_fig(fig, p)
                written.append(str(p))
        for name, fig in trend_figures(paths, theme).items():
            p = out / f"trend_{name}.png"
            plots.save_fig(fig, p)
            written.append(str(p))
    return written