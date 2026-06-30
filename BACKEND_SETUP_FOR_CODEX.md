# BACKEND SETUP - Cemetery Management System

File này dùng để đưa cho Codex setup **backend בלבד** cho hệ thống quản lý nghĩa trang.

## 1. Công nghệ chốt

```txt
Backend: NestJS + TypeScript
Database: PostgreSQL
Database access: pg raw SQL Pool
Auth: JWT + bcrypt
Validation: class-validator + class-transformer
Deploy: Render Web Service
Frontend deploy sau: Vercel
File upload sau: Cloudinary
```

Lưu ý: Backend **không code frontend**. Chỉ cần tạo API để frontend gọi.

---

## 2. Cấu trúc thư mục backend cần tạo

```txt
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── interfaces/
│   │       └── api-response.interface.ts
│   │
│   ├── config/
│   │   └── env.config.ts
│   │
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── database.service.ts
│   │   └── transaction.helper.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   └── register.dto.ts
│   │   │   └── strategies/
│   │   │       └── jwt.strategy.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   │
│   │   ├── plots/
│   │   │   ├── plots.controller.ts
│   │   │   ├── plots.service.ts
│   │   │   ├── plots.module.ts
│   │   │   └── dto/
│   │   │       ├── create-plot.dto.ts
│   │   │       └── update-plot.dto.ts
│   │   │
│   │   ├── reservations/
│   │   │   ├── reservations.controller.ts
│   │   │   ├── reservations.service.ts
│   │   │   ├── reservations.module.ts
│   │   │   └── dto/
│   │   │       ├── create-reservation.dto.ts
│   │   │       └── update-reservation-status.dto.ts
│   │   │
│   │   ├── contracts/
│   │   │   ├── contracts.controller.ts
│   │   │   ├── contracts.service.ts
│   │   │   └── contracts.module.ts
│   │   │
│   │   ├── services/
│   │   │   ├── cemetery-services.controller.ts
│   │   │   ├── cemetery-services.service.ts
│   │   │   ├── cemetery-services.module.ts
│   │   │   └── dto/
│   │   │       └── create-service-order.dto.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.service.ts
│   │   │   └── notifications.module.ts
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.service.ts
│   │   │   └── dashboard.module.ts
│   │   │
│   │   └── ai-agent/
│   │       ├── ai-agent.controller.ts
│   │       ├── ai-agent.service.ts
│   │       └── ai-agent.module.ts
│   │
│   └── uploads/
│       ├── uploads.controller.ts
│       ├── uploads.service.ts
│       └── uploads.module.ts
│
├── database/
│   ├── DBase.sql
│   └── seed.sql
│
├── API_DOCUMENTATION.md
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 3. Lệnh khởi tạo backend

Chạy từ thư mục gốc project:

```bash
nest new backend
cd backend
```

Cài package cần thiết:

```bash
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt pg
npm install class-validator class-transformer
npm install helmet compression cookie-parser
npm install -D @types/bcrypt @types/passport-jwt @types/cookie-parser
```

Nếu chưa có Nest CLI:

```bash
npm install -g @nestjs/cli
```

---

## 4. File `.env.example`

Tạo file:

```env
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://postgres:password@localhost:5432/cemetery_db

JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d

FRONTEND_URL=http://localhost:3000

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Không commit file `.env` thật.

---

## 5. Setup `main.ts`

Backend cần:

```txt
- Prefix toàn bộ API là /api
- Bật CORS cho FRONTEND_URL
- Bật ValidationPipe
- Bật helmet
- Bật cookie parser
- Port mặc định 3001
```

Yêu cầu response API nên thống nhất dạng:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

Khi lỗi:

```json
{
  "success": false,
  "message": "Error message",
  "error": "BAD_REQUEST"
}
```

---

## 6. Setup database

Backend dùng PostgreSQL có sẵn schema từ file `DBase.sql`.

Tạo database local:

```bash
createdb cemetery_db
```

Chạy schema:

```bash
psql -d cemetery_db -f database/DBase.sql
```

Nếu dùng Render PostgreSQL thì lấy `DATABASE_URL`, sau đó chạy SQL bằng tool như pgAdmin, DBeaver hoặc psql.

Không dùng ORM tự generate schema ở giai đoạn này, vì database có trigger, function, view, index và enum logic riêng.

---

## 7. DatabaseModule cần setup

Tạo `DatabaseService` dùng `pg.Pool`.

Service cần có các hàm:

```ts
query<T = any>(text: string, params?: any[]): Promise<T[]>
queryOne<T = any>(text: string, params?: any[]): Promise<T | null>
transaction<T>(callback: (client) => Promise<T>): Promise<T>
```

Tất cả module khác gọi database qua `DatabaseService`, không tự tạo connection riêng.

---

