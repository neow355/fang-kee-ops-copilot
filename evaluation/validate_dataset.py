#!/usr/bin/env python3
"""Validate the shape and required category counts of dataset.json."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

EXPECTED_COUNTS = {
    "direct_answer": 20,
    "cross_paragraph": 10,
    "refusal": 10,
    "prompt_injection": 5,
    "permission_isolation": 5,
}
REQUIRED_FIELDS = {
    "id",
    "category",
    "question",
    "expected_sources",
    "should_refuse",
    "allowed_role",
    "notes",
}
ROLES = {"public", "client", "staff", "manager", "admin"}


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("dataset.json")
    errors: list[str] = []
    try:
        records = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read valid JSON: {exc}", file=sys.stderr)
        return 1

    if not isinstance(records, list):
        print("ERROR: dataset root must be an array", file=sys.stderr)
        return 1
    if len(records) != 50:
        errors.append(f"expected exactly 50 records, found {len(records)}")

    ids: list[str] = []
    counts: Counter[str] = Counter()
    for index, record in enumerate(records):
        prefix = f"record[{index}]"
        if not isinstance(record, dict):
            errors.append(f"{prefix} must be an object")
            continue
        missing = REQUIRED_FIELDS - record.keys()
        extra = record.keys() - REQUIRED_FIELDS
        if missing:
            errors.append(f"{prefix} missing fields: {sorted(missing)}")
        if extra:
            errors.append(f"{prefix} has unexpected fields: {sorted(extra)}")
        record_id = record.get("id")
        if not isinstance(record_id, str) or not record_id:
            errors.append(f"{prefix}.id must be a non-empty string")
        else:
            ids.append(record_id)
        category = record.get("category")
        counts[category] += 1
        if category not in EXPECTED_COUNTS:
            errors.append(f"{prefix}.category is invalid: {category!r}")
        if not isinstance(record.get("question"), str) or not record.get("question", "").strip():
            errors.append(f"{prefix}.question must be a non-empty string")
        sources = record.get("expected_sources")
        if not isinstance(sources, list) or not sources or not all(isinstance(s, str) and "#" in s for s in sources):
            errors.append(f"{prefix}.expected_sources must be a non-empty list of document#section strings")
        if not isinstance(record.get("should_refuse"), bool):
            errors.append(f"{prefix}.should_refuse must be boolean")
        if record.get("allowed_role") not in ROLES:
            errors.append(f"{prefix}.allowed_role is invalid")
        if not isinstance(record.get("notes"), str) or not record.get("notes", "").strip():
            errors.append(f"{prefix}.notes must be a non-empty string")

    duplicates = sorted(item for item, count in Counter(ids).items() if count > 1)
    if duplicates:
        errors.append(f"duplicate ids: {duplicates}")
    if dict(counts) != EXPECTED_COUNTS:
        errors.append(f"category counts are {dict(counts)}, expected {EXPECTED_COUNTS}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"OK: {len(records)} records; category counts {dict(counts)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
