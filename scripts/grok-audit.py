#!/usr/bin/env python3
"""Count Grok requests at or past the inclusive 200k price cliff.

cost_total is an API-equivalent estimate from stats.db. It is not an invoice.
"""
import argparse
import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path

LONG_CONTEXT = 200_000
DEFAULT_DB = Path.home() / ".omp" / "stats.db"


def parse_since(value):
    if value is None:
        return None
    if value.isdigit():
        return int(value)
    parsed = dt.datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.astimezone()
    return int(parsed.timestamp() * 1000)


def audit(connection, since=None, model=None):
    clauses = ["provider LIKE 'xai%'"]
    params = []
    if since is not None:
        clauses.append("timestamp >= ?")
        params.append(since)
    if model:
        clauses.append("model = ?")
        params.append(model)
    where = " AND ".join(clauses)
    rows = connection.execute(
        f"""
        SELECT model,
               COUNT(*) AS calls,
               SUM(CASE WHEN input_tokens + cache_read_tokens >= ? THEN 1 ELSE 0 END) AS over_calls,
               ROUND(SUM(cost_total), 4) AS cost,
               MAX(input_tokens + cache_read_tokens) AS max_prompt
        FROM messages
        WHERE {where}
        GROUP BY model
        ORDER BY model
        """,
        [LONG_CONTEXT, *params],
    ).fetchall()
    return [
        {
            "model": row[0],
            "calls": row[1],
            "over_200k_calls": row[2],
            "cost_api_equivalent": row[3],
            "max_prompt": row[4],
        }
        for row in rows
    ]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--since", help="epoch ms, or ISO-8601")
    parser.add_argument("--model")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--fail-on-violation", action="store_true")
    args = parser.parse_args(argv)
    connection = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    try:
        rows = audit(connection, parse_since(args.since), args.model)
    finally:
        connection.close()
    if args.json:
        print(json.dumps(rows, indent=2))
    else:
        print("model\tcalls\tover_200k\tcost_api_equivalent\tmax_prompt")
        for row in rows:
            print(
                f"{row['model']}\t{row['calls']}\t{row['over_200k_calls']}\t"
                f"{row['cost_api_equivalent']}\t{row['max_prompt']}"
            )
        print("cost_total is an API-equivalent estimate, not an invoice.")
    if args.fail_on_violation and any(row["over_200k_calls"] for row in rows):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
