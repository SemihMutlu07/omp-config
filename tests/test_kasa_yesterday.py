"""Dün block: pick one date, count session chores without listing them, stay up on a failed probe."""

import os
import subprocess
import sys
import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "kasa-yesterday.py"


def git(repo: Path, *args: str, when: str | None = None) -> None:
    env = os.environ.copy()
    env.update({
        "GIT_AUTHOR_NAME": "Test",
        "GIT_AUTHOR_EMAIL": "test@example.com",
        "GIT_COMMITTER_NAME": "Test",
        "GIT_COMMITTER_EMAIL": "test@example.com",
    })
    if when:
        env["GIT_AUTHOR_DATE"] = when
        env["GIT_COMMITTER_DATE"] = when
    subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
        env=env,
    )


class KasaYesterdayTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        git(self.repo, "init", "-b", "main")
        self.bins = self.repo / "bin"
        self.bins.mkdir()
        self.env = dict(os.environ, PATH=f"{self.bins}:{os.environ['PATH']}")
        self.probe("systemctl", "")
        self.probe("bash", "ok synthetic layers\\n")

    def probe(self, name: str, output: str, code: int = 0) -> None:
        path = self.bins / name
        path.write_text(f"#!/bin/sh\nprintf '{output}'\nexit {code}\n", encoding="utf-8")
        path.chmod(0o700)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def commit(self, subject: str, day: str) -> None:
        offset = datetime.now().astimezone().strftime("%z")
        git(
            self.repo,
            "-c", "commit.gpgsign=false",
            "commit", "--allow-empty", "-m", subject,
            when=f"{day} 12:00:00 {offset}",
        )

    def run_script(self, root: Path, day: str) -> subprocess.CompletedProcess[str]:
        env = self.env.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        return subprocess.run(
            [sys.executable, "-B", str(SCRIPT), "--root", str(root), "--date", day],
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
            timeout=45,
        )

    def test_selects_the_requested_date(self) -> None:
        self.commit("eski iş", "2026-11-03")
        self.commit("gerçek iş", "2026-11-04")
        handoff = self.repo / "handoff"
        handoff.mkdir()
        note = handoff / "2026-11-01.md"
        note.write_text("eski\n", encoding="utf-8")
        old = time.time() - 5 * 86400 - 10
        os.utime(note, (old, old))

        proc = self.run_script(self.repo, "2026-11-04")

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("Dün (2026-11-04)", proc.stdout)
        self.assertIn("Kasa: 1 commit", proc.stdout)
        self.assertIn("- gerçek iş", proc.stdout)
        self.assertNotIn("eski iş", proc.stdout)
        self.assertIn("Devir: 2026-11-01.md (5 gün)", proc.stdout)
        self.assertIn("uyarı: devir 2 günden eski", proc.stdout)
        self.assertLessEqual(len(proc.stdout.splitlines()), 12)

    def test_session_chores_are_counted_but_not_listed(self) -> None:
        self.commit("gerçek iş", "2026-11-04")
        self.commit("chore(sessions): günlük", "2026-11-04")
        self.commit("chore(sessions): özet", "2026-11-04")

        proc = self.run_script(self.repo, "2026-11-04")

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("Kasa: 3 commit", proc.stdout)
        self.assertIn("- gerçek iş", proc.stdout)
        self.assertNotIn("chore(sessions)", proc.stdout)
        self.assertIn("Devir: yok", proc.stdout)
        self.assertLessEqual(len(proc.stdout.splitlines()), 12)

    def test_failing_subcommand_prints_olculemedi_and_exits_zero(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            proc = self.run_script(Path(raw), "2026-11-04")

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("ölçülemedi", proc.stdout)
        self.assertLessEqual(len(proc.stdout.splitlines()), 12)
        self.assertNotIn("Traceback", proc.stderr)

    def test_failed_unit_names_and_doctor_failures_are_reported(self) -> None:
        self.probe("systemctl", "  ● broken.service loaded failed failed Example\\n")
        self.probe("bash", "FAIL missing layer\\nWARN stale layer\\n", 1)

        proc = self.run_script(self.repo, "2026-11-04")

        self.assertIn("systemd: 1 başarısız: broken.service", proc.stdout)
        self.assertIn("Katmanlar: 1 FAIL, 1 WARN", proc.stdout)

    def test_nonzero_probe_with_stdout_is_not_a_measurement(self) -> None:
        self.probe("systemctl", "partial diagnostic\\n", 1)
        self.probe("bash", "ok partial check\\n", 2)

        proc = self.run_script(self.repo, "2026-11-04")

        self.assertIn("systemd: ölçülemedi:", proc.stdout)
        self.assertIn("Katmanlar: ölçülemedi:", proc.stdout)
        self.assertNotIn("Katmanlar: 0 FAIL", proc.stdout)

    def test_historical_date_uses_its_own_timezone_offset(self) -> None:
        self.env["TZ"] = "America/New_York"
        for subject, stamp in (
            ("önceki gün", "2026-07-04T23:30:00-0400"),
            ("seçilen gün", "2026-07-05T00:30:00-0400"),
            ("sonraki gün", "2026-07-06T00:30:00-0400"),
        ):
            git(self.repo, "-c", "commit.gpgsign=false", "commit", "--allow-empty",
                "-m", subject, when=stamp)

        proc = self.run_script(self.repo, "2026-07-05")

        self.assertIn("- seçilen gün", proc.stdout)
        self.assertNotIn("- önceki gün", proc.stdout)
        self.assertNotIn("- sonraki gün", proc.stdout)


if __name__ == "__main__":
    unittest.main()
