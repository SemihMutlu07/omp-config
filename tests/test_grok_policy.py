"""Grok compaction policy: stay under the inclusive 200k cliff."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import importlib.util

SPEC = importlib.util.spec_from_file_location("grok_policy", ROOT / "scripts" / "grok-policy.py")
policy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(policy)


def model(selector, window=500_000):
    provider, model_id = selector.split("/", 1)
    return {
        "provider": provider,
        "kind": "chat",
        "id": model_id,
        "selector": selector,
        "contextWindow": window,
    }


class PolicyTests(unittest.TestCase):
    def test_exact_key_beats_shorter_prefix(self):
        thresholds = {
            "xai-oauth/*": policy.parse_entry("f180000"),
            "xai-oauth/grok-4.7": policy.parse_entry("f150000"),
        }
        self.assertEqual(policy.match_key("xai-oauth/grok-4.7", thresholds), "xai-oauth/grok-4.7")
        self.assertEqual(policy.match_key("xai-oauth/grok-4.6", thresholds), "xai-oauth/*")

    def test_fixed_trigger_under_cliff_passes(self):
        thresholds = {"xai-oauth/grok-4.7": policy.parse_entry("f150000")}
        self.assertEqual(policy.violations_for([model("xai-oauth/grok-4.7")], thresholds), [])

    def test_trigger_at_200000_fails(self):
        thresholds = {"xai-oauth/grok-4.7": policy.parse_entry("f200000")}
        found = policy.violations_for([model("xai-oauth/grok-4.7")], thresholds)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["trigger"], 200_000)

    def test_missing_key_fails(self):
        found = policy.violations_for([model("xai-oauth/grok-4.6")], {})
        self.assertEqual(found[0]["reason"], "no matching key")

    def test_percent_uses_real_window(self):
        entry = policy.parse_entry("40%")
        self.assertEqual(policy.trigger_tokens(entry, 500_000, None), 200_000)

    def test_base_uses_percent_when_set(self):
        entry = policy.parse_entry(150_000)
        self.assertEqual(policy.trigger_tokens(entry, 500_000, 80), 120_000)

    def test_base_default_reserve_is_15_percent_above_109k(self):
        entry = policy.parse_entry(150_000)
        self.assertEqual(policy.trigger_tokens(entry, 500_000, None), 127_500)

    def test_blocked_send_makes_zero_network_calls(self):
        calls = []

        def transport():
            calls.append(1)

        blocked = policy.send_or_block(200_000, transport)
        allowed = policy.send_or_block(199_999, transport)
        self.assertEqual(blocked, {"blocked": True, "network_calls": 0})
        self.assertEqual(allowed["network_calls"], 1)
        self.assertEqual(calls, [1])

    def test_non_chat_and_other_providers_are_ignored(self):
        models = [
            {"provider": "xai-oauth", "kind": "image", "id": "grok-imagine-image", "selector": "xai-oauth/grok-imagine-image", "contextWindow": 1},
            model("openai-codex/gpt-6-luna"),
        ]
        self.assertEqual(policy.violations_for(models, {}), [])


if __name__ == "__main__":
    unittest.main()
