#!/usr/bin/env python3
"""Hostile and positive coverage for Observed Authority Branch Set v0.1."""

from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


branch_set = load_module("observed_authority_branch_set", HERE / "receipt.py")
divergence = load_module(
    "observed_authority_branch_divergence_for_set_test",
    SCRIPTS / "observed-authority-branch-divergence" / "receipt.py",
)
chain = load_module(
    "authority_surface_continuity_chain_for_set_test",
    SCRIPTS / "authority-surface-continuity-chain" / "receipt.py",
)


def fixture(name: str) -> dict:
    return json.loads((HERE / "fixtures" / name).read_text(encoding="utf-8"))


def predecessor_divergence_fixture(name: str) -> dict:
    return json.loads(
        (
            SCRIPTS
            / "observed-authority-branch-divergence"
            / "fixtures"
            / name
        ).read_text(encoding="utf-8")
    )


def deep_find_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from deep_find_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from deep_find_keys(child)


class BranchSetTests(unittest.TestCase):
    def test_three_distinct_branches_have_three_pairs(self):
        receipt = branch_set.evaluate(fixture("three-branches.json"))
        self.assertEqual(receipt["observation_count"], 3)
        self.assertEqual(receipt["distinct_branch_count"], 3)
        self.assertEqual(receipt["pairwise_entry_count"], 3)
        self.assertEqual(len(receipt["pairwise_matrix"]), 3)

    def test_two_branch_result_matches_merged_900(self):
        data = fixture("three-branches.json")
        data["branches"] = data["branches"][:2]
        receipt = branch_set.evaluate(data)
        self.assertEqual(receipt["pairwise_entry_count"], 1)

        branches = data["branches"]
        reps = []
        for item in branches:
            fps = [chain._canonical_fingerprint(s) for s in item["snapshots"]]
            reps.append((divergence._branch_fingerprint(fps), item))
        reps.sort(key=lambda item: item[0])
        pair = divergence.evaluate(
            {
                "schema": divergence.INPUT_SCHEMA,
                "left_chain": reps[0][1],
                "right_chain": reps[1][1],
            }
        )
        matrix = receipt["pairwise_matrix"][0]
        self.assertEqual(matrix["relation"], pair["relation"])
        self.assertEqual(
            matrix["common_observed_prefix_length"],
            pair["common_observed_prefix_length"],
        )
        self.assertEqual(
            matrix["parallel_same_version_root_variants_observed"],
            pair["divergence"]["parallel_same_version_root_variants_observed"],
        )

    def test_same_version_root_digest_multiplicity_is_observable_not_verdict(self):
        receipt = branch_set.evaluate(fixture("three-branches.json"))
        v3 = next(
            item
            for item in receipt["observed_root_variant_groups"]
            if item["root_id"] == "fixture-root" and item["root_version"] == 3
        )
        self.assertEqual(v3["distinct_digest_count"], 2)
        self.assertTrue(v3["multiple_root_digests_observed"])
        self.assertTrue(receipt["any_multiple_root_digests_observed"])
        self.assertFalse(receipt["semantic_guards"]["global_equivocation_proven"])

    def test_duplicate_observation_does_not_inflate_distinct_branches_or_pairs(self):
        data = fixture("three-branches.json")
        data["branches"] = [data["branches"][0], copy.deepcopy(data["branches"][0]), data["branches"][1]]
        receipt = branch_set.evaluate(data)
        self.assertEqual(receipt["observation_count"], 3)
        self.assertEqual(receipt["distinct_branch_count"], 2)
        self.assertEqual(receipt["pairwise_entry_count"], 1)
        self.assertEqual(len(receipt["duplicate_observations"]), 1)
        self.assertEqual(receipt["duplicate_observations"][0]["observation_count"], 2)

    def test_duplicate_does_not_change_pairwise_relation(self):
        base = fixture("three-branches.json")
        two = copy.deepcopy(base)
        two["branches"] = two["branches"][:2]
        duplicate = copy.deepcopy(base)
        duplicate["branches"] = [duplicate["branches"][0], duplicate["branches"][0], duplicate["branches"][1]]
        self.assertEqual(
            branch_set.evaluate(two)["pairwise_matrix"],
            branch_set.evaluate(duplicate)["pairwise_matrix"],
        )

    def test_input_order_is_non_semantic(self):
        data = fixture("three-branches.json")
        reversed_data = copy.deepcopy(data)
        reversed_data["branches"] = list(reversed(reversed_data["branches"]))
        self.assertEqual(branch_set.evaluate(data), branch_set.evaluate(reversed_data))

    def test_mixed_prefix_and_divergent_relations_remain_pair_scoped(self):
        receipt = branch_set.evaluate(fixture("mixed.json"))
        relations = [item["relation"] for item in receipt["pairwise_matrix"]]
        prefix_count = sum(
            item in {"LEFT_IS_OBSERVED_PREFIX", "RIGHT_IS_OBSERVED_PREFIX"}
            for item in relations
        )
        divergent_count = relations.count("DIVERGENT_OBSERVED_PATHS")
        self.assertEqual(prefix_count, 1)
        self.assertEqual(divergent_count, 2)

    def test_reconvergence_stays_pair_scoped(self):
        pred = predecessor_divergence_fixture("reconvergent.json")
        left = pred["left_chain"]
        right = pred["right_chain"]
        prefix = {
            "schema": chain.INPUT_SCHEMA,
            "snapshots": copy.deepcopy(left["snapshots"][:2]),
        }
        data = {
            "schema": branch_set.INPUT_SCHEMA,
            "branches": [left, right, prefix],
        }
        receipt = branch_set.evaluate(data)
        reconvergent_pairs = [
            item
            for item in receipt["pairwise_matrix"]
            if item["observed_reconvergence_present"]
        ]
        self.assertEqual(len(reconvergent_pairs), 1)

    def test_unrelated_origin_fails_closed(self):
        data = fixture("three-branches.json")
        data["branches"][2]["snapshots"][0]["runtime_surface"]["document_sha256"] = "9" * 64
        with self.assertRaisesRegex(branch_set.BranchSetInputError, "NO_COMMON_OBSERVED_ORIGIN"):
            branch_set.evaluate(data)

    def test_invalid_branch_fails_whole_set_closed(self):
        data = fixture("three-branches.json")
        del data["branches"][1]["snapshots"][1]["signed_root"]
        with self.assertRaises(branch_set.BranchSetInputError):
            branch_set.evaluate(data)

    def test_single_branch_rejected(self):
        data = fixture("three-branches.json")
        data["branches"] = data["branches"][:1]
        with self.assertRaisesRegex(branch_set.BranchSetInputError, "at least two"):
            branch_set.evaluate(data)

    def test_unknown_top_level_field_rejected(self):
        data = fixture("three-branches.json")
        data["timestamp"] = "2026-09-05T00:00:00Z"
        with self.assertRaises(branch_set.BranchSetInputError):
            branch_set.evaluate(data)

    def test_supplied_pairwise_receipt_rejected(self):
        data = fixture("three-branches.json")
        data["pairwise_receipts"] = []
        with self.assertRaises(branch_set.BranchSetInputError):
            branch_set.evaluate(data)

    def test_unknown_nested_branch_field_rejected(self):
        data = fixture("three-branches.json")
        data["branches"][0]["canonical_branch"] = True
        with self.assertRaises(branch_set.BranchSetInputError):
            branch_set.evaluate(data)

    def test_runtime_digest_cross_branch_content_contradiction_rejected(self):
        data = fixture("three-branches.json")
        left = data["branches"][0]
        right = copy.deepcopy(left)
        right["snapshots"][1]["runtime_surface"]["document_sha256"] = "5" * 64
        right["snapshots"][1]["runtime_surface"]["configured_signers"].append("fixture-witness-8")
        right["snapshots"].append(copy.deepcopy(right["snapshots"][1]))
        right["snapshots"][2]["runtime_surface"]["document_sha256"] = "1" * 64
        data["branches"] = [left, right]
        with self.assertRaisesRegex(branch_set.BranchSetInputError, "runtime_surface document_sha256"):
            branch_set.evaluate(data)

    def test_export_digest_cross_branch_content_contradiction_rejected(self):
        data = fixture("three-branches.json")
        left = data["branches"][0]
        right = copy.deepcopy(left)
        right["snapshots"][1]["export_surface"]["document_sha256"] = "6" * 64
        right["snapshots"][1]["export_surface"]["signers"] = right["snapshots"][1]["export_surface"]["signers"][:-1]
        right["snapshots"].append(copy.deepcopy(right["snapshots"][1]))
        right["snapshots"][2]["export_surface"]["document_sha256"] = "2" * 64
        data["branches"] = [left, right]
        with self.assertRaisesRegex(branch_set.BranchSetInputError, "export_surface document_sha256"):
            branch_set.evaluate(data)

    def test_root_digest_cross_branch_content_contradiction_rejected(self):
        data = fixture("three-branches.json")
        left = data["branches"][0]
        right = copy.deepcopy(data["branches"][0])
        right["snapshots"][1]["signed_root"]["admitted_signers"] = right["snapshots"][1]["signed_root"]["admitted_signers"][:-1]
        data["branches"] = [left, right]
        with self.assertRaisesRegex(branch_set.BranchSetInputError, "signed_root document_sha256"):
            branch_set.evaluate(data)

    def test_branch_set_fingerprint_binds_duplicate_multiplicity(self):
        data = fixture("three-branches.json")
        two = copy.deepcopy(data)
        two["branches"] = two["branches"][:2]
        duplicate = copy.deepcopy(two)
        duplicate["branches"].append(copy.deepcopy(duplicate["branches"][0]))
        self.assertNotEqual(
            branch_set.evaluate(two)["branch_set_fingerprint_sha256"],
            branch_set.evaluate(duplicate)["branch_set_fingerprint_sha256"],
        )

    def test_input_is_not_mutated(self):
        data = fixture("three-branches.json")
        before = copy.deepcopy(data)
        branch_set.evaluate(data)
        self.assertEqual(data, before)

    def test_semantic_guards_deny_global_and_actuating_claims(self):
        receipt = branch_set.evaluate(fixture("three-branches.json"))
        guards = receipt["semantic_guards"]
        required_false = {
            "all_existing_branches_observed",
            "global_non_equivocation_proven",
            "global_equivocation_proven",
            "complete_history_proven",
            "no_omitted_states_proven",
            "complete_fork_topology_proven",
            "trusted_time_proven",
            "canonical_branch_selected",
            "preferred_branch_selected",
            "malicious_behavior_proven",
            "authority_mutated",
            "quorum_mutated",
            "remediation_triggered",
        }
        self.assertTrue(required_false.issubset(guards))
        self.assertTrue(all(guards[key] is False for key in required_false))

    def test_no_aggregate_score_rank_severity_or_fraud_verdict(self):
        receipt = branch_set.evaluate(fixture("three-branches.json"))
        keys = set(deep_find_keys(receipt))
        forbidden = {"score", "rank", "severity", "trust_score", "fraud_proven", "failure_verdict"}
        self.assertTrue(keys.isdisjoint(forbidden))


if __name__ == "__main__":
    unittest.main(verbosity=2)
