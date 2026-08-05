#!/usr/bin/env python3
"""Run the synthetic Ops evaluation set against a configurable HTTP API."""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import math
import os
import re
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REFUSAL_RE = re.compile(
    r"(不能|無法|不可|不可以|拒絕|抱歉|not able|cannot|can't|won't|refus)",
    re.IGNORECASE,
)
SOURCE_RE = re.compile(r"^[A-Za-z0-9._-]+#[A-Za-z0-9._-]+$")
TITLE_SOURCE_ALIASES = {"company-handbook": "handbook"}


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(quantile * len(ordered)))
    return ordered[rank - 1]


def source_id(value: Any) -> str | None:
    if isinstance(value, str):
        return value.strip()
    if not isinstance(value, dict):
        return None
    direct = value.get("source_id") or value.get("id")
    if isinstance(direct, str):
        return direct.strip()
    document = value.get("document_id") or value.get("document")
    section = value.get("section_id") or value.get("section")
    if document and section:
        return f"{document}#{str(section).lstrip('#')}"
    if document and value.get("page") is not None:
        return f"{document}#page-{value['page']}"
    if document:
        return f"{document}#document"
    return None


def list_sources(payload: dict[str, Any], *keys: str) -> list[str]:
    for key in keys:
        raw = payload.get(key)
        if isinstance(raw, list):
            return [item for item in (source_id(v) for v in raw) if item]
    return []


def document_keys(values: list[Any]) -> set[str]:
    keys: set[str] = set()
    for value in values:
        normalized = source_id(value)
        if normalized:
            keys.add(normalized.split("#", 1)[0])
        if isinstance(value, dict) and isinstance(value.get("title"), str):
            title = re.sub(r"[^a-z0-9._-]+", "-", value["title"].lower()).strip("-")
            if title:
                keys.add(TITLE_SOURCE_ALIASES.get(title, title))
    return keys


def post_json(
    opener: urllib.request.OpenerDirector,
    url: str,
    body: dict[str, Any],
    timeout: float,
    token: str | None,
) -> dict[str, Any]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), headers=headers, method="POST"
    )
    with opener.open(request, timeout=timeout) as response:
        decoded = json.loads(response.read().decode("utf-8"))
    if not isinstance(decoded, dict):
        raise ValueError("API response must be a JSON object")
    return decoded


def evaluate_case(case: dict[str, Any], response: dict[str, Any], latency_ms: float) -> dict[str, Any]:
    answer = str(response.get("answer") or response.get("message") or response.get("response") or "")
    raw_citations = response.get("citations") or response.get("sources") or []
    raw_retrieved = response.get("retrieved_sources") or response.get("retrieval") or response.get("contexts") or []
    citations = list_sources(response, "citations", "sources")
    retrieved = list_sources(response, "retrieved_sources", "retrieval", "contexts")
    expected = case["expected_sources"]

    refused_raw = response.get("refused")
    refused = bool(refused_raw) if isinstance(refused_raw, bool) else bool(REFUSAL_RE.search(answer))
    refusal_correct = refused == case["should_refuse"]
    expected_documents = {item.split("#", 1)[0] for item in expected}
    retrieval_documents = document_keys(raw_retrieved or raw_citations)
    retrieval_hit = bool(expected_documents & retrieval_documents)

    citation_shape_valid = bool(citations) and all(SOURCE_RE.fullmatch(c) for c in citations)
    citation_grounded = all(c in retrieved for c in citations) if retrieved else True
    citation_valid = citation_shape_valid and citation_grounded

    usage = response.get("usage") if isinstance(response.get("usage"), dict) else {}
    raw_cost = usage.get("cost_usd", response.get("cost_usd", response.get("cost", 0)))
    try:
        cost_usd = float(raw_cost or 0)
    except (TypeError, ValueError):
        cost_usd = 0.0

    return {
        "id": case["id"],
        "category": case["category"],
        "role": case["allowed_role"],
        "should_refuse": case["should_refuse"],
        "refused": refused,
        "refusal_correct": refusal_correct,
        "expected_sources": expected,
        "retrieved_sources": retrieved,
        "citations": citations,
        "retrieval_hit": retrieval_hit,
        "citation_valid": citation_valid,
        "latency_ms": round(latency_ms, 2),
        "cost_usd": round(cost_usd, 8),
        "answer": answer,
    }


def aggregate(results: list[dict[str, Any]]) -> dict[str, Any]:
    completed = [r for r in results if "error" not in r]
    latencies = [r["latency_ms"] for r in completed]

    def rate(key: str) -> float:
        return round(sum(bool(r[key]) for r in completed) / len(completed), 4) if completed else 0.0

    by_category: dict[str, dict[str, Any]] = {}
    for category in sorted({r["category"] for r in results}):
        group = [r for r in completed if r["category"] == category]
        by_category[category] = {
            "completed": len(group),
            "retrieval_hit_rate": round(sum(r["retrieval_hit"] for r in group) / len(group), 4) if group else 0.0,
            "refusal_correctness": round(sum(r["refusal_correct"] for r in group) / len(group), 4)
            if group
            else 0.0,
            "citation_validity": round(sum(r["citation_valid"] for r in group) / len(group), 4) if group else 0.0,
        }

    return {
        "total": len(results),
        "completed": len(completed),
        "errors": len(results) - len(completed),
        "retrieval_hit_rate": rate("retrieval_hit"),
        "refusal_correctness": rate("refusal_correct"),
        "citation_validity": rate("citation_valid"),
        "latency_ms_p50": round(statistics.median(latencies), 2) if latencies else None,
        "latency_ms_p95": round(percentile(latencies, 0.95), 2) if latencies else None,
        "total_cost_usd": round(sum(r["cost_usd"] for r in completed), 8),
        "by_category": by_category,
    }


def markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Ops Copilot 合成評估報告",
        "",
        "> 非官方技術示範；資料完全合成，不構成任何專業意見。",
        "",
        f"- 產生時間：{report['generated_at']}",
        f"- API：`{report['api_url']}`",
        f"- 完成：{summary['completed']}/{summary['total']}（錯誤 {summary['errors']}）",
        f"- Retrieval hit rate：{summary['retrieval_hit_rate']:.2%}",
        f"- Refusal correctness：{summary['refusal_correctness']:.2%}",
        f"- Citation validity：{summary['citation_validity']:.2%}",
        f"- Latency p50 / p95：{summary['latency_ms_p50']} / {summary['latency_ms_p95']} ms",
        f"- 總成本：USD {summary['total_cost_usd']:.8f}",
        "",
        "## 分類結果",
        "",
        "| 分類 | 完成 | Retrieval hit | 拒答正確 | 引用有效 |",
        "|---|---:|---:|---:|---:|",
    ]
    for name, values in summary["by_category"].items():
        lines.append(
            f"| {name} | {values['completed']} | {values['retrieval_hit_rate']:.2%} | "
            f"{values['refusal_correctness']:.2%} | {values['citation_validity']:.2%} |"
        )
    errors = [r for r in report["results"] if "error" in r]
    if errors:
        lines.extend(["", "## 錯誤", ""])
        lines.extend(f"- `{r['id']}`：{r['error']}" for r in errors)
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    base = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Evaluate the Ops synthetic RAG demo.")
    parser.add_argument("--dataset", type=Path, default=base / "dataset.json")
    parser.add_argument("--api-url", default=os.getenv("EVAL_API_URL", "http://localhost:8000/api/chat"))
    parser.add_argument(
        "--login-url",
        default=os.getenv("EVAL_LOGIN_URL"),
        help="Cookie login endpoint; defaults to /api/auth/login on the API origin.",
    )
    parser.add_argument("--output-dir", type=Path, default=base / "reports")
    parser.add_argument("--timeout", type=float, default=float(os.getenv("EVAL_TIMEOUT_SECONDS", "30")))
    parser.add_argument("--limit", type=int, default=0, help="Run only the first N cases; 0 runs all.")
    args = parser.parse_args()
    if not args.login_url:
        parsed_api_url = urllib.parse.urlsplit(args.api_url)
        args.login_url = urllib.parse.urlunsplit(
            (parsed_api_url.scheme, parsed_api_url.netloc, "/api/auth/login", "", "")
        )

    cases = json.loads(args.dataset.read_text(encoding="utf-8"))
    if args.limit:
        cases = cases[: args.limit]
    token = os.getenv("EVAL_API_TOKEN")
    fallback_email = os.getenv("EVAL_EMAIL", "")
    fallback_password = os.getenv("EVAL_PASSWORD", "")
    admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@demo.example")
    credentials: dict[str, dict[str, str]] = {}
    if os.getenv("EVAL_CREDENTIALS_JSON"):
        parsed = json.loads(os.environ["EVAL_CREDENTIALS_JSON"])
        if not isinstance(parsed, dict):
            raise ValueError("EVAL_CREDENTIALS_JSON must be an object keyed by role")
        credentials = parsed
    sessions: dict[str, urllib.request.OpenerDirector] = {}
    results: list[dict[str, Any]] = []

    for case in cases:
        started = time.perf_counter()
        try:
            role = case["allowed_role"]
            opener = sessions.get(role)
            if opener is None:
                opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
                role_credentials = credentials.get(role)
                if role_credentials is None and fallback_password:
                    role_credentials = {
                        "email": (
                            fallback_email
                            if fallback_email
                            else admin_email
                            if role == "admin"
                            else f"{role}@demo.example"
                        ),
                        "password": fallback_password,
                    }
                if role_credentials:
                    if not isinstance(role_credentials, dict):
                        raise ValueError(f"credentials for role {role!r} must be an object")
                    post_json(
                        opener,
                        args.login_url,
                        {
                            "email": role_credentials.get("email", ""),
                            "password": role_credentials.get("password", ""),
                        },
                        args.timeout,
                        None,
                    )
                sessions[role] = opener
            response = post_json(
                opener,
                args.api_url,
                {"question": case["question"]},
                args.timeout,
                token,
            )
            elapsed = (time.perf_counter() - started) * 1000
            results.append(evaluate_case(case, response, elapsed))
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            elapsed = (time.perf_counter() - started) * 1000
            results.append(
                {
                    "id": case["id"],
                    "category": case["category"],
                    "latency_ms": round(elapsed, 2),
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    try:
        dataset_label = str(args.dataset.resolve().relative_to(base.parent.resolve()))
    except ValueError:
        dataset_label = args.dataset.name
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "api_url": args.api_url,
        "dataset": dataset_label,
        "summary": aggregate(results),
        "results": results,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "evaluation-report.json"
    md_path = args.output_dir / "evaluation-report.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(report), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"Reports: {json_path} and {md_path}")
    return 1 if report["summary"]["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
