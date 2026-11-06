"""Repeated user keys from Kasa session headers. Keys only, never full text."""
import importlib.util
import json
import tempfile
import unittest
import os
import subprocess
import sys
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("kasa_repeats", ROOT / "scripts" / "kasa-repeats.py")
repeats = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(repeats)

TAIL = "ZZZUNIQUEBEYONDFORTYMARKER"
TIMESTAMP = "2026-11-04T12:00:00.000Z"

def event(role: str, text: str, timestamp: str = TIMESTAMP) -> str:
    payload = {"role": role, "timestamp": timestamp, "text": text}
    body = "BODYSECRETNOTINLINE1 " + TAIL
    return "<!-- kasa " + json.dumps(payload, ensure_ascii=False) + " -->\n" + body + "\n"


class KasaRepeatsTests(unittest.TestCase):
    def test_five_files_counts_role_truncation_and_malformed(self):
        texts = [
            ("Tekrarşı! " * 8) + TAIL + " napiyorduk",
            ("TEKRARŞı " * 8) + TAIL + " NAPIYORDUK",
            ("tekrarşı-" * 8) + TAIL + " devam",
        ]
        key = "tekrarşıtekrarşıtekrarşıtekrarşıtekrarşı"
        week = "2026-W45"

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            session = root / "_vault" / "sessions" / "s1"
            session.mkdir(parents=True)
            files = {
                "e-1.md": event("user", texts[0]),
                "e-2.md": event("user", texts[1]),
                "e-3.md": event("user", texts[2]),
                "e-4.md": event("assistant", texts[0]),
                "e-5.md": "<!-- kasa {not-json " + TAIL + "} -->\n" + TAIL + "\n",
            }
            for name, content in files.items():
                (session / name).write_text(content, encoding="utf-8")

            output = self.run_cli(root, "--since", "2026-11-01")
            json_output = self.run_cli(root, "--since", "2026-11-01", "--json")

        parsed = json.loads(json_output)
        self.assertEqual(parsed["nudge_total"], 3)
        self.assertEqual(parsed["rows"], [{"week": week, "key": key, "count": 3}])
        for rendered in (output, json_output):
            self.assertNotIn(TAIL, rendered)
            self.assertNotIn("BODYSECRETNOTINLINE1", rendered)
            self.assertNotIn("napiyorduk", rendered.lower())
            self.assertNotIn(texts[0], rendered)

    def test_top_15_drops_below_three(self):
        counts = {("2026-W45", f"k{i:02d}"): 3 for i in range(16)}
        counts[("2026-W45", "low")] = 2
        counts[("2026-W44", "high")] = 9
        rows = repeats.select_rows(counts)
        self.assertEqual(len(rows), 15)
        self.assertEqual(rows[0], {"week": "2026-W44", "key": "high", "count": 9})
        self.assertNotIn("low", [row["key"] for row in rows])
        self.assertNotIn("k15", [row["key"] for row in rows])

    def test_injected_context_does_not_count_as_a_request_or_nudge(self):
        with tempfile.TemporaryDirectory() as tmp:
            session = Path(tmp) / "_vault" / "sessions" / "s1"
            session.mkdir(parents=True)
            texts = [
                "<project-context>devam</project-context>Aynı talep",
                "<system-reminder>continue</system-reminder>Aynı talep",
                "<attachment name='a'>go on</attachment>Aynı talep",
                "<attachment>devam",
                "Kasa reference data: devam",
                "RFC 2119 keywords: continue",
            ]
            for i, text in enumerate(texts):
                (session / f"e-{i}.md").write_text(event("user", text), encoding="utf-8")
            report = json.loads(self.run_cli(Path(tmp), "--since", "2026-11-01", "--json"))
        self.assertEqual(report["rows"], [{"week": "2026-W45", "key": "aynıtalep", "count": 3}])
        self.assertEqual(report["nudge_total"], 0)

    def test_since_and_iso_week_share_the_local_timezone(self):
        with tempfile.TemporaryDirectory() as tmp:
            session = Path(tmp) / "_vault" / "sessions" / "s1"
            session.mkdir(parents=True)
            for i in range(3):
                (session / f"e-{i}.md").write_text(
                    event("user", "Devam", "2026-11-01T22:30:00Z"), encoding="utf-8")
            proc = subprocess.run(
                [sys.executable, "-B", str(ROOT / "scripts/kasa-repeats.py"),
                 "--root", tmp, "--since", "2026-11-02", "--json"],
                env={**os.environ, "TZ": "Europe/Istanbul"},
                capture_output=True, text=True, check=True,
            )
        report = json.loads(proc.stdout)
        self.assertEqual(report["rows"], [{"week": "2026-W45", "key": "devam", "count": 3}])
        self.assertEqual(report["nudge_total"], 3)

    def run_cli(self, root: Path, *args: str) -> str:
        buf = StringIO()
        with redirect_stdout(buf):
            code = repeats.main(["--root", str(root), *args])
        self.assertEqual(code, 0)
        return buf.getvalue()


if __name__ == "__main__":
    unittest.main()
