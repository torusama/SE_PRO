from pathlib import Path

from app.features import FEATURE_NAMES
from app.inference import predict_options
from app.model_registry import ModelRegistry
from app.training import train_candidate


def approved_samples():
    return [
        {
            "features": {
                name: (0.8 if (index + offset) % 2 else 0.2)
                for offset, name in enumerate(FEATURE_NAMES)
            },
            "label": {"label_selected": index % 2},
        }
        for index in range(12)
    ]


def test_training_creates_reloadable_artifact_and_bounded_prediction(tmp_path, monkeypatch):
    from app import model_registry

    model_dir = tmp_path / "models"
    registry_path = model_dir / "registry.json"
    monkeypatch.setattr(model_registry, "MODEL_DIR", model_dir)
    monkeypatch.setattr(model_registry, "REGISTRY_PATH", registry_path)
    registry = ModelRegistry()

    result = train_candidate(
        dataset_version="test-dataset",
        version="plot-ranker-test",
        activate=True,
        approved_samples=approved_samples(),
        registry=registry,
    )
    artifact_path = Path(result["artifactPath"])
    assert artifact_path.exists()

    loaded = registry.load()
    assert loaded.version == "plot-ranker-test"
    response = predict_options(
        [
            {
                "optionId": "OPT-001",
                "features": {name: 0.9 for name in FEATURE_NAMES},
            }
        ],
        registry,
    )
    assert response["modelVersion"] == "plot-ranker-test"
    score = response["predictions"][0]["score"]
    assert 0 <= score <= 1

    train_candidate(
        dataset_version="test-dataset-2",
        version="plot-ranker-candidate",
        activate=False,
        approved_samples=approved_samples(),
        registry=registry,
    )
    switched = registry.activate("plot-ranker-candidate")
    assert switched["previousVersion"] == "plot-ranker-test"
    assert registry.load().version == "plot-ranker-candidate"
