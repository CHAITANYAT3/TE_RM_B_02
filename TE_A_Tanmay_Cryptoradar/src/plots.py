"""Matplotlib figures used by both the Streamlit dashboard (dark) and the PDF report (light).

Every function takes already-saved data (JSON / CSV / NPZ produced by training), never
hard-coded numbers. SolRPDS figures carry the proxy-label statement in the footer.
"""
from __future__ import annotations

import io
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

THEMES = {
    "dark": dict(bg="#0F1B2B", fg="#E6EDF3", muted="#8FA3B8", grid="#25405B",
                 a1="#4FB3BF", a2="#F2B134", a3="#E4572E", a4="#8E7DBE", a5="#6FCF97"),
    "light": dict(bg="#FFFFFF", fg="#1B2A3A", muted="#5B6B7C", grid="#D5DDE6",
                  a1="#1F7A8C", a2="#C98A12", a3="#B83A1B", a4="#6A5ACD", a5="#2E8B57"),
}
CYCLE = ["a1", "a2", "a3", "a4", "a5"]


def _theme(name):
    return THEMES[name]


def _new(theme, size=(7.2, 4.2), nrows=1, ncols=1, **kw):
    t = _theme(theme)
    fig, axes = plt.subplots(nrows, ncols, figsize=size, facecolor=t["bg"], **kw)
    for ax in np.atleast_1d(axes).ravel():
        _style(ax, t)
    return fig, axes


def _style(ax, t):
    ax.set_facecolor(t["bg"])
    for s in ax.spines.values():
        s.set_color(t["grid"])
    ax.tick_params(colors=t["muted"], labelsize=8)
    ax.xaxis.label.set_color(t["fg"])
    ax.yaxis.label.set_color(t["fg"])
    ax.title.set_color(t["fg"])
    ax.grid(True, color=t["grid"], linewidth=0.5, alpha=0.6)
    ax.set_axisbelow(True)


def _finish(fig, theme, footer=None):
    t = _theme(theme)
    if footer:
        wrapped = "\n".join(textwrap.wrap(footer, 120))
        fig.text(0.01, 0.01, wrapped, fontsize=6.5, color=t["muted"], va="bottom", ha="left")
        fig.tight_layout(rect=(0, 0.07, 1, 1))
    else:
        fig.tight_layout()
    return fig


def fig_to_png(fig, dpi=160) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, facecolor=fig.get_facecolor())
    plt.close(fig)
    return buf.getvalue()


def save_fig(fig, path, dpi=160):
    with open(path, "wb") as fh:
        fh.write(fig_to_png(fig, dpi))


# ----------------------------------------------------------------- model figures
def fig_pr_curve(curves: dict, theme="dark", title="Precision-recall curve", footer=None):
    fig, ax = _new(theme, (6.2, 4.2))
    t = _theme(theme)
    for i, (name, c) in enumerate(curves.items()):
        if not c:
            continue
        ax.plot(c["recall"], c["precision"], color=t[CYCLE[i]], lw=1.8, label=f"{name} (prevalence {c['prevalence']:.3f})")
        ax.axhline(c["prevalence"], color=t[CYCLE[i]], lw=0.8, ls=":")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.02)
    ax.set_title(title, fontsize=10)
    if any(curves.values()):
        leg = ax.legend(fontsize=7, facecolor=t["bg"], edgecolor=t["grid"])
        for tx in leg.get_texts():
            tx.set_color(t["fg"])
    else:
        ax.text(0.5, 0.5, "No positives in these splits", ha="center", color=t["muted"], transform=ax.transAxes)
    return _finish(fig, theme, footer)


