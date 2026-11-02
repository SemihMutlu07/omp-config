"""199,999 is under the cliff. 200,000 is over. Cache reads count."""
import importlib.util
import sqlite3
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("grok_audit", ROOT / "scripts" / "grok-audit.py")
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


def connection():
    con = sqlite3.connect(":memory:")
    con.execute(
        """
        CREATE TABLE messages (
            model TEXT, provider TEXT, timestamp INTEGER,
            input_tokens INTEGER, cache_read_tokens INTEGER, cost_total REAL
        )
        """
    )
    return con


def add(con, model, input_tokens, cache_read, cost=1.0, provider="xai-oauth", timestamp=1000):
    con.execute(
        "INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?)",
        (model, provider, timestamp, input_tokens, cache_read, cost),
    )


class AuditTests(unittest.TestCase):
    def test_boundary_and_cache_reads(self):
        con = connection()
        add(con, "grok-4.7", 199_999, 0, 0.4)
        add(con, "grok-4.7", 100_000, 100_000, 0.8)
        add(con, "grok-4.7", 50_000, 149_999, 0.2)
        rows = audit.audit(con)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["calls"], 3)
        self.assertEqual(row["over_200k_calls"], 1)
        self.assertEqual(row["max_prompt"], 200_000)
        self.assertEqual(row["cost_api_equivalent"], 1.4)

    def test_model_and_since_filters(self):
        con = connection()
        add(con, "grok-4.7", 200_000, 0, timestamp=1000)
        add(con, "grok-4.6", 200_000, 0, timestamp=3000)
        self.assertEqual(audit.audit(con, since=2000)[0]["model"], "grok-4.6")
        self.assertEqual(audit.audit(con, model="grok-4.7")[0]["calls"], 1)

    def test_other_providers_are_excluded(self):
        con = connection()
        add(con, "gpt-6-luna", 250_000, 0, provider="openai-codex")
        self.assertEqual(audit.audit(con), [])


if __name__ == "__main__":
    unittest.main()
