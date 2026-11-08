#!/usr/bin/env python3
"""Record closed Herdr OMP tabs, find lost OMP sessions, and bring them back.

The session file already holds the conversation. This journal keeps the last
user prompt and the tab placement so reopen still works after herdr-app or the
PC restarts.

  lost --since 17:30            list sessions that stopped running (any cause)
  restore --since 17:30         dry run: what would reopen
  restore --since 17:30 --apply reopen each as `omp --resume` in one new space
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time

JOURNAL = os.path.expanduser("~/.omp/agent/herdr-reopen.json")
STATE_DIR = os.path.expanduser("~/.omp/agent/herdr-terminals")
KEEP = 40
PROMPT_LIMIT = 2000


def content_text(content):
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts = []
    for item in content:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict) and item.get("type") in ("text", "input_text"):
            parts.append(item.get("text") or "")
    return "\n".join(part for part in parts if part)


def last_user_prompt(path):
    if not path or not os.path.isfile(path):
        return ""
    size = os.path.getsize(path)
    with open(path, "rb") as handle:
        handle.seek(max(0, size - 4_000_000))
        raw = handle.read().decode("utf-8", "replace")
    text = ""
    for line in raw.splitlines():
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        message = obj.get("message") if obj.get("type") == "message" else None
        if isinstance(message, dict) and message.get("role") == "user":
            text = content_text(message.get("content"))
    return " ".join(text.split())[:PROMPT_LIMIT]


def load_state(address):
    if not address:
        return {}
    path = os.path.join(STATE_DIR, f"{address}.json")
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def load_journal():
    try:
        with open(JOURNAL, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []
    sessions = data.get("sessions") if isinstance(data, dict) else None
    return sessions if isinstance(sessions, list) else []


def save_journal(sessions):
    os.makedirs(os.path.dirname(JOURNAL), exist_ok=True)
    payload = {"sessions": sessions[-KEEP:]}
    tmp = JOURNAL + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)
        handle.write("\n")
    os.replace(tmp, JOURNAL)


def omp_lines():
    try:
        raw = subprocess.check_output(
            ["pgrep", "-a", "-x", "omp"], text=True, stderr=subprocess.DEVNULL
        )
    except (OSError, subprocess.CalledProcessError):
        return []
    me = str(os.getpid())
    lines = []
    for line in raw.splitlines():
        pid, _, rest = line.partition(" ")
        if not pid.isdigit() or pid == me or "herdr-reopen-journal" in rest:
            continue
        lines.append((pid, rest))
    return lines


def session_live(session_id):
    if not session_id:
        return False
    lines = omp_lines()
    live_pids = {pid for pid, _rest in lines}
    if os.path.isdir(STATE_DIR):
        for name in os.listdir(STATE_DIR):
            if not name.endswith(".json"):
                continue
            data = load_state(name[:-5])
            if data.get("sessionId") != session_id:
                continue
            pid = data.get("pid")
            if pid is not None and str(pid) in live_pids:
                return True
    for _pid, rest in lines:
        parts = rest.split()
        if session_id in parts and ("--resume" in parts or "-r" in parts):
            return True
    return False


def write_marker(address):
    if not address:
        return
    os.makedirs(STATE_DIR, exist_ok=True)
    path = os.path.join(STATE_DIR, f"{address}.want-resume")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("1\n")


def record(args):
    state = load_state(args.address)
    session_id = (args.session_id or state.get("sessionId") or "").strip()
    if not session_id:
        print("{}", flush=True)
        return 0
    session_file = state.get("sessionFile") or ""
    item = {
        "sessionId": session_id,
        "sessionFile": session_file or None,
        "cwd": args.cwd or state.get("cwd") or None,
        "tab": args.tab or None,
        "spaceId": args.space_id or None,
        "spaceName": args.space_name or None,
        "address": args.address or state.get("terminalId") or None,
        "prompt": last_user_prompt(session_file),
        "closedAt": int(time.time() * 1000),
    }
    sessions = [old for old in load_journal() if old.get("sessionId") != session_id]
    sessions.append(item)
    save_journal(sessions)
    if not args.no_marker:
        write_marker(item["address"])
    print(json.dumps(item, ensure_ascii=False), flush=True)
    return 0


def latest(_args):
    for item in reversed(load_journal()):
        session_id = item.get("sessionId")
        if session_id and not session_live(session_id):
            print(json.dumps(item, ensure_ascii=False), flush=True)
            return 0
    print("{}", flush=True)
    return 0


def live(args):
    if session_live(args.session_id):
        print("live", flush=True)
        return 0
    print("dead", flush=True)
    return 1


def parse_since(text):
    """HH:MM (today, local), Nh (hours ago), or YYYY-MM-DD[THH:MM]. Returns epoch ms."""
    text = text.strip()
    now = time.time()
    if text.endswith("h") and text[:-1].isdigit():
        return int((now - int(text[:-1]) * 3600) * 1000)
    clock = re.fullmatch(r"(\d{1,2}):(\d{2})", text)
    if clock:
        day = time.strftime("%Y-%m-%d", time.localtime(now))
        stamp = time.mktime(time.strptime(f"{day}T{int(clock[1]):02d}:{clock[2]}", "%Y-%m-%dT%H:%M"))
        if stamp > now:  # 23:45 asked at 00:30 means yesterday
            stamp -= 86400
        return int(stamp * 1000)
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return int(time.mktime(time.strptime(text, fmt)) * 1000)
        except ValueError:
            continue
    raise SystemExit(f"--since anlaşılmadı: {text} (HH:MM, 6h veya YYYY-MM-DDTHH:MM)")


def lost_sessions(since_ms):
    """Recorded OMP sessions that are no longer running, newest first, one row per session.

    Works for every way a tab dies (close, layout change, crash, reboot) because it reads
    the per-terminal records the herdr-terminal-resume extension writes while omp runs.
    """
    if not os.path.isdir(STATE_DIR):
        return []
    lines = omp_lines()
    live_pids = {pid for pid, _rest in lines}
    resumed = {part for _pid, rest in lines for part in rest.split()}
    newest = {}
    for name in os.listdir(STATE_DIR):
        if not name.endswith(".json"):
            continue
        data = load_state(name[:-5])
        session_id = data.get("sessionId")
        updated = data.get("updatedAt") or 0
        if not session_id or updated < since_ms:
            continue
        if not os.path.isfile(data.get("sessionFile") or ""):
            continue
        if session_id not in newest or updated > newest[session_id].get("updatedAt", 0):
            newest[session_id] = data
    rows = []
    for session_id, data in newest.items():
        if str(data.get("pid")) in live_pids or session_id in resumed:
            continue
        if session_live(session_id):
            continue
        rows.append(data)
    rows.sort(key=lambda d: d.get("updatedAt", 0), reverse=True)
    return rows


def lost(args):
    rows = lost_sessions(parse_since(args.since))
    for data in rows:
        stamp = time.strftime("%m-%d %H:%M", time.localtime(data["updatedAt"] / 1000))
        prompt = last_user_prompt(data.get("sessionFile"))[:90]
        print(f"{stamp}  {data['sessionId'][:13]}  {data.get('cwd') or '-'}  {prompt}", flush=True)
    print(f"{len(rows)} kayıp oturum", flush=True)
    return 0


def herdr_do(command, payload):
    result = subprocess.run(
        ["herdr-app", "do", command, json.dumps(payload, ensure_ascii=False)],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"herdr-app do {command} başarısız: {(result.stderr or result.stdout).strip()[:300]}")


def space_id_by_name(name):
    raw = subprocess.check_output(["herdr-app", "ls"], text=True)
    for space in json.loads(raw).get("spaces", []):
        if space.get("name") == name:
            return space.get("id")
    return None


def restore(args):
    rows = lost_sessions(parse_since(args.since))
    if args.limit:
        rows = rows[: args.limit]
    if not rows:
        print("0 kayıp oturum; açılacak bir şey yok", flush=True)
        return 0
    if not args.apply:
        for data in rows:
            print(f"açılacak: omp --resume {data['sessionId']}  ({data.get('cwd') or '-'})", flush=True)
        print(f"{len(rows)} oturum. Açmak için --apply ekle.", flush=True)
        return 0
    name = args.space or "geri gelen " + time.strftime("%m-%d %H:%M")
    first, rest = rows[0], rows[1:]
    space_id = space_id_by_name(name)
    if space_id:
        rest = rows
    else:
        herdr_do("space.new", {
            "name": name,
            "folder": first.get("cwd") or os.path.expanduser("~"),
            "tab": first["sessionId"][:8],
            "argv": ["omp", "--resume", first["sessionId"]],
        })
        space_id = space_id_by_name(name)
        if not space_id:
            raise SystemExit(f"uzay açıldı ama bulunamadı: {name}")
        print(f"açıldı: {first['sessionId'][:8]}", flush=True)
    for data in rest:
        herdr_do("tab.new", {
            "space": space_id,
            "name": data["sessionId"][:8],
            "folder": data.get("cwd") or os.path.expanduser("~"),
            "argv": ["omp", "--resume", data["sessionId"]],
        })
        print(f"açıldı: {data['sessionId'][:8]}", flush=True)
    print(f"{len(rows)} oturum '{name}' uzayına geri geldi", flush=True)
    return 0


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    rec = sub.add_parser("record")
    rec.add_argument("--address", default="")
    rec.add_argument("--session-id", default="")
    rec.add_argument("--cwd", default="")
    rec.add_argument("--tab", default="")
    rec.add_argument("--space-id", default="")
    rec.add_argument("--space-name", default="")
    rec.add_argument("--no-marker", action="store_true")
    rec.set_defaults(func=record)

    last = sub.add_parser("latest")
    last.set_defaults(func=latest)

    alive = sub.add_parser("live")
    alive.add_argument("--session-id", required=True)
    alive.set_defaults(func=live)

    gone = sub.add_parser("lost", help="kayıtlı ama artık çalışmayan OMP oturumları")
    gone.add_argument("--since", required=True)
    gone.set_defaults(func=lost)

    back = sub.add_parser("restore", help="kayıp oturumları yeni bir Herdr uzayında aç")
    back.add_argument("--since", required=True)
    back.add_argument("--space", default="")
    back.add_argument("--limit", type=int, default=0)
    back.add_argument("--apply", action="store_true")
    back.set_defaults(func=restore)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
