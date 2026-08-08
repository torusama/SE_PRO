# Cemetery Backend API

Base URL local: `http://localhost:3001/api`

All successful responses follow:

```json
{ "success": true, "message": "OK", "data": {} }
```

Errors follow:

```json
{
  "success": false,
  "message": "Error message",
  "data": null,
  "error": "BAD_REQUEST"
}
```

Use `Authorization: Bearer <accessToken>` for protected endpoints.

## Auth

| Method | Endpoint         | Auth | Role           | Body                                                                                                       |
| ------ | ---------------- | ---- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/register` | No   | -              | `{ "fullName": "Nguyen Van A", "email": "user@example.com", "password": "123456", "phone": "0900000000" }` |
| POST   | `/auth/login`    | No   | -              | `{ "email": "user@example.com", "password": "123456" }`                                                    |
| GET    | `/auth/me`       | Yes  | customer/admin | -                                                                                                          |
| POST   | `/auth/logout`   | No   | -              | -                                                                                                          |

## Users

| Method | Endpoint                  | Auth | Role           |
| ------ | ------------------------- | ---- | -------------- |
| GET    | `/users/me`               | Yes  | customer/admin |
| GET    | `/users/me/stats`         | Yes  | customer/admin |
| PATCH  | `/users/me`               | Yes  | customer/admin |
| POST   | `/users/me/avatar`        | Yes  | customer/admin |
| PATCH  | `/users/me/password`      | Yes  | customer/admin |
| GET    | `/admin/users`            | Yes  | admin          |
| GET    | `/admin/users/:id`        | Yes  | admin          |
| PATCH  | `/admin/users/:id/status` | Yes  | admin          |

Status body: `{ "isActive": true }`

`GET /users/me/stats` — used by the profile page's stat row. Response:

```json
{
  "success": true,
  "data": {
    "lots": 2,
    "services": 14,
    "years": 3,
    "memberSince": "2023-03-10T00:00:00.000Z"
  }
}
```

### Update profile

`PATCH /users/me`

Body (all fields optional, only provided fields are updated):

```json
{
  "fullName": "Nguyen Van Thanh",
  "dateOfBirth": "1978-04-15",
  "gender": "male",
  "address": "142 Nguyen Trai, Q5, TP.HCM"
}
```

`gender` must be one of `male`, `female`, `other`. Returns the updated user (same shape as `GET /users/me`).

Note: `phone`/`email` are intentionally not editable here — changing them requires an OTP-verification
flow that is planned for a later iteration. `idCardNumber` is also read-only once verified.

### Upload avatar

`POST /users/me/avatar` — `multipart/form-data` with a single field named `avatar` (JPG/PNG/WEBP, max 5MB).

Response:

```json
{
  "success": true,
  "message": "Avatar updated",
  "data": { "id": 12, "avatarUrl": "/uploads/avatars/avatar-169...-123.png" }
}
```

The returned `avatarUrl` is a relative path served by the API's static file host, e.g.
`http://localhost:3001/uploads/avatars/avatar-169...-123.png` (not under the `/api` prefix).

### Change password

`PATCH /users/me/password`

Body:

```json
{ "currentPassword": "oldpass123", "newPassword": "newpass456" }
```

`newPassword` must be at least 8 characters. Returns `400 Bad Request` if `currentPassword` doesn't match.

## Plots

| Method | Endpoint                  | Auth | Role  |
| ------ | ------------------------- | ---- | ----- |
| GET    | `/plots`                  | No   | -     |
| GET    | `/plots/map`              | No   | -     |
| GET    | `/plots/:id`              | No   | -     |
| POST   | `/admin/plots`            | Yes  | admin |
| PATCH  | `/admin/plots/:id`        | Yes  | admin |
| PATCH  | `/admin/plots/:id/status` | Yes  | admin |
| DELETE | `/admin/plots/:id`        | Yes  | admin |

Map item sample:

```json
{
  "id": 1,
  "plotCode": "A-01-001",
  "zoneName": "Khu A",
  "rowCode": "01",
  "plotNumber": "001",
  "status": "available",
  "price": 50000000,
  "area": 4,
  "mapX": 10,
  "mapY": 10,
  "mapWidth": 40,
  "mapHeight": 40
}
```

## Reservations

| Method | Endpoint                          | Auth | Role     |
| ------ | --------------------------------- | ---- | -------- |
| POST   | `/reservations`                   | Yes  | customer |
| POST   | `/reservations/multiple`          | Yes  | customer |
| GET    | `/my/reservations`                | Yes  | customer |
| GET    | `/my/reservations/:id`            | Yes  | customer |
| POST   | `/reservations/:id/submit`        | Yes  | customer |
| POST   | `/reservations/:id/cancel`        | Yes  | customer |
| GET    | `/admin/reservations`             | Yes  | admin    |
| GET    | `/admin/reservations/:id`         | Yes  | admin    |
| PATCH  | `/admin/reservations/:id/approve` | Yes  | admin    |
| PATCH  | `/admin/reservations/:id/reject`  | Yes  | admin    |

