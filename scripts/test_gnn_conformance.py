"""Offline receipts must not attribute arbitrary model bytes to the upstream pin."""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
UNRELATED_MODEL = """## GNNSection
ActInfPOMDP
## GNNVersionAndFlags
GNN v1
## ModelName
Unrelated Model
## ModelAnnotation
An unrelated, well-formed model is not the pinned upstream exemplar.
## StateSpaceBlock
A[2,2,type=float]
B[2,2,2,type=float]
C[2,type=float]
D[2,1,type=float]
s[2,1,type=float]
o[2,1,type=int]
u[1,type=int]
## Connections
D>s
s-A
A-o
s-B
B>u
u>s
## InitialParameterization
A={(0.9, 0.2), (0.1, 0.8)}
B={((0.95, 0.05), (0.05, 0.95)), ((0.05, 0.95), (0.95, 0.05))}
C={(0.0, 0.0)}
D={(0.5, 0.5)}
## Time
Static
## Footer
Unrelated model.
"""


class OfflineExemplarTests(unittest.TestCase):
    def run_checker(self, revision: str | None = None) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory(prefix="gnn-receipt-provenance-") as directory:
            root = Path(directory)
            (root / "scripts").mkdir()
            (root / ".github").mkdir()
            checker = root / "scripts/check_gnn_conformance.py"
            shutil.copy2(ROOT / "scripts/check_gnn_conformance.py", checker)
            pin = json.loads((ROOT / ".github/gnn-pin.json").read_text())
            if revision is not None:
                pin["revision"] = revision
            (root / ".github/gnn-pin.json").write_text(json.dumps(pin))
            exemplar = root / "unrelated.md"
            exemplar.write_text(UNRELATED_MODEL)
            return subprocess.run([sys.executable, "-B", str(checker), "--exemplar", str(exemplar)],
                                  cwd=root, stdin=subprocess.DEVNULL, capture_output=True, text=True)

    def test_unrelated_model_cannot_receive_a_pinned_receipt(self) -> None:
        result = self.run_checker()
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXEMPLAR-DIGEST-MISMATCH", result.stderr)
        self.assertNotIn('"result": "verified"', result.stdout)

    def test_unreviewed_revision_cannot_receive_an_offline_receipt(self) -> None:
        result = self.run_checker("0" * 40)
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXEMPLAR-DIGEST-UNREVIEWED", result.stderr)
        self.assertNotIn('"result": "verified"', result.stdout)


if __name__ == "__main__":
    unittest.main()
