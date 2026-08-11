# Database migrations

Đây là thư mục migration duy nhất của backend. Không tạo migration dưới
`backend/src`.

## Migration runner

Backend tự chạy migration trước khi các service bắt đầu truy vấn database.
Runner:

- đọc các file `NNN_descriptive_name.sql` theo thứ tự tên file;
- khóa PostgreSQL advisory để nhiều instance không chạy migration đồng thời;
- chạy từng file và ghi ledger `schema_migrations` trong cùng transaction;
- lưu SHA-256 checksum và dừng startup nếu một file đã áp dụng bị sửa;
- dừng startup ngay khi migration thất bại.

Tên file đầy đủ là định danh migration. Repository còn một số prefix lịch sử
trùng nhau, vì vậy không được chỉ dùng phần số để xác định migration. Migration
mới tiếp theo dùng prefix `037`; không tạo thêm prefix trùng.

Runner quản lý transaction và tự bỏ lớp `BEGIN`/`COMMIT` bao ngoài của các file
legacy trong lúc thực thi, nhưng vẫn checksum nguyên văn file để tương thích
ledger. Migration mới không cần tự bao transaction và phải additive/idempotent
khi có thể. Không sửa hoặc đổi tên file đã có trong `schema_migrations`; hãy
tạo migration mới.

Các biến môi trường:

```env
DB_MIGRATIONS_ENABLED=true
# Chỉ cần khi SQL không nằm ở backend/database/migrations:
# DB_MIGRATIONS_DIR=/absolute/path/to/migrations
```

Có thể chạy runner độc lập từ thư mục `backend`:

```powershell
npm run migration:run
```

Production đã build có thể dùng `npm run migration:run:prod`.

## Database mới

`database/DBase.sql` là schema nền và seed, không phải migration idempotent nên
phải được nạp đúng một lần khi tạo database rỗng:

```powershell
$env:PGCLIENTENCODING="UTF8"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/DBase.sql
npm run migration:run
```

Sau bước nền, `npm run start:dev` và `npm run start:prod` đều tự áp dụng các
migration còn thiếu. Nếu bảng nền `users` chưa tồn tại, runner dừng và hướng
dẫn nạp `DBase.sql` thay vì cố chạy trên database chưa hoàn chỉnh.

## Database cũ chưa có ledger

Lần chạy đầu tiên sẽ chạy lại các migration hiện có theo thứ tự rồi ghi ledger.
Các file hiện tại được thiết kế additive/idempotent cho quá trình chuyển tiếp
này. File tồn tại trong repository không còn là bằng chứng migration đã chạy;
`schema_migrations` mới là source of truth.

Thứ tự hiện tại:

1. `001_consolidated_schema.sql`
2. `002_add_service_order_history.sql`
3. `002_offline_signing_contract_activation.sql`
4. `012_reminder_notify_emails.sql`
5. `013_add_service_order_rework.sql`
6. `013_admin_audit_entity_key.sql`
7. `013_fix_cemetery_zone_encoding.sql`
8. `014_registration_email_verifications.sql`
9. `015_ai_agent_learning.sql`
10. `016_ai_autonomous_learning.sql`
11. `017_password_reset_tokens.sql`
12. `018_purchase_contract_workflow.sql`
13. `019_contract_plot_trigger_compatibility.sql`
14. `020_backfill_contract_base_content.sql`
15. `021_remove_archived_pdf_and_e_signature.sql`
16. `022_signed_contract_evidence_documents.sql`
17. `023_service_order_payment_status.sql`
18. `024_ai_knowledge_embeddings.sql`
19. `024_request_processing_workflow.sql`
20. `025_appointment_customer_selected_time.sql`
21. `025_switch_rag_to_nvidia_bge_m3.sql`
22. `026_repair_signed_evidence_filenames.sql`
23. `027_deceased_family_schema.sql`
24. `028_reject_transient_consultation_memories.sql`
25. `029_ai_conversation_memory.sql`
26. `030_appointment_email_reminders.sql`
27. `031_ai_knowledge_review_rejection_fix.sql`
28. `032_ai_learning_signal_training_bridge.sql`
29. `033_add_reminder_calendar_type.sql`
30. `034_remove_plot_hold_requests.sql`
31. `035_cancel_legacy_plot_hold_requests.sql`
32. `036_purchase_request_cancellations.sql`

`015` phải chạy trước `016`; thứ tự tên file của runner bảo đảm dependency này.
