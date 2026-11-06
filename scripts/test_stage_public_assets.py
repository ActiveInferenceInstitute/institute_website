"""Real-file controls for release metadata, public artifact custody and source identity."""

import json
import tempfile
import unittest
from pathlib import Path

from check_site_contract import check_version
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


class ReleaseMetadataTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="release-metadata-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        for folder in ("src", "assets", "simulations"):
            (self.root / folder).mkdir()
        (self.root / "package.json").write_text(json.dumps({"version": "1.2.3"}), encoding="utf-8")
        self.lock = {"version": "1.2.3", "packages": {"": {"version": "1.2.3"}}}
        self.save_lock()
        (self.root / "sitemap.xml").write_text(
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            '<url><loc>https://example.test/</loc></url></urlset>', encoding="utf-8"
        )
        (self.root / "version.json").write_text(json.dumps({
            "site_version": "1.2.3", "pages": 1,
            "website_source_fingerprint": website_source_fingerprint(self.root),
        }), encoding="utf-8")

    def save_lock(self):
        (self.root / "package-lock.json").write_text(json.dumps(self.lock), encoding="utf-8")

    def version_errors(self):
        errors = []
        check_version(self.root, errors)
        return errors

    def test_matching_package_and_lock_metadata_pass(self):
        self.assertEqual(self.version_errors(), [])

    def test_stale_top_level_lock_version_fails(self):
        self.lock["version"] = "1.2.2"
        self.save_lock()
        errors = self.version_errors()
        self.assertEqual(len(errors), 1)
        self.assertIn("package-lock.json version", errors[0])

    def test_stale_root_package_lock_version_fails(self):
        self.lock["packages"][""]["version"] = "1.2.2"
        self.save_lock()
        errors = self.version_errors()
        self.assertEqual(len(errors), 1)
        self.assertIn('package-lock.json packages[""].version', errors[0])

    def test_missing_root_package_metadata_fails(self):
        self.lock["packages"] = {}
        self.save_lock()
        errors = self.version_errors()
        self.assertEqual(len(errors), 1)
        self.assertIn('packages[""].version None', errors[0])

    def test_invalid_lock_metadata_is_reported(self):
        for contents in ("{", "[]"):
            with self.subTest(contents=contents):
                (self.root / "package-lock.json").write_text(contents, encoding="utf-8")
                errors = self.version_errors()
                self.assertEqual(len(errors), 1)
                self.assertIn("package-lock.json", errors[0])
