"""Local-only checks for parallel non-interference and re-entry semantics.

Static fixtures only: no network, no repository mutation, no workflow or PR actions.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples"


def load(name: str):
    with (EXAMPLES / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


class ParallelNonInterferenceTests(unittest.TestCase):
    def test_dependency_is_one_way(self):
        firewall = load("dependency-firewall.example.json")
        self.assertTrue(firewall["parallel_may_observe_main"])
        self.assertTrue(firewall["main_must_not_wait_for_parallel"])
        self.assertTrue(firewall["main_must_not_require_parallel_artifacts"])
        self.assertTrue(firewall["parallel_cannot_block_main_progress"])
        self.assertTrue(firewall["parallel_output_is_advisory_until_adopted"])
        self.assertTrue(firewall["adoption_requires_explicit_event"])
        self.assertEqual("none", firewall["authority_effect"])

    def test_reentry_is_fail_closed(self):
        contract = load("reentry-contract.example.json")
        self.assertTrue(contract["fresh_observation_completed"])
        self.assertTrue(contract["active_work_reobserved"])
        self.assertTrue(contract["path_overlap_recomputed"])
        self.assertTrue(contract["semantic_overlap_recomputed"])
        self.assertTrue(contract["prior_recommendations_stale"])
        self.assertFalse(contract["automatic_resume_allowed"])
        self.assertFalse(contract["automatic_pr_creation_allowed"])
        self.assertFalse(contract["automatic_merge_allowed"])
        self.assertTrue(contract["explicit_human_disposition_required"])
        self.assertNotIn("execute", contract["allowed_reentry_modes"])
        self.assertEqual("none", contract["authority_effect"])


if __name__ == "__main__":
    unittest.main()
