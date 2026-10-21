from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SCRIPTS = Path(__file__).resolve().parent


class SourceDiscoveryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="website-source-discovery-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = {key: value for key, value in os.environ.items() if key != "INSTITUTEOS_ROOT"}

    def checkout(self, relative: str) -> Path:
        website = self.root / relative
        shutil.copytree(SCRIPTS, website / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
        return website

    def selected(self, website: Path) -> Path:
        result = subprocess.run(
            [sys.executable, "-c", "import sync_instituteos_public_data as s; print(s.DEFAULT_INSTITUTEOS_ROOT)"],
            cwd=website / "scripts", env=self.env, capture_output=True, text=True, check=True,
        )
        return Path(result.stdout.strip())

    def test_embedding_depth_does_not_change_source_selection(self) -> None:
        for relative in ("repos/website", "repos/public/website", "deep/arbitrary/nested/website"):
            with self.subTest(relative=relative):
                website = self.checkout(relative)
                (self.root / "library/registries").mkdir(parents=True, exist_ok=True)
                self.assertEqual(self.selected(website), self.root)

    def test_nearest_valid_ancestor_wins(self) -> None:
        website = self.checkout("outer/repos/public/website")
        (self.root / "library/registries").mkdir(parents=True)
        inner = self.root / "outer"
        (inner / "library/registries").mkdir(parents=True)
        self.assertEqual(self.selected(website), inner)

    def test_sibling_source_remains_supported(self) -> None:
        website = self.checkout("standalone/website")
        source = website.parent / "instituteos"
        (source / "library/registries").mkdir(parents=True)
        self.assertEqual(self.selected(website), source)

    def test_environment_override_does_not_fall_back(self) -> None:
        website = self.checkout("repos/public/website")
        (self.root / "library/registries").mkdir(parents=True)
        override = self.root / "missing"
        self.env["INSTITUTEOS_ROOT"] = str(override)
        result = subprocess.run(
            [sys.executable, "scripts/sync_instituteos_public_data.py", "--check"],
            cwd=website, env=self.env, capture_output=True, text=True, check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("registry directory not found", result.stderr)

    def test_explicit_cli_selection_precedes_environment(self) -> None:
        website = self.checkout("repos/public/website")
        self.env["INSTITUTEOS_ROOT"] = str(self.root / "wrong-environment")
        selected = self.root / "cli-source"
        result = subprocess.run(
            [sys.executable, "scripts/sync_instituteos_public_data.py", "--check", "--instituteos-root", str(selected)],
            cwd=website, env=self.env, capture_output=True, text=True, check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(str(selected), result.stderr)
        self.assertNotIn("wrong-environment", result.stderr)

    def test_embedded_check_detects_registry_drift(self) -> None:
        website = self.checkout("repos/public/website")
        source = self.root / "library/registries"
        source.mkdir(parents=True)
        for name, payload in {
            "tech_trees": {"tech_trees": []}, "entities": {"entities": []},
            "policies": {"policies": []}, "sab_cohorts": {"cohorts": []},
        }.items():
            (source / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")
        content = website / "src/content"
        content.mkdir(parents=True)
        for name, payload in {"repositories": {"repositories": []}, "live-sources": {"sources": []}}.items():
            (content / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")
        assets = self.root / "library/assets"
        assets.mkdir()
        for name in ("ActInferServe.png", "Dark_ActInfServe.png"):
            shutil.copyfile(SCRIPTS.parent / "assets/img/instituteos" / name, assets / name)
        for relative in ("src/content/instituteos", "src/content/pages/domains", "data", "assets/img/newsletters"):
            shutil.copytree(SCRIPTS.parent / relative, website / relative)
        result = subprocess.run(
            [sys.executable, "scripts/sync_instituteos_public_data.py", "--check"],
            cwd=website, env=self.env, capture_output=True, text=True, check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("stale src/content/instituteos/ideas.json", result.stderr)
        self.assertNotIn("registry source not available", result.stdout)

    def test_roster_exports_only_registered_reachable_urls(self) -> None:
        website = self.checkout("website")
        content = website / "src/content"
        content.mkdir(parents=True)
        (content / "live-sources.json").write_text(json.dumps({"sources": [
            {"id": "live", "url": "https://example.org/live", "ok": True,
             "previousUrls": ["https://example.org/previous"]},
            {"id": "withheld", "url": "https://example.org/withheld", "ok": False,
             "previousUrls": ["https://example.org/previous-withheld"]},
        ]}))
        payload = {"cohorts": [{"year": 2025, "members": [
            {"name": "Live", "url": "https://example.org/live"},
            {"name": "Approved replacement", "url": "https://example.org/previous"},
            {"name": "Withheld", "url": "https://example.org/withheld"},
            {"name": "Withheld replacement", "url": "https://example.org/previous-withheld"},
            {"name": "Unregistered", "url": "https://example.org/unregistered"},
        ]}]}
        result = subprocess.run(
            [sys.executable, "-c", "import json,sys; import sync_instituteos_public_data as s; "
             "print(json.dumps(s.sanitize_sab_cohorts(json.loads(sys.argv[1]))))", json.dumps(payload)],
            cwd=website / "scripts", env=self.env, capture_output=True, text=True, check=True,
        )
        members = json.loads(result.stdout)["cohorts"][0]["members"]
        self.assertEqual([member["name"] for member in members],
                         ["Live", "Approved replacement", "Withheld", "Withheld replacement", "Unregistered"])
        self.assertEqual([member["url"] for member in members],
                         ["https://example.org/live", "https://example.org/live", "", "", ""])


if __name__ == "__main__":
    unittest.main()