## 8. Các module MVP cần code trước

Ưu tiên làm theo thứ tự này:

```txt
1. database
2. auth
3. users
4. plots
5. reservations
6. contracts
7. cemetery services
8. notifications
9. dashboard
10. ai-agent prototype
```

---

## 9. Auth module

### API cần có

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Register body

```json
{
  "fullName": "Nguyen Van A",
  "email": "user@example.com",
  "password": "123456",
  "phone": "0900000000"
}
```

### Login body

```json
{
  "email": "user@example.com",
  "password": "123456"
}
```

### JWT payload

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "customer"
}
```

Role tối thiểu:

```txt
customer
admin
```

Cần tạo:

```txt
JwtAuthGuard
RolesGuard
@Roles('admin')
@CurrentUser()
```

---

## 10. Users module

### API cần có

```txt
GET /api/users/me
GET /api/admin/users
GET /api/admin/users/:id
PATCH /api/admin/users/:id/status
```

Các API `/api/admin/...` chỉ admin được gọi.

---

## 11. Plots module

Đây là module quan trọng nhất vì frontend cần bản đồ 2D.

### API customer/admin dùng chung

```txt
GET /api/plots
GET /api/plots/map
GET /api/plots/:id
```

### API admin

```txt
POST  /api/admin/plots
PATCH /api/admin/plots/:id
PATCH /api/admin/plots/:id/status
DELETE /api/admin/plots/:id
```

### `GET /api/plots/map` response đề xuất

```json
{
  "success": true,
  "data": [
    {
      "id": "plot_id",
      "plotCode": "A-01-001",
      "zoneName": "Khu A",
      "rowCode": "01",
      "plotNumber": "001",
      "status": "available",
      "price": 10000000,
      "area": 5.5,
      "mapX": 10,
      "mapY": 20,
      "mapWidth": 40,
      "mapHeight": 30
    }
  ]
}
```

Frontend sẽ dùng API này để vẽ bản đồ 2D.

---

## 12. Reservations module

Dùng cho giữ chỗ/mua lô, gồm cả chọn 1 lô và nhiều lô.

### API customer

```txt
POST /api/reservations
GET  /api/my/reservations
GET  /api/my/reservations/:id
POST /api/reservations/:id/submit
POST /api/reservations/:id/cancel
```

### API admin

```txt
GET   /api/admin/reservations
GET   /api/admin/reservations/:id
PATCH /api/admin/reservations/:id/approve
PATCH /api/admin/reservations/:id/reject
```

### Create reservation body

```json
{
  "type": "purchase",
  "plotIds": ["plot_id_1", "plot_id_2"],
  "note": "Muốn mua khu gia đình"
}
```

### Trạng thái request

```txt
draft
submitted
pending
approved
rejected
cancelled
```

Khi customer submit, backend phải kiểm tra:

```txt
- User đã đăng nhập
- Tất cả plot còn available
- Không cho chọn plot sold/locked/reserved
- Nếu hợp lệ thì tạo request và đổi plot sang pending
```

Khi admin approve:

```txt
- Update request approved
- Update plot sang reserved hoặc sold tùy type
- Tạo contract nếu là purchase
- Tạo notification cho customer
```

Khi admin reject:

```txt
- Update request rejected
- Trả plot về available nếu đang pending
- Tạo notification cho customer
```

Các thao tác approve/reject phải chạy trong transaction.

---

## 13. Contracts module

### API admin

```txt
GET  /api/admin/contracts
GET  /api/admin/contracts/:id
POST /api/admin/contracts/from-reservation/:reservationId
PATCH /api/admin/contracts/:id/status
POST /api/admin/contracts/:id/payments
```

### API customer

```txt
GET /api/my/contracts
GET /api/my/contracts/:id
```

Contract được tạo khi admin approve yêu cầu mua lô.

Trạng thái contract đề xuất:

```txt
draft
active
completed
cancelled
```

---

## 14. Cemetery Services module

Không đặt tên module là `services` trong code nếu dễ nhầm với service class. Nên đặt folder là `cemetery-services` hoặc vẫn giữ folder `services` nhưng class rõ tên `CemeteryServicesService`.

### API customer

```txt
GET  /api/service-types
POST /api/service-orders
GET  /api/my/service-orders
GET  /api/my/service-orders/:id
```

### API admin

```txt
GET   /api/admin/service-orders
GET   /api/admin/service-orders/:id
PATCH /api/admin/service-orders/:id/status
POST  /api/admin/service-orders/:id/completion
```

### Create service order body

```json
{
  "serviceTypeId": "service_type_id",
  "plotId": "plot_id",
  "requestedDate": "2026-07-05",
  "note": "Dọn dẹp và thay hoa"
}
```

### Trạng thái service order

```txt
submitted
pending
confirmed
in_progress
completed
cancelled
```

Khi trạng thái thay đổi, tạo notification cho customer.

---

## 15. Notifications module

### API

```txt
GET   /api/notifications
GET   /api/notifications/unread-count
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
```

Notification dùng polling trước, chưa cần WebSocket.

Frontend có thể gọi:

```txt
GET /api/notifications/unread-count mỗi 30 giây
```

---

## 16. Dashboard module

### API admin

```txt
GET /api/admin/dashboard/summary
GET /api/admin/dashboard/plots
GET /api/admin/dashboard/revenue
GET /api/admin/dashboard/services
```

Nếu database đã có view dashboard thì query trực tiếp từ view.

Response `/api/admin/dashboard/summary` đề xuất:

```json
{
  "success": true,
  "data": {
    "totalPlots": 100,
    "availablePlots": 60,
    "reservedPlots": 10,
    "soldPlots": 25,
    "lockedPlots": 5,
    "pendingRequests": 4,
    "activeServices": 3,
    "completedServices": 20,
    "totalCustomers": 15,
    "estimatedRevenue": 500000000
  }
}
```

---

## 17. AI Agent prototype

Chỉ làm rule-based, chưa cần gọi AI API thật.

### API

```txt
POST /api/ai-agent/recommend
POST /api/ai-agent/create-draft-reservation
```

### Recommend body

```json
{
  "budget": 50000000,
  "numberOfPlots": 2,
  "preferredZone": "Khu A",
  "preferredDirection": "east"
}
```

Backend lọc plots:

```txt
- status = available
- tổng giá <= budget
- cùng zone nếu có preferredZone
- đủ số lượng lô
- ưu tiên lô gần nhau theo map_x/map_y
```

Response trả về danh sách plot để frontend highlight trên bản đồ.

---

## 18. Upload module

MVP có thể chưa cần làm ngay. Nếu làm thì dùng Cloudinary.

### API

```txt
POST /api/uploads/image
POST /api/uploads/document
```

Dùng cho:

```txt
- ảnh hoàn thành dịch vụ
- file hợp đồng PDF
- giấy tờ chuyển nhượng/thừa kế
```

---

## 19. CORS cần cấu hình

Backend phải cho phép frontend gọi API.

Local:

```txt
http://localhost:3000
```

Deploy:

```txt
https://your-frontend.vercel.app
```

Dùng biến môi trường:

```env
FRONTEND_URL=http://localhost:3000
```

---

## 20. Render deploy backend

Render Web Service config:

```txt
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm run start:prod
```

Env trên Render:

```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://...
JWT_SECRET=your_render_secret
JWT_EXPIRES_IN=1d
FRONTEND_URL=https://your-frontend.vercel.app
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Backend phải listen theo `process.env.PORT`.

