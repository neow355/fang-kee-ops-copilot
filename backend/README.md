# 方記 AI 營運助理後端

FastAPI + SQLAlchemy 的可離線示範後端。預設使用 SQLite 及可重現的本地 hash embedding／抽取式回答；生產環境可切換 PostgreSQL，設定 `OPENAI_API_KEY` 後會使用 OpenAI provider。

## 快速啟動

需要 Python 3.11+。

```powershell
cd fang-kee-ops-copilot/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
$env:SECRET_KEY = "請換成至少 32 bytes 的隨機值"
python -m app.seed
uvicorn app.main:app --reload
```

預設 seed 帳戶為 `admin@fangkee.example` / `ChangeMe123!`，只供本機示範。其他示範角色使用 `public|client|staff|manager@fangkee.example`，密碼相同。正式部署必須透過環境變數更換。Swagger UI 位於 `http://localhost:8000/docs`。

### 環境變數

- `DATABASE_URL`：預設 `sqlite:///./fangkee.db`；PostgreSQL 範例 `postgresql+psycopg://user:pass@db/fangkee`
- `SECRET_KEY`：JWT 簽署密鑰，正式環境必填且不可使用預設值
- `SECURE_COOKIES=true`：HTTPS 生產環境必須開啟
- `STORAGE_DIR`：上傳檔案目錄，預設 `./storage`
- `SEED_ON_START=true`：啟動時冪等建立管理員及示範文件
- `SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD`：seed 管理員登入資料
- `OPENAI_API_KEY`：未設定時完全離線；設定後啟用 OpenAI
- `OPENAI_MODEL`：預設 `gpt-4o-mini`
- `RETRIEVAL_THRESHOLD`：低信心拒答門檻，預設 `0.08`

只建立管理員、不建立示範文件：

```powershell
python -m app.seed --no-demo
```

## API 與權限

- 公開：`GET /health`
- 登入：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
- staff/admin：`GET/POST /api/inquiries`、`GET /api/documents`、`POST /api/chat`
- admin：`POST /api/documents`、`GET /api/metrics`

登入 JWT 僅放在 HttpOnly、SameSite=Lax Cookie。staff 只會看到自己的 inquiries 和非 admin 文件；admin 可看全部。文件上傳接受 PDF/TXT/MD、最多 10MB，會清理檔名並存到本地 storage adapter。

RAG chunk 保留文件、頁碼及段落。所有引用均直接取自授權 chunk；無足夠相似內容、偵測到 prompt injection 或引用驗證失敗時拒答。每次聊天記錄 latency、輸入／輸出 token、provider、拒答及估算成本。

`PortableEmbedding` 在 PostgreSQL 自動使用 pgvector `vector(256)`，SQLite 則退化為 JSON；PostgreSQL 建庫前須執行 `CREATE EXTENSION IF NOT EXISTS vector`。大資料量部署應透過 migration 建立 HNSW/IVFFlat cosine index；應用的確定性離線模式仍可保留。正式系統建議再加入 Alembic migration、外部物件儲存及登入節流。

## 測試

```powershell
pytest
```

涵蓋 Argon2、確定性 embedding、登入/Cookie、inquiries、文件上傳、RAG 引用、metrics、RBAC、未授權存取、prompt injection、檔案類型與大小限制。

## Docker

```powershell
docker build -t fangkee-backend .
docker run --rm -p 8000:8000 `
  -e SECRET_KEY="replace-with-random-secret" `
  -e DATABASE_URL="postgresql+psycopg://user:pass@host/db" `
  -e SECURE_COOKIES=true `
  -v fangkee-storage:/app/storage `
  fangkee-backend
```
