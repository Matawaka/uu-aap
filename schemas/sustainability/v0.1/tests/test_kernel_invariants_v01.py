"""Local-only consistency tests for the compact parallel sustainability kernel.

No network calls, repository mutations, workflow activation, ref changes, pull-request
operations, or external execution are performed by this module.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
KERNEL = ROOT / "sustainability-kernel.json"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


class SustainabilityKernelTests(unittest.TestCase):
    def test_kernel_is_compact_and_non_authoritative(self):
        kernel = load_json(KERNEL)
        self.assertEqual("uu-aap.parallel-sustainability-kernel", kernel["document_type"])
        self.assertEqual("none", kernel["authority_effect"])
        self.assertIs(kernel["main_line_dependency_created"], False)
        self.assertIs(kernel["whole_branch_integration_required"], False)
        self.assertEqual(10, len(kernel["invariants"]))

    def test_kernel_invariant_ids_are_unique(self):
        kernel = load_json(KERNEL)
        ids = [item["id"] for item in kernel["invariants"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual([f"K{i}" for i in range(1, 11)], ids)

    def test_every_kernel_source_exists(self):
        kernel = load_json(KERNEL)
        missing = []
        for invariant in kernel["invariants"]:
            for source in invariant["sources"]:
                if not (ROOT / source).exists():
                    missing.append((invariant["id"], source))
        self.assertEqual([], missing, f"Missing kernel source artifacts: {missing}")

    def test_observation_budget_is_fail_closed(self):
        budget = load_json(ROOT / "examples/observation-budget.example.json")
        self.assertIs(budget["continuous_polling_allowed"], False)
        self.assertIs(budget["background_monitoring_allowed"], False)
        self.assertIs(budget["mutation_during_observation_allowed"], False)
        self.assertEqual("none", budget["authority_effect"])

    def test_side_track_closure_cannot_pressure_main(self):
        closure = load_json(ROOT / "examples/side-track-closure.example.json")
        self.assertIs(closure["historical_material_preserved"], True)
        self.assertIs(closure["main_line_action_required"], False)
        self.assertIs(closure["automatic_reactivation_allowed"], False)
        self.assertIs(closure["automatic_integration_allowed"], False)
        self.assertIs(closure["branch_deletion_required"], False)
        self.assertEqual("none", closure["authority_effect"])

    def test_non_interference_attestation_denies_pressure_paths(self):
        attestation = load_json(ROOT / "examples/non-interference-attestation.example.json")
        for field, value in attestation["claims"].items():
            with self.subTest(field=field):
                self.assertIs(value, False)


if __name__ == "__main__":
    unittest.main()
