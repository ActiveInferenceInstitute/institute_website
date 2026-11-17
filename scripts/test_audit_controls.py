"""Public inventory boundaries retain real output and exclude local source graphs."""

import tempfile
import unittest
from pathlib import Path

from check_internal_links import generated_html_files
from check_site_contract import check_stale_references, generated_public_files


class PublicInventoryTests(unittest.TestCase):
    def test_public_research_pdf_and_retired_atlas_are_distinguished(self):
        with tempfile.TemporaryDirectory(prefix="public-research-pdf-") as directory:
            root = Path(directory)
            bibliography = root / "bibliography"
            bibliography.mkdir()
            publication = root / "index.html"
            publication.write_text(
                '<a href="https://example.org/research/prospectus.pdf">Research prospectus (PDF)</a>'
            )
            errors = []
            check_stale_references(root, errors)
            self.assertEqual(errors, [])

            legacy = bibliography / "index.html"
            legacy.write_text('<a href="/assets/source/AII.pdf">Source Atlas</a>')
            check_stale_references(root, errors)
            self.assertTrue(errors)
            self.assertTrue(all("bibliography/index.html" in error for error in errors))

    def test_source_graphs_do_not_become_public_content(self):
        with tempfile.TemporaryDirectory(prefix="public-graph-control-") as directory:
            root = Path(directory)
            for name in ["graft/.graph/wiring.json", ".graft/context.json", "data/public.json"]:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('"PDF"')
            self.assertEqual(generated_public_files(root), [root / "data/public.json"])

    def test_localized_simulation_alias_assets_are_checked_but_vendor_bodies_remain_separate(self):
        with tempfile.TemporaryDirectory(prefix="alias-coverage-control-") as directory:
            root = Path(directory)
            names = ["simulations/Ink.html", "simulations/index.html", "ru/simulations/Ink.html"]
            for name in names:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("<html></html>")
            self.assertEqual(set(generated_html_files(root)), {root / names[1], root / names[2]})
