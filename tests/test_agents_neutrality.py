"""Keep the shared AGENTS.md harness-neutral and OMP routing in its own file.

The 2026-10-22 audit found OMP-only tool names and slash commands inside the
shared contract that every harness loads. These tests fail if that creeps back.
"""

from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SHARED = ROOT / "AGENTS.md"
OMP_ONLY = ROOT / "APPEND_SYSTEM.md"
HOME = Path.home()
OPENCODE_CONFIG = HOME / ".config/opencode/opencode.json"
OPENCODE_ADAPTER = HOME / ".config/opencode/AGENTS.md"
OMP_AGENTS_LINK = HOME / ".omp/agent/AGENTS.md"
OMP_APPENDIX_LINK = HOME / ".omp/agent/APPEND_SYSTEM.md"
KASA_CONTRACT = HOME / "Kasa/AGENTS.md"

# Harness- or vendor-specific tokens that must not appear in the shared contract.
FORBIDDEN = [
    r"\bworkpool\b",
    r"\bjudge_batch\b",
    r"\bcompletion\(",
    r"`?agent\(",
    r"\bskill://",
    r"\bagent://",
    r"\bproc://",
    r"\bxd://",
    r"`/loop\b",
    r"\borchestrate\b",
    r"\bworkflowz\b",
    r"\bultrathink\b",
    r"\bjevify\b",
    r"\bopenai-codex\b",
    r"\bgoogle-antigravity\b",
    r"\bgpt-6\b",
    r"\bclaude-[a-z0-9.-]+-\d\b",
    r"\bdeepseek[/-]",
    r"\bgemini-\d",
    r"\bopenrouter\b",
    r"\bSol 6\.1\b",
    r"\bAstra\b",
    r"\bGemini 3",
    r"\bGrok\b",
    r"\bseparate from Pi\b",
    r"\bGPT\b",
    r"\bfive-hour\b",
    r"\bOMP workflowz\b",
]