def fig_confusion(m: dict, theme="dark", title="Test confusion matrix", footer=None):
    fig, ax = _new(theme, (4.2, 3.8))
    t = _theme(theme)
    if m is None or m.get("tp") is None:
        ax.text(0.5, 0.5, "No test data", ha="center", color=t["muted"], transform=ax.transAxes)
        return _finish(fig, theme, footer)
    mat = np.array([[m["tn"], m["fp"]], [m["fn"], m["tp"]]])
    ax.grid(False)
    ax.imshow(mat, cmap="Blues" if theme == "light" else "viridis", alpha=0.85)
    for (i, j), v in np.ndenumerate(mat):
        ax.text(j, i, f"{v:,}", ha="center", va="center", color="#FFFFFF" if theme == "dark" else "#102030",
                fontsize=11, fontweight="bold")
    ax.set_xticks([0, 1], ["pred 0", "pred 1"])
    ax.set_yticks([0, 1], ["true 0", "true 1"])
    ax.set_title(f"{title}\n(threshold {m['threshold']:.3f})", fontsize=9)
    return _finish(fig, theme, footer)


def fig_metric_gap(val: dict, test: dict, theme="dark", title="Validation vs test", footer=None):
    from .modeling import HEADLINE_METRICS, METRIC_LABELS
    fig, ax = _new(theme, (7.0, 3.8))
    t = _theme(theme)
    names = [METRIC_LABELS[k].split(" (")[0] for k in HEADLINE_METRICS]
    v = [val.get(k) if val.get(k) is not None else np.nan for k in HEADLINE_METRICS]
    s = [test.get(k) if test.get(k) is not None else np.nan for k in HEADLINE_METRICS]
    x = np.arange(len(names))
    ax.bar(x - 0.2, v, 0.38, color=t["a1"], label="validation")
    ax.bar(x + 0.2, s, 0.38, color=t["a2"], label="test")
    ax.set_xticks(x, names, rotation=20, ha="right")
    ax.set_title(title, fontsize=10)
    ax.axhline(0, color=t["grid"], lw=0.8)
    leg = ax.legend(fontsize=7, facecolor=t["bg"], edgecolor=t["grid"])
    for tx in leg.get_texts():
        tx.set_color(t["fg"])
    return _finish(fig, theme, footer)


def fig_shap_bar(imp: pd.DataFrame, theme="dark", title="Mean |SHAP|", top=15, footer=None):
    fig, ax = _new(theme, (6.6, 4.6))
    t = _theme(theme)
    d = imp.head(top).iloc[::-1]
    ax.barh(d["feature"], d["mean_abs_shap"], color=t["a1"])
    ax.set_xlabel("mean |SHAP value| (model-output units)")
    ax.set_title(title, fontsize=10)
    ax.tick_params(axis="y", labelsize=7)
    return _finish(fig, theme, footer)


def fig_shap_beeswarm(values: np.ndarray, X: pd.DataFrame, theme="dark", title="SHAP summary", top=12, footer=None,
                      seed=0):
    fig, ax = _new(theme, (6.8, 5.0))
    t = _theme(theme)
    order = np.argsort(-np.abs(values).mean(axis=0))[:top][::-1]
    rng = np.random.default_rng(seed)
    cmap = plt.get_cmap("coolwarm")
    for row, j in enumerate(order):
        col = X.iloc[:, j].to_numpy(dtype=float)
        rank = pd.Series(col).rank(pct=True).to_numpy()
        ax.scatter(values[:, j], row + rng.uniform(-0.28, 0.28, len(col)), c=rank, cmap=cmap, s=6, alpha=0.7,
                   linewidths=0)
    ax.set_yticks(range(len(order)), [X.columns[j] for j in order], fontsize=7)
    ax.axvline(0, color=t["muted"], lw=0.8)
    ax.set_xlabel("SHAP value (impact on model output); colour = feature value percentile (blue low, red high)")
    ax.set_title(title, fontsize=10)
    return _finish(fig, theme, footer)


def fig_zero_activity(zero: dict, theme="dark", title="Zero-transaction addresses", footer=None):
    fig, ax = _new(theme, (4.6, 3.6))
    t = _theme(theme)
    labels = ["criminal", "benign"]
    vals = [zero[k]["zero_transaction_pct"] for k in labels]
    bars = ax.bar(labels, vals, color=[t["a3"], t["a1"]])
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v, f"{v:.1f}%", ha="center", va="bottom", color=t["fg"], fontsize=9)
    ax.set_ylabel("% of addresses with zero observed transactions")
    ax.set_title(title, fontsize=9)
    return _finish(fig, theme, footer)


