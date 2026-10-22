"""Exercise installation against temporary homes without invoking any agent."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


INSTALLER = Path(__file__).resolve().parents[1] / "scripts/install-gauntlet-loop.py"


class InstallGauntletLoopTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / "repo"
        self.home = self.root / "home"
        self.source = self.repo / "skills/gauntlet-loop"
        self.source.mkdir(parents=True)
        self.home.mkdir()
        self.write(self.source / "SKILL.md", "---\nname: gauntlet-loop\ndescription: Verify a change.\n---\nRead references/adapters.md.\n")
        self.write(self.source / "references/adapters.md", "# Adapters\nUse native tools; preserve Semih's choices.\n")
        self.repo_guidance = "# Existing OMP guidance\n\nKeep this unfinished draft.\n"
        self.write(self.repo / "AGENTS.md", self.repo_guidance)

    @staticmethod
    def write(path, text):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def invoke_installer(self, *arguments):
        return subprocess.run(
            [sys.executable, "-B", str(INSTALLER), "--repo", str(self.repo), "--home", str(self.home), *arguments],
            capture_output=True,
            text=True,
            check=False,
        )

    def run_installer(self, *arguments):
        result = self.invoke_installer(*arguments)
        self.assertIn(result.returncode, (0, 1), result.stderr or result.stdout)
        self.assertFalse(result.stderr, result.stderr)
        return result.returncode, json.loads(result.stdout)

    def snapshot(self):
        """Include timestamps so rewriting identical data also counts as mutation."""
        result = {}
        for path in sorted(self.root.rglob("*")):
            relative = str(path.relative_to(self.root))
            stat = path.lstat()
            if path.is_symlink():
                result[relative] = ("symlink", str(path.readlink()), stat.st_mtime_ns)
            elif path.is_file():
                result[relative] = ("file", path.read_bytes(), stat.st_mtime_ns)
            else:
                result[relative] = ("directory", stat.st_mtime_ns)
        return result

    def test_second_install_is_a_no_op(self):
        status, first = self.run_installer()
        self.assertEqual(status, 0)
        self.assertTrue(first["changed"])
        before = self.snapshot()

        status, second = self.run_installer()

        self.assertEqual(status, 0)
        self.assertEqual(second["changed"], [])
        self.assertEqual(second["mismatches"], [])
        self.assertIsNone(second["backup"])
        self.assertEqual(self.snapshot(), before)
        self.assertEqual((self.repo / "AGENTS.md").read_text().count("<!-- gauntlet-loop:begin -->"), 1)

    def test_user_text_frontmatter_and_omp_guidance_symlink_survive(self):
        codex_guidance = "# Personal rules\n\nPreserve my Turkish notes: eğitim önce.\n"
        cursor_guidance = "---\ndescription: My custom rules\nalwaysApply: true\ncustom: preserved\n---\n# Existing Cursor text\n"
        self.write(self.home / ".codex/AGENTS.md", codex_guidance)
        self.write(self.home / ".cursor/rules/global.mdc", cursor_guidance)
        omp_guidance = self.home / ".omp/agent/AGENTS.md"
        omp_guidance.parent.mkdir(parents=True)
        omp_guidance.symlink_to(self.repo / "AGENTS.md")
        original_link = omp_guidance.readlink()

        status, result = self.run_installer()

        self.assertEqual(status, 0)
        self.assertTrue(omp_guidance.is_symlink())
        self.assertEqual(omp_guidance.readlink(), original_link)
        for path, original in [
            (self.repo / "AGENTS.md", self.repo_guidance),
            (self.home / ".codex/AGENTS.md", codex_guidance),
            (self.home / ".cursor/rules/global.mdc", cursor_guidance),
        ]:
            self.assertTrue(path.read_text().startswith(original), str(path))
        self.assertIn("## Default verification loop", omp_guidance.read_text())
        restore_map = json.loads((Path(result["backup"]) / "restore-map.json").read_text())
        backed_up_contents = {Path(item["path"]): Path(item["backup"]).read_text() for item in restore_map}
        self.assertEqual(backed_up_contents[self.home / ".cursor/rules/global.mdc"], cursor_guidance)
        self.assertEqual(backed_up_contents[self.repo / "AGENTS.md"], self.repo_guidance)

    def test_direct_instruction_symlink_is_preserved(self):
        target = self.root / "canonical-guidance.md"
        self.write(target, self.repo_guidance)
        guidance = self.repo / "AGENTS.md"
        guidance.unlink()
        guidance.symlink_to(target)

        self.run_installer()

        self.assertTrue(guidance.is_symlink())
        self.assertEqual(guidance.readlink(), target)
        self.assertTrue(target.read_text().startswith(self.repo_guidance))
        self.assertIn("## Default verification loop", target.read_text())

    def test_personal_catalog_preserves_other_plugins_and_custom_metadata(self):
        other = {
            "name": "my-other-plugin",
            "source": {"source": "local", "path": "./my-plugin"},
            "policy": {"installation": "NOT_AVAILABLE", "authentication": "ON_USE"},
            "custom": {"notes": ["keep", "this"]},
        }
        catalog = {
            "name": "my-existing-marketplace",
            "interface": {"displayName": "My existing plugins"},
            "custom": "Do not replace this catalog",
            "plugins": [other],
        }
        catalog_path = self.home / ".agents/plugins/marketplace.json"
        self.write(catalog_path, json.dumps(catalog))

        self.run_installer()

        installed = json.loads(catalog_path.read_text())
        self.assertEqual(installed["name"], catalog["name"])
        self.assertEqual(installed["interface"], catalog["interface"])
        self.assertEqual(installed["custom"], catalog["custom"])
        self.assertEqual(installed["plugins"][0], other)
        self.assertEqual([entry["name"] for entry in installed["plugins"]], ["my-other-plugin", "gauntlet-loop"])
        entry = installed["plugins"][1]
        plugin_path = self.home / entry["source"]["path"]
        self.assertTrue((plugin_path / "plugin.json").is_file())

    def test_skill_and_plugin_materialize_identical_reference_files(self):
        self.run_installer()
        installed = self.home / ".agents/skills/gauntlet-loop"
        plugin = self.home / ".codex/plugins/gauntlet-loop"

        for source in self.source.rglob("*"):
            if source.is_file():
                relative = source.relative_to(self.source)
                for destination in (installed / relative, plugin / "skills/gauntlet-loop" / relative):
                    self.assertFalse(destination.is_symlink(), str(destination))
                    self.assertEqual(destination.read_bytes(), source.read_bytes(), str(destination))
        self.assertFalse(installed.is_symlink())
        self.assertFalse(plugin.is_symlink())
        manifest = json.loads((plugin / "plugin.json").read_text())
        self.assertEqual(manifest["name"], "gauntlet-loop")
        self.assertEqual(manifest["$schema"], "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json")

    def test_only_known_legacy_cursor_alias_is_retired_and_backed_up(self):
        alias = self.home / ".cursor/skills/gauntlet-loop"
        alias.parent.mkdir(parents=True)
        alias.symlink_to(self.source)
        unrelated = alias.parent / "other-skill"
        unrelated.symlink_to(self.source)
        original_skill = (self.source / "SKILL.md").read_bytes()

        _, result = self.run_installer()

        self.assertFalse(alias.is_symlink())
        self.assertFalse(alias.exists())
        self.assertTrue(unrelated.is_symlink())
        self.assertEqual(unrelated.readlink(), self.source)
        self.assertEqual((self.source / "SKILL.md").read_bytes(), original_skill)
        restore_map = json.loads((Path(result["backup"]) / "restore-map.json").read_text())
        entry = next(item for item in restore_map if item["path"] == str(alias))
        self.assertEqual(entry["kind"], "symlink")
        self.assertEqual(Path(entry["backup"]).read_text(), str(self.source))

    def test_unknown_cursor_alias_and_real_directory_are_untouched(self):
        alias = self.home / ".cursor/skills/gauntlet-loop"
        alias.parent.mkdir(parents=True)
        custom = self.home / "custom-skill"
        self.write(custom / "SKILL.md", "User-owned alternative.\n")
        alias.symlink_to(custom)

        self.run_installer()

        self.assertTrue(alias.is_symlink())
        self.assertEqual(alias.readlink(), custom)
        self.assertEqual((custom / "SKILL.md").read_text(), "User-owned alternative.\n")
        alias.unlink()
        self.write(alias / "SKILL.md", "User-owned local directory.\n")

        self.run_installer()

        self.assertFalse(alias.is_symlink())
        self.assertEqual((alias / "SKILL.md").read_text(), "User-owned local directory.\n")

    def test_check_reports_drift_without_mutating_any_fixture(self):
        alias = self.home / ".cursor/skills/gauntlet-loop"
        alias.parent.mkdir(parents=True)
        alias.symlink_to(self.source)
        before = self.snapshot()

        status, pending = self.run_installer("--check")

        self.assertEqual(status, 1)
        self.assertTrue(pending["mismatches"])
        self.assertEqual(pending["changed"], [])
        self.assertIsNone(pending["backup"])
        self.assertEqual(self.snapshot(), before)
        self.run_installer()
        installed = self.snapshot()

        status, clean = self.run_installer("--check")

        self.assertEqual(status, 0)
        self.assertEqual(clean["mismatches"], [])
        self.assertEqual(clean["changed"], [])
        self.assertEqual(self.snapshot(), installed)

    def test_malformed_catalog_is_rejected_before_any_writes(self):
        catalog = self.home / ".agents/plugins/marketplace.json"
        for content in ("{\n", "[]", '{"plugins": {}}', '{"plugins": [null]}'):
            with self.subTest(catalog=content):
                self.write(catalog, content)
                before = self.snapshot()

                result = self.invoke_installer()

                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.snapshot(), before)

    def test_ambiguous_managed_block_is_rejected_before_any_writes(self):
        # Put the failure in the last instruction target to detect partial installs.
        cursor = self.home / ".cursor/rules/global.mdc"
        self.write(cursor, "---\nalwaysApply: true\n---\nUser text\n<!-- gauntlet-loop:begin -->\nUnfinished block.\n")
        before = self.snapshot()

        result = self.invoke_installer()

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.snapshot(), before)

    def test_symlink_installation_destinations_are_rejected_without_touching_target(self):
        for relative in (".agents/skills/gauntlet-loop", ".codex/plugins/gauntlet-loop"):
            with self.subTest(destination=relative):
                destination = self.home / relative
                target = self.root / "user-owned-skill"
                self.write(target / "SKILL.md", "Keep user-owned content exactly.\n")
                self.write(target / "notes.txt", "Unrelated notes.\n")
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.symlink_to(target)
                before = self.snapshot()

                result = self.invoke_installer()

                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.snapshot(), before)
                destination.unlink()


if __name__ == "__main__":
    unittest.main()
