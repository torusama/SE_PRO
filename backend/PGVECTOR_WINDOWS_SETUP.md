# Hướng dẫn biên dịch và cài pgvector trên Windows

Tài liệu này hướng dẫn cài extension PostgreSQL **pgvector** từ source chính
thức trên Windows. Tên dự án là `pgvector`, nhưng tên extension dùng trong SQL
là `vector`.

Hướng dẫn đã được kiểm tra với:

- Windows x64;
- PostgreSQL 18.4;
- Visual Studio 2022;
- pgvector 0.8.2.

Nếu dùng phiên bản PostgreSQL khác, hãy thay số `18` trong các đường dẫn bên
dưới bằng đúng phiên bản đang chạy.

## 1. Khi nào cần cài pgvector?

pgvector cho phép PostgreSQL lưu embedding bằng kiểu `VECTOR(n)` và tìm kiếm
độ tương đồng. Trong dự án này, nó được dùng cho Semantic RAG của AI Agent.

Nếu PostgreSQL không có pgvector, backend vẫn chạy bằng SQL fallback và sẽ ghi
cảnh báo:

```text
Deferring optional migration 024_ai_knowledge_embeddings.sql...
Deferring optional migration 025_switch_rag_to_nvidia_bge_m3.sql...
```

Cài pgvector sẽ bật tìm kiếm vector và cho phép hai migration trên chạy.

## 2. Yêu cầu trước khi biên dịch

Cần cài đủ:

1. PostgreSQL, bao gồm `pg_config.exe`, thư mục header và thư viện server.
2. Git for Windows.
3. Visual Studio 2022 hoặc Build Tools for Visual Studio 2022 với workload
   **Desktop development with C++**.
4. Thành phần MSVC x64/x86 build tools và Windows SDK.
5. Tài khoản Windows có thể chấp nhận quyền Administrator khi cài vào
   `C:\Program Files`.

Kiểm tra PostgreSQL và Git trong PowerShell:

```powershell
Get-Command git
Get-Command psql
Get-Command pg_config
pg_config --version
pg_config --pkglibdir
pg_config --sharedir
```

Nếu `psql` hoặc `pg_config` chưa nằm trong `PATH`, gọi bằng đường dẫn đầy đủ:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_config.exe" --version
```

Kiểm tra Visual Studio C++ Build Tools:

```powershell
$vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
```

## 3. Biên dịch và cài đặt

Mở **x64 Native Tools Command Prompt for VS 2022** bằng **Run as
administrator**. Không dùng Command Prompt thường vì bước `install` phải ghi
file vào thư mục PostgreSQL dưới `C:\Program Files`.

Chạy lần lượt:

```bat
set "PGROOT=C:\Program Files\PostgreSQL\18"
cd /d "%TEMP%"
git clone --branch v0.8.2 --depth 1 https://github.com/pgvector/pgvector.git pgvector-0.8.2
cd /d "%TEMP%\pgvector-0.8.2"
nmake /F Makefile.win
nmake /F Makefile.win install
```

Nếu thư mục `%TEMP%\pgvector-0.8.2` đã tồn tại, hãy dùng tên thư mục mới thay
vì clone đè lên source cũ.

Lệnh `nmake install` cài các thành phần chính:

- `vector.dll` vào thư mục library của PostgreSQL;
- `vector.control` và các file SQL vào `share\extension`;
- header của extension vào thư mục include của PostgreSQL.

Source chính thức và các phiên bản mới hơn nằm tại:

<https://github.com/pgvector/pgvector>

## 4. Bật extension trong database

Extension phải được bật riêng cho từng database. Ví dụ với database
`cemetery_db`:

```powershell
psql -U postgres -d cemetery_db -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Không đặt mật khẩu trực tiếp trong câu lệnh hoặc commit mật khẩu vào Git.

Kiểm tra extension:

```powershell
psql -U postgres -d cemetery_db -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

Kết quả mong đợi:

```text
 extname | extversion
---------+-----------
 vector  | 0.8.2
```

## 5. Áp dụng migration của dự án

Từ thư mục `backend`:

```powershell
npm run migration:run
```

Runner sẽ áp dụng:

- `024_ai_knowledge_embeddings.sql`;
- `025_switch_rag_to_nvidia_bge_m3.sql`.

Kiểm tra kiểu cột, index và ledger:

```sql
SELECT format_type(a.atttypid, a.atttypmod) AS embedding_type
FROM pg_attribute a
WHERE a.attrelid = 'ai_knowledge_entries'::regclass
  AND a.attname = 'embedding'
  AND NOT a.attisdropped;

SELECT indexname
FROM pg_indexes
WHERE indexname = 'idx_ai_knowledge_embedding';

SELECT migration_name
FROM schema_migrations
WHERE migration_name IN (
  '024_ai_knowledge_embeddings.sql',
  '025_switch_rag_to_nvidia_bge_m3.sql'
)
ORDER BY migration_name;
```

Kết quả cần có kiểu `vector(1024)`, index
`idx_ai_knowledge_embedding` và cả hai migration trong ledger.

Chạy lại runner để xác nhận tính idempotent:

```powershell
npm run migration:run
```

Kết quả mong đợi:

```text
Database schema is up to date
```

Sau đó khởi động lại backend để AI Agent nhận schema mới và chạy backfill:

```powershell
npm run start:dev
```

## 6. Lỗi thường gặp

### `nmake` không được nhận diện

Bạn đang dùng sai terminal hoặc chưa cài C++ workload. Hãy mở **x64 Native
Tools Command Prompt for VS 2022** và thử lại.

### `Access is denied` khi `nmake install`

Phần biên dịch đã có thể thành công nhưng Windows không cho ghi vào
`C:\Program Files\PostgreSQL\...`. Đóng terminal, mở lại bằng **Run as
administrator**, vào thư mục source đã build và chạy:

```bat
nmake /F Makefile.win install
```

### `extension "vector" is not available`

Kiểm tra:

- `PGROOT` có trỏ đúng PostgreSQL server đang chạy không;
- phiên bản `pg_config` có cùng major version với server không;
- bước `nmake install` đã chạy với quyền Administrator chưa;
- file `vector.control` có nằm trong thư mục `share\extension` của đúng bản
  PostgreSQL không.

Xem phiên bản server thực tế:

```powershell
psql -U postgres -d cemetery_db -c "SHOW server_version;"
```

### Migration vẫn hiện `Deferring optional migration`

Thường là extension được bật nhầm database. Kiểm tra `DATABASE_URL` của backend
đang trỏ tới database nào, sau đó chạy câu lệnh sau trên chính database đó:

```sql
SELECT current_database();
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

## 7. Lưu ý khi deploy

Extension được biên dịch trên Windows chỉ cài cho PostgreSQL của máy Windows
đó. Không copy `vector.dll` vào source Node.js và không đưa nó lên một managed
PostgreSQL server khác.

Khi deploy có hai trường hợp:

1. Database provider hỗ trợ pgvector: migration runner sẽ tự chạy
   `CREATE EXTENSION vector` và áp dụng migration vector.
2. Provider không hỗ trợ pgvector: runner hoãn riêng hai migration vector, các
   migration khác vẫn chạy và AI Agent dùng SQL fallback.

Với PostgreSQL tự quản lý trên Linux hoặc Docker, hãy cài pgvector theo hướng
dẫn tương ứng từ repository chính thức thay vì dùng file DLL của Windows.

