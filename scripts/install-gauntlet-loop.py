#!/usr/bin/env python3
"""Install the shared loop instructions and private plugin; preserve other config."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import shutil


START = "<!-- gauntlet-loop:begin -->"
END = "<!-- gauntlet-loop:end -->"


def rule_block(home):
    skill = home / ".agents/skills/gauntlet-loop/SKILL.md"
    return f"""{START}
## Default verification loop

- For top-level implementation, bug fixes, scripts, or executable configuration changes, automatically read and use `gauntlet-loop` at `{skill}` (OMP may read `skill://gauntlet-loop`). A short user request is enough; recover the current context and derive the compact spec without asking for a long prompt or a slash command.
- Follow spec → implement → self-check → independent review → relevant automated/runtime checks → bounded repair. Use the active harness's native tools and existing model/role/concurrency settings. Assigned workers and reviewers perform only their bounded subtask; they do not recursively start the parent loop.
- Allow at most two repair rounds per task. Missing essential tools or independent review, a scope/product/cost decision, or repeated failure requires an explicit BLOCKED/PARTIAL handoff. Never report a skipped check or self-review as independent PASS.
- Independent review requires the actual reviewer session/task identity and its returned result; an empty wait or the implementer's assertion is not evidence.
- Read-only questions, research, and plan-only requests do not initiate implementation. Honor user stop immediately. Evidence must match the current changes; a final PASS means ready for review and does not grant commit, push, deployment, or publication permission.
- This is the default workflow for active sessions, not a background scheduler or a claim of an untested runtime gate. New sessions load changed global guidance; existing sessions are not assumed to have reloaded it.
{END}"""


def with_rule(text, block):
    if START in text or END in text:
        if text.count(START) != 1 or text.count(END) != 1:
            raise ValueError("Ambiguous managed loop block; refusing to replace unrelated text")
        before, rest = text.split(START, 1)
        _, after = rest.split(END, 1)
        return before + block + after
    return text.rstrip() + "\n\n" + block + "\n"


def install(repo, home, check=False):
    source = repo / "skills/gauntlet-loop"
    if not (source / "SKILL.md").is_file():
        raise ValueError(f"Missing canonical skill: {source}")
    installed = home / ".agents/skills/gauntlet-loop"
    plugin = home / ".codex/plugins/gauntlet-loop"
    # The shared store may link back to this repo; writes then land on the single source copy.
    if installed.is_symlink() and installed.resolve() != source.resolve():
        raise ValueError(f"{installed} points outside the repo: {installed.resolve()}")
    if plugin.is_symlink() or (plugin.exists() and not plugin.is_dir()):
        raise ValueError(f"Expected a real installation directory: {plugin}")
    catalog_path = home / ".agents/plugins/marketplace.json"
    catalog = json.loads(catalog_path.read_text()) if catalog_path.exists() else {
        "name": "semih-local", "interface": {"displayName": "Semih Local"}, "plugins": []}
    if (not isinstance(catalog, dict)
            or not isinstance(catalog.get("plugins", []), list)
            or any(not isinstance(item, dict) for item in catalog.get("plugins", []))):
        raise ValueError("Invalid existing plugin catalog; no configuration was changed")
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup = home / ".local/state/gauntlet-loop" / f"deploy-{stamp}"
    changed, mismatches, saved = [], [], []

    def save(path):
        backup.mkdir(parents=True, exist_ok=True)
        target = backup / (hashlib.sha256(str(path).encode()).hexdigest()[:12] + "-" + path.name)
        if path.is_symlink():
            target.write_text(str(path.readlink()))
            kind = "symlink"
        else:
            shutil.copy2(path, target)
            kind = "file"
        saved.append({"path": str(path), "backup": str(target), "kind": kind})

    def put(path, content):
        data = content if isinstance(content, bytes) else content.encode()
        # Keep existing instruction symlinks, such as OMP's AGENTS.md, intact.
        target = path.resolve() if path.is_symlink() else path
        if target.exists() and target.read_bytes() == data:
            return
        if check:
            mismatches.append(str(path))
            return
        if target.exists():
            save(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        changed.append(str(path))

    targets = [home / ".codex/AGENTS.md", repo / "AGENTS.md", home / ".cursor/rules/global.mdc"]
    block = rule_block(home)
    prepared = {}
    for path in targets:
        existing = path.read_text() if path.exists() else ""
        if not existing and path.suffix == ".mdc":
            existing = "---\ndescription: Semih working agreements\nalwaysApply: true\n---\n"
        prepared[path] = with_rule(existing, block)
    for path, content in prepared.items():
        put(path, content)

    # Materialize files so both skill hosts and plugin containment checks work.
    for path in sorted(source.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts:
            relative = path.relative_to(source)
            put(installed / relative, path.read_bytes())
            put(plugin / "skills/gauntlet-loop" / relative, path.read_bytes())
    manifest = {
        "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        "name": "gauntlet-loop", "version": "1.0.0",
        "description": "Spec, implementation, independent review and bounded repair.",
    }
    put(plugin / "plugin.json", json.dumps(manifest, indent=2) + "\n")

    entries = catalog.setdefault("plugins", [])
    entry = next((item for item in entries if item.get("name") == "gauntlet-loop"), None)
    if entry is None:
        entry = {"name": "gauntlet-loop"}
        entries.append(entry)
    entry.update({"source": {"source": "local", "path": "./.codex/plugins/gauntlet-loop"},
                  "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
                  "category": "Productivity"})
    put(catalog_path, json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")

    # Retire only the known old alias; the real source remains in the repository.
    # A symlinked harness root already points at the shared store, so its entry is the store.
    alias = home / ".cursor/skills/gauntlet-loop"
    if alias.is_symlink() and alias.resolve() == source.resolve() and not (home / ".cursor/skills").is_symlink():
        if check:
            mismatches.append(str(alias) + " (duplicate old alias)")
        else:
            save(alias)
            alias.unlink()
            changed.append(str(alias) + " (alias removed; shared skill installed)")
    if saved:
        (backup / "restore-map.json").write_text(json.dumps(saved, indent=2) + "\n")
    return {"changed": changed, "mismatches": mismatches,
            "backup": str(backup) if saved else None,
            "plugin": str(plugin), "catalog": str(catalog_path)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--home", type=Path, default=Path.home())
    parser.add_argument("--check", action="store_true", help="Read-only installation drift check")
    args = parser.parse_args()
    result = install(args.repo.resolve(), args.home.resolve(), args.check)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return bool(result["mismatches"])


if __name__ == "__main__":
    raise SystemExit(main())
