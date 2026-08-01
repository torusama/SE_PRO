# PlotRanker ML Service

FastAPI service dùng Random Forest để xếp hạng các phương án lô đất. Dataset
`datasets/seed_training_data.csv` là **dữ liệu synthetic phục vụ demo**, không
phải dữ liệu hành vi thật của khách hàng.

PlotRanker là thử nghiệm xếp hạng nhẹ, không phải foundation LLM. Service này
không fine-tune, retrain hay thay đổi trọng số của LLM bên ngoài.

## Chạy local

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Service không tự train hoặc active model khi khởi động. Khi không có active
artifact, `/predict` trả 503 và backend dùng xếp hạng quy tắc.

`/train` chỉ nhận các sample đã duyệt có đủ feature thực. Thiếu feature không
được điền số 0 giả. Candidate mới không tự active; admin phải đánh giá rồi chủ
động deploy. Dataset synthetic chỉ dành cho demo/test offline và không được
trình bày như hành vi khách hàng thật.

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