---

## 21. API documentation cần tạo

Tạo file `API_DOCUMENTATION.md` ghi rõ cho frontend:

```txt
- endpoint
- method
- auth required hay không
- role required
- request body
- response mẫu
```

Frontend chỉ cần đọc file này để gọi API.

---

## 22. Checklist hoàn thành backend setup

Backend được xem là setup xong khi đạt các mục sau:

```txt
[ ] Chạy được npm run start:dev
[ ] Kết nối được PostgreSQL bằng DATABASE_URL
[ ] Chạy được DBase.sql
[ ] Có prefix /api
[ ] Có CORS cho frontend
[ ] Có auth register/login/me
[ ] Có JWT guard
[ ] Có roles guard admin/customer
[ ] Có GET /api/plots/map
[ ] Có API tạo reservation
[ ] Có API admin approve/reject reservation
[ ] Có API contract cơ bản
[ ] Có API service order cơ bản
[ ] Có API notification cơ bản
[ ] Có API dashboard summary
[ ] Có .env.example
[ ] Có README.md hướng dẫn chạy backend
[ ] Có API_DOCUMENTATION.md
[ ] Deploy được lên Render
```

---

## 23. Prompt ngắn đưa cho Codex

Dán đoạn này cho Codex:

```txt
Setup backend only for a cemetery management system using NestJS + TypeScript + PostgreSQL.
Do not modify frontend.
Use pg raw SQL Pool, not ORM schema generation, because the database schema already exists in database/DBase.sql.
Create modules: auth, users, plots, reservations, contracts, cemetery-services, notifications, dashboard, ai-agent, uploads.
Configure /api prefix, CORS from FRONTEND_URL, ValidationPipe, JWT auth, role guards for customer/admin, and .env.example.
Implement MVP endpoints for auth, plots map, reservations approve/reject, contracts, service orders, notifications, and dashboard summary.
Create README.md and API_DOCUMENTATION.md for frontend developers.
Prepare the backend to deploy on Render with build command npm install && npm run build and start command npm run start:prod.
```
