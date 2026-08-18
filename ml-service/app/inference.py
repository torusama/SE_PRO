from .features import feature_vector
from .model_registry import ModelRegistry


def predict_options(
    options: list[dict[str, object]],
    registry: ModelRegistry | None = None,
) -> dict[str, object]:
    model_registry = registry or ModelRegistry()
    artifact = model_registry.load()
    vectors = [
        feature_vector(option.get("features") if isinstance(option, dict) else {})
        for option in options
    ]
    probabilities = artifact.model.predict_proba(vectors)[:, 1]
    return {
        "modelVersion": artifact.version,
        "predictions": [
            {
                "optionId": str(option["optionId"]),
                "score": round(float(score), 6),
            }
            for option, score in zip(options, probabilities, strict=True)
        ],
    }
