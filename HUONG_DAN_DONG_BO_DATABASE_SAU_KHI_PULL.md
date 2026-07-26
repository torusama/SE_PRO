# Hướng dẫn đồng bộ database sau khi pull code

Tài liệu này dành cho thành viên phát triển SE_PRO khi lấy code mới từ GitHub
về máy local. Git chỉ đồng bộ source code và file SQL; Git không tự thay đổi
database PostgreSQL trên từng máy.

## 1. Xác định loại thay đổi database

Đọc mô tả pull request/commit và
`backend/database/migrations/README.md` trước khi chạy SQL.

- Nếu có thông báo **reset baseline** hoặc thay đổi
  `001_consolidated_schema.sql`: làm theo mục 3 để tạo lại database local.
- Nếu chỉ có migration mới như `002_*.sql`, `003_*.sql`: không chạy lại
  `DBase.sql`; chỉ chạy các migration mới theo thứ tự tên file như mục 4.
- Nếu không có thay đổi trong `backend/database`: không cần thao tác database.

Baseline hiện tại được tạo ngày 26/07/2026 và gồm:

```text
backend/database/DBase.sql
backend/database/migrations/001_consolidated_schema.sql
```

## 2. Pull code an toàn

Từ thư mục gốc repository:

```powershell
git status --short
git pull
```

Nếu `git status --short` hiển thị thay đổi chưa commit, hãy commit hoặc stash
trước khi pull. Không dùng `git reset --hard` để xử lý thay đổi local.

Sau khi pull, cài dependency nếu `package.json` hoặc lockfile thay đổi:

```powershell
cd backend
npm install

cd ../frontend
npm install

cd ..
```

## 3. Reset database theo baseline mới

Áp dụng mục này cho lần pull có thay đổi squash/baseline. Quy trình sẽ xóa toàn
bộ dữ liệu trong database local được chỉ định.

### 3.1. Kiểm tra cấu hình

Mở `backend/.env` và xác định database trong `DATABASE_URL`.

Ví dụ:

```env
DATABASE_URL=postgresql://postgres:MAT_KHAU@localhost:5432/cemetery_db
```

Các lệnh bên dưới dùng database mẫu `cemetery_db` và user `postgres`. Nếu
`DATABASE_URL` của bạn dùng tên khác, phải thay đúng tên trước khi chạy.
Không commit hoặc gửi mật khẩu PostgreSQL lên GitHub.

### 3.2. Dừng backend

Dừng terminal đang chạy `npm run start:dev`. Backend còn kết nối có thể khiến
PostgreSQL không xóa được database.

Kiểm tra cổng backend:

```powershell
netstat -ano | Select-String ":3001"
```

Nếu có tiến trình cũ và bạn chắc chắn đó là backend local của mình:

```powershell
Stop-Process -Id <PID>
```

### 3.3. Sao lưu dữ liệu local nếu cần

Đây là bước tùy chọn. Lưu file backup bên ngoài repository để tránh commit dữ
liệu cá nhân hoặc dữ liệu test nhạy cảm.

```powershell
pg_dump -U postgres -d cemetery_db -F c `
  -f "$env:TEMP\cemetery_db_before_reset.backup"
```

### 3.4. Xóa và tạo lại database UTF-8

```powershell
dropdb --if-exists --force -U postgres cemetery_db
createdb -U postgres -E UTF8 cemetery_db
```

### 3.5. Import schema, seed và baseline

Chạy từ thư mục `backend`:

```powershell
cd backend
$env:PGCLIENTENCODING="UTF8"

psql -U postgres -d cemetery_db -v ON_ERROR_STOP=1 `
  -f database/DBase.sql

psql -U postgres -d cemetery_db -v ON_ERROR_STOP=1 `
  -f database/migrations/001_consolidated_schema.sql
```

Thứ tự bắt buộc là `DBase.sql` trước, `001_consolidated_schema.sql` sau.
`ON_ERROR_STOP=1` bảo đảm lệnh dừng ngay khi có lỗi thay vì tiếp tục với schema
không hoàn chỉnh.

## 4. Chạy migration mới sau baseline

Sau khi mọi người đã đồng bộ baseline `001`, thay đổi database tiếp theo phải
tạo file `002_*.sql`, rồi `003_*.sql`...

Ví dụ pull request thêm:

```text
backend/database/migrations/002_add_example_column.sql
```

Chỉ chạy file mới từ thư mục `backend`:

```powershell
$env:PGCLIENTENCODING="UTF8"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 `
  -f database/migrations/002_add_example_column.sql
```

