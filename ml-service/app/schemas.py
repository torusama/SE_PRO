from typing import Any

from pydantic import BaseModel, Field


class PlotOption(BaseModel):
    optionId: str = Field(min_length=1, max_length=100)
    features: dict[str, float] = Field(default_factory=dict)


class PredictRequest(BaseModel):
    options: list[PlotOption] = Field(min_length=1, max_length=100)


class Prediction(BaseModel):
    optionId: str
    score: float = Field(ge=0, le=1)


class PredictResponse(BaseModel):
    modelVersion: str
    predictions: list[Prediction]


class ApprovedSample(BaseModel):
    features: dict[str, Any] = Field(default_factory=dict)
    label: dict[str, Any] = Field(default_factory=dict)


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
