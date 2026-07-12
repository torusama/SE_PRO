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
5. `006_change_usage_right_foundation.sql`
6. `007_plot_lock_and_availability.sql`
7. `008_schedule_appointments.sql`

`008_schedule_appointments.sql` is retained as an idempotent historical
follow-up to `007`; both use `IF NOT EXISTS` for shared schedule objects.

There is currently no automatic migration runner. A migration file being
present does not mean it has been applied to a database.
