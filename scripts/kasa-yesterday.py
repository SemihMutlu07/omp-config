#!/usr/bin/env python3
"""Read-only morning "Dün" block. Never writes. A failed probe prints one line and exits 0."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

TIMEOUT = 10
CHORE = "chore(sessions)"
DOCTOR = Path(__file__).resolve().parent / "layers-doctor.sh"


class ProbeError(Exception):
    def __init__(self, reason: object) -> None:
        text = " ".join(str(reason).split())
        super().__init__((text or "bilinmeyen")[:160])


def run(cmd: list[str], *, allow_failure: bool = False,
        env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT, env=env)
    except subprocess.TimeoutExpired:
        raise ProbeError("zaman aşımı") from None
    except FileNotFoundError as exc:
        raise ProbeError(f"komut yok: {exc.filename or cmd[0]}") from None
    except OSError as exc:
        raise ProbeError(exc.strerror or exc) from None
    if result.returncode != 0 and not allow_failure:
        err = (result.stderr or "").strip().splitlines()
        raise ProbeError(err[0] if err else f"çıkış {result.returncode}")
    return result


def day_window(day: date) -> tuple[str, str]:
    # Resolve each boundary in its date's local timezone, including DST.
    start = datetime.combine(day, datetime.min.time()).astimezone()
    end = datetime.combine(day, datetime.max.time().replace(microsecond=0)).astimezone()
    return start.isoformat(), end.isoformat()


def git_subjects(root: Path, day: date) -> list[str]:
    start, end = day_window(day)
    out = run([
        "git", "--no-pager",
        "-c", "i18n.logOutputEncoding=utf-8",
        "-c", "core.quotepath=false",
        "-C", str(root),
        "log",
        f"--since-as-filter={start}",
        f"--until={end}",
        "--format=%s",
    ]).stdout
    return [line.strip() for line in out.splitlines() if line.strip()]


def kasa_lines(root: Path, day: date) -> list[str]:
    try:
        subjects = git_subjects(root, day)
    except ProbeError as exc:
        return [f"Kasa: ölçülemedi: {exc}"]
    listed = [subject for subject in subjects if not subject.startswith(CHORE)]
    lines = [f"Kasa: {len(subjects)} commit"]
    lines.extend(f"- {subject}" for subject in listed[:5])
    return lines


def handoff_lines(root: Path) -> list[str]:
    try:
        folder = root / "handoff"
        if not folder.is_dir():
            return ["Devir: yok"]
        files = [path for path in folder.glob("*.md") if path.is_file()]
        if not files:
            return ["Devir: yok"]
        newest = max(files, key=lambda path: (path.stat().st_mtime, path.name))
        age = int((time.time() - newest.stat().st_mtime) // 86400)
    except OSError as exc:
        return [f"Devir: ölçülemedi: {exc.strerror or exc}"]
    lines = [f"Devir: {newest.name} ({age} gün)"]
    if age > 2:
        lines.append("uyarı: devir 2 günden eski")
    return lines


def systemd_lines() -> list[str]:
    try:
        out = run(["systemctl", "--user", "--failed", "--no-legend"]).stdout
    except ProbeError as exc:
        return [f"systemd: ölçülemedi: {exc}"]
    units = []
    for line in out.splitlines():
        parts = line.split()
        if parts:
            units.append(parts[1] if parts[0] == "●" else parts[0])
    if not units:
        return ["systemd: başarısız birim yok"]
    return [f"systemd: {len(units)} başarısız: {' '.join(units)}"]


def doctor_lines(root: Path) -> list[str]:
    try:
        result = run(["bash", str(DOCTOR)], allow_failure=True,
                     env={**os.environ, "KASA_ROOT": str(root.resolve())})
    except ProbeError as exc:
        return [f"Katmanlar: ölçülemedi: {exc}"]
    fail = 0
    warn = 0
    for line in result.stdout.splitlines():
        head = line.lstrip()
        if head.startswith("FAIL"):
            fail += 1
        elif head.startswith("WARN"):
            warn += 1
    if result.returncode not in (0, 1) or (result.returncode == 1 and fail == 0):
        return [f"Katmanlar: ölçülemedi: çıkış {result.returncode}"]
    return [f"Katmanlar: {fail} FAIL, {warn} WARN"]


def render(root: Path, day: date) -> str:
    lines = [f"Dün ({day.isoformat()})"]
    lines.extend(kasa_lines(root, day))
    lines.extend(handoff_lines(root))
    lines.extend(systemd_lines())
    lines.extend(doctor_lines(root))
    return "\n".join(lines[:12])


def parse_day(text: str | None) -> date:
    if not text:
        return datetime.now().astimezone().date() - timedelta(days=1)
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        raise ProbeError(f"tarih {text}") from None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only Turkish Dün block for the start of the day.")
    parser.add_argument("--root", default=str(Path.home() / "Kasa"))
    parser.add_argument("--date", default=None, metavar="YYYY-MM-DD")
    args = parser.parse_args(argv)
    try:
        text = render(Path(args.root).expanduser(), parse_day(args.date))
    except ProbeError as exc:
        print(f"ölçülemedi: {exc}")
        return 0
    except Exception as exc:
        reason = " ".join(str(exc).split())[:160]
        print(f"ölçülemedi: {type(exc).__name__}: {reason}")
        return 0
    print(text)
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