Không chạy lại `DBase.sql` trên database đang dùng vì file này tạo bảng và
seed nền, không phải migration cập nhật.

Dự án chưa có migration runner/ledger tự động. Vì vậy:

- Pull request phải liệt kê migration mới cần chạy.
- Mỗi thành viên phải ghi nhớ migration đã chạy trên database local.
- Chạy migration theo thứ tự prefix tăng dần.
- Không chỉnh sửa migration cũ sau khi đã được merge và áp dụng.

## 5. Kiểm tra sau khi đồng bộ

Kiểm tra encoding và dữ liệu nền:

```powershell
psql -U postgres -d cemetery_db -c "SHOW server_encoding;"
psql -U postgres -d cemetery_db -c "SELECT COUNT(*) AS users FROM users;"
psql -U postgres -d cemetery_db -c "SELECT COUNT(*) AS zones FROM cemetery_zones;"
psql -U postgres -d cemetery_db -c "SELECT name, unit FROM service_types ORDER BY sort_order;"
```

Kết quả baseline hiện tại cần có:

- `server_encoding`: `UTF8`
- 6 tài khoản seed
- 8 khu nghĩa trang A–H
- 8 loại dịch vụ với tiếng Việt hiển thị đúng

Mở terminal mới tại thư mục gốc repository rồi khởi động backend:

```powershell
cd backend
npm run start:dev
```

Mở terminal khác để kiểm tra API:

```powershell
Invoke-RestMethod http://localhost:3001/api/service-types
Invoke-RestMethod http://localhost:3001/api/plots/map
```

Mở terminal khác tại thư mục gốc repository rồi chạy frontend:

```powershell
cd frontend
npm run dev
```

## 6. Lỗi thường gặp

### `psql`, `createdb` hoặc `dropdb` không nhận lệnh

Dùng đường dẫn đầy đủ tới PostgreSQL. Ví dụ PostgreSQL 18:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version
```

Thay `18` bằng phiên bản đang cài trên máy.

### `EADDRINUSE: address already in use :::3001`

Đã có một backend khác chạy trên cổng `3001`. Không mở hai phiên backend cùng
lúc. Xác định PID bằng:

```powershell
netstat -ano | Select-String ":3001"
```

### `database "cemetery_db" is being accessed by other users`

Dừng backend rồi chạy:

```powershell
dropdb --if-exists --force -U postgres cemetery_db
```

### `relation ... already exists`

Bạn đang import `DBase.sql` vào database chưa được reset hoặc đã chạy sai thứ
tự. Với đợt reset baseline, hãy drop và tạo lại database rồi chạy hai file như
mục 3.

### Tiếng Việt hiển thị thành `Nguyá»...` hoặc `Dá»‹ch vá»¥`

Database đã được import sai encoding. Chạy lại:

```powershell
$env:PGCLIENTENCODING="UTF8"
```

Sau đó reset database và import lại baseline.

### `ERR_CONNECTION_REFUSED` từ frontend

Backend chưa chạy hoặc đã bị dừng. Kiểm tra:

```powershell
Invoke-RestMethod http://localhost:3001/api/service-types
```

Nếu lệnh thất bại, chạy lại `npm run start:dev` trong thư mục `backend`.

## 7. Checklist trước khi bắt đầu làm việc

- [ ] Đã pull code mới nhất.
- [ ] Đã đọc mô tả thay đổi database trong pull request.
- [ ] Đã kiểm tra đúng `DATABASE_URL`.
- [ ] Đã chạy đúng baseline hoặc migration mới.
- [ ] PostgreSQL đang dùng UTF-8.
- [ ] Backend khởi động không lỗi.
- [ ] API `/api/service-types` và `/api/plots/map` trả dữ liệu.
- [ ] Không commit `.env`, file backup hoặc thông tin đăng nhập.
