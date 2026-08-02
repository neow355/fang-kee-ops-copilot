# 方記 AI 營運協作平台（前端）

使用 Next.js 16 App Router、React 19、TypeScript 及原生 CSS 建立的內部學習示範介面。

## 本地啟動

需要 Node.js 20.9 或以上版本。

```bash
npm install
copy .env.example .env.local
npm run dev
```

瀏覽 `http://localhost:3000`。介面不包含示範業務數據；後端無法連線或未回傳資料時，會顯示明確的錯誤或空白狀態。

## 環境變數

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

`NEXT_PUBLIC_API_URL` 會成為所有瀏覽器端 API 請求的 base URL。所有請求均使用 `credentials: "include"`，後端需允許前端來源及憑證式 CORS。

## 預期 API

- `POST /auth/login`
- `GET /dashboard`
- `GET /inquiries`、`POST /inquiries`
- `GET /documents`、`POST /documents`（multipart，欄位名稱 `file`）
- `POST /rag/query`
- `GET /metrics`

列表 API 可直接回傳陣列，或使用 `items`、`data`、`results` 包裝。實際欄位契約應與後端同步；目前後端路由尚未完整提供，因此前端對缺失欄位只顯示「未提供」，不會補入虛構內容。

## 品質檢查

```bash
npm run lint
npm run build
```

## Docker

建置時必須傳入公開 API URL：

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=http://api.example.com/api -t fang-kee-frontend .
docker run --rm -p 3000:3000 fang-kee-frontend
```

## 使用限制

本系統僅供內部學習示範，不構成正式報價、法律、安全或其他專業意見。所有 AI 回應及引用必須由合資格人員覆核。
