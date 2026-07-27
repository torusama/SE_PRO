# Database migrations

Đây là thư mục migration duy nhất của backend. Không tạo migration dưới
`backend/src`.

Ngày 26/07/2026, các migration lịch sử `002`–`014` đã được squash thành baseline
hậu-schema:

```text
001_consolidated_schema.sql
```

Khi tạo database local mới, chạy từ thư mục `backend`:

```powershell
$env:PGCLIENTENCODING="UTF8"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/DBase.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 `
  -f database/migrations/001_consolidated_schema.sql
```

`DBase.sql` tạo schema nền và seed. Migration `001` bổ sung hồ sơ/bảo mật,
phiên đăng nhập, lịch hẹn, hợp đồng mở rộng, workflow chuyển quyền legacy,
chuyển nhượng admin và seed khu E–H.

Migration mới phải additive/idempotent khi có thể và được liệt kê tại file này.
Dự án hiện chưa có migration runner hoặc ledger; sự tồn tại của file không
chứng minh database local đã chạy file đó.

## Migration sau baseline

Chạy theo đúng thứ tự tên file:

1. `002_add_service_order_history.sql`: bảo đảm bảng lịch sử đơn dịch vụ tồn tại.
2. `012_reminder_notify_emails.sql`: thêm cấu hình email cho nhắc lịch.
3. `013_admin_audit_entity_key.sql`: thêm `audit_logs.entity_key` để định danh
   entity UUID. Migration chỉ bổ sung cột và index, không xóa dữ liệu cũ.

Áp dụng migration `013` từ thư mục `backend`:

```powershell
$env:PGCLIENTENCODING="UTF8"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 `
  -f database/migrations/013_admin_audit_entity_key.sql
```

Rollback thủ công, chỉ khi chưa có consumer sử dụng cột:

```sql
DROP INDEX IF EXISTS idx_audit_logs_entity_key;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS entity_key;
```
