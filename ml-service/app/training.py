import csv
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split

from .features import FEATURE_NAMES, feature_vector
from .model_registry import ROOT_DIR, ModelRegistry

SEED_DATASET = ROOT_DIR / "datasets" / "seed_training_data.csv"


def load_seed_dataset(path: Path = SEED_DATASET) -> tuple[list[list[float]], list[int]]:
    rows: list[list[float]] = []
    labels: list[int] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            rows.append(feature_vector(row))
            labels.append(int(row["label_selected"]))
    return rows, labels


def approved_sample_rows(
    samples: list[dict[str, Any]],
) -> tuple[list[list[float]], list[int]]:
    rows: list[list[float]] = []
    labels: list[int] = []
    for sample in samples:
        features = sample.get("features") or {}
        label_data = sample.get("label") or {}
        label = label_data.get("label_selected")
        if label not in (0, 1, "0", "1"):
            continue
        rows.append(feature_vector(features))
        labels.append(int(label))
    return rows, labels


def train_candidate(
    *,
    dataset_version: str,
    approved_samples: list[dict[str, Any]] | None = None,
    version: str | None = None,
    activate: bool = False,
    registry: ModelRegistry | None = None,
) -> dict[str, Any]:
    x_rows, labels = load_seed_dataset()
    approved_x, approved_y = approved_sample_rows(approved_samples or [])
    x_rows.extend(approved_x)
    labels.extend(approved_y)
    if len(x_rows) < 10 or len(set(labels)) < 2:
        raise ValueError("Training requires at least 10 samples and two classes")

    x_train, x_valid, y_train, y_valid = train_test_split(
        x_rows,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels,
    )
    model = RandomForestClassifier(
        n_estimators=120,
        max_depth=6,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(x_train, y_train)
    predictions = model.predict(x_valid)
    probabilities = model.predict_proba(x_valid)[:, 1]
    metrics = {
        "accuracy": round(float(accuracy_score(y_valid, predictions)), 6),
        "auc": round(float(roc_auc_score(y_valid, probabilities)), 6),
    }
    candidate_version = version or (
        "plot-ranker-" + datetime.now(UTC).strftime("%Y%m%d%H%M%S%f")
    )
    model_registry = registry or ModelRegistry()
    artifact_path = model_registry.register(
        version=candidate_version,
        model=model,
        feature_names=FEATURE_NAMES,
        metrics=metrics,
        dataset_version=dataset_version,
        activate=activate,
    )
    return {
        "candidateVersion": candidate_version,
        "datasetVersion": dataset_version,
        "algorithm": "RandomForestClassifier",
        "artifactPath": str(artifact_path),
        "sampleCount": len(x_rows),
        "metrics": metrics,
    }