### Create reservation

`POST /reservations`

Body:

```json
{ "type": "purchase", "plotIds": [1, 2], "note": "Muon mua khu gia dinh" }
```

`type` must be `reserve` or `purchase`. `plotIds` must be a non-empty array of unique positive integers. All selected plots must currently be `available`; otherwise the request is rejected and no partial reservation data is kept.

Successful creation immediately creates a `pending` reservation request and updates all selected plots to `pending`.

Sample response:

```json
{
  "success": true,
  "message": "Reservation request created",
  "data": {
    "id": 10,
    "type": "purchase",
    "status": "pending",
    "totalPrice": 100000000,
    "plotCount": 2,
    "plotCodes": ["A-01-001", "A-01-002"],
    "plots": [
      { "id": 1, "code": "A-01-001", "status": "pending", "price": 50000000 },
      { "id": 2, "code": "A-01-002", "status": "pending", "price": 50000000 }
    ]
  }
}
```

Common errors:

- Unavailable/missing plot: `{ "success": false, "message": "All plots must be available", "data": null, "error": "BAD_REQUEST" }`
- Duplicate plot ID: `{ "success": false, "message": "Duplicate plot IDs are not allowed", "data": null, "error": "BAD_REQUEST" }`

### Create multi-plot family reservation

`POST /reservations/multiple`

Body:

```json
{ "type": "purchase", "plotIds": [1, 2, 3], "note": "Khu gia dinh" }
```

This endpoint is stricter than `POST /reservations`: it requires at least two unique plots, all plots must be `available`, and the selected plots must be adjacent/nearby. Backend validates adjacency using plot map rectangles first (`mapX`, `mapY`, `mapWidth`, `mapHeight`) and falls back to same-zone row/column adjacency when map data cannot be used.

Successful response includes the normal reservation detail plus adjacency metadata:

```json
{
  "success": true,
  "message": "Multi-plot reservation request created",
  "data": {
    "id": 10,
    "type": "purchase",
    "status": "pending",
    "totalPrice": 150000000,
    "plotCount": 3,
    "plotCodes": ["A-01-001", "A-01-002", "A-01-003"],
    "adjacency": { "valid": true, "method": "map" }
  }
}
```

Additional common errors:

- Too few plots: `At least two plots are required for a multi-plot reservation`
- Non-adjacent plots: `Selected plots must be adjacent or near each other`
- Missing location data: `Selected plots do not have enough location data to validate adjacency`

### Customer reservation views

`GET /my/reservations` returns only the authenticated customer's reservation summaries.

`GET /my/reservations/:id` returns only the authenticated customer's reservation detail with selected plots. Requests owned by another customer are returned as not found.

### Admin reservation review

`GET /admin/reservations` lists all reservation requests.

`GET /admin/reservations/:id` returns any reservation request detail for admin review.

Admin approve/reject body: `{ "adminNote": "OK" }`

Approval/rejection are transaction-safe:

- Approve `reserve`: request becomes `approved`; related plots become `reserved`; one `request_approved` notification is created for the customer.
- Approve `purchase`: request becomes `approved`; related plots become `reserved` and one draft contract is created with all selected plots and their agreed prices. The plots become `sold` only after an admin uploads signed-contract evidence and explicitly activates ownership.
- Reject: request becomes `rejected`; related pending plots return to `available` only when no other valid request still claims them; one `request_rejected` notification is created for the customer.

Only `pending` requests are valid for new decisions. Existing `submitted` records are also tolerated for backward compatibility. Already approved/rejected requests return an error and do not create duplicate notifications.

## Contracts

| Method | Endpoint                                           | Auth | Role           |
| ------ | -------------------------------------------------- | ---- | -------------- |
| GET    | `/admin/contracts`                                 | Yes  | admin          |
| GET    | `/admin/contracts/:id`                             | Yes  | admin          |
| POST   | `/admin/contracts/from-reservation/:reservationId` | Yes  | admin          |
| PATCH  | `/admin/contracts/:id/status`                      | Yes  | admin          |
| POST   | `/admin/contracts/:id/payments`                    | Yes  | admin          |
| PATCH  | `/admin/contracts/:id/inheritance`                 | Yes  | admin          |
| POST   | `/admin/contracts/:id/generated-pdf`               | Yes  | admin          |
| POST   | `/admin/contracts/:id/signed-evidence`             | Yes  | admin          |
| GET    | `/admin/contracts/:id/signed-evidence/:filename`   | Yes  | admin          |
| POST   | `/admin/contracts/:id/activate-ownership`          | Yes  | admin          |
| GET    | `/my/contracts`                                    | Yes  | customer/admin |
| GET    | `/my/contracts/:id`                                | Yes  | customer/admin |

