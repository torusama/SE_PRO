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
4. `014_registration_email_verifications.sql`: thêm trạng thái OTP tạm thời để
   xác thực email trước khi tạo tài khoản khách hàng.
5. `015_ai_agent_learning.sql`: tạo conversations, messages, tool calls,
   feedback, Knowledge Base, knowledge versions và metadata PlotRanker.
6. `016_ai_autonomous_learning.sql`: mở rộng Knowledge Base cho bộ nhớ cô lập
   theo user, validation/effective dates/version audit; tạo recommendation runs
   và learning signals tách khỏi factual knowledge.

## Khởi tạo đầy đủ AI Agent

Thứ tự phụ thuộc của các bảng là:

1. `audit_logs` và `users` từ `DBase.sql`/baseline; migration `013` bổ sung
   `audit_logs.entity_key`.
2. `ai_conversations`.
3. `ai_messages` và `ai_tool_calls`.
4. `ai_feedback`.
5. `ai_knowledge_entries`.
6. `ai_knowledge_versions`.
7. `ai_training_runs`, `ai_model_versions` và `ai_training_samples` (chỉ cho
   PlotRanker tùy chọn).
8. `ai_recommendation_runs`.
9. `ai_learning_signals`.

Các bước trên được đóng gói theo đúng dependency trong `015` rồi `016`. Với
database mới, chạy:

```powershell
$env:PGCLIENTENCODING="UTF8"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/DBase.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 `
  -f database/migrations/001_consolidated_schema.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 `
  -f database/migrations/013_admin_audit_entity_key.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 `
  -f database/migrations/015_ai_agent_learning.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 `
  -f database/migrations/016_ai_autonomous_learning.sql
```

`015` và `016` là hai prefix AI Agent duy nhất và phải chạy theo thứ tự đó.
Không chạy file autonomous-learning lịch sử mang prefix cũ sau `016`.

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
