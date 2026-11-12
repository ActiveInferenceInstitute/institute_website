"""The GNN timing note must state what each recorded command does with the exemplar."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

import measure_gates

ROOT = Path(__file__).resolve().parents[1]
GATE_EVIDENCE = ROOT / "docs/gate-measurements.json"
GATE_DOCUMENT = ROOT / "docs/GATE_MEASUREMENTS.md"
BLANKET_OFFLINE_CLAIM = "GNN uses the same pre-fetched pinned exemplar in both phases"


class GnnExemplarNoteTests(unittest.TestCase):
    def test_notes_are_derived_from_each_recorded_command(self) -> None:
        notes = measure_gates.exemplar_notes({
            "before": {"gnn": {"command": "original CI GNN verification body"}},
            "after": {"gnn": {"command": "./run.sh gnn --exemplar PINNED_FILE"}},
        })
        self.assertIn("The GNN before arm fetches the pinned exemplar itself", notes[0])
        self.assertIn("The GNN after arm receives pre-fetched exemplar bytes", notes[1])

    def test_document_does_not_call_a_downloading_arm_offline(self) -> None:
        data = json.loads(GATE_EVIDENCE.read_text())
        document = GATE_DOCUMENT.read_text()
        self.assertNotIn(BLANKET_OFFLINE_CLAIM, document)
        for phase, note in zip(("before", "after"), measure_gates.exemplar_notes(data)):
            self.assertIn(note, document)
            if "--exemplar" not in data[phase]["gnn"]["command"].split():
                self.assertIn("fetches the pinned exemplar itself", note)


if __name__ == "__main__":
    unittest.main()
