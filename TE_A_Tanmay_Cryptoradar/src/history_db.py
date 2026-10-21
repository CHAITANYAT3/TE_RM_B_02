"""SQLite prediction history. Stores model risk scores (uncalibrated model probabilities)."""
from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_utc TEXT NOT NULL,
    dataset TEXT NOT NULL,
    model_key TEXT NOT NULL,
    model_version TEXT,
    input_ref TEXT,
    input_hash TEXT,
    model_risk_score REAL NOT NULL,
    threshold REAL NOT NULL,
    above_threshold INTEGER NOT NULL,
    top_drivers_json TEXT,
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_predictions_model ON predictions(model_key);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_utc);
"""


def _connect(db_path: Path) -> sqlite3.Connection:
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path) -> None:
    with closing(_connect(db_path)) as conn:
        conn.executescript(SCHEMA)
        conn.commit()


def log_prediction(db_path: Path, *, dataset: str, model_key: str, model_version: str | None,
                   input_ref: str | None, input_hash: str | None, score: float, threshold: float,
                   top_drivers: list | None = None, note: str | None = None) -> int:
    init_db(db_path)
    with closing(_connect(db_path)) as conn:
        cur = conn.execute(
            "INSERT INTO predictions (created_utc, dataset, model_key, model_version, input_ref, input_hash,"
            " model_risk_score, threshold, above_threshold, top_drivers_json, note)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (datetime.now(timezone.utc).isoformat(timespec="seconds"), dataset, model_key, model_version,
             input_ref, input_hash, float(score), float(threshold), int(score >= threshold),
             json.dumps(top_drivers) if top_drivers is not None else None, note))
        conn.commit()
        return int(cur.lastrowid)


def read_history(db_path: Path, limit: int = 500, model_key: str | None = None) -> pd.DataFrame:
    init_db(db_path)
    q = "SELECT * FROM predictions"
    args: list = []
    if model_key:
        q += " WHERE model_key = ?"
        args.append(model_key)
    q += " ORDER BY id DESC LIMIT ?"
    args.append(int(limit))
    with closing(_connect(db_path)) as conn:
        return pd.read_sql_query(q, conn, params=args)


def count(db_path: Path) -> int:
    init_db(db_path)
    with closing(_connect(db_path)) as conn:
        return int(conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0])
