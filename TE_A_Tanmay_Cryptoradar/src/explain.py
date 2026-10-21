"""SHAP explainability for the main (tree) model of each dataset.

SHAP values are associative explanations of the trained model, not causal claims.
`shap` is imported lazily so the rest of the code base works without it; training raises a clear
error unless --skip-shap is passed.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .config import SEED, SHAP_MAX_ROWS
from .utils import get_logger

log = get_logger()


def shap_available() -> bool:
    try:
        import shap  # noqa: F401
        return True
    except Exception:
        return False


def _as_2d(values) -> np.ndarray:
    """Normalise SHAP output to (n_rows, n_features) for the positive class."""
    if isinstance(values, list):                 # older shap: list per class
        values = values[-1]
    values = np.asarray(values)
    if values.ndim == 3:                         # (n, f, classes)
        values = values[:, :, -1]
    return values


def _base_value(explainer) -> float:
    ev = np.asarray(explainer.expected_value).ravel()
    return float(ev[-1])


def transform_for_model(pipeline, X: pd.DataFrame) -> pd.DataFrame:
    return pipeline[:-1].transform(X)


def compute_shap(pipeline, X: pd.DataFrame, max_rows: int = SHAP_MAX_ROWS, seed: int = SEED):
    """SHAP values on a random sample of X (raw feature frame). Returns a dict."""
    import shap
    if len(X) == 0:
        raise ValueError("No rows available for SHAP")
    if len(X) > max_rows:
        X = X.sample(n=max_rows, random_state=seed)
    Xt = transform_for_model(pipeline, X)
    clf = pipeline.steps[-1][1]
    explainer = shap.TreeExplainer(clf)
    values = _as_2d(explainer.shap_values(Xt))
    return {"values": values.astype("float32"), "X": Xt.astype("float32"),
            "base_value": _base_value(explainer), "index": list(X.index)}


def importance_table(values: np.ndarray, names) -> pd.DataFrame:
    imp = pd.DataFrame({"feature": list(names), "mean_abs_shap": np.abs(values).mean(axis=0)})
    imp = imp.sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
    imp["rank"] = np.arange(1, len(imp) + 1)
    return imp


def save_shap(result: dict, key: str, shap_dir: Path) -> pd.DataFrame:
    shap_dir = Path(shap_dir)
    shap_dir.mkdir(parents=True, exist_ok=True)
    names = list(result["X"].columns)
    imp = importance_table(result["values"], names)
    imp.to_csv(shap_dir / f"{key}_importance.csv", index=False)
    np.savez_compressed(shap_dir / f"{key}_shap_sample.npz",
                        values=result["values"], X=result["X"].to_numpy(dtype="float32"),
                        names=np.array(names), base_value=np.array([result["base_value"]]))
    return imp


def load_shap_sample(key: str, shap_dir: Path):
    path = Path(shap_dir) / f"{key}_shap_sample.npz"
    if not path.exists():
        return None
    z = np.load(path, allow_pickle=False)
    return {"values": z["values"], "X": pd.DataFrame(z["X"], columns=[str(n) for n in z["names"]]),
            "base_value": float(z["base_value"][0])}


def local_explanation(pipeline, X_row: pd.DataFrame, top_k: int = 10) -> pd.DataFrame:
    """Top-k SHAP contributions for the rows in X_row (expects one row)."""
    import shap
    Xt = transform_for_model(pipeline, X_row)
    clf = pipeline.steps[-1][1]
    explainer = shap.TreeExplainer(clf)
    values = _as_2d(explainer.shap_values(Xt))[0]
    out = pd.DataFrame({"feature": list(Xt.columns), "feature_value": Xt.iloc[0].to_numpy(dtype=float),
                        "shap_value": values})
    out["abs"] = out["shap_value"].abs()
    return out.sort_values("abs", ascending=False).head(top_k).drop(columns="abs").reset_index(drop=True)
