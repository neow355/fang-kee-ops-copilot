#!/usr/bin/env python3
"""Run repository checks that require only the Python standard library."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    validator = subprocess.run(
        [sys.executable, str(ROOT / "evaluation" / "validate_dataset.py")],
        cwd=ROOT,
        check=False,
    )
    if validator.returncode:
        return validator.returncode

    query_path = ROOT / "demo-data" / "queries.jsonl"
    for line_number, line in enumerate(query_path.read_text(encoding="utf-8").splitlines(), 1):
        record = json.loads(line)
        if record.get("synthetic") is not True or not record.get("disclaimer"):
            print(f"ERROR: queries.jsonl line {line_number} lacks synthetic marking/disclaimer", file=sys.stderr)
            return 1

    env_text = (ROOT / ".env.example").read_text(encoding="utf-8")
    secret_keys = (
        "POSTGRES_PASSWORD",
        "SECRET_KEY",
        "SEED_ADMIN_PASSWORD",
        "OPENAI_API_KEY",
        "EVAL_API_TOKEN",
        "EVAL_PASSWORD",
        "EVAL_CREDENTIALS_JSON",
    )
    for key in secret_keys:
        values = [line.split("=", 1)[1] for line in env_text.splitlines() if line.startswith(f"{key}=")]
        if values != [""]:
            print(f"ERROR: {key} must be present and empty in .env.example", file=sys.stderr)
            return 1

    print("OK: synthetic query markings and secret placeholders are valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
