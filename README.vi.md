<p align="center">
  <img
    src="https://drive.google.com/uc?export=view&id=1VrcdWFqFQGaPHCgkoL-_PLuT6c3uUA_C"
    alt="Vĩnh Phúc Viên"
    width="100%"
  />
</p>

<div align="center">

# Vĩnh Phúc Viên

### Hệ thống Quản lý Nghĩa trang & Nền tảng Tư vấn AI

Nền tảng web hỗ trợ số hóa quản lý lô đất nghĩa trang, hồ sơ gia đình/người đã khuất, dịch vụ nghĩa trang, quy trình quản trị và tư vấn bằng AI.

<p>
  <a href="./README.md"><img src="https://img.shields.io/badge/Language-English-6b7280?style=for-the-badge" alt="English README" /></a>
  <a href="./README.vi.md"><img src="https://img.shields.io/badge/Ng%C3%B4n_ng%E1%BB%AF-Ti%E1%BA%BFng_Vi%E1%BB%87t-2f5b51?style=for-the-badge" alt="Vietnamese README" /></a>
</p>

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=000" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=fff" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=fff" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=flat-square&logo=postgresql&logoColor=fff" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/FastAPI-ML_Service-009688?style=flat-square&logo=fastapi&logoColor=fff" alt="FastAPI" />
  <img src="https://img.shields.io/badge/HCMUS-Software_Engineering_Project-0b6e4f?style=flat-square" alt="HCMUS Software Engineering Project" />
</p>

**Nhóm 8 · Trường Đại học Khoa học Tự nhiên, ĐHQG-HCM (HCMUS)**

