# Change of usage right cases (Phase 1)

This module uses the legal/domain term “usage right holder”. Legacy
`ownership_records` remains an integration source only.

## Policy administration

- `GET /api/admin/change-right-policies`
- `POST /api/admin/change-right-policies`
- `POST /api/admin/change-right-policies/:id/publish`

Creating a policy always creates a new immutable `DRAFT` version. Publishing
requires a different admin account from the creator, at least two approval
levels, `allow_multiple_holders: false`, and non-empty document requirements
for every enabled case type. Publishing retires the previous active version.

Example configuration:

```json
{
  "allow_transfer": true,
  "allow_gift": true,
  "allow_inheritance": true,
  "allow_multiple_holders": false,
  "require_legal_review": true,
  "require_original_inspection": true,
  "require_finance_clearance": true,
  "approval_levels": 2,
  "document_requirements": {
    "TRANSFER": [
      { "code": "LEGAL_TEAM_CODE", "displayName": "Tên do pháp chế xác nhận", "required": true }
    ],
    "INHERITANCE": [
      { "code": "LEGAL_TEAM_CODE", "displayName": "Tên do pháp chế xác nhận", "required": true }
    ]
  },
  "contract_template_ids": {}
}
```

Do not publish placeholder requirements in production. Store signed templates
in private document storage and put only their immutable identifiers in
`contract_template_ids`.

## Customer intake

- `GET /api/change-right-cases`
- `GET /api/change-right-cases/:id`
- `POST /api/change-right-cases`
- `POST /api/change-right-cases/:id/submit` with `{ "lockVersion": 0 }`

Submission is transactional: it checks the active source contract and usage
right, pins the published policy, creates immutable snapshots and requirements,
locks the plot, increments `lockVersion`, appends an audit event, and records an
outbox event. There is deliberately no approval endpoint in Phase 1.

Stable errors include `SOURCE_CONTRACT_NOT_ACTIVE`,
`APPLICANT_NOT_AUTHORIZED`, `POLICY_VERSION_MISMATCH`,
`MISSING_REQUIRED_DOCUMENT_POLICY`, `ACTIVE_CASE_ALREADY_EXISTS`,
`CASE_NOT_DRAFT`, `CASE_STATE_CONFLICT`, and `MAKER_CHECKER_CONFLICT`.

## Rollback

Disable the module routes, then drop only the `change_right_*` tables and the
new `usage_right_records` table in reverse foreign-key order. The migration
does not update or delete rows in `contracts`, `ownership_records`, or
`transfer_requests`, so legacy reads remain recoverable.
