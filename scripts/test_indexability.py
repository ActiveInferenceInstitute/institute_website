"""Real-file negative controls for crawler signals; no mock parser or HTTP."""

import json
import tempfile
import unittest
from pathlib import Path

from check_indexability import audit, write_inventory


class IndexabilityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="indexability-control-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.base = "https://example.org/"
        self.write("src/content/site.json", json.dumps({"baseUrl": self.base}))
        self.write(
            "src/i18n/locales.json", json.dumps({"defaultLocale": "en", "locales": [{"code": "en"}, {"code": "es"}]})
        )
        self.write("robots.txt", "User-agent: *\nAllow: /\n")
        self.cluster = '<link rel="alternate" hreflang="en" href="https://example.org/about/"><link rel="alternate" hreflang="es" href="https://example.org/es/about/">'
        self.write("about/index.html", self.page("about/", self.cluster))
        self.write("es/about/index.html", self.page("es/about/", self.cluster, "es"))
        self.write(
            "sitemap.xml",
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:x="http://www.w3.org/1999/xhtml"><url><loc>https://example.org/about/</loc><x:link rel="alternate" hreflang="en" href="https://example.org/about/"/><x:link rel="alternate" hreflang="es" href="https://example.org/es/about/"/></url></urlset>',
        )

    def write(self, name, text):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding="utf-8")

    def page(self, route, extra="", lang="en"):
        return f'<html lang="{lang}"><head><title>About</title><meta name="description" content="About us"><link rel="canonical" href="{self.base}{route}">{extra}</head><body><h1>About us</h1></body></html>'

    def test_valid_cluster_and_inventory_do_not_claim_http_or_gsc(self):
        result = audit(self.root)
        self.assertEqual(result.errors, [])
        csv = self.root / "inventory.csv"
        write_inventory(result, csv)
        text = csv.read_text()
        self.assertIn("untested; disk only", text)
        self.assertIn("not exported", text)
        self.assertIn("index-public-canonical", text)

    def test_vendored_simulation_metadata_is_not_exempt(self):
        self.write("simulations/Ink.html", '<html><head><title>Ink</title></head><body></body></html>')
        self.assertTrue(any("simulation needs" in e for e in audit(self.root).errors))
        self.write("simulations/Ink.html", self.page("simulations/Ink.html").replace('content="About us"', 'content="Explore the interactive ink demonstration and its configurable visual dynamics."'))
        self.assertEqual(audit(self.root).errors, [])

    def test_noindex_robots_and_wrong_canonical_are_detected(self):
        cases = [
            ('<meta name="robots" content="noindex">', "must be indexable"),
            ('<meta name="robots" content="NOINDEX FOLLOW">', "must be indexable"),
            ('<meta name="googlebot" content="none">', "must be indexable"),
            ('<link rel="canonical" href="https://example.org/missing/">', "exactly one canonical"),
        ]
        for extra, message in cases:
            with self.subTest(extra=extra):
                self.write("about/index.html", self.page("about/", self.cluster + extra))
                self.assertTrue(any(message in e for e in audit(self.root).errors))
        self.write("about/index.html", self.page("about/", self.cluster))
        self.write("robots.txt", "User-agent: *\nDisallow: /about/\n")
        self.assertTrue(any("public canonical blocked" in e for e in audit(self.root).errors))

    def test_hreflang_must_exist_be_reciprocal_and_match_language(self):
        for cluster in [
            self.cluster.replace("es/about/", "es/missing/"),
            "",
            self.cluster.replace('hreflang="en"', 'hreflang="fr"'),
        ]:
            with self.subTest(cluster=cluster):
                self.write("es/about/index.html", self.page("es/about/", cluster, "es"))
                self.assertTrue(any("hreflang" in e for e in audit(self.root).errors))

    def test_case_sensitive_assets_and_unexpected_error_shell_fail(self):
        self.write("simulations/Ink.html", self.page("simulations/Ink.html").replace('content="About us"', 'content="Explore the interactive ink demonstration and its configurable visual dynamics."'))
        self.write("about/index.html", self.page("about/", self.cluster + '<a href="/simulations/Ink.html">Ink</a>'))
        self.assertEqual(audit(self.root).errors, [])
        self.write("about/index.html", self.page("about/", self.cluster + '<a href="/simulations/ink.html">Ink</a>'))
        self.assertTrue(any("incorrectly cased" in e for e in audit(self.root).errors))
        self.write("about/index.html", '<html lang="en"><title>Not found</title><h1>Not found</h1></html>')
        self.assertTrue(any("public page must be indexable and self-canonical" in e for e in audit(self.root).errors))
        self.write(
            "about/index.html",
            self.page("about/", self.cluster).replace("<h1>About us</h1>", "<h1>Page not found</h1>"),
        )
        self.assertTrue(any("error/redirect shell" in e for e in audit(self.root).errors))

    def test_sitemap_and_canonical_cannot_target_redirects(self):
        self.write(
            "about/index.html",
            self.page(
                "es/about/",
                '<meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=/es/about/"><section data-redirect-stub="true"></section>',
            ),
        )
        errors = audit(self.root).errors
        self.assertTrue(any("sitemap: loc is not an indexable canonical" in e for e in errors))
        self.write("es/about/index.html", self.page("about/", lang="es"))
        self.assertTrue(any("canonical target missing, redirected" in e for e in audit(self.root).errors))

    def test_sitemap_completeness_rejects_missing_canonical(self):
        self.write("sitemap.xml", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
        self.assertEqual(sum("canonical omitted" in e for e in audit(self.root).errors), 2)


if __name__ == "__main__":
    unittest.main()