Payment body: `{ "amount": 1000000, "paymentMethod": "cash", "referenceCode": "ABC", "note": "Deposit" }`.
`paymentMethod` accepts `cash`, `bank_transfer`, `card`, or `other`. Payment can only be
recorded after the customer confirms the offline appointment and the PDF generation step is
recorded through `POST /admin/contracts/:id/generated-pdf`.

`signed-evidence` is multipart with up to 10 `evidence` document fields (PDF, DOC or DOCX;
10 MB each) and requires a fully paid draft contract. `activate-ownership` requires a draft
contract with a generated PDF marker, full payment and at least one signed evidence document;
it activates the contract, creates current ownership records for every `contract_plots` row and
marks all included plots as sold in one transaction.

`GET /my/contracts` and `GET /my/contracts/:id` now also return plot/zone context used by the
customer profile page ("Lô đất của tôi" tab): `plotId`, `areaSqm`, `direction`, `plotType`,
`zoneName`, `zoneCode`, `remainingAmount` (`totalAmount - paidAmount`), `effectiveDate`,
`expiryDate`, `deceasedName`/`burialDate` (from the current ownership record, if any). The single
contract endpoint (`GET /my/contracts/:id`) additionally returns a `payments` array with each
payment transaction (`id, amount, paymentMethod, paymentDate, referenceCode, note`).

## Offline Appointments

| Method | Endpoint                         | Auth | Role     |
| ------ | -------------------------------- | ---- | -------- |
| POST   | `/admin/appointments`            | Yes  | admin    |
| GET    | `/my/appointments`               | Yes  | customer |
| PATCH  | `/my/appointments/:id/response`  | Yes  | customer |
| GET    | `/admin/appointments`            | Yes  | admin    |
| PATCH  | `/admin/appointments/:id`        | Yes  | admin    |
| PATCH  | `/admin/appointments/:id/status` | Yes  | admin    |

### Create appointment

`POST /admin/appointments`

Body:

```json
{
  "reservationRequestId": 10,
  "scheduledAt": "2026-07-15T09:00:00+07:00",
  "scheduledEndAt": "2026-07-15T11:00:00+07:00",
  "location": "Van phong nghia trang",
  "assignedStaffId": 3,
  "assignedStaffName": "Nguyen Van B",
  "note": "Mang theo CCCD va giay to lien quan"
}
```

The reservation request must be an approved hold or purchase request. The start date cannot be
earlier than the current date in `Asia/Ho_Chi_Minh`, and the end must be after the start.
The admin UI accepts date-only values with a four-digit year. Creation is transactional, sets `customerStatus` to `pending` and creates
an `appointment_created` notification for the customer.

The customer responds with `PATCH /my/appointments/:id/response`. Confirming requires an exact
future meeting time inside the admin's proposed range:

```json
{ "status": "confirmed", "selectedAt": "2026-07-15T09:30:00+07:00" }
```

A decline uses `{ "status": "declined", "note": "..." }`. A declined proposal is cancelled so
the admin can send a new range. A confirmed proposal stores `customerSelectedAt`, unlocks the next
purchase workflow step, and notifies every active admin with the exact date and time selected by
the customer.

### Appointment lists

`GET /my/appointments?status=scheduled` returns only the authenticated customer's appointments.

`GET /admin/appointments?status=scheduled&from=2026-07-01T00:00:00Z&to=2026-07-31T23:59:59Z` returns admin appointment list with optional filters.

### Update appointment details

`PATCH /admin/appointments/:id`

Body:

```json
{
  "scheduledAt": "2026-07-16T10:00:00+07:00",
  "scheduledEndAt": "2026-07-16T12:00:00+07:00",
  "location": "Phong hop 2",
  "assignedStaffId": 4,
  "assignedStaffName": "Tran Thi C",
  "note": "Cap nhat lich hen"
}
```

Updates reset `customerStatus` to `pending` and create an `appointment_updated` notification,
so the customer must confirm the revised range again.

### Update appointment status

`PATCH /admin/appointments/:id/status`

Body:

```json
{ "status": "completed", "statusNote": "Da ky hop dong offline" }
```

`status` must be `scheduled`, `completed`, `cancelled`, or `no_show`. `cancelled` and `no_show` require `statusNote`. Status updates create an `appointment_status_updated` notification.

Common errors:

- Invalid request: `Appointments can only be created for approved reservation requests`
- Duplicate active appointment: `A scheduled appointment already exists for this reservation`
- Invalid status: `Invalid appointment status`
- Missing reason: `A status note is required for cancelled or no-show appointments`

## Cemetery Services

