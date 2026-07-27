from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .inference import predict_options
from .model_registry import ModelRegistry
from .schemas import PredictRequest, PredictResponse, TrainRequest, TrainResponse
from .training import train_candidate

registry = ModelRegistry()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not registry.active_version():
        train_candidate(
            dataset_version="synthetic-seed-v1",
            version="plot-ranker-v1.0",
            activate=True,
            registry=registry,
        )
    yield


app = FastAPI(
    title="Cemetery PlotRanker",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "plot-ranker",
        "activeModel": registry.active_version(),
    }


@app.get("/model-info")
def model_info():
    return registry.info()


@app.post("/models/{version}/activate")
def activate_model(version: str):
    try:
        return registry.activate(version)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    try:
        return predict_options(
            [option.model_dump() for option in request.options],
            registry,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/train", response_model=TrainResponse)
def train(request: TrainRequest):
    try:
        return train_candidate(
            dataset_version=request.datasetVersion,
            approved_samples=[
                sample.model_dump() for sample in request.approvedSamples
            ],
            activate=False,
            registry=registry,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
