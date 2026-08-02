# 合成評估

本評估只使用虛構資料，並非對真實工程品質、安全或合規的認證。

## 資料集

`dataset.json` 恰好包含 50 題：

- 20 題 `direct_answer`
- 10 題 `cross_paragraph`
- 10 題 `refusal`
- 5 題 `prompt_injection`
- 5 題 `permission_isolation`

驗證 schema 與數量：

```bash
python evaluation/validate_dataset.py
```

## API 契約

Runner 先按角色使用 `POST /api/auth/login` 取得 HttpOnly session cookie，再向 `EVAL_API_URL`（預設 `/api/chat`）發送：

```json
{"question":"..."}
```

現有後端回傳：

```json
{
  "answer": "回答或拒答原因",
  "refused": false,
  "citations": [{"document_id":"uuid","title":"文件標題","page":null,"excerpt":"..."}],
  "latency_ms": 42,
  "cost_usd": 0.00042
}
```

Runner 亦相容較完整的 `retrieved_sources`、`usage.cost_usd`、`document_id#section_id` 回應。若沒有明確 `refused` 布林值，會以保守關鍵字推斷。成本缺省為零，因此「零」只表示 API 未回報成本，不代表實際免費。

認證可用兩種方式：

- 單一帳戶：設定 `EVAL_EMAIL` 與 `EVAL_PASSWORD`；適合連通性測試，但不能真實驗證多角色隔離。
- 多角色帳戶：設定 `EVAL_CREDENTIALS_JSON`，例如 `{"public":{"email":"...","password":"..."},"staff":{...}}`。帳戶須事先由測試環境安全建立，其實際角色必須與 key 一致。

也可用 `EVAL_API_TOKEN` 傳 Bearer token（後端必須支援）。不可把任何帳戶或 token 寫入資料集、報告或版本庫。

## 執行

```bash
python evaluation/runner.py \
  --api-url http://localhost:8000/api/chat \
  --output-dir evaluation/reports
```

可用 `EVAL_API_TOKEN` 提供 Bearer token，請勿寫入版本庫。輸出為 `evaluation-report.json` 及 `evaluation-report.md`。指標定義：

- retrieval hit：預期文件至少一項出現在 retrieval 或 citations；現有 API 只回傳 citation 時會以文件標題 alias 比對。
- refusal correctness：實際拒答狀態等於題目預期。
- citation validity：citation 有有效來源識別；API 提供取回來源時，亦須屬於該集合。現有 API 未回傳完整 retrieval trace，因此此指標只驗證結構，不能證明語意支持。
- latency p50/p95：逐題端到端 HTTP 延遲，p95 使用 nearest-rank。
- cost：加總 API 回傳的 USD 成本。
