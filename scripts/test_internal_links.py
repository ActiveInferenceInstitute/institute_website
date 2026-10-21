from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

from check_internal_links import check_links


class CanonicalLinkTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="website-canonical-links-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        content = self.root / "src/content"
        content.mkdir(parents=True)
        (content / "site.json").write_text(json.dumps({"baseUrl": "https://institute.example/"}))
        (self.root / "learning").mkdir()
        (self.root / "learning/index.html").write_text('<h1 id="idea-active-inference">Active Inference</h1>')

    def result(self, href: str) -> int:
        (self.root / "index.html").write_text(f'<a href="{href}">Learn</a>')
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return check_links(self.root)

    def test_absolute_canonical_fragment_resolves(self) -> None:
        self.assertEqual(self.result("https://institute.example/learning/#idea-active-inference"), 0)

    def test_missing_absolute_canonical_fragment_fails(self) -> None:
        self.assertEqual(self.result("https://institute.example/learning/#missing"), 1)

    def test_missing_absolute_canonical_page_fails(self) -> None:
        self.assertEqual(self.result("https://institute.example/missing/"), 1)

    def test_protocol_relative_canonical_fragment_fails(self) -> None:
        self.assertEqual(self.result("//institute.example/learning/#missing"), 1)

    def test_different_origin_remains_network_gate_responsibility(self) -> None:
        self.assertEqual(self.result("https://other.example/learning/#missing"), 0)

    def test_protocol_relative_external_reference_is_not_local(self) -> None:
        self.assertEqual(self.result("//other.example/elsewhere/"), 0)


if __name__ == "__main__":
    unittest.main()
