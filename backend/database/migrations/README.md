# Database migrations

This is the only migration directory for the backend. Do not place SQL
migrations under `backend/src`.

Apply migrations after `backend/database/DBase.sql`, in filename order, with
`ON_ERROR_STOP` enabled. Example from the `backend` directory:

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/migrations/002_offline_appointments.sql
```

Current order:

1. `002_offline_appointments.sql`
2. `003_profile_extended_fields.sql`
3. `004_automatic_contracts.sql`
4. `005_contract_signatures_and_pdf.sql`
5. `005_password_security.sql`
6. `006_change_usage_right_foundation.sql`
7. `006_ward_address.sql`
8. `007_plot_lock_and_availability.sql`
9. `007_user_sessions.sql`
10. `008_authorized_persons.sql`
11. `008_schedule_appointments.sql`
12. `009_email_otp_verification.sql`
13. `009_phone_otp_verification.sql`
14. `010_admin_direct_plot_transfers.sql`
15. `011_cemetery_zones_e_to_h.sql`
16. `012_service_order_management.sql`
17. `013_fix_utf8_user_names.sql`
18. `014_fix_utf8_service_types.sql`

Các tiền tố `005` đến `009` bị trùng do lịch sử dự án. Danh sách trên là thứ
tự được kiểm soát; không chạy migration bằng glob. Các migration mới có
`IF NOT EXISTS` ở những đối tượng dùng chung khi phù hợp.

There is currently no automatic migration runner. A migration file being
present does not mean it has been applied to a database.
