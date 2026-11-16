"""Real-file controls for release metadata, public artifact custody and source identity."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from check_site_contract import check_version
from source_identity import website_source_fingerprint
from stage_public_assets import stage
from sync_instituteos_public_data import PRODUCER2_PUBLIC_JSON_FILES


def write_export(root, files):
    entries = []
    for relative, target, content in files:
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        entries.append({
            "name": f"newsletter-media/{path.name}" if target == "newsletter_assets" else path.name,
            "output_path": relative, "target": target, "record_count": 1,
            "sha256": hashlib.sha256(content).hexdigest(),
        })
    fingerprint = hashlib.sha256("\n".join(sorted(entry["sha256"] for entry in entries)).encode()).hexdigest()[:12]
    (root / "data/export-manifest.json").write_text(json.dumps({
        "gate_version": "1.0.0", "generated_at": "2026-11-01T00:00:00+00:00",
        "source_fingerprint": fingerprint, "files": entries,
    }))
    return fingerprint


def sample_exports():
    return [
        ("data/projects.json", "data", b'{"projects":[{}]}'),
        ("src/content/pages/domains/test.json", "pages_domains", b'{"title":"Public test domain"}'),
        ("assets/img/newsletters/test.png", "newsletter_assets", b"\x89PNG\r\n\x1a\n"),
        *((f"src/content/instituteos/{name}", "content", b"{}") for name in PRODUCER2_PUBLIC_JSON_FILES),
    ]


class StageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="public-stage-")
        self.addCleanup(self.temp.cleanup)
        self.parent = Path(self.temp.name)
        self.root = self.parent / "source"
        self.root.mkdir()
        for folder in ["src", "assets", "data", ".well-known", "scripts", "docs", "simulations"]:
            (self.root / folder).mkdir()
        for name in ["package.json", "src/page.mjs", "index.html", "robots.txt", "sitemap.xml", "feed.xml", "feed.json", "manifest.webmanifest", ".nojekyll", "CNAME", ".well-known/security.txt", "data/redirects.json"]:
            (self.root / name).write_text("{}")
        (self.root / "data/public-html-files.json").write_text('["index.html"]')
        (self.root / "docs/private-audit.html").write_text("must not ship")
        (self.root / "scripts/private.txt").write_text("must not ship")
        self.files = sample_exports()
        self.fingerprint = write_export(self.root, self.files)
        self.version()

    def version(self):
        (self.root / "version.json").write_text(json.dumps({
            "website_source_fingerprint": website_source_fingerprint(self.root),
            "source_fingerprint": self.fingerprint,
        }))

    def test_only_reviewed_public_output_is_staged_and_existing_evidence_is_preserved(self):
        out = self.parent / "artifact"
        self.assertGreater(stage(self.root, out), 10)
        self.assertTrue((out / "index.html").is_file())
        for relative, _, content in self.files:
            self.assertEqual((out / relative).read_bytes(), content)
        self.assertEqual(
            {path.relative_to(out).as_posix() for path in (out / "src").rglob("*") if path.is_file()},
            {relative for relative, _, _ in self.files if relative.startswith("src/")},
        )
        self.assertEqual((out / "data/export-manifest.json").read_bytes(),
                         (self.root / "data/export-manifest.json").read_bytes())
        self.assertFalse((out / "docs").exists())
        self.assertFalse((out / "scripts").exists())
        with self.assertRaises(FileExistsError):
            stage(self.root, out)
        self.assertTrue((out / "index.html").is_file())

    def test_stale_source_and_unsafe_inventory_fail_before_writing(self):
        out = self.parent / "artifact"
        for name in ("src/page.mjs", "data/export-manifest.json", "data/projects.json"):
            with self.subTest(name=name):
                original = (self.root / name).read_bytes()
                (self.root / name).write_text('{"changed":true}')
                with self.assertRaisesRegex(ValueError, "Stale"):
                    stage(self.root, out)
                self.assertFalse(out.exists())
                (self.root / name).write_bytes(original)
        for bad in ["../outside.html", "/outside.html", "src/private.html"]:
            (self.root / "data/public-html-files.json").write_text(json.dumps([bad]))
            with self.assertRaises(ValueError):
                stage(self.root, out)
            self.assertFalse(out.exists())

    def test_fresh_build_still_rejects_export_hash_mismatch(self):
        (self.root / "data/projects.json").write_text("{}")
        self.version()
        out = self.parent / "artifact"
        with self.assertRaisesRegex(ValueError, "sha256 mismatch"):
            stage(self.root, out)
        self.assertFalse(out.exists())

    def test_manifest_cannot_stage_an_undeclared_payload_or_private_value(self):
        out = self.parent / "artifact"
        self.fingerprint = write_export(self.root, [
            *self.files, ("src/content/instituteos/private.json", "content", b"{}"),
        ])
        self.version()
        with self.assertRaisesRegex(ValueError, "unapproved output path"):
            stage(self.root, out)
        self.assertFalse(out.exists())

        self.fingerprint = write_export(self.root, [
            (name, target, b'{"contactEmail":"private@example.invalid"}' if target == "pages_domains" else content)
            for name, target, content in self.files
        ])
        self.version()
        with self.assertRaisesRegex(ValueError, r"^src/content/pages/domains/test\.json failed public-safety validation$"):
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
