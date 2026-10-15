from pathlib import Path

import pandas as pd
import yaml


def load_config(config_path="config.yaml"):
    with open(config_path, "r", encoding="utf-8") as file:
        return yaml.safe_load(file)


def load_data(config):
    data_path = Path(config["data_path"])
    return pd.read_csv(data_path)


def preprocess_data(df, config):
    df = df.copy()

    # Remove unnecessary index columns such as "Unnamed: 0"
    unnamed_columns = [
        column for column in df.columns
        if column.startswith("Unnamed:")
    ]

    if unnamed_columns:
        df = df.drop(columns=unnamed_columns)

    # Remove duplicate rows
    df = df.drop_duplicates()

    # Remove rows marked as unsuitable
    flag_column = config["exclude_flag_column"]

    if flag_column in df.columns:
        df = df[df[flag_column] != 1]

    # Check that the target exists
    target = config["target"]

    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found.")

    # Remove rows where the target is missing
    df = df.dropna(subset=[target])

    # Columns that must not be used as input features
    excluded_columns = {
        config["id_column"],
        config["exclude_flag_column"],
        target,
    }

    # Keep only numeric columns as features
    feature_columns = [
        column
        for column in df.columns
        if column not in excluded_columns
        and pd.api.types.is_numeric_dtype(df[column])
    ]

    X = df[feature_columns].copy()
    y = df[target].astype(int).copy()

    # Fill missing feature values with the median
    X = X.fillna(X.median())

    return X, y