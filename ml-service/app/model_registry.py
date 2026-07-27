import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib

ROOT_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT_DIR / "models"
REGISTRY_PATH = MODEL_DIR / "registry.json"


@dataclass
class ModelArtifact:
    version: str
    model: Any
    feature_names: list[str]
    metrics: dict[str, float]
    artifact_path: Path


class ModelRegistry:
    def __init__(self) -> None:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)

    def _registry(self) -> dict[str, Any]:
        if not REGISTRY_PATH.exists():
            return {"activeVersion": None, "versions": {}}
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))

    def _save_registry(self, registry: dict[str, Any]) -> None:
        REGISTRY_PATH.write_text(
            json.dumps(registry, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def register(
        self,
        *,
        version: str,
        model: Any,
        feature_names: list[str],
        metrics: dict[str, float],
        dataset_version: str,
        activate: bool = False,
    ) -> Path:
        artifact_path = MODEL_DIR / f"{version}.joblib"
        joblib.dump(
            {
                "version": version,
                "model": model,
                "feature_names": feature_names,
                "metrics": metrics,
                "dataset_version": dataset_version,
            },
            artifact_path,
        )
        registry = self._registry()
        registry["versions"][version] = {
            "artifactPath": str(artifact_path),
            "datasetVersion": dataset_version,
            "metrics": metrics,
            "status": "active" if activate else "candidate",
        }
        if activate:
            previous = registry.get("activeVersion")
            if previous and previous in registry["versions"]:
                registry["versions"][previous]["status"] = "retired"
            registry["activeVersion"] = version
        self._save_registry(registry)
        return artifact_path

    def active_version(self) -> str | None:
        return self._registry().get("activeVersion")

    def activate(self, version: str) -> dict[str, Any]:
        registry = self._registry()
        if version not in registry["versions"]:
            raise FileNotFoundError(f"PlotRanker model {version} was not found")
        previous = registry.get("activeVersion")
        if previous and previous in registry["versions"] and previous != version:
            registry["versions"][previous]["status"] = "retired"
        registry["versions"][version]["status"] = "active"
        registry["activeVersion"] = version
        self._save_registry(registry)
        return {
            "activeVersion": version,
            "previousVersion": previous,
        }

    def load(self, version: str | None = None) -> ModelArtifact:
        registry = self._registry()
        selected = version or registry.get("activeVersion")
        if not selected or selected not in registry["versions"]:
            raise FileNotFoundError("No active PlotRanker model")
        artifact_path = Path(
            registry["versions"][selected]["artifactPath"]
        )
        payload = joblib.load(artifact_path)
        return ModelArtifact(
            version=payload["version"],
            model=payload["model"],
            feature_names=list(payload["feature_names"]),
            metrics=dict(payload["metrics"]),
            artifact_path=artifact_path,
        )

    def info(self) -> dict[str, Any]:
        registry = self._registry()
        active = registry.get("activeVersion")
        return {
            "activeVersion": active,
            "versions": registry.get("versions", {}),
        }
