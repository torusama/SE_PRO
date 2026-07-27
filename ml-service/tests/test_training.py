from pathlib import Path

from app.inference import predict_options
from app.model_registry import MODEL_DIR, REGISTRY_PATH, ModelRegistry
from app.training import train_candidate


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
                "features": {
                    "budget_match_score": 0.9,
                    "zone_match": 1,
                    "adjacency_score": 1,
                },
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
        registry=registry,
    )
    switched = registry.activate("plot-ranker-candidate")
    assert switched["previousVersion"] == "plot-ranker-test"
    assert registry.load().version == "plot-ranker-candidate"
