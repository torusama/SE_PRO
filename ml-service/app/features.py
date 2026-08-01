from collections.abc import Mapping
from typing import Any

FEATURE_NAMES = [
    "budget_match_score",
    "zone_match",
    "preferred_direction_match",
    "adjacency_score",
    "plot_type_match",
    "number_of_plots_match",
    "area_match_score",
    "price_to_budget_ratio",
]


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def feature_vector(features: Mapping[str, Any] | None) -> list[float]:
    """Return a complete, stable feature vector without fabricating values."""

    if not isinstance(features, Mapping):
        raise ValueError("A complete feature mapping is required")
    missing = [name for name in FEATURE_NAMES if name not in features]
    if missing:
        raise ValueError(
            "Missing required PlotRanker features: " + ", ".join(missing)
        )

    vector: list[float] = []
    for name in FEATURE_NAMES:
        try:
            value = float(features[name])
        except (TypeError, ValueError) as error:
            raise ValueError(f"Invalid PlotRanker feature: {name}") from error
        vector.append(clamp(value))
    return vector
