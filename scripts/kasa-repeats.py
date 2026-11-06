#!/usr/bin/env python3
"""Count repeated user messages per ISO week.

Read-only. Prints normalized keys (max 40 chars), never full message text.
Input: <root>/_vault/sessions/*/e-*.md, line 1 only: <!-- kasa {JSON} -->.
"""
import argparse
import json
import re
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

NUDGE = re.compile(r"napiyorduk|devam|go on|continue|say ok|soo", re.IGNORECASE)
PREFIX = "<!-- kasa "
MIN_COUNT = 3
TOP = 15
KEY_LEN = 40
INJECTED_SPAN = re.compile(
    r"<(attachment|system-reminder|project-context)(?:\s[^>]*)?>.*?(?:</\1\s*>|$)",
    re.DOTALL,
)
INJECTED_MARKERS = (
    "Kasa reference data", "Kasa episodic reference",
    "RFC 2119 keywords", "Retrieved automatically for this request",
)


def request_text(text: str) -> str:
    """Follow hazirlik-ara.py's span/record rules before counting requests."""
    text = INJECTED_SPAN.sub("", text)
    return "" if any(marker in text for marker in INJECTED_MARKERS) else text


def normalize(text: str) -> str:
    """Lowercase, drop non-letters/digits, keep Turkish letters, first 40."""
    return "".join(ch for ch in text.lower() if ch.isalnum())[:KEY_LEN]


def parse_header(line: str):
    line = line.strip()
    if not line.startswith(PREFIX) or not line.endswith("-->"):
        return None
    raw = line[len(PREFIX):]
    raw = raw[:-4] if raw.endswith(" -->") else raw[:-3].rstrip()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def parse_timestamp(value):
    if not isinstance(value, str) or not value:
        return None
    text = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        ts = datetime.fromisoformat(text)
    except ValueError:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone()


def week_of(ts: datetime) -> str:
    iso = ts.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def read_user(path: Path):
    """Line 1 only. None unless role is exactly user and the header parses."""
    try:
        with path.open(encoding="utf-8", errors="replace") as handle:
            line = handle.readline()
    except OSError:
        return None
    payload = parse_header(line)
    if not payload or payload.get("role") != "user":
        return None
    text = payload.get("text")
    ts = parse_timestamp(payload.get("timestamp"))
    if not isinstance(text, str) or ts is None:
        return None
    return {"text": text, "timestamp": ts}


def select_rows(counts: Counter) -> list:
    rows = [
        {"week": week, "key": key, "count": count}
        for (week, key), count in counts.items()
        if count >= MIN_COUNT
    ]
    rows.sort(key=lambda row: (-row["count"], row["week"], row["key"]))
    return rows[:TOP]


def collect(root: Path, since: date) -> dict:
    counts: Counter = Counter()
    nudge_total = 0
    sessions = Path(root) / "_vault" / "sessions"
    paths = sessions.glob("*/e-*.md") if sessions.is_dir() else ()
    for path in paths:
        item = read_user(path)
        if item is None or item["timestamp"].date() < since:
            continue
        text = request_text(item["text"])
        if NUDGE.search(text):
            nudge_total += 1
        key = normalize(text)
        if not key:
            continue
        counts[(week_of(item["timestamp"]), key)] += 1
    return {
        "since": since.isoformat(),
        "nudge_total": nudge_total,
        "rows": select_rows(counts),
    }


def render_markdown(report: dict) -> str:
    lines = ["| week | key | count |", "|---|---|---|"]
    for row in report["rows"]:
        lines.append(f"| {row['week']} | {row['key']} | {row['count']} |")
    lines.append("")
    lines.append(f"nudge_total: {report['nudge_total']}")
    return "\n".join(lines) + "\n"


def render_json(report: dict) -> str:
    return json.dumps(report, ensure_ascii=False, indent=2) + "\n"


def default_since(today: date | None = None) -> date:
    return (today or date.today()) - timedelta(days=7)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(Path.home() / "Kasa"))
    parser.add_argument("--since", default=None, help="YYYY-MM-DD (default: 7 days ago)")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args(argv)
    since = date.fromisoformat(args.since) if args.since else default_since()
    report = collect(Path(args.root).expanduser(), since)
    sys.stdout.write(render_json(report) if args.as_json else render_markdown(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
