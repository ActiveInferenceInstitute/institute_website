"""GNN timing claims are grounded in recorded observations."""

from __future__ import annotations

import unittest

import measure_gates


class GnnObservationTests(unittest.TestCase):
    def test_exemplar_handling_comes_from_recorded_commands(self) -> None:
        observations = measure_gates.gnn_observations({
            "before": {"gnn": {"command": "original CI GNN verification body"}},
            "after": {"gnn": {"command": "./run.sh gnn --exemplar PINNED_FILE"}},
        })
        self.assertEqual(observations, [("before", False), ("after", True)])

    def test_unmeasured_phase_does_not_create_a_gnn_observation(self) -> None:
        observations = measure_gates.gnn_observations({
            "before": {"gnn": {"command": "./run.sh gnn"}},
            "after": {"full": {"command": "./run.sh full", "seconds": 12, "exit_code": 0}},
        })
        self.assertEqual(observations, [("before", False)])

    def test_no_recorded_gnn_arm_has_no_exemplar_observations(self) -> None:
        self.assertEqual(measure_gates.gnn_observations({"before": {}, "after": {}}), [])


if __name__ == "__main__":
    unittest.main()
