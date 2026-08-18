import pytest

from app.features import FEATURE_NAMES, feature_vector


def complete_features(**overrides):
    values = {name: 0.5 for name in FEATURE_NAMES}
    values.update(overrides)
    return values


def test_feature_order_is_deterministic_for_complete_vectors():
    first = feature_vector(
        complete_features(zone_match=1, budget_match_score=0.5)
    )
    second_values = complete_features(
        budget_match_score=0.5, zone_match=1
    )
    second = feature_vector(dict(reversed(list(second_values.items()))))

    assert first == second
    assert len(first) == len(FEATURE_NAMES)
    assert first[FEATURE_NAMES.index("budget_match_score")] == 0.5
    assert first[FEATURE_NAMES.index("zone_match")] == 1.0


def test_missing_features_are_rejected_instead_of_filled_with_zero():
    with pytest.raises(ValueError, match="Missing required PlotRanker features"):
        feature_vector({"zone_match": 1, "budget_match_score": 0.5})


def test_feature_values_are_clamped():
    vector = feature_vector(
        complete_features(budget_match_score=3, zone_match=-2)
    )
    assert vector[0] == 1.0
    assert vector[1] == 0.0
