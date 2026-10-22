"""Keep the shared AGENTS.md harness-neutral and OMP routing in its own file.

The 2026-10-22 audit found OMP-only tool names and slash commands inside the
shared contract that every harness loads. These tests fail if that creeps back.
"""

from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SHARED = ROOT / "AGENTS.md"
OMP_ONLY = ROOT / "APPEND_SYSTEM.md"

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


if __name__ == "__main__":
    unittest.main()
