#!/usr/bin/env python3

import copy
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from receipt import DivergenceInputError, evaluate  # noqa: E402


def load(name):
    return json.loads((HERE / "fixtures" / name).read_text(encoding="utf-8"))


class ObservedAuthorityBranchDivergenceTests(unittest.TestCase):
    def test_parallel_same_version_root_variants_observed_without_equivocation_claim(self):
        receipt = evaluate(load("parallel-root-variants.json"))
        self.assertEqual(receipt["relation"], "DIVERGENT_OBSERVED_PATHS")
        self.assertEqual(receipt["common_observed_prefix_length"], 1)
        self.assertTrue(
            receipt["divergence"]["parallel_same_version_root_variants_observed"]
        )
        self.assertFalse(receipt["divergence"]["signed_root_exact_equal"])
        self.assertFalse(receipt["semantic_guards"]["global_equivocation_proven"])
        self.assertFalse(receipt["semantic_guards"]["malicious_behavior_proven"])

    def test_observed_reconvergence_is_descriptive_only(self):
        receipt = evaluate(load("reconvergent.json"))
        self.assertEqual(receipt["relation"], "DIVERGENT_OBSERVED_PATHS")
        self.assertTrue(receipt["reconvergence"]["observed_reconvergence_present"])
        self.assertEqual(receipt["reconvergence"]["left_index"], 2)
        self.assertEqual(receipt["reconvergence"]["right_index"], 2)
        self.assertFalse(receipt["semantic_guards"]["complete_history_proven"])
        self.assertFalse(receipt["semantic_guards"]["no_omitted_states_proven"])

    def test_same_root_surface_divergence(self):
        data = load("reconvergent.json")
        data["left_chain"]["snapshots"] = data["left_chain"]["snapshots"][:2]
        data["right_chain"]["snapshots"] = data["right_chain"]["snapshots"][:2]
        receipt = evaluate(data)
        self.assertEqual(receipt["relation"], "DIVERGENT_OBSERVED_PATHS")
        self.assertTrue(receipt["divergence"]["signed_root_exact_equal"])
        self.assertFalse(receipt["divergence"]["runtime_surface_exact_equal"])
        self.assertFalse(receipt["divergence"]["export_surface_exact_equal"])
        self.assertFalse(
            receipt["divergence"]["parallel_same_version_root_variants_observed"]
        )

    def test_identical_branches(self):
        data = load("parallel-root-variants.json")
        data["right_chain"] = copy.deepcopy(data["left_chain"])
        receipt = evaluate(data)
        self.assertEqual(receipt["relation"], "IDENTICAL_OBSERVED_BRANCHES")
        self.assertIsNone(receipt["divergence"])
        self.assertFalse(receipt["reconvergence"]["observed_reconvergence_present"])

    def test_left_prefix(self):
        data = load("reconvergent.json")
        data["right_chain"] = copy.deepcopy(data["left_chain"])
        data["left_chain"]["snapshots"] = data["left_chain"]["snapshots"][:2]
        receipt = evaluate(data)
        self.assertEqual(receipt["relation"], "LEFT_IS_OBSERVED_PREFIX")
        self.assertEqual(receipt["common_observed_prefix_length"], 2)
        self.assertIsNone(receipt["divergence"])

    def test_right_prefix(self):
        data = load("reconvergent.json")
        data["left_chain"] = copy.deepcopy(data["right_chain"])
        data["right_chain"]["snapshots"] = data["right_chain"]["snapshots"][:2]
        receipt = evaluate(data)
        self.assertEqual(receipt["relation"], "RIGHT_IS_OBSERVED_PREFIX")
        self.assertEqual(receipt["common_observed_prefix_length"], 2)

    def test_different_successor_versions_are_observed_without_preference(self):
        data = load("parallel-root-variants.json")
        right_root = data["right_chain"]["snapshots"][1]["signed_root"]
        right_root["version"] = 4
        receipt = evaluate(data)
        self.assertEqual(receipt["relation"], "DIVERGENT_OBSERVED_PATHS")
        self.assertEqual(receipt["divergence"]["left_signed_root"]["version"], 3)
        self.assertEqual(receipt["divergence"]["right_signed_root"]["version"], 4)
        self.assertFalse(
            receipt["divergence"]["parallel_same_version_root_variants_observed"]
        )
        self.assertFalse(
            receipt["semantic_guards"]["branch_ordering_or_preference_established"]
        )

    def test_different_first_snapshot_rejected(self):
        data = load("reconvergent.json")
        data["right_chain"]["snapshots"][0]["runtime_surface"]["document_sha256"] = (
            "9999999999999999999999999999999999999999999999999999999999999999"
        )
        with self.assertRaisesRegex(DivergenceInputError, "NO_COMMON_OBSERVED_ORIGIN"):
            evaluate(data)

    def test_invalid_branch_interior_rejected(self):
        data = load("reconvergent.json")
        data["right_chain"]["snapshots"][2]["signed_root"]["version"] = 1
        with self.assertRaises(DivergenceInputError):
            evaluate(data)

    def test_unknown_top_level_field_rejected(self):
        data = load("parallel-root-variants.json")
        data["timestamp"] = "2026-09-05T00:00:00Z"
        with self.assertRaises(DivergenceInputError):
            evaluate(data)

    def test_caller_supplied_chain_receipt_rejected(self):
        data = load("parallel-root-variants.json")
        data["left_chain"]["chain_receipt"] = {"forged": True}
        with self.assertRaises(DivergenceInputError):
            evaluate(data)

    def test_canonical_branch_control_rejected(self):
        data = load("parallel-root-variants.json")
        data["canonical_branch"] = "left"
        with self.assertRaises(DivergenceInputError):
            evaluate(data)

    def test_equivocation_verdict_injection_rejected(self):
        data = load("parallel-root-variants.json")
        data["equivocation_proven"] = True
        with self.assertRaises(DivergenceInputError):
            evaluate(data)

    def test_nested_latest_root_control_rejected_by_predecessor(self):
        data = load("parallel-root-variants.json")
        data["right_chain"]["latest_root"] = True
        with self.assertRaises(DivergenceInputError):
            evaluate(data)

    def test_input_not_mutated(self):
        data = load("reconvergent.json")
        original = copy.deepcopy(data)
        evaluate(data)
        self.assertEqual(data, original)

    def test_deterministic_output(self):
        data = load("parallel-root-variants.json")
        self.assertEqual(evaluate(copy.deepcopy(data)), evaluate(copy.deepcopy(data)))

    def test_branch_fingerprints_bind_ordered_snapshot_sequences(self):
        receipt = evaluate(load("parallel-root-variants.json"))
        self.assertNotEqual(
            receipt["left_branch"]["branch_fingerprint_sha256"],
            receipt["right_branch"]["branch_fingerprint_sha256"],
        )
        self.assertEqual(len(receipt["left_branch"]["snapshot_fingerprints_sha256"]), 2)
        self.assertEqual(len(receipt["right_branch"]["snapshot_fingerprints_sha256"]), 2)

    def test_semantic_guards_deny_global_and_action_claims(self):
        receipt = evaluate(load("parallel-root-variants.json"))
        for value in receipt["semantic_guards"].values():
            self.assertFalse(value)

    def test_no_aggregate_score_or_failure_verdict(self):
        serialized = json.dumps(evaluate(load("parallel-root-variants.json")), sort_keys=True).lower()
        for forbidden in [
            '"trust_score"',
            '"severity"',
            '"failure_verdict"',
            '"fraud_proven"',
            '"canonical_branch"',
        ]:
            self.assertNotIn(forbidden, serialized)

    def test_wrong_schema_rejected(self):
        data = load("parallel-root-variants.json")
        data["schema"] = "urn:wrong"
        with self.assertRaises(DivergenceInputError):
            evaluate(data)


if __name__ == "__main__":
    unittest.main()
