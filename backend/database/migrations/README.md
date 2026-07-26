# Database migrations

Đây là thư mục migration duy nhất của backend. Không tạo migration dưới
`backend/src`.

Ngày 26/07/2026, các migration lịch sử `002`–`014` đã được squash thành một
baseline hậu-schema duy nhất:

```text
001_consolidated_schema.sql
```

Khi tạo database local mới, chạy từ thư mục `backend` theo đúng hai bước:

```powershell
$env:PGCLIENTENCODING="UTF8"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/DBase.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 `
  -f database/migrations/001_consolidated_schema.sql
```

`DBase.sql` tạo schema nền và seed. Migration `001` bổ sung hồ sơ/bảo mật,
phiên đăng nhập, lịch hẹn, hợp đồng mở rộng, workflow chuyển quyền legacy,
chuyển nhượng admin và seed khu E–H.

Migration mới tiếp theo phải dùng prefix `002`, additive/idempotent khi có thể
và được thêm vào danh sách tại file này. Dự án hiện chưa có migration runner
hoặc migration ledger; sự tồn tại của file không chứng minh database đã chạy
file đó.