[Tổng quan](#tổng-quan) · [Chức năng](#chức-năng) · [Kiến trúc](#kiến-trúc) · [Chạy local](#chạy-local) · [AI Concierge](#ai-concierge) · [Tài liệu](#tài-liệu)

</div>

---

## Tổng quan

**Vĩnh Phúc Viên** là đồ án môn Kỹ thuật Phần mềm, hướng đến số hóa các nghiệp vụ nghĩa trang cho cả khách hàng và quản trị viên. Hệ thống tập trung quản lý thông tin lô đất, yêu cầu đặt/mua, hợp đồng, dịch vụ chăm sóc, nhắc lịch, hồ sơ gia đình/người đã khuất và các hoạt động quản trị trên một nền tảng web thống nhất.

Repository hiện tại đã phát triển xa hơn bản MVP ban đầu và gồm ba khối chính:

- **Cổng khách hàng** để xem bản đồ lô đất, quản lý lô đã sở hữu, đặt dịch vụ, lịch hẹn, nhắc lịch, thông báo, hồ sơ gia đình/người đã khuất và sử dụng trợ lý AI.
- **Cổng quản trị** để quản lý lô/bản đồ, yêu cầu, hợp đồng, dịch vụ, chuyển nhượng, lịch hẹn, nhắc lịch, nhật ký hoạt động, dashboard và duyệt dữ liệu học của AI.
- **Khối AI/ML** gồm AI Cemetery Concierge, bộ nhớ dài hạn/RAG có kiểm soát, quy trình học từ phản hồi, định tuyến nhiều nhà cung cấp LLM và PlotRanker ML tùy chọn.

> Phần “tự học” của AI **không phải** cho foundation model tự retrain từ tin nhắn người dùng. Dữ liệu nghiệp vụ vẫn lấy từ PostgreSQL; bộ nhớ và correction phải qua kiểm tra trước khi trở thành kiến thức được tái sử dụng.

## Chức năng

### Dành cho khách hàng

- Đăng ký, đăng nhập, hoàn thiện hồ sơ và phân quyền truy cập.
- **Bản đồ nghĩa trang 2D** tương tác, xem thông tin chi tiết từng lô.
- Gửi yêu cầu mua lô; hủy ngay khi chưa được duyệt hoặc gửi yêu cầu hủy để
  admin xử lý sau khi đã duyệt.
- Xem, đặt và theo dõi dịch vụ nghĩa trang; nhận minh chứng hoàn thành dịch vụ.
- Xem lịch rảnh và đặt lịch hẹn.
- Tạo nhắc lịch tưởng niệm và xem trung tâm thông báo.
- Hỗ trợ các luồng chuyển nhượng / thừa kế.
- Quản lý hồ sơ người đã khuất và liên kết trong gia đình.
- Luồng thanh toán demo phục vụ trình diễn đồ án.
- Tư vấn AI: gợi ý lô, so sánh phương án, highlight trên bản đồ và hướng dẫn bước tiếp theo.

### Dành cho quản trị viên

- Dashboard và thống kê hoạt động.
- CRUD lô đất, trạng thái, giá và quản lý bản đồ nghĩa trang.
- Xử lý yêu cầu mua lô và các yêu cầu hủy mua lô riêng biệt.
- Quản lý hợp đồng và hồ sơ sở hữu.
- Quản lý đơn dịch vụ nghĩa trang.
- Quản lý chuyển nhượng.
- Quản lý lịch hẹn và nhắc lịch.
- Quản lý thông báo và nhật ký/audit hoạt động quản trị.
- Quản trị AI Agent: duyệt feedback, duyệt knowledge, xem learning journal và learning analytics.

### Năng lực AI & learning

- Trò chuyện tự nhiên về nghiệp vụ Vĩnh Phúc Viên và gọi tool backend khi cần.
- Gợi ý lô dựa trên **dữ liệu lô thật trong database**, không cho LLM tự bịa mã lô/giá/trạng thái.
- So sánh các phương án và highlight lô trên bản đồ 2D.
- Gợi ý hướng Bát Tự / văn hóa tâm linh bằng service rule-based ở backend.
- Bộ nhớ ngắn hạn từ lịch sử hội thoại và bộ nhớ dài hạn theo từng user.
- Safe RAG trên knowledge đã duyệt, dùng PostgreSQL/pgvector-compatible schema và NVIDIA BGE-M3 khi được cấu hình.
- Thu thập feedback/correction từ người dùng; admin có thể duyệt, từ chối, version và audit.
- Định tuyến nhiều LLM/API key với timeout, cooldown và fallback.
- **PlotRanker** FastAPI tùy chọn dùng Random Forest; model candidate không tự động được active.

## Kiến trúc

```mermaid
flowchart TB
    C["Khách hàng"] --> FE["React + TypeScript Web App"]
    A["Quản trị viên"] --> FE

    FE --> API["NestJS REST API"]
    API --> DB[(PostgreSQL)]
    API --> FILES["Tài liệu / minh chứng upload"]
    API --> MAIL["Gmail API / SMS tùy chọn"]

    API --> AGENT["AI Cemetery Concierge"]
    AGENT --> TOOLS["Backend Tools đã kiểm soát"]
    TOOLS --> DB

    AGENT --> ROUTER["Multi-provider LLM Router"]
    ROUTER --> OAI["OpenAI-compatible Routes"]
    ROUTER --> NIM["NVIDIA NIM"]

    AGENT --> RAG["Memory & Knowledge đã xác thực"]
    RAG --> DB

    AGENT -.-> ML["FastAPI PlotRanker (Tùy chọn)"]
    ML --> MODEL["Random Forest Candidate Model"]
```

### Nguyên tắc thiết kế

1. **Frontend hiển thị, backend giữ sự thật nghiệp vụ.** Trạng thái lô, giá, hợp đồng, dịch vụ và reservation lấy từ backend/database.
2. **LLM điều phối hội thoại, không nắm quyền nghiệp vụ.** Tool call được validate ở server; model không được tự sửa các trusted field.
3. **Learning có kiểm soát.** Feedback có thể tạo proposal/correction nhưng chỉ knowledge được xác minh hoặc admin duyệt mới được active.
4. **Memory tách theo user.** Preference riêng của khách hàng này không được đưa vào hội thoại của khách hàng khác.
5. **ML là tùy chọn.** PlotRanker chỉ là thành phần xếp hạng thử nghiệm; hệ thống vẫn có fallback rule-based/deterministic khi ML không sẵn sàng.

## Công nghệ sử dụng

| Tầng | Công nghệ | Mục đích |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand, Axios | Web khách hàng và admin |
| Backend | NestJS 11, TypeScript, Node.js | REST API, xác thực, workflow và business logic |
| Database | PostgreSQL, SQL migrations, pgvector-compatible RAG schema | Dữ liệu quan hệ, audit, memory/knowledge AI |
| Xác thực | JWT, bcrypt, guards/RBAC | Phiên đăng nhập và phân quyền customer/admin |
| AI | OpenAI-compatible APIs, NVIDIA NIM, tool orchestration | Hội thoại AI và failover routing |
| Embedding / RAG | NVIDIA BGE-M3 khi được cấu hình | Semantic retrieval cho memory/knowledge đã duyệt |
| ML service | FastAPI, scikit-learn, Random Forest | Thử nghiệm xếp hạng lô |
| Email | Gmail HTTP API (OAuth 2.0) | OTP/xác thực, nhắc lịch, thông báo dịch vụ |
| Testing | Jest, Vitest, Pytest | Kiểm thử backend, frontend và ML |

## Cấu trúc repository

```text
SE_PRO-main/
├── frontend/                         # React customer + admin application
│   ├── src/pages/customer/           # Luồng khách hàng
│   ├── src/pages/admin/              # Luồng quản trị
│   └── src/pages/shared/             # Màn hình dùng chung family/deceased
├── backend/                          # NestJS REST API
│   ├── src/modules/ai-agent/         # Concierge, RAG, feedback, learning
│   ├── src/modules/plots/            # Lô đất và logic bản đồ
│   ├── src/modules/reservations/     # Yêu cầu mua lô
│   ├── src/modules/contracts/        # Hợp đồng và sở hữu
│   ├── src/modules/cemetery-services/# Dịch vụ nghĩa trang
│   ├── src/modules/reminders/        # Nhắc lịch tưởng niệm
│   ├── src/modules/appointments/     # Lịch hẹn
│   ├── src/modules/transfers/        # Chuyển nhượng
│   ├── src/modules/deceased/         # Hồ sơ người đã khuất/gia đình
│   └── database/                     # Schema gốc, seed, migrations
├── ml-service/                       # FastAPI PlotRanker tùy chọn
├── README.md
└── README.vi.md
```

## Chạy local

### Yêu cầu

- **Node.js 24+** và npm
- **PostgreSQL**
- **Python 3.10+** nếu muốn chạy ML service tùy chọn

### 1. Clone và cài dependency

```bash
git clone <your-repository-url>
cd SE_PRO-main
```

Backend:

```bash
cd backend
npm install
copy .env.example .env
```

Frontend:

```bash
cd ../frontend
npm install
```

### 2. Tạo PostgreSQL database

Từ root repository, tạo database và nạp schema gốc:

```bash
createdb cemetery_db
psql -d cemetery_db -f backend/database/DBase.sql
```

Chạy các migration theo version:

```bash
cd backend
npm run migration:run
```

> Backend cũng có thể tự chạy migration lúc khởi động khi `DB_MIGRATIONS_ENABLED=true`.

### 3. Cấu hình biến môi trường

Cấu hình backend tối thiểu:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/cemetery_db
DB_MIGRATIONS_ENABLED=true
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:5173
```

Các integration tùy chọn có thể cấu hình bằng environment variables cho:

- Gmail OAuth / tài khoản gửi mail
- SMS provider
- OpenAI-compatible API route(s)
- NVIDIA NIM
- RAG embeddings
- PlotRanker ML service

Xem [`backend/README.md`](./backend/README.md) để lấy cấu hình AI routing và RAG hiện tại.

Frontend mặc định gọi `http://localhost:3001/api`. Nếu muốn đổi, tạo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### 4. Chạy project

Backend:

```bash
cd backend
npm run start:dev
```

Frontend (terminal khác):

```bash
cd frontend
npm run dev
```

Địa chỉ local mặc định:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001/api`

### 5. Tùy chọn: chạy PlotRanker ML service

```bash
cd ml-service
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

ML service là thành phần tùy chọn và **không tự train/active model khi startup**.

## AI Concierge

AI Concierge được thiết kế như một **trợ lý sử dụng tool trên dữ liệu đáng tin cậy của hệ thống**.

Luồng xử lý điển hình:

```text
Tin nhắn người dùng
  -> trusted conversation state + preference đã lưu
  -> LLM planner hoặc deterministic intent path
  -> backend tool đã validate
  -> dữ liệu PostgreSQL / service
  -> kết quả có cấu trúc
  -> câu trả lời + quick actions cho khách hàng
```

### Luồng learning có kiểm soát

```text
Feedback / correction từ người dùng
  -> bản ghi pending hoặc quarantined
  -> validation / admin review
  -> approve hoặc reject
  -> cập nhật knowledge có version
  -> embedding cho RAG nếu bật
  -> hội thoại sau có thể truy xuất knowledge đã duyệt
```

Cách này giúp hệ thống có thể audit và không biến một phát biểu chưa kiểm chứng của người dùng thành “sự thật” nghiệp vụ.

> Gợi ý Bát Tự / hướng tâm linh chỉ là tham khảo văn hóa, không phải tiêu chí bắt buộc hay tư vấn chuyên môn cho quyết định mua lô.

## Database & Migration

- Schema gốc và dữ liệu demo: [`backend/database/DBase.sql`](./backend/database/DBase.sql)
- Seed script: [`backend/database/seed.sql`](./backend/database/seed.sql)
- Versioned migrations: [`backend/database/migrations/`](./backend/database/migrations/)
- Hướng dẫn migration: [`backend/database/migrations/README.md`](./backend/database/migrations/README.md)

Không commit credential, API key hoặc secret thật vào SQL hay source code.

## Kiểm thử

Backend:

```bash
cd backend
npm test
npm run test:e2e
```

Frontend:

```bash
cd frontend
npm test
npm run build
```

ML service:

```bash
cd ml-service
python -m pytest -q
```

## Thành viên

| MSSV | Thành viên | Trách nhiệm chính trong kế hoạch đồ án |
| --- | --- | --- |
| 24127318 | Võ Tấn An | Project Manager / Business Analyst / Documentation Lead |
| 24127147 | Mai Khánh Băng | Frontend — Customer Portal |
| 24127435 | Đoàn Võ Ngọc Lâm | Frontend — Admin Portal & 2D Map |
| 24127204 | Nguyễn Ngọc Minh | Backend — Core System & Database |
| 24127037 | Trần Minh Hiển | Backend — Services, Notifications, AI Agent & Deployment |

**Giảng viên hướng dẫn:** Trương Phước Lộc · Trần Duy Hoàng  
**Môn học:** Nhập môn Công nghệ Phần mềm · Bộ môn Công nghệ Phần mềm · Trường Đại học Khoa học Tự nhiên, ĐHQG-HCM

## Tài liệu

- [Backend README](./backend/README.md)
- [Backend API Documentation](./backend/API_DOCUMENTATION.md)
- [Đặc tả kỹ thuật AI Agent](./AI_AGENT_CODEX_README.md)
- [AI Agent v17 Test Guide](./backend/AI_AGENT_V17_TEST_GUIDE.md)
- [AI Agent v18 Test Guide](./backend/AI_AGENT_V18_TEST_GUIDE.md)
- [Hướng dẫn chạy Backend Local](./HUONG_DAN_CHAY_BACKEND_LOCAL.md)
- [Hướng dẫn đồng bộ Database sau khi Pull](./HUONG_DAN_DONG_BO_DATABASE_SAU_KHI_PULL.md)
- [ML Service README](./ml-service/README.md)

## Quy ước làm việc nhóm

Branch flow đề xuất cho đồ án:

```text
main                  branch ổn định/demo
develop               branch tích hợp
feature/<name>        phát triển chức năng
fix/<name>            sửa lỗi
```

- Không đưa secret lên Git. Chỉ commit `.env.example`, không commit `.env` thật.
- Dùng commit rõ ràng và pull request; tránh đưa code chưa hoàn thiện trực tiếp lên `main`.
- Test module bị ảnh hưởng trước khi merge.
- Thay đổi database phải được quản lý bằng migration theo version.

## Lưu ý về đồ án

Đây là **đồ án học thuật môn Kỹ thuật Phần mềm** và hiện repository chưa kèm giấy phép mã nguồn mở. Các integration bên thứ ba như AI API, SMS và payment có thể được cấu hình, giới hạn, mock hoặc tắt tùy môi trường demo.

## Demo: https://byvn.net/Kco7
---

<div align="center">
  <strong>Vĩnh Phúc Viên</strong><br/>
  Số hóa quản lý nghĩa trang với thiết kế trang trọng, nghiệp vụ rõ ràng và AI được kiểm soát bằng dữ liệu thật.
</div>
