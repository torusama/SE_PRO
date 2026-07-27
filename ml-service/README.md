# PlotRanker ML Service

FastAPI service dùng Random Forest để xếp hạng các phương án lô đất. Dataset
`datasets/seed_training_data.csv` là **dữ liệu synthetic phục vụ demo**, không
phải dữ liệu hành vi thật của khách hàng.

## Chạy local

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Lần khởi động đầu tiên service train và active artifact
`plot-ranker-v1.0`. Các candidate sinh bởi `/train` không tự active; backend
admin phải kiểm tra deploy gate rồi chủ động deploy.

## API

- `GET /health`
- `GET /model-info`
- `POST /models/{version}/activate`
- `POST /predict`
- `POST /train`

## Test

```powershell
python -m pytest -q
```
