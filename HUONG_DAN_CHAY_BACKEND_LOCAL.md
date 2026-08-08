# Hướng Dẫn Chạy Backend Local

File này hướng dẫn thành viên trong nhóm setup và chạy backend local cho hệ thống quản lý nghĩa trang.

## 1. Yêu Cầu Cần Có

Cài sẵn:

- Node.js
- npm
- PostgreSQL
- PostgreSQL Command Line Tools: `psql`, `createdb`, `dropdb`

Kiểm tra:

```powershell
node --version
npm --version
```

Nếu `psql` chưa nhận lệnh, dùng đường dẫn đầy đủ. Ví dụ PostgreSQL 18:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version
```

## 2. Cài Dependency Backend

Từ thư mục gốc project:

```powershell
cd backend
npm install
```

## 3. Tạo File `.env`

Trong thư mục `backend`, copy file mẫu:

```powershell
Copy-Item .env.example .env
```

Mở file `backend/.env` và sửa `DATABASE_URL` theo mật khẩu PostgreSQL của máy bạn:

```env
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://postgres:MAT_KHAU_POSTGRES_CUA_BAN@localhost:5432/cemetery_db

JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d

FRONTEND_URL=http://localhost:5173

# Gửi email từ Gmail cá nhân qua Gmail HTTP API
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_SENDER_EMAIL=your-account@gmail.com
GMAIL_API_TIMEOUT_MS=15000
```

Không commit file `.env` thật lên repo.

### Cấp quyền Gmail API lần đầu

1. Tạo project trong Google Cloud Console và bật **Gmail API**.
2. Trong Google Auth Platform, cấu hình Audience là **External**. Nếu ứng dụng
   đang ở trạng thái Testing, thêm Gmail dùng để gửi vào danh sách Test users.
3. Tạo OAuth Client với Application type là **Desktop app**.
4. Điền Client ID, Client Secret và Gmail gửi thư vào `backend/.env`:

```env
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_SENDER_EMAIL=your-account@gmail.com
```

5. Từ thư mục `backend`, chạy:

```powershell
npm run email:gmail:authorize
```

6. Mở liên kết được in ra terminal, đăng nhập đúng `GMAIL_SENDER_EMAIL` và cấp
   quyền gửi email. Google chuyển về callback local; script tự ghi
   `GMAIL_REFRESH_TOKEN` vào `.env` và không in token ra màn hình.
7. Khởi động lại backend.

OAuth app ở trạng thái Testing sẽ làm quyền của test user, bao gồm refresh
token, hết hạn sau 7 ngày. Khi cấu hình ổn định, chuyển Publishing status sang
In production; ứng dụng chưa xác minh có thể hiện cảnh báo khi chính bạn cấp
quyền nhưng chỉ tài khoản Gmail gửi thư cần thực hiện bước này.

Nếu thiếu một trong bốn biến `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
`GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL`, backend vẫn khởi động nhưng các
chức năng bắt buộc gửi email sẽ báo chưa cấu hình.

## 4. Tạo Và Import Database

Vào thư mục backend:

```powershell
cd D:\SE_CNPM\backend
```

Set encoding UTF-8 để tránh lỗi tiếng Việt khi import SQL:

```powershell
$env:PGCLIENTENCODING="UTF8"
```

Nếu chưa tạo database:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres -E UTF8 cemetery_db
```

Import schema và seed data:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d cemetery_db -v ON_ERROR_STOP=1 -f database\DBase.sql
npm run migration:run
```

Nếu cần tạo lại database từ đầu:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\dropdb.exe" -U postgres cemetery_db
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres -E UTF8 cemetery_db
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d cemetery_db -v ON_ERROR_STOP=1 -f database\DBase.sql
npm run migration:run
```

Nếu PostgreSQL của bạn không phải bản 18, đổi `18` thành version đang cài, ví dụ `16` hoặc `17`.

## 5. Chạy Backend Local

Trong thư mục `backend`:

```powershell
npm run start:dev
```

Backend tự chạy các migration còn thiếu trước khi nhận request. Có thể đặt
`DB_MIGRATIONS_ENABLED=false` trong `.env` để tắt tạm thời; mặc định là bật.

Nếu chạy thành công sẽ thấy:

```txt
Found 0 errors. Watching for file changes.
Nest application successfully started
```

Backend API chạy tại:

```txt
http://localhost:3001/api
```

## 6. Test API

Mở terminal mới, test API bản đồ lô:

```powershell
Invoke-RestMethod http://localhost:3001/api/plots/map
```

Hoặc mở browser:

```txt
http://localhost:3001/api/plots/map
```

Test login admin:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3001/api/auth/login `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@cemetery.vn","password":"123456"}'
```

Tài khoản seed để test:

```txt
Admin:
email: admin@cemetery.vn
password: 123456

Customer:
email: khachhang1@gmail.com
password: 123456
```

## 7. Một Số Endpoint Test Nhanh

```txt
GET  http://localhost:3001/api/plots/map
GET  http://localhost:3001/api/plots
GET  http://localhost:3001/api/service-types
POST http://localhost:3001/api/auth/login
```

Xem đầy đủ endpoint trong:

```txt
backend/API_DOCUMENTATION.md
```

## 8. Lỗi Thường Gặp

### `psql` hoặc `createdb` không nhận lệnh

PostgreSQL đã cài nhưng chưa thêm vào PATH. Dùng full path:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version
```

Hoặc thêm thư mục này vào PATH:

```txt
C:\Program Files\PostgreSQL\18\bin
```

### Lỗi encoding `WIN1252 has no equivalent in UTF8`

Chạy dòng này trước khi import SQL:

```powershell
$env:PGCLIENTENCODING="UTF8"
```

Sau đó drop database, tạo lại và import lại.

### Login báo `Invalid credentials`

Kiểm tra đã import bản `database/DBase.sql` mới nhất chưa. Password seed hiện tại là:

```txt
123456
```

Nếu cần reset password seed trực tiếp:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d cemetery_db -c 'UPDATE users SET password_hash = ''$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu'' WHERE email IN (''admin@cemetery.vn'', ''admin2@cemetery.vn'', ''khachhang1@gmail.com'', ''khachhang2@gmail.com'', ''khachhang3@gmail.com'', ''khachhang4@gmail.com'');'
```

### Backend chạy nhưng browser không có giao diện web

Backend hiện tại là API, không phải frontend. Mở các link `/api/...` sẽ trả JSON. Frontend sẽ gọi API từ:

```txt
http://localhost:3001/api
```

## 9. Chạy Frontend Local

Backend chính của project là thư mục `backend/`, chạy ở port `3001`.

Frontend nằm trong thư mục `vinh-hang-frontend`. Lần đầu chạy:

```powershell
cd D:\SE_CNPM\vinh-hang-frontend
npm install
Copy-Item .env.example .env
npm run dev
```

File `vinh-hang-frontend/.env` cần có:

```env
VITE_API_URL=http://localhost:3001/api
```

Khi Vite chạy xong, mở link local mà terminal in ra, thường là:

```txt
http://localhost:5173
```

Lưu ý: thư mục `server/` chỉ là backend Express auth demo cũ. Backend chính để chạy cùng frontend là `backend/`.
