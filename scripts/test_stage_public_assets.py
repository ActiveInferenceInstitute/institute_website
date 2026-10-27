"""Real-file controls for public artifact custody and source identity."""

import json
import tempfile
import unittest
from pathlib import Path

from source_identity import website_source_fingerprint
from stage_public_assets import stage


class StageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="public-stage-")
        self.addCleanup(self.temp.cleanup)
        self.parent = Path(self.temp.name)
        self.root = self.parent / "source"
        self.root.mkdir()
        for folder in ["src", "assets", "data", ".well-known", "scripts", "docs", "simulations"]:
            (self.root / folder).mkdir()
        for name in ["package.json", "src/page.mjs", "index.html", "robots.txt", "sitemap.xml", "feed.xml", "feed.json", "manifest.webmanifest", ".nojekyll", "CNAME", ".well-known/security.txt", "data/projects.json", "data/export-manifest.json", "data/redirects.json"]:
            (self.root / name).write_text("{}")
        (self.root / "data/public-html-files.json").write_text('["index.html"]')
        (self.root / "docs/private-audit.html").write_text("must not ship")
        (self.root / "scripts/private.txt").write_text("must not ship")
        self.version()

    def version(self):
        (self.root / "version.json").write_text(json.dumps({"website_source_fingerprint": website_source_fingerprint(self.root)}))

    def test_only_reviewed_public_output_is_staged_and_existing_evidence_is_preserved(self):
        out = self.parent / "artifact"
        self.assertGreater(stage(self.root, out), 10)
        self.assertTrue((out / "index.html").is_file())
        self.assertFalse((out / "src").exists())
        self.assertFalse((out / "docs").exists())
        self.assertFalse((out / "scripts").exists())
        with self.assertRaises(FileExistsError):
            stage(self.root, out)
        self.assertTrue((out / "index.html").is_file())

    def test_stale_source_and_unsafe_inventory_fail_before_writing(self):
        out = self.parent / "artifact"
        (self.root / "src/page.mjs").write_text("changed")
        with self.assertRaisesRegex(ValueError, "Stale"):
            stage(self.root, out)
        self.assertFalse(out.exists())
        self.version()
        for bad in ["../outside.html", "/outside.html", "src/private.html"]:
            (self.root / "data/public-html-files.json").write_text(json.dumps([bad]))
            with self.assertRaises(ValueError):
                stage(self.root, out)
            self.assertFalse(out.exists())

    def test_malformed_release_identity_does_not_create_an_artifact(self):
        with self.assertRaises(ValueError):
            stage(self.root, self.parent / "artifact", commit="invalid", run_url="https://example.org/run")
        self.assertFalse((self.parent / "artifact").exists())

    def test_symlinks_and_source_tree_destinations_cannot_enter_a_deployment(self):
        for destination in [self.root, self.root / "public", self.parent]:
            with self.assertRaises(ValueError):
                stage(self.root, destination)
        outside = self.parent / "private.css"
        outside.write_text("private fixture")
        (self.root / "assets/linked.css").symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "symlink"):
            stage(self.root, self.parent / "artifact")
        self.assertFalse((self.parent / "artifact").exists())
