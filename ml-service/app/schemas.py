import math
from typing import Any

from pydantic import BaseModel, Field, field_validator

from .features import FEATURE_NAMES


def validate_complete_features(value: dict[str, Any]) -> dict[str, Any]:
    missing = [name for name in FEATURE_NAMES if name not in value]
    if missing:
        raise ValueError(
            "Missing required PlotRanker features: " + ", ".join(missing)
        )
    for name in FEATURE_NAMES:
        try:
            number = float(value[name])
        except (TypeError, ValueError) as error:
            raise ValueError(f"Invalid PlotRanker feature: {name}") from error
        if not math.isfinite(number):
            raise ValueError(f"Invalid PlotRanker feature: {name}")
    return value


class PlotOption(BaseModel):
    optionId: str = Field(min_length=1, max_length=100)
    features: dict[str, float]

    _complete_features = field_validator("features")(
        validate_complete_features
    )


class PredictRequest(BaseModel):
    options: list[PlotOption] = Field(min_length=1, max_length=100)


class Prediction(BaseModel):
    optionId: str
    score: float = Field(ge=0, le=1)


class PredictResponse(BaseModel):
    modelVersion: str
    predictions: list[Prediction]


class ApprovedSample(BaseModel):
    features: dict[str, Any]
    label: dict[str, Any] = Field(default_factory=dict)

    _complete_features = field_validator("features")(
        validate_complete_features
    )


class TrainRequest(BaseModel):
    datasetVersion: str = Field(min_length=1, max_length=100)
    approvedSamples: list[ApprovedSample] = Field(default_factory=list)


class TrainResponse(BaseModel):
    candidateVersion: str
    datasetVersion: str
    algorithm: str
    artifactPath: str
    sampleCount: int
    metrics: dict[str, float]
