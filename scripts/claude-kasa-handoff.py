#!/usr/bin/env python3
"""Claude Code Stop hook: persist the turn-closing block into today's Kasa handoff.

The agent's last answer is read from the transcript. A complete closing block
(`Yaptım:` / `Kanıt:` / `Sırada:`) is written into the marked block near the top
of ``$KASA_ROOT/handoff/YYYY-MM-DD.md``, which Kasa context injects at the next
session start. A work turn that ends without the block gets one continuation
turn to close itself. A hook failure never blocks the session.
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from datetime import datetime
from pathlib import Path

BEGIN = "<!-- kasa-handoff:auto:begin -->"
END = "<!-- kasa-handoff:auto:end -->"
ENTRY_CLIP = 240
INTENT_KEEP = 2
BLOCK_BUDGET = 1000
ENTRY_BYTES = 450
NUDGE = (
    "Kapanış bloğu eksik. Cevabını bir kez oku; en sona tam olarak şu üç satırı ekle: "
    "`Yaptım: …`, `Kanıt: …`, `Sırada: …`. Doğrulamadığın işe bitmiş deme, yeni iş açma."
)
LABELS = (("Yaptım:", "done"), ("Kanıt:", "proof"), ("Sırada:", "next"))


def text_of(content: object) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts = []
    for part in content:
        if isinstance(part, dict) and part.get("type") == "text" and isinstance(part.get("text"), str):
            parts.append(part["text"])
    return "\n".join(parts)


def rows(transcript: Path) -> list[dict]:
    out = []
    try:
        with transcript.open(encoding="utf-8") as handle:
            for line in handle:
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(row, dict):
                    out.append(row)
    except OSError:
        return []
    return out


def last_assistant_text(entries: list[dict]) -> str:
    for entry in reversed(entries):
        message = entry.get("message") if isinstance(entry.get("message"), dict) else entry
        if message.get("role") == "assistant":
            return text_of(message.get("content"))
    return ""


def turn_used_tools(entries: list[dict]) -> bool:
    """True when the latest user prompt was followed by a tool use or result."""
    used = False
    for entry in reversed(entries):
        message = entry.get("message") if isinstance(entry.get("message"), dict) else entry
        content = message.get("content")
        role = message.get("role")
        if role == "user":
            if isinstance(content, list) and any(
                isinstance(part, dict) and part.get("type") == "tool_result" for part in content
            ):
                used = True
                continue
            if text_of(content).strip():
                return used
        elif role == "assistant" and isinstance(content, list):
            if any(isinstance(part, dict) and part.get("type") == "tool_use" for part in content):
                used = True
    return used


def parse_block(text: str) -> dict[str, str] | None:
    found: dict[str, str] = {}
    for raw in text.splitlines():
        line = re.sub(r"^\s*[-*]\s+", "", raw).replace("**", "").strip()
        for label, key in LABELS:
            if line.startswith(label):
                found[key] = re.sub(r"\s+", " ", line[len(label):]).strip()[:ENTRY_CLIP]
    if not all(found.get(key) for key in ("done", "proof", "next")):
        return None
    return found


def clamp_bytes(line: str, limit: int) -> str:
    """Cut to a UTF-8 byte cap on a character boundary."""
    if len(line.encode("utf-8")) <= limit:
        return line
    out = ""
    for char in line:
        if len((out + char).encode("utf-8")) > limit - 3:
            break
        out += char
    return out + "…"


def format_entry(block: dict[str, str], now: datetime, agent: str) -> str:
    line = (
        f"- {now:%H:%M} [{agent}] Yaptım: {block['done']} | "
        f"Kanıt: {block['proof']} | Sırada: {block['next']}"
    )
    return clamp_bytes(line, ENTRY_BYTES)


def fit(lines: list[str]) -> list[str]:
    """Newest first. The newest line never drops; old closings drop before intents."""
    def is_intent(line: str) -> bool:
        return "] Niyet: " in line

    kept: list[str] = []
    intents = 0
    for line in lines:
        if is_intent(line):
            intents += 1
            if intents > INTENT_KEEP:
                continue
        kept.append(line)
    while len(kept) > 1 and len("\n".join(kept).encode("utf-8")) > BLOCK_BUDGET:
        drop = next((i for i in range(len(kept) - 1, 0, -1) if not is_intent(kept[i])), len(kept) - 1)
        del kept[drop]
    return kept


def apply_entry(file_text: str, entry: str) -> str:
    existing = re.search(re.escape(BEGIN) + r"[\s\S]*?" + re.escape(END), file_text)
    earlier = [line for line in existing.group(0).split("\n") if line.startswith("- ")] if existing else []
    if earlier and earlier[0] == entry:
        return file_text
    fresh = f"{BEGIN}\n" + "\n".join(fit([entry, *earlier])) + f"\n{END}"
    if existing:
        return file_text[: existing.start()] + fresh + file_text[existing.end():]
    frontmatter = re.match(r"^---\n[\s\S]*?\n---\n", file_text)
    if frontmatter:
        head = file_text[: frontmatter.end()]
        tail = file_text[frontmatter.end():].lstrip("\n")
        return f"{head}\n{fresh}\n\n{tail}"
    return f"{fresh}\n" if not file_text else f"{fresh}\n\n{file_text}"


def seed(now: datetime) -> str:
    date = f"{now:%Y-%m-%d}"
    return (
        f"---\ntitle: Devir — {date}\ndate: {date}\nstatus: handoff\n"
        f"epistemic: measured\ntags: [handoff, claude]\n---\n"
    )


def write_entry(root: Path, block: dict[str, str], now: datetime) -> bool:
    handoff = root / "handoff"
    if not handoff.is_dir():
        return False
    path = handoff / f"{now:%Y-%m-%d}.md"
    before = path.read_text(encoding="utf-8") if path.is_file() else seed(now)
    after = apply_entry(before, format_entry(block, now, "claude"))
    if after == before:
        return False
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=handoff, prefix=".kasa-handoff-", delete=False) as handle:
        handle.write(after)
        temp = Path(handle.name)
    temp.replace(path)
    return True


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return 0
    transcript = payload.get("transcript_path")
    if not isinstance(transcript, str) or not transcript:
        return 0
    entries = rows(Path(transcript))
    text = last_assistant_text(entries)
    if not text:
        return 0
    block = parse_block(text)
    if block:
        try:
            write_entry(Path(os.environ.get("KASA_ROOT", Path.home() / "Kasa")), block, datetime.now())
        except OSError:
            pass
        return 0
    if payload.get("stop_hook_active") or not turn_used_tools(entries):
        return 0
    print(json.dumps({"decision": "block", "reason": NUDGE}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