class SharedAgentsNeutralityTests(unittest.TestCase):
    def setUp(self):
        self.text = SHARED.read_text(encoding="utf-8")

    def test_shared_contract_has_no_harness_specific_tokens(self):
        hits = [pattern for pattern in FORBIDDEN if re.search(pattern, self.text)]
        self.assertEqual(hits, [], f"harness-specific tokens in {SHARED.name}: {hits}")

    def test_shared_contract_has_no_omp_sections(self):
        for heading in ("When running OMP", "OMP workflowz routing"):
            self.assertNotIn(heading, self.text)

    def test_omp_appendix_keeps_omp_routing(self):
        appendix = OMP_ONLY.read_text(encoding="utf-8")
        for token in ("workpool(", "judge_batch(", "completion("):
            self.assertIn(token, appendix)

    def test_every_harness_declares_where_it_loads_rules(self):
        # The split is only real if the shared file says how each side loads it.
        self.assertIn("APPEND_SYSTEM.md", self.text)
        self.assertIn("~/.config/opencode/", self.text)

    def test_shared_contract_has_no_project_specific_tokens(self):
        # Kasa rules belong to /home/semihmutlu/Kasa/AGENTS.md, not every project.
        project_tokens = [
            r"\bKasa\b",
            r"kasa-capture",
            r"\borkestra\b",
            r"\.kasa/",
            r"publish:\s*true",
        ]
        hits = [pattern for pattern in project_tokens if re.search(pattern, self.text)]
        self.assertEqual(hits, [], f"project-specific tokens in {SHARED.name}: {hits}")

    def test_shared_contract_keeps_gauntlet_block(self):
        self.assertEqual(self.text.count("<!-- gauntlet-loop:begin -->"), 1)
        self.assertEqual(self.text.count("<!-- gauntlet-loop:end -->"), 1)
        self.assertLess(
            self.text.index("<!-- gauntlet-loop:begin -->"),
            self.text.index("<!-- gauntlet-loop:end -->"),
        )
        self.assertIn("Allow at most two repair rounds", self.text)
        self.assertIn("Never report a skipped check or self-review as independent PASS", self.text)

    def test_shared_contract_keeps_authority_boundaries(self):
        for phrase in (
            "## Candidate improvement",
            "## Privacy and scope",
            "verified, awaiting authorized commit",
            "require user authorization",
            "Never clean a dirty worktree",
        ):
            self.assertIn(phrase, self.text)

    def test_shared_contract_keeps_skill_routing(self):
        for token in ("## Skill workflow routing", "`ask-pocock`", "`ask-matt`"):
            self.assertIn(token, self.text)

    def test_opencode_adapter_does_not_duplicate_shared_routing(self):
        adapter = OPENCODE_ADAPTER.read_text(encoding="utf-8")
        for token in ("## Skill workflow routing", "`ask-pocock`", "`ask-matt`", "Kasa", "orkestra"):
            self.assertNotIn(token, adapter)
        self.assertIn("## OpenCode specifics", adapter)

    def test_omp_appendix_does_not_duplicate_shared_routing(self):
        appendix = OMP_ONLY.read_text(encoding="utf-8")
        for token in ("## Skill workflow routing", "`ask-pocock`", "`ask-matt`"):
            self.assertNotIn(token, appendix)

    def test_omp_symlinks_resolve_to_repo(self):
        self.assertEqual(OMP_AGENTS_LINK.resolve(), SHARED.resolve())
        self.assertEqual(OMP_APPENDIX_LINK.resolve(), OMP_ONLY.resolve())

    def test_opencode_config_loads_one_shared_contract(self):
        config = json.loads(OPENCODE_CONFIG.read_text(encoding="utf-8"))
        self.assertEqual(config.get("instructions"), [str(SHARED)])
        self.assertNotIn("AGENTS.md", config.get("instructions", []))

    def test_opencode_config_skills_point_at_shared_store(self):
        """One store: OpenCode lists the same skills every other harness reads."""
        store = HOME / ".agents/skills"
        expected = {
            entry.name
            for entry in store.iterdir()
            if not entry.name.startswith(".") and (entry / "SKILL.md").is_file()
        }
        self.assertTrue(expected, "shared skill store is empty")
        config = json.loads(OPENCODE_CONFIG.read_text(encoding="utf-8"))
        skills = config.get("skills", [])
        self.assertEqual(len(skills), len(expected))
        self.assertEqual({Path(path).name for path in skills}, expected)
        for path in skills:
            skill_dir = Path(path)
            self.assertEqual(skill_dir.parent, store)
            self.assertTrue((skill_dir / "SKILL.md").is_file(), path)

    def test_harness_skill_roots_share_one_store(self):
        """A harness root is a link to the store, never a second hand-made copy."""
        store = (HOME / ".agents/skills").resolve()
        for root in (HOME / ".omp/agent/skills", HOME / ".claude/skills", HOME / ".cursor/skills"):
            self.assertTrue(root.is_symlink(), f"{root} is a real directory, not a link to the store")
            self.assertEqual(root.resolve(), store)

    def test_kasa_contract_covers_pipeline_and_firewall(self):
        text = KASA_CONTRACT.read_text(encoding="utf-8")
        for token in (
            "COLLECT",
            "NORMALIZE",
            "VALIDATE",
            "INTERPRET",
            "REVIEW",
            "PUBLISH",
            "publish --check",
            "publish: true",
            "policy.toml",
            "Tek yazıcı",
            "köken",
            "öneridir",
            "orkestra.md",
        ):
            self.assertIn(token, text)

    def test_kasa_tokens_do_not_leak_globally(self):
        combined = self.text + "\n" + OPENCODE_ADAPTER.read_text(encoding="utf-8")
        for token in ("Kasa", "kasa-capture", "orkestra.md", ".kasa/policy.toml"):
            self.assertNotIn(token, combined)


if __name__ == "__main__":
    unittest.main()
