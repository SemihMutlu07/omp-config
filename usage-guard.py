#!/usr/bin/env python3
"""Observe Codex quota; pause and wake only an explicitly owned Herdr session."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time


def command(*args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=40)
    if result.returncode:
        raise RuntimeError(f"{args[0]} {args[1]} exited {result.returncode}")
    return result.stdout


def limits_from(document):
    reports = [r for r in document.get("reports", []) if r.get("provider") == "openai-codex"]
    if len(reports) != 1:
        raise ValueError("Expected exactly one Codex usage report")
    report = reports[0]
    fetched = report.get("fetchedAt")
    if not isinstance(fetched, (int, float)) or abs(time.time() * 1000 - fetched) > 120000:
        raise ValueError("Codex usage is missing or older than two minutes")
    limits = {}
    for item in report.get("limits", []):
        window = item.get("window", {})
        key = window.get("id")
        if key not in ("5h", "7d"):
            continue
        amount = item.get("amount", {})
        fraction = amount.get("usedFraction")
        reset = window.get("resetsAt")
        if not isinstance(fraction, (int, float)) or not 0 <= fraction <= 1:
            raise ValueError("Invalid Codex quota fraction")
        if not isinstance(reset, (int, float)) or reset <= 0:
            raise ValueError("Missing Codex reset time")
        limits[key] = {"used_percent": fraction * 100, "resets_at": reset}
    if set(limits) != {"5h", "7d"}:
        raise ValueError("Both five-hour and weekly quota are required")
    return limits


def snapshot():
    command("omp", "usage", "invalidate", "--provider", "openai-codex")
    return limits_from(json.loads(command("omp", "usage", "--provider", "openai-codex", "--json")))


def needs_pause(limits):
    return any(item["used_percent"] >= 95 for item in limits.values())


def may_resume(limits, paused_limits):
    if needs_pause(limits):
        return False
    if not paused_limits:
        return True
    exhausted = [key for key, value in paused_limits.items() if value["used_percent"] >= 95]
    return all(limits[key]["resets_at"] > paused_limits[key]["resets_at"] for key in exhausted)


def remember_exhausted(previous, current):
    required = dict(previous or {})
    for key, value in current.items():
        if value["used_percent"] >= 95:
            required[key] = value
    return required or None


def same_session(document, session):
    value = document.get("result", {}).get("agent", {}).get("agent_session", {}).get("value", "")
    return value.endswith("_" + session + ".jsonl")


def control(args, action, text=None):
    # Herdr clears an agent name when its occupant exits or is replaced. Never
    # deliver input to a reusable pane ID after a separate identity lookup.
    info = json.loads(command("herdr", "agent", "get", args.agent))
    agent = info.get("result", {}).get("agent", {})
    if (agent.get("name") != args.agent or not same_session(info, args.session)
            or agent.get("pane_id") != args.pane):
        raise RuntimeError("Named agent no longer contains the owned OMP session")
    status = agent.get("agent_status")
    if action == "pause":
        if status not in ("idle", "done"):
            command("herdr", "agent", "send-keys", args.agent, "esc")
    else:
        if status not in ("idle", "done"):
            raise RuntimeError("Owned session is not idle; wake not submitted")
        if dt.datetime.now(dt.timezone.utc) >= args.deadline:
            raise RuntimeError("Wake deadline passed; prompt not submitted")
        command("herdr", "agent", "prompt", args.agent, text)


def save(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".usage-guard-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def self_test():
    now = time.time() * 1000
    def sample(a=94, b=27, reset=now + 10000):
        return {"5h": {"used_percent": a, "resets_at": reset},
                "7d": {"used_percent": b, "resets_at": now + 100000}}
    assert not needs_pause(sample())
    assert needs_pause(sample(95))
    assert needs_pause(sample(10, 95))
    assert not may_resume(sample(94), sample(95))
    assert may_resume(sample(1, reset=now + 20000), sample(95))
    assert not may_resume(sample(1, 95, reset=now + 20000), sample(95, 95))
    assert may_resume(sample(), None)
    observed_high = remember_exhausted(None, sample(95))
    assert not may_resume(sample(94), observed_high)
    assert may_resume(sample(1, reset=now + 20000), observed_high)
    both_high = remember_exhausted(observed_high, sample(1, 95, reset=now + 20000))
    assert not may_resume(sample(1, 94, reset=now + 20000), both_high)
    assert remember_exhausted(None, sample(94)) is None
    assert same_session({"result": {"agent": {"agent_session": {"value": "/x/a_owned.jsonl"}}}}, "owned")
    assert not same_session({"result": {"agent": {"agent_session": {"value": "/x/a_other.jsonl"}}}}, "owned")
    try:
        limits_from({"reports": []})
    except ValueError:
        pass
    else:
        raise AssertionError("Unknown usage must fail closed")
    print("SELF_TEST_PASS: quota boundaries, accumulated reset requirements and identity checks", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--once", action="store_true", help="Observe live usage without sending keys or prompts")
    parser.add_argument("--pane")
    parser.add_argument("--agent", help="Unique owned Herdr agent name, not a reusable pane ID")
    parser.add_argument("--session")
    parser.add_argument("--task-url")
    parser.add_argument("--state", type=Path)
    parser.add_argument("--until", help="Timezone-aware ISO deadline")
    parser.add_argument("--interval", type=int, default=30)
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    if args.once:
        print(json.dumps({"limits": snapshot()}, ensure_ascii=False), flush=True)
        return 0
    if not all((args.pane, args.agent, args.session, args.task_url, args.state, args.until)):
        parser.error("Watch mode requires --pane, --agent, --session, --task-url, --state and --until")
    if not re.fullmatch(r"[a-z][a-z0-9_-]{0,31}", args.agent):
        parser.error("--agent must be a unique Herdr agent name, not a pane ID")
    deadline = dt.datetime.fromisoformat(args.until)
    if deadline.tzinfo is None or args.interval < 5:
        parser.error("Use a timezone-aware deadline and an interval of at least five seconds")
    args.deadline = deadline
    state = {"session": args.session, "pane": args.pane, "agent": args.agent, "task_url": args.task_url,
             "paused": False, "paused_limits": None, "wake_pending": None, "until": args.until}
    if args.state.exists():
        previous = json.loads(args.state.read_text())
        if previous.get("session") == args.session and previous.get("pane") == args.pane:
            for key in ("paused", "paused_limits", "wake_pending"):
                if key in previous:
                    state[key] = previous[key]
    print("GUARD_READY " + json.dumps({"pane": args.pane, "until": args.until}), flush=True)
    while dt.datetime.now(dt.timezone.utc) < deadline:
        try:
            current = snapshot()
            state.update(limits=current, checked_at=dt.datetime.now(dt.timezone.utc).isoformat(), error=None)
            state["paused_limits"] = remember_exhausted(state["paused_limits"], current)
            if needs_pause(current):
                # Reconcile against live status even if a saved pause flag is set:
                # the user may have resumed the same session since the last tick.
                control(args, "pause")
                state.update(paused=True, event="paused_at_quota_threshold")
            elif state["paused"] and state["wake_pending"]:
                state["event"] = "wake_delivery_uncertain_no_replay"
            elif state["paused"] and may_resume(current, state["paused_limits"]):
                prompt = ("Kota nöbetçisi: taze provider usage kapasiteyi doğruladı: "
                          + json.dumps(current) + ". workflowz. Gece yetkisini mevcut Notion spec ve "
                          "son devirden devral: " + args.task_url + ". Ücretsiz OpenCode yürütücülerini "
                          "yönet; yeni uzun prompt/soru isteme. Aynı işi çoğaltma; gerçek sonuçları doğrula. "
                          "GPT yüzde 95 sınırını koru, saved reset/ücretli fallback kullanma. "
                          "Önce usage-guard state dosyasını ve görev kartını oku.")
                # A crash after delivery must not replay the same prompt. An
                # uncertain delivery stays fail-closed for explicit reconciliation.
                state.update(wake_pending=f"{args.session}:{time.time_ns()}", event="wake_pending")
                save(args.state, state)
                control(args, "wake", prompt + " Wake-ID: " + state["wake_pending"])
                state.update(paused=False, paused_limits=None, wake_pending=None,
                             event="woke_after_verified_capacity")
                print("GUARD_WOKE " + json.dumps(current), flush=True)
            save(args.state, state)
        except Exception as error:
            state.update(error=str(error), checked_at=dt.datetime.now(dt.timezone.utc).isoformat())
            try:
                control(args, "pause")
                state.update(paused=True, event="paused_unknown_usage")
            except Exception as stop_error:
                state["stop_error"] = str(stop_error)
            save(args.state, state)
            print("GUARD_ERROR " + str(error), flush=True)
        time.sleep(args.interval)
    state["event"] = "night_window_finished"
    save(args.state, state)
    print("GUARD_FINISHED", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
