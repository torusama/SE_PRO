# Cemetery Backend API

Base URL local: `http://localhost:3001/api`

All successful responses follow:

```json
{ "success": true, "message": "OK", "data": {} }
```

Errors follow:

```json
{ "success": false, "message": "Error message", "data": null, "error": "BAD_REQUEST" }
```

Use `Authorization: Bearer <accessToken>` for protected endpoints.

## Auth

| Method | Endpoint | Auth | Role | Body |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | No | - | `{ "fullName": "Nguyen Van A", "email": "user@example.com", "password": "123456", "phone": "0900000000" }` |
| POST | `/auth/login` | No | - | `{ "email": "user@example.com", "password": "123456" }` |
| GET | `/auth/me` | Yes | customer/admin | - |
| POST | `/auth/logout` | No | - | - |

## Users

| Method | Endpoint | Auth | Role |
| --- | --- | --- | --- |
| GET | `/users/me` | Yes | customer/admin |
| GET | `/admin/users` | Yes | admin |
| GET | `/admin/users/:id` | Yes | admin |
| PATCH | `/admin/users/:id/status` | Yes | admin |

Status body: `{ "isActive": true }`

## Plots

| Method | Endpoint | Auth | Role |
| --- | --- | --- | --- |
| GET | `/plots` | No | - |
| GET | `/plots/map` | No | - |
| GET | `/plots/:id` | No | - |
| POST | `/admin/plots` | Yes | admin |
| PATCH | `/admin/plots/:id` | Yes | admin |
| PATCH | `/admin/plots/:id/status` | Yes | admin |
| DELETE | `/admin/plots/:id` | Yes | admin |

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

| Method | Endpoint | Auth | Role |
| --- | --- | --- | --- |
| POST | `/reservations` | Yes | customer |
| GET | `/my/reservations` | Yes | customer |
| GET | `/my/reservations/:id` | Yes | customer |
| POST | `/reservations/:id/submit` | Yes | customer |
| POST | `/reservations/:id/cancel` | Yes | customer |
| GET | `/admin/reservations` | Yes | admin |
| GET | `/admin/reservations/:id` | Yes | admin |
| PATCH | `/admin/reservations/:id/approve` | Yes | admin |
| PATCH | `/admin/reservations/:id/reject` | Yes | admin |

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

### Customer reservation views

`GET /my/reservations` returns only the authenticated customer's reservation summaries.

`GET /my/reservations/:id` returns only the authenticated customer's reservation detail with selected plots. Requests owned by another customer are returned as not found.

### Admin reservation review

`GET /admin/reservations` lists all reservation requests.

`GET /admin/reservations/:id` returns any reservation request detail for admin review.

Admin approve/reject body: `{ "adminNote": "OK" }`

Approval/rejection are transaction-safe:

- Approve `reserve`: request becomes `approved`; related plots become `reserved`; one `request_approved` notification is created for the customer.
- Approve `purchase`: request becomes `approved`; related plots become `sold`; one `request_approved` notification is created for the customer.
- Reject: request becomes `rejected`; related pending plots return to `available` only when no other valid request still claims them; one `request_rejected` notification is created for the customer.

Only `pending` requests are valid for new decisions. Existing `submitted` records are also tolerated for backward compatibility. Already approved/rejected requests return an error and do not create duplicate notifications.

## Contracts

| Method | Endpoint | Auth | Role |
| --- | --- | --- | --- |
| GET | `/admin/contracts` | Yes | admin |
| GET | `/admin/contracts/:id` | Yes | admin |
| POST | `/admin/contracts/from-reservation/:reservationId` | Yes | admin |
| PATCH | `/admin/contracts/:id/status` | Yes | admin |
| POST | `/admin/contracts/:id/payments` | Yes | admin |
| GET | `/my/contracts` | Yes | customer/admin |
| GET | `/my/contracts/:id` | Yes | customer/admin |

Payment body: `{ "amount": 1000000, "paymentMethod": "cash", "referenceCode": "ABC", "note": "Deposit" }`

## Cemetery Services

| Method | Endpoint | Auth | Role |
| --- | --- | --- | --- |
| GET | `/service-types` | No | - |
| POST | `/service-orders` | Yes | customer/admin |
| GET | `/my/service-orders` | Yes | customer/admin |
| GET | `/my/service-orders/:id` | Yes | customer/admin |
| GET | `/admin/service-orders` | Yes | admin |
| GET | `/admin/service-orders/:id` | Yes | admin |
| PATCH | `/admin/service-orders/:id/status` | Yes | admin |
| POST | `/admin/service-orders/:id/completion` | Yes | admin |

Create body: `{ "serviceTypeId": 1, "plotId": 1, "requestedDate": "2026-07-05", "note": "Don dep va thay hoa" }`

## Notifications

| Method | Endpoint | Auth | Role |
| --- | --- | --- | --- |
| GET | `/notifications` | Yes | customer/admin |
| GET | `/notifications/unread-count` | Yes | customer/admin |
| PATCH | `/notifications/:id/read` | Yes | customer/admin |
| PATCH | `/notifications/read-all` | Yes | customer/admin |

## Dashboard

All dashboard endpoints require admin auth.

| Method | Endpoint |
| --- | --- |
| GET | `/admin/dashboard/summary` |
| GET | `/admin/dashboard/plots` |
| GET | `/admin/dashboard/revenue` |
| GET | `/admin/dashboard/services` |

## AI Agent Prototype

| Method | Endpoint | Auth |
| --- | --- | --- |
| POST | `/ai-agent/recommend` | No |
| POST | `/ai-agent/create-draft-reservation` | Yes |

Recommend body: `{ "budget": 50000000, "numberOfPlots": 2, "preferredZone": "Khu A", "preferredDirection": "east" }`

## Upload Placeholders

| Method | Endpoint | Auth |
| --- | --- | --- |
| POST | `/uploads/image` | Yes |
| POST | `/uploads/document` | Yes |
