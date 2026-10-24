#!/usr/bin/env python3
"""Mirror the shared skill store into harnesses that cannot read a directory.

The single source is ``~/.agents/skills``. OMP, Claude Code and Cursor read that
directory directly, so they need no sync. Codex keeps user skills in a real
directory that also holds its ``.system`` skills, and OpenCode lists skill
directories in ``opencode.json``. This script keeps those two in step.

Only names that exist in the store are managed. Entries a harness owns itself
(Codex ``.system``, Omarchy system links) are never removed.
"""

import argparse
import datetime
import json
import os
from pathlib import Path

import shutil


def store_skills(store: Path) -> list[str]:
    names = []
    for entry in sorted(store.iterdir()):
        if entry.name.startswith("."):
            continue
        if (entry / "SKILL.md").exists():
            names.append(entry.name)
    return names


def codex_plan(home: Path, names: list[str]) -> tuple[list[str], list[str]]:
    """Return (missing, wrong) names for the Codex skills directory."""
    root = home / ".codex/skills"
    store = home / ".agents/skills"
    missing, wrong = [], []
    for name in names:
        link = root / name
        if link.is_symlink():
            if link.resolve() != (store / name).resolve():
                wrong.append(name)
        elif link.exists():
            if (link / "SKILL.md").exists():
                continue  # Codex's own copy; leave it alone.
            wrong.append(name)
        else:
            missing.append(name)
    return missing, wrong


def dangling_links(store: Path) -> list[str]:
    """Store entries whose symlink target is gone or no longer holds SKILL.md.

    Some skills link to another checkout (for example a plugin repo). When that
    checkout moves, the entry still looks installed to every harness, so the
    store itself has to be checked, not only the links this repo owns.
    """
    broken = []
    for entry in sorted(store.iterdir()):
        if entry.name.startswith("."):
            continue
        if not entry.is_symlink():
            continue  # A real directory without SKILL.md is not a skill and not our call.
        if not entry.exists() or not (entry / "SKILL.md").is_file():
            broken.append(entry.name)
    return broken


def repo_plan(home: Path, repo: Path, store: Path) -> tuple[list[str], list[str]]:
    """Skills owned by this checkout that are missing from, or mislinked in, the store."""
    missing, wrong = [], []
    for entry in sorted(repo.glob("*/")):
        if not (entry / "SKILL.md").exists():
            continue
        target = store / entry.name
        if target.is_symlink():
            if target.resolve() != entry.resolve():
                wrong.append(entry.name)
        elif target.exists():
            continue  # A real copy in the store wins; never clobber content.
        else:
            missing.append(entry.name)
    return missing, wrong


def opencode_plan(home: Path, names: list[str]) -> list[str] | None:
    """Return the expected skills array, or None when the config is unreadable."""
    config = home / ".config/opencode/opencode.json"
    if not config.exists():
        return None
    current = json.loads(config.read_text()).get("skills")
    if not isinstance(current, list):
        return None
    store = home / ".agents/skills"
    return [str(store / name) for name in names]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path.home())
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true", help="Report drift without writing")
    args = parser.parse_args()
    home = args.home
    store = home / ".agents/skills"

    dangling = dangling_links(store) if store.exists() else []
    repo_missing, repo_wrong = repo_plan(home, args.repo / "skills", store)
    if not args.check:
        store.mkdir(parents=True, exist_ok=True)
        for name in repo_missing:
            os.symlink(os.path.realpath(args.repo / "skills" / name), store / name)
        for name in repo_wrong:
            link = store / name
            link.unlink()
            os.symlink(os.path.realpath(args.repo / "skills" / name), link)

    names = store_skills(store)
    if not names:
        raise SystemExit("Shared store is empty; refusing to mirror nothing")

    missing, wrong = codex_plan(home, names)
    expected = opencode_plan(home, names)
    config = home / ".config/opencode/opencode.json"
    opencode_drift = False
    if expected is not None:
        opencode_drift = json.loads(config.read_text()).get("skills") != expected

    drift = bool(dangling or repo_missing or repo_wrong or missing or wrong or opencode_drift)
    print(f"store: {len(names)} skills, {len(dangling)} dangling")
    print(f"repo: {len(repo_missing)} missing, {len(repo_wrong)} pointing elsewhere")
    print(f"codex: {len(missing)} missing, {len(wrong)} pointing elsewhere")
    print(f"opencode: {'drift' if opencode_drift else 'in sync'}")

    if args.check:
        for name in dangling[:10]:
            print(f"  dangling in store: {name} -> {os.readlink(store / name)}")
        for name in repo_missing[:10]:
            print(f"  missing in store: {name}")
        for name in missing[:10]:
            print(f"  missing in codex: {name}")
        for name in wrong[:10]:
            print(f"  wrong target in codex: {name}")
        return 1 if drift else 0
    if not (missing or wrong or opencode_drift):
        return 1 if dangling else 0

    root = home / ".codex/skills"
    root.mkdir(parents=True, exist_ok=True)
    for name in missing:
        os.symlink(home / ".agents/skills" / name, root / name)
    for name in wrong:
        link = root / name
        if link.is_symlink():
            link.unlink()
            os.symlink(home / ".agents/skills" / name, link)

    if expected is not None and opencode_drift:
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = home / ".config/opencode" / f"opencode.json.bak.{stamp}"
        shutil.copy2(config, backup)
        data = json.loads(config.read_text())
        data["skills"] = expected
        config.write_text(json.dumps(data, indent=2) + "\n")
        print(f"opencode: {len(expected)} entries written, backup {backup}")
    print(f"codex: {len(missing)} linked, {len(wrong)} relinked")
    if dangling:
        print(f"dangling: {len(dangling)} store entries lose their target; fix the source or remove the link")
    return 1 if dangling else 0


if __name__ == "__main__":
    raise SystemExit(main())
