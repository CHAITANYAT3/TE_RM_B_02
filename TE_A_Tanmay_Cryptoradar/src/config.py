"""Central configuration for CryptoRadar.

All paths are relative to the project root (the folder that contains app.py),
so the code does not depend on the current working directory.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SEED = 42

# ---------------------------------------------------------------- data files
SOLRPDS_FILES = ("2021.json", "2022.json", "2023.json", "Jan_2024-Nov_2024.json")
REALCATS_FILES = {
    "btc": {"criminal": "CB.tsv", "benign": "BB.tsv"},
    "eth": {"criminal": "CE.tsv", "benign": "BE.tsv"},
}
ELLIPTIC_FILES = {
    "features": "elliptic_txs_features.csv",
    "classes": "elliptic_txs_classes.csv",
    "edges": "elliptic_txs_edgelist.csv",
}

# ------------------------------------------------------------ split settings
# Chronological fractions (train, validation, test) for SolRPDS and Real-CATS.
SPLIT_FRACS = (0.6, 0.2, 0.2)
# Elliptic split by time_step (inclusive ranges).
ELLIPTIC_STEPS = {"train": (1, 29), "val": (30, 34), "test": (35, 49)}

SHAP_MAX_ROWS = 1500

# ------------------------------------------------------------ model registry
DATASETS = {
    "solrpds": "SolRPDS (Solana liquidity pools)",
    "btc": "Real-CATS Bitcoin addresses",
    "eth": "Real-CATS Ethereum addresses",
    "elliptic": "Elliptic (Bitcoin transactions)",
}

MODEL_SPECS = {
    "solrpds_primary": dict(
        dataset="solrpds", role="primary",
        title="SolRPDS - Primary model",
        subtitle="Excludes outcome-related timestamp fields",
        target="inactivity-based rug-pull proxy label (INACTIVITY_STATUS == 'Inactive')",
    ),
    "solrpds_ablation": dict(
        dataset="solrpds", role="ablation",
        title="SolRPDS - Ablation model",
        subtitle="Includes timestamp-derived duration features; potentially label-leaking",
        target="inactivity-based rug-pull proxy label (INACTIVITY_STATUS == 'Inactive')",
    ),
    "btc_filtered": dict(
        dataset="btc", role="headline",
        title="Real-CATS BTC - Activity-filtered",
        subtitle="Headline BTC result; excludes zero-transaction addresses",
        target="criminal (1) vs benign (0) address",
    ),
    "btc_full": dict(
        dataset="btc", role="secondary",
        title="Real-CATS BTC - Full",
        subtitle="Zero-activity addresses are training-only and flagged report-only",
        target="criminal (1) vs benign (0) address",
    ),
    "eth": dict(
        dataset="eth", role="primary",
        title="Real-CATS ETH",
        subtitle="Addresses with observed on-chain activity",
        target="criminal (1) vs benign (0) address",
    ),
    "elliptic": dict(
        dataset="elliptic", role="primary",
        title="Elliptic",
        subtitle="Labelled transactions only (unknown excluded)",
        target="illicit (1) vs licit (0) transaction",
    ),
    "elliptic_degree": dict(
        dataset="elliptic", role="ablation",
        title="Elliptic - Ablation",
        subtitle="Adds in/out-degree computed from the edge list",
        target="illicit (1) vs licit (0) transaction",
    ),
}


# ----------------------------------------------------------------- paths
@dataclass(frozen=True)
class Paths:
    data: Path
    models: Path
    outputs: Path

    @property
    def audit(self) -> Path: return self.outputs / "audit"
    @property
    def metrics(self) -> Path: return self.outputs / "metrics"
    @property
    def figures(self) -> Path: return self.outputs / "figures"
    @property
    def shap(self) -> Path: return self.outputs / "shap"
    @property
    def trends(self) -> Path: return self.outputs / "trends"
    @property
    def reports(self) -> Path: return self.outputs / "reports"
    @property
    def db(self) -> Path: return self.outputs / "cryptoradar.db"

    def make_dirs(self) -> None:
        for p in (self.models, self.audit, self.metrics, self.figures, self.shap,
                  self.trends, self.reports):
            p.mkdir(parents=True, exist_ok=True)


def default_paths() -> Paths:
    """Project-relative defaults; environment variables may override (used by tests)."""
    return Paths(
        data=Path(os.environ.get("CRYPTORADAR_DATA_DIR", ROOT / "data")),
        models=Path(os.environ.get("CRYPTORADAR_MODELS_DIR", ROOT / "models")),
        outputs=Path(os.environ.get("CRYPTORADAR_OUTPUTS_DIR", ROOT / "outputs")),
    )
