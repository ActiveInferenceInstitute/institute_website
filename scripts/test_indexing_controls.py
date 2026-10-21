import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_internal_links import check_links
from check_site_contract import check_domain_config, check_sitemap_dates
from public_link_policy import institute_link_errors
from check_redirects import check_redirects
from site_paths import site_paths


class IndexingControls(unittest.TestCase):
    def test_site_walk_preserves_inventory_and_prunes_before_descent(self):
        root = Path(tempfile.mkdtemp(prefix="website-walk-control-")).resolve()
        paths = ["index.html", "deep/pages/index.html", "assets/site.css", "simulations/index.html", "simulations/Ink.html", "ru/simulations/Ink.html", "src/source.json", ".cache/ignored/deep/index.html", "node_modules/ignored.html", "deep/.cache/ignored.html"]
        for relative in paths:
            file = root / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("fixture")
        (root / "linked-directory").symlink_to(root / "deep", target_is_directory=True)
        (root / "linked-file.html").symlink_to(root / "index.html")
        (root / "directory.html").mkdir()
        excluded = {".cache", "node_modules"}
        expected = sorted(path for path in root.rglob("*") if not any(part in excluded for part in path.relative_to(root).parts))
        self.assertEqual(sorted(site_paths(root, excluded)), expected)
        blocked = root / ".cache"
        blocked.chmod(0)
        try:
            self.assertEqual(sorted(site_paths(root, excluded)), expected)
            with self.assertRaises(PermissionError):
                list(site_paths(root, {"node_modules"}))
        finally:
            blocked.chmod(0o700)
        with self.assertRaises(FileNotFoundError):
            list(site_paths(root / "missing", excluded))

    def test_redirect_and_forward_negative_controls(self):
        source = Path(__file__).resolve().parents[1]
        root = Path(tempfile.mkdtemp(prefix="website-stub-control-")).resolve()
        shutil.copytree(source / "src/content/pages", root / "src/content/pages")
        paths = ["src/url-taxonomy.json", "src/i18n/locales.json", "src/content/site.json", "src/content/inbound-forwards.json", "data/redirects.json", "assets/js/redirects.js", "docs/MIGRATION_AND_REDIRECTS.md"]
        manifest = json.loads((source / "data/redirects.json").read_text())
        for entry in manifest:
            paths.append(entry["file"])
            paths.append(entry["to"] if entry["to"].endswith(".html") else entry["to"] + "index.html")
        paths.extend(f"simulations/{path.name}" for path in (source / "simulations").glob("*.html") if path.name != "index.html")
        forwards = json.loads((source / "src/content/inbound-forwards.json").read_text())["forwards"]
        paths.extend(target.lstrip("/") + "index.html" for target in forwards.values())
        for relative in set(paths):
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / relative, target)
        self.assertEqual(check_redirects(root), [])
        stub = root / "officers/index.html"
        original = stub.read_text()
        stub.write_text(original.replace('content="0; url=/structure/officers/"', 'content="0; url=/missing/"'))
        self.assertIn("officers/index.html: incorrect refresh or missing fallback link", check_redirects(root))
        stub.write_text(original)
        target = root / "programs/mentorship/index.html"
        original_target = target.read_text()
        target.write_text(original_target.replace('rel="canonical" href="https://activeinference.institute/programs/mentorship/"', 'rel="canonical" href="https://activeinference.institute/changed/"'))
        self.assertTrue(any("pinned forwarding target" in error for error in check_redirects(root)))
        target.write_text(original_target)
        self.assertEqual(check_redirects(root), [])
        host = next(iter(forwards))
        ignored = root / ".cache/ignored/index.html"
        ignored.parent.mkdir(parents=True)
        ignored.write_text(f'<a href="https://{host}.activeinference.institute/">Alias</a>')
        self.assertEqual(check_redirects(root), [])
        public = root / "public-control/index.html"
        public.parent.mkdir()
        public.write_text(ignored.read_text())
        self.assertTrue(any("on-site forwarding shortlink must render an internal URL" in error for error in check_redirects(root)))
        public.write_text('<a href="/projects/">Projects</a>')
        self.assertEqual(check_redirects(root), [])

    def test_locale_simulation_negative_control(self):
        root = Path(tempfile.mkdtemp(prefix="website-link-control-")).resolve()
        landing = root / "ru/simulations/index.html"
        landing.parent.mkdir(parents=True)
        (root / "simulations").mkdir()
        (root / "simulations/Ink.html").write_text("<h1>Ink</h1>")
        landing.write_text('<a href="Ink.html">Ink</a>')
        self.assertEqual(check_links(root), 1)
        landing.write_text('<a href="/simulations/Ink.html">Ink</a>')
        self.assertEqual(check_links(root), 0)

    def test_domain_negative_controls(self):
        root = Path(tempfile.mkdtemp(prefix="website-domain-control-")).resolve()
        config = root / "src/content/site.json"
        config.parent.mkdir(parents=True)
        config.write_text(json.dumps({"baseUrl": "https://activeinference.institute/"}))
        (root / "CNAME").write_text("activeinference.institute\n")
        errors = []
        check_domain_config(root, errors)
        self.assertEqual(errors, [])
        (root / "CNAME").write_text("wrong.example\n")
        errors = []
        check_domain_config(root, errors)
        self.assertEqual(errors, ["CNAME must match the host of site.json baseUrl"])
        (root / "CNAME").write_text("activeinference.institute\n")
        config.write_text(json.dumps({"baseUrl": "http://activeinference.institute/"}))
        errors = []
        check_domain_config(root, errors)
        self.assertEqual(errors, ["site.json baseUrl must use https"])

    def test_security_negative_controls(self):
        known = {"activeinference.institute", "discord.activeinference.institute"}
        self.assertEqual(institute_link_errors("https://discord.activeinference.institute/", known), [])
        self.assertEqual(institute_link_errors("http://activeinference.institute/", known), ["Institute anchor must use https"])
        self.assertIn("unknown Institute subdomain must be registered as a known public destination", institute_link_errors("https://unknown.activeinference.institute/", known))
        self.assertIn("dead Institute host must render as plain text", institute_link_errors("https://octopus.activeinference.institute/", known))

    def test_sitemap_dates_are_checked_per_url(self):
        start = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        valid = start + '<url><loc>https://example.test/</loc><lastmod>2026-10-12</lastmod></url></urlset>'
        errors = []
        check_sitemap_dates(valid, errors)
        self.assertEqual(errors, [])
        misplaced = start + '<url><loc>https://example.test/</loc></url><url><loc>https://example.test/about/</loc><lastmod>2026-10-12</lastmod><lastmod>2026-10-12</lastmod></url></urlset>'
        errors = []
        check_sitemap_dates(misplaced, errors)
        self.assertEqual(len(errors), 2)
        errors = []
        check_sitemap_dates(valid.replace("2026-10-12", "2026-13-01"), errors)
        self.assertEqual(errors, ["sitemap lastmod must be a valid calendar date"])


if __name__ == "__main__":
    unittest.main()
