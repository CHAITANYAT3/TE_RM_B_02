"""Descriptive trend aggregations (no model involved).

Each function returns a DataFrame; `save_*` writes CSVs under outputs/trends so the dashboard
and the PDF report read exactly the same numbers.

Trends are counts and shares by time period. SolRPDS trends use the inactivity-based
rug-pull proxy label. Real-CATS trends are per chain (BTC and ETH are never combined).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd


def solrpds_monthly(df: pd.DataFrame) -> pd.DataFrame:
    d = df[df["FIRST_POOL_ACTIVITY_TIMESTAMP"].notna()].copy()
    d["month"] = d["FIRST_POOL_ACTIVITY_TIMESTAMP"].dt.to_period("M").dt.to_timestamp()
    g = d.groupby("month").agg(
        n_rows=("y", "size"),
        n_pools=("LIQUIDITY_POOL_ADDRESS", "nunique"),
        n_inactive_proxy=("y", "sum"),
        median_liquidity_adds=("NUM_LIQUIDITY_ADDS", "median"),
        median_liquidity_removes=("NUM_LIQUIDITY_REMOVES", "median"),
    ).reset_index()
    g["inactive_proxy_share"] = g["n_inactive_proxy"] / g["n_rows"]
    return g


def solrpds_by_source(df: pd.DataFrame) -> pd.DataFrame:
    g = df.groupby("source_file").agg(n_rows=("y", "size"), n_inactive_proxy=("y", "sum")).reset_index()
    g["inactive_proxy_share"] = g["n_inactive_proxy"] / g["n_rows"]
    return g


def realcats_subtype_by_year(df: pd.DataFrame) -> pd.DataFrame:
    """Criminal address counts by first-seen year and subtype. Undated rows get year 'undated'."""
    c = df[df["y"] == 1].copy()
    c["year"] = c["first_time"].dt.year.astype("Int64").astype("string").fillna("undated")
    t = c.groupby(["year", "subtype"]).size().rename("n_addresses").reset_index()
    return t


def realcats_class_by_year(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    d["year"] = d["first_time"].dt.year.astype("Int64").astype("string").fillna("undated")
    d["class"] = d["y"].map({1: "criminal", 0: "benign"})
    return d.groupby(["year", "class"]).size().rename("n_addresses").reset_index()


def elliptic_by_time_step(df: pd.DataFrame, edges: pd.DataFrame) -> pd.DataFrame:
    """Per time step counts. Unknown is shown for description only."""
    g = df.groupby("time_step")["y"].agg(
        n_total="size",
        n_illicit=lambda s: int((s == 1).sum()),
        n_licit=lambda s: int((s == 0).sum()),
        n_unknown=lambda s: int((s == -1).sum()),
    ).reset_index()
    g["n_labelled"] = g["n_illicit"] + g["n_licit"]
    g["illicit_share_of_labelled"] = g["n_illicit"] / g["n_labelled"].where(g["n_labelled"] > 0)
    g["unknown_share"] = g["n_unknown"] / g["n_total"]
    step = df.set_index("txId")["time_step"]
    e_step = edges["txId1"].map(step)
    ec = e_step.dropna().astype("int64").value_counts().rename("n_edges")
    ec = ec.rename_axis("time_step").reset_index()
    g["time_step"] = g["time_step"].astype("int64")
    g = g.merge(ec, on="time_step", how="left")
    g["n_edges"] = g["n_edges"].fillna(0).astype(int)
    return g


def save_csv(df: pd.DataFrame, trends_dir: Path, name: str) -> Path:
    trends_dir = Path(trends_dir)
    trends_dir.mkdir(parents=True, exist_ok=True)
    p = trends_dir / f"{name}.csv"
    df.to_csv(p, index=False)
    return p


def read_csv(trends_dir: Path, name: str):
    p = Path(trends_dir) / f"{name}.csv"
    return pd.read_csv(p) if p.exists() else None