# ----------------------------------------------------------------- trend figures
def fig_solrpds_monthly(df: pd.DataFrame, theme="dark", footer=None, title="SolRPDS by first-activity month"):
    fig, (a, b) = _new(theme, (7.4, 5.0), nrows=2, ncols=1, sharex=True)
    t = _theme(theme)
    x = pd.to_datetime(df["month"])
    a.bar(x, df["n_rows"], width=22, color=t["a1"])
    a.set_ylabel("pool-mint rows")
    a.set_title(title, fontsize=10)
    b.plot(x, df["inactive_proxy_share"], color=t["a2"], lw=1.8, marker="o", ms=3)
    b.set_ylabel("share labelled Inactive\n(proxy label)")
    b.set_ylim(bottom=0)
    return _finish(fig, theme, footer)


def fig_subtype_by_year(df: pd.DataFrame, theme="dark", title="Criminal addresses by first-seen year", top=6,
                        footer=None):
    fig, ax = _new(theme, (7.2, 4.2))
    t = _theme(theme)
    if df is None or df.empty:
        ax.text(0.5, 0.5, "No data", ha="center", color=t["muted"], transform=ax.transAxes)
        return _finish(fig, theme, footer)
    tops = df.groupby("subtype")["n_addresses"].sum().sort_values(ascending=False).head(top).index
    d = df.assign(subtype=np.where(df["subtype"].isin(tops), df["subtype"], "other subtypes"))
    pv = d.pivot_table(index="year", columns="subtype", values="n_addresses", aggfunc="sum", fill_value=0)
    pv = pv.reindex(sorted(pv.index, key=lambda s: (s == "undated", s)))
    bottom = np.zeros(len(pv))
    colors = [t[c] for c in CYCLE] + ["#7F8C9A", "#B0883A"]
    for i, col in enumerate(pv.columns):
        ax.bar(pv.index.astype(str), pv[col], bottom=bottom, label=col, color=colors[i % len(colors)])
        bottom += pv[col].to_numpy()
    ax.set_ylabel("criminal addresses")
    ax.set_title(title, fontsize=10)
    ax.tick_params(axis="x", rotation=45)
    leg = ax.legend(fontsize=6, facecolor=t["bg"], edgecolor=t["grid"], ncol=2)
    for tx in leg.get_texts():
        tx.set_color(t["fg"])
    return _finish(fig, theme, footer)


def fig_elliptic_steps(df: pd.DataFrame, theme="dark", title="Elliptic by time step", footer=None):
    from .config import ELLIPTIC_STEPS
    fig, (a, b) = _new(theme, (7.4, 5.0), nrows=2, ncols=1, sharex=True)
    t = _theme(theme)
    a.plot(df["time_step"], df["illicit_share_of_labelled"], color=t["a3"], lw=1.8, marker="o", ms=3)
    a.set_ylabel("illicit share of\nlabelled transactions")
    a.set_title(title, fontsize=10)
    b.bar(df["time_step"], df["n_unknown"], color=t["muted"], label="unknown (excluded from ML)")
    b.bar(df["time_step"], df["n_licit"], bottom=df["n_unknown"], color=t["a1"], label="licit")
    b.bar(df["time_step"], df["n_illicit"], bottom=df["n_unknown"] + df["n_licit"], color=t["a3"], label="illicit")
    b.set_ylabel("transactions")
    b.set_xlabel("time step")
    leg = b.legend(fontsize=6.5, facecolor=t["bg"], edgecolor=t["grid"])
    for tx in leg.get_texts():
        tx.set_color(t["fg"])
    for ax in (a, b):
        for edge in (ELLIPTIC_STEPS["train"][1] + 0.5, ELLIPTIC_STEPS["val"][1] + 0.5):
            ax.axvline(edge, color=t["a2"], lw=1, ls="--")
    return _finish(fig, theme, footer)
