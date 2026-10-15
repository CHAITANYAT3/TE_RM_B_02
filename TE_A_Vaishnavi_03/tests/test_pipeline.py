from src.models import get_models
from src.preprocess import load_config, load_data, preprocess_data


def test_config_loads():
    config = load_config()

    assert config["target"] == "Plaque"
    assert config["seed"] == 42


def test_dataset_loads():
    config = load_config()

    df = load_data(config)

    assert len(df) > 0


def test_preprocessing():
    config = load_config()

    df = load_data(config)

    X, y = preprocess_data(df, config)

    assert len(X) == len(y)
    assert len(X) > 0
    assert "Plaque" not in X.columns


def test_models_exist():
    models = get_models()

    assert "LDA" in models
    assert "KNN" in models
    assert "SVM" in models
    assert "Random Forest" in models