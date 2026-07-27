from collections.abc import Mapping
from typing import Any

FEATURE_NAMES = [
    "budget_match_score",
    "zone_match",
    "preferred_direction_match",
    "bazi_direction_match",
    "adjacency_score",
    "plot_type_match",
    "number_of_plots_match",
    "area_match_score",
    "price_to_budget_ratio",
    "historical_acceptance_rate",
]


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def feature_vector(features: Mapping[str, Any] | None) -> list[float]:
    """Return a stable, deterministic feature vector.

    Missing or invalid values use 0.0. The API never changes feature order
    based on input object ordering.
    """

    source = features or {}
    vector: list[float] = []
    for name in FEATURE_NAMES:
        try:
            value = float(source.get(name, 0.0))
        except (TypeError, ValueError):
            value = 0.0
        vector.append(clamp(value))
    return vector