| Method | Endpoint                               | Auth | Role           |
| ------ | -------------------------------------- | ---- | -------------- |
| GET    | `/service-types`                       | No   | -              |
| POST   | `/service-orders`                      | Yes  | customer/admin |
| GET    | `/my/service-orders`                   | Yes  | customer/admin |
| GET    | `/my/service-orders/:id`               | Yes  | customer/admin |
| GET    | `/admin/service-orders`                | Yes  | admin          |
| GET    | `/admin/service-orders/:id`            | Yes  | admin          |
| PATCH  | `/admin/service-orders/:id/status`     | Yes  | admin          |
| POST   | `/admin/service-orders/:id/completion` | Yes  | admin          |

Create body: `{ "serviceTypeId": 1, "plotId": 1, "requestedDate": "2026-07-05", "note": "Don dep va thay hoa" }`

## Notifications

| Method | Endpoint                      | Auth | Role           |
| ------ | ----------------------------- | ---- | -------------- |
| GET    | `/notifications`              | Yes  | customer/admin |
| GET    | `/notifications/unread-count` | Yes  | customer/admin |
| PATCH  | `/notifications/:id/read`     | Yes  | customer/admin |
| PATCH  | `/notifications/read-all`     | Yes  | customer/admin |

Appointment notification types:

- `appointment_created`
- `appointment_updated`
- `appointment_status_updated`

## Dashboard

All dashboard endpoints require admin auth.

| Method | Endpoint                    |
| ------ | --------------------------- |
| GET    | `/admin/dashboard/summary`  |
| GET    | `/admin/dashboard/plots`    |
| GET    | `/admin/dashboard/revenue`  |
| GET    | `/admin/dashboard/services` |

## AI Agent Prototype

| Method | Endpoint                             | Auth |
| ------ | ------------------------------------ | ---- |
| POST   | `/ai-agent/recommend`                | No   |
| POST   | `/ai-agent/create-draft-reservation` | Yes  |

Recommend body: `{ "budget": 50000000, "numberOfPlots": 2, "preferredZone": "Khu A", "preferredDirection": "east" }`

## Upload Placeholders

| Method | Endpoint            | Auth |
| ------ | ------------------- | ---- |
| POST   | `/uploads/image`    | Yes  |
| POST   | `/uploads/document` | Yes  |
# Admin Portal Backend Integration (bổ sung 2026-07-27)

Tất cả endpoint dưới đây yêu cầu Bearer JWT, `JwtAuthGuard`, `RolesGuard` và role
`admin`. Danh sách dùng envelope:

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

- `GET /admin/dashboard/summary`, `/plot-stats`, `/revenue?period=month`,
  `/service-stats`: số liệu tổng hợp trực tiếp từ PostgreSQL.
- `GET /admin/users`: `page`, `pageSize`, `search`, `role`, `isActive`.
- `PATCH /admin/users/:id/status`: khóa/mở tài khoản và ghi audit.
- `GET /admin/plots`: `page`, `pageSize`, `search`, `zoneId`, `status`,
  `includeDeleted`; có detail và route restore.
- Admin zones hỗ trợ tạo, sửa, vô hiệu hóa và khôi phục.
- `GET /admin/reservations`: `page`, `pageSize`, `search`, `status`, `type`,
  `source=customer|ai`. Approve/reject cập nhật request, plot, contract,
  notification và audit trong một transaction.
- `GET /admin/contracts`: `page`, `pageSize`, `search`, `status`,
  `paymentStatus`. Detail trả thêm `payments` và `ownershipHistory`; CCCD được
  che, chỉ giữ bốn số cuối.
- `GET /admin/audit-logs` và `/admin/audit-logs/:id`: lịch sử đã loại bỏ trường
  nhạy cảm, hỗ trợ tìm kiếm, actor, loại đối tượng và khoảng ngày.
- `GET /admin/ai-activity` và `/admin/ai-activity/:id`: chỉ đọc các reservation
  draft có `is_ai_draft=true`. Các capability về prompt history, model usage và
  recommendation telemetry được trả rõ là không hỗ trợ, không tạo schema AI lớn.

Migration bắt buộc trước khi dùng audit API:
`database/migrations/013_admin_audit_entity_key.sql`.

## AI chat quick replies (v17)

`POST /api/ai-agent/chat` may return:

```json
{
  "success": true,
  "data": {
    "assistantMessage": "Chào bạn!...",
    "quickReplies": [
      {
        "id": "help-plots",
        "label": "Gợi ý lô phù hợp",
        "message": "Gợi ý cho mình vài lô phù hợp nhé.",
        "emphasis": "strong"
      }
    ]
  }
}
```

The frontend renders `label` as clickable text and submits `message` through the normal chat endpoint. A quick reply never bypasses authentication, booking confirmation, or administrator approval.
