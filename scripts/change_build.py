#!/usr/bin/env python3
from __future__ import annotations

from collections import defaultdict
from datetime import date
import re
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
CHANGES_DIR = ROOT_DIR / ".changes"
CHANGELOG_PATH = ROOT_DIR / "CHANGELOG.md"

REQUIRED_FIELDS = ("date", "task", "scope", "type", "area", "summary", "risk")
FIELD_PATTERN = re.compile(r"^([a-z_]+):\s*(.*)$")
SCOPE_ORDER = ("business", "internal")
SCOPE_TITLES = {
    "business": "Business Changes",
    "internal": "Internal Changes",
}


def parse_fragment(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = FIELD_PATTERN.match(line)
        if not match:
            continue
        key, value = match.groups()
        values[key] = value.strip()

    missing = [field for field in REQUIRED_FIELDS if not values.get(field)]
    if missing:
        missing_joined = ", ".join(missing)
        raise ValueError(f"{path}: missing required fields: {missing_joined}")

    try:
        values["date"] = date.fromisoformat(values["date"]).isoformat()
    except ValueError as exc:
        raise ValueError(f"{path}: invalid date '{values['date']}'") from exc

    if values["scope"] not in SCOPE_ORDER:
        raise ValueError(f"{path}: invalid scope '{values['scope']}'")

    values.setdefault("business_value", "")
    values["__path__"] = str(path.relative_to(ROOT_DIR))
    return values


def load_entries() -> list[dict[str, str]]:
    if not CHANGES_DIR.exists():
        return []

    entries: list[dict[str, str]] = []
    for path in sorted(CHANGES_DIR.glob("*.md")):
        if path.name.startswith("_") or path.name == "README.md":
            continue
        entries.append(parse_fragment(path))

    entries.sort(key=lambda item: (item["date"], item["scope"], item["task"], item["__path__"]))
    return entries


def format_entry(entry: dict[str, str]) -> str:
    text = (
        f"- **{entry['task']}** ({entry['type']}, {entry['area']}, risk: {entry['risk']}): "
        f"{entry['summary']}"
    )
    business_value = entry.get("business_value", "").strip()
    if business_value:
        text += f" | value: {business_value}"
    return text


def build_markdown(entries: list[dict[str, str]]) -> str:
    lines = [
        "# Changelog",
        "",
        "Собран из change-фрагментов в `.changes/`.",
        "",
    ]

    grouped: dict[str, dict[str, list[dict[str, str]]]] = defaultdict(lambda: defaultdict(list))
    for entry in entries:
        grouped[entry["scope"]][entry["date"]].append(entry)

    for scope in SCOPE_ORDER:
        lines.append(f"## {SCOPE_TITLES[scope]}")
        date_map = grouped.get(scope, {})
        if not date_map:
            lines.append("")
            lines.append("- Пока нет записей.")
            lines.append("")
            continue

        for change_date in sorted(date_map.keys()):
            lines.append("")
            lines.append(f"### {change_date}")
            for entry in date_map[change_date]:
                lines.append(format_entry(entry))
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    try:
        entries = load_entries()
        markdown = build_markdown(entries)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    CHANGELOG_PATH.write_text(markdown, encoding="utf-8")
    print(f"Wrote {CHANGELOG_PATH.relative_to(ROOT_DIR)} ({len(entries)} entries)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
