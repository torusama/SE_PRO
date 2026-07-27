from app.features import FEATURE_NAMES, feature_vector


def test_feature_order_and_missing_values_are_deterministic():
    first = feature_vector({"zone_match": 1, "budget_match_score": 0.5})
    second = feature_vector(
        {"budget_match_score": 0.5, "zone_match": 1}
    )

    assert first == second
    assert len(first) == len(FEATURE_NAMES)
    assert first[FEATURE_NAMES.index("budget_match_score")] == 0.5
    assert first[FEATURE_NAMES.index("zone_match")] == 1.0
    assert first[FEATURE_NAMES.index("adjacency_score")] == 0.0


def test_feature_values_are_clamped():
    vector = feature_vector(
        {"budget_match_score": 3, "zone_match": -2}
    )
    assert vector[0] == 1.0
    assert vector[1] == 0.0
