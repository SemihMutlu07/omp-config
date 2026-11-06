#!/usr/bin/env python3
"""Claude Code hook: feed Kasa context to the model through the same helper OMP uses.

SessionStart       -> approved decisions + latest handoff (session_start: true)
UserPromptSubmit   -> notes that match the prompt
Fail-open: if the helper breaks, Claude Code continues and the model is told
the context did NOT load. Never blocks, never writes to Kasa.
"""
import json, os, subprocess, sys
from pathlib import Path

ROOT = Path(os.environ.get("KASA_ROOT", Path.home() / "Kasa"))
HELPER = ROOT / "_vault/scripts/kasa-context.py"
MAX_BYTES = 8000


def emit(event: str, text: str) -> None:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}}, ensure_ascii=False))


def main() -> int:
    try:
        hook = json.load(sys.stdin)
    except Exception:
        hook = {}
    event = hook.get("hook_event_name") or "UserPromptSubmit"
    start = event == "SessionStart"
    request = {"prompt": hook.get("prompt", ""), "cwd": hook.get("cwd", str(Path.home())), "session_start": start}
    try:
        if not HELPER.is_file():
            raise FileNotFoundError(str(HELPER))
        out = subprocess.run(["python3", "-B", str(HELPER)], input=json.dumps(request), capture_output=True,
                             text=True, timeout=20, cwd=str(ROOT), check=True).stdout
        res = json.loads(out)
        text = (res.get("content") or "").strip()
        if res.get("status") != "ready" or not text:
            if start:
                emit(event, "Kasa context: no match / empty.")
            return 0
        emit(event, text.encode()[:MAX_BYTES].decode(errors="ignore"))
    except Exception as exc:  # fail open, but say so
        emit(event, f"Kasa context FAILED TO LOAD ({type(exc).__name__}: {str(exc)[:120]}). Do not assume prior decisions; run kasa-context.py by hand.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
