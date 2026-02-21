#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import date
import re
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
CHANGES_DIR = ROOT_DIR / ".changes"

SCOPE_VALUES = {"business", "internal"}
TYPE_VALUES = {"feature", "fix", "improvement", "docs", "chore"}
RISK_VALUES = {"low", "medium", "high"}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "change"


def normalize_text(value: str) -> str:
    return " ".join(value.strip().split())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a change fragment in .changes/",
    )
    parser.add_argument("--scope", choices=sorted(SCOPE_VALUES), default="business")
    parser.add_argument("--task", required=True, help="Task id, e.g. ONCO-142")
    parser.add_argument("--type", choices=sorted(TYPE_VALUES), default="improvement")
    parser.add_argument("--area", required=True, help="Product/module area")
    parser.add_argument("--summary", required=True, help="What changed")
    parser.add_argument(
        "--business-value",
        default="",
        help="Business value (optional for internal scope)",
    )
    parser.add_argument("--risk", choices=sorted(RISK_VALUES), default="low")
    parser.add_argument(
        "--date",
        default=date.today().isoformat(),
        help="Date in YYYY-MM-DD, default: today",
    )
    parser.add_argument("--slug", default="", help="Optional filename suffix")
    return parser.parse_args()


def validate_iso_date(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise ValueError(f"Invalid date '{value}'. Expected YYYY-MM-DD.") from exc


def next_available_path(base_name: str) -> Path:
    candidate = CHANGES_DIR / f"{base_name}.md"
    if not candidate.exists():
        return candidate

    index = 2
    while True:
        candidate = CHANGES_DIR / f"{base_name}-{index}.md"
        if not candidate.exists():
            return candidate
        index += 1


def build_fragment_content(args: argparse.Namespace) -> str:
    business_value = normalize_text(args.business_value)
    if args.scope == "business" and not business_value:
        business_value = "TBD"

    lines = [
        f"date: {args.date}",
        f"task: {normalize_text(args.task)}",
        f"scope: {args.scope}",
        f"type: {args.type}",
        f"area: {normalize_text(args.area)}",
        f"summary: {normalize_text(args.summary)}",
        f"business_value: {business_value}",
        f"risk: {args.risk}",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    args = parse_args()

    try:
        args.date = validate_iso_date(args.date)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    base_parts = [args.date, slugify(args.task)]
    if args.slug:
        base_parts.append(slugify(args.slug))
    base_parts.append(args.scope)
    file_path = next_available_path("-".join(base_parts))

    CHANGES_DIR.mkdir(parents=True, exist_ok=True)
    content = build_fragment_content(args)
    file_path.write_text(content, encoding="utf-8")
    print(file_path.relative_to(ROOT_DIR))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
