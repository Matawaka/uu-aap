"""Local-only fail-closed checks for long-lived parallel divergence artifacts.

This module reads static JSON fixtures only. It performs no network access,
no fetch, no push, no merge, no pull-request creation, and no ref mutation.
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


class LongDivergenceTests(unittest.TestCase):
    def test_divergence_does_not_create_merge_pressure(self):
        horizon = load("divergence-horizon.example.json")
        self.assertTrue(horizon["age_does_not_imply_merge_priority"])
        self.assertTrue(horizon["distance_does_not_imply_discard"])
        self.assertTrue(horizon["fresh_review_before_disposition"])
        self.assertFalse(horizon["automatic_rebase_allowed"])
        self.assertFalse(horizon["automatic_merge_allowed"])
        self.assertEqual("none", horizon["authority_effect"])

    def test_archive_preserves_history_without_reactivation(self):
        capsule = load("archival-capsule.example.json")
        self.assertTrue(capsule["historical_origin_preserved"])
        self.assertFalse(capsule["deletion_required"])
        self.assertFalse(capsule["canonicality_claimed"])
        self.assertTrue(capsule["future_reuse_requires_fresh_review"])
        self.assertFalse(capsule["automatic_reactivation_allowed"])

    def test_supersession_is_scoped_and_non_destructive(self):
        graph = load("supersession-graph.example.json")
        self.assertTrue(graph["historical_nodes_must_remain_addressable"])
        self.assertTrue(graph["supersession_does_not_rewrite_origin"])
        for edge in graph["edges"]:
            self.assertFalse(edge["automatic_deletion_allowed"])
            self.assertTrue(edge["scope"])

    def test_convergence_review_cannot_self_authorize(self):
        review = load("convergence-review.example.json")
        self.assertTrue(review["fresh_observation"])
        self.assertTrue(review["path_overlap_checked"])
        self.assertTrue(review["semantic_overlap_checked"])
        self.assertTrue(review["validation_checked"])
        self.assertTrue(review["recommendation_is_not_authorization"])
        self.assertTrue(review["explicit_human_decision_required"])
        self.assertFalse(review["automatic_pr_creation_allowed"])
        self.assertFalse(review["automatic_merge_allowed"])
        self.assertEqual("none", review["authority_effect"])


if __name__ == "__main__":
    unittest.main()
