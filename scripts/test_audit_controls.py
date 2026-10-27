"""Public inventory boundaries retain real output and exclude local source graphs."""

import tempfile
import unittest
from pathlib import Path

from check_internal_links import generated_html_files
from check_site_contract import generated_public_files


class PublicInventoryTests(unittest.TestCase):
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
