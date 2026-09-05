#!/usr/bin/env python3
"""Hostile and positive tests for observed authority branch-set transition v0.1."""

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


transition = load_module("branch_set_transition", HERE / "receipt.py")
branch_set = load_module(
    "branch_set_predecessor",
    SCRIPTS / "observed-authority-branch-set" / "receipt.py",
)


def predecessor_fixture(name: str) -> dict:
    return json.loads(
        (
            SCRIPTS
            / "observed-authority-branch-set"
            / "fixtures"
            / name
        ).read_text(encoding="utf-8")
    )


def transition_input(before_branches: list[dict], after_branches: list[dict]) -> dict:
    return {
        "schema": transition.INPUT_SCHEMA,
        "before_set": {
            "schema": branch_set.INPUT_SCHEMA,
            "branches": copy.deepcopy(before_branches),
        },
        "after_set": {
            "schema": branch_set.INPUT_SCHEMA,
            "branches": copy.deepcopy(after_branches),
        },
    }


def abc() -> tuple[dict, dict, dict]:
    branches = predecessor_fixture("three-branches.json")["branches"]
    return tuple(copy.deepcopy(branches))  # type: ignore[return-value]


class BranchSetTransitionTests(unittest.TestCase):
    def test_identical_set_is_input_order_invariant(self):
        a, b, c = abc()
        receipt = transition.evaluate(transition_input([a, b, c], [c, a, b]))
        self.assertEqual(receipt["relation"], "IDENTICAL_OBSERVED_SET")
        self.assertFalse(receipt["branch_membership_changed"])
        self.assertFalse(receipt["any_observation_count_change"])
        self.assertEqual(
            receipt["before_set"]["branch_set_fingerprint_sha256"],
            receipt["after_set"]["branch_set_fingerprint_sha256"],
        )

    def test_multiplicity_only_change_is_not_membership_change(self):
        a, b, _ = abc()
        receipt = transition.evaluate(transition_input([a, b], [a, b, b]))
        self.assertEqual(
            receipt["relation"], "OBSERVATION_MULTIPLICITY_ONLY_CHANGED"
        )
        self.assertFalse(receipt["branch_membership_changed"])
        self.assertTrue(receipt["persisted_branch_multiplicity_changed"])
        self.assertTrue(receipt["any_observation_count_change"])

    def test_new_branch_is_only_newly_observed(self):
        a, b, c = abc()
        receipt = transition.evaluate(transition_input([a, c], [a, b, c]))
        life = receipt["distinct_branch_observation_lifecycle"]
        self.assertEqual(len(life["newly_observed_branch_fingerprints"]), 1)
        self.assertEqual(life["not_observed_in_after_branch_fingerprints"], [])
        self.assertEqual(receipt["relation"], "OBSERVED_BRANCH_MEMBERSHIP_CHANGED")
        self.assertFalse(
            receipt["semantic_guards"]["newly_observed_proves_branch_creation"]
        )

    def test_branch_absence_after_is_not_deletion(self):
        a, b, c = abc()
        receipt = transition.evaluate(transition_input([a, b, c], [a, c]))
        life = receipt["distinct_branch_observation_lifecycle"]
        self.assertEqual(len(life["not_observed_in_after_branch_fingerprints"]), 1)
        self.assertEqual(life["newly_observed_branch_fingerprints"], [])
        self.assertFalse(
            receipt["semantic_guards"][
                "not_observed_in_after_proves_branch_deletion"
            ]
        )

    def test_membership_and_persisted_multiplicity_change_are_separate(self):
        a, b, c = abc()
        receipt = transition.evaluate(transition_input([a, b], [a, a, c]))
        self.assertEqual(
            receipt["relation"], "OBSERVED_BRANCH_AND_MULTIPLICITY_CHANGED"
        )
        self.assertTrue(receipt["branch_membership_changed"])
        self.assertTrue(receipt["persisted_branch_multiplicity_changed"])

    def test_root_variant_expansion_is_only_newly_observed_digest(self):
        a, b, c = abc()
        receipt = transition.evaluate(transition_input([a, c], [a, b, c]))
        v3 = next(
            item
            for item in receipt["observed_root_variant_lifecycle"]
            if item["root_id"] == "fixture-root" and item["root_version"] == 3
        )
        self.assertEqual(v3["newly_observed_digests"], ["b" * 64])
        self.assertEqual(v3["observed_in_both_digests"], ["a" * 64])
        self.assertFalse(
            receipt["semantic_guards"]["root_digest_newly_observed_proves_issuance"]
        )

    def test_root_variant_contraction_is_not_revocation(self):
        a, b, c = abc()
        receipt = transition.evaluate(transition_input([a, b, c], [a, c]))
        v3 = next(
            item
            for item in receipt["observed_root_variant_lifecycle"]
            if item["root_id"] == "fixture-root" and item["root_version"] == 3
        )
        self.assertEqual(v3["not_observed_in_after_digests"], ["b" * 64])
        self.assertFalse(
            receipt["semantic_guards"]["root_digest_absent_after_proves_revocation"]
        )

    def test_pairwise_lifecycle_tracks_only_observed_membership(self):
        a, b, c = abc()
        receipt = transition.evaluate(transition_input([a, c], [a, b, c]))
        pairs = receipt["pairwise_observation_lifecycle"]
        self.assertEqual(len(pairs["newly_observed_pairs"]), 2)
        self.assertEqual(pairs["not_observed_in_after_pairs"], [])
        self.assertEqual(len(pairs["observed_in_both_pairs"]), 1)
        self.assertEqual(len(pairs["observed_in_both_pair_evidence"]), 1)

    def test_persistent_pair_evidence_is_preserved_under_duplicate_change(self):
        a, _, c = abc()
        receipt = transition.evaluate(transition_input([a, c], [a, c, c]))
        pairs = receipt["pairwise_observation_lifecycle"]
        self.assertEqual(pairs["newly_observed_pairs"], [])
        self.assertEqual(pairs["not_observed_in_after_pairs"], [])
        self.assertEqual(len(pairs["observed_in_both_pair_evidence"]), 1)

    def test_different_valid_origins_fail_closed(self):
        a, _, c = abc()
        before = [a, c]
        after = copy.deepcopy(before)
        for branch in after:
            branch["snapshots"][0]["runtime_surface"]["document_sha256"] = "9" * 64
        with self.assertRaisesRegex(
            transition.BranchSetTransitionInputError, "OBSERVED_SET_ORIGIN_CHANGED"
        ):
            transition.evaluate(transition_input(before, after))

    def test_invalid_before_set_fails_closed(self):
        a, b, _ = abc()
        data = transition_input([a], [a, b])
        with self.assertRaisesRegex(
            transition.BranchSetTransitionInputError, "before_set invalid"
        ):
            transition.evaluate(data)

    def test_invalid_after_set_fails_closed(self):
        a, b, _ = abc()
        data = transition_input([a, b], [a])
        with self.assertRaisesRegex(
            transition.BranchSetTransitionInputError, "after_set invalid"
        ):
            transition.evaluate(data)

    def _cross_set_membership_mutation(self, surface_name: str) -> dict:
        a, _, c = abc()
        before = [a, c]
        after = copy.deepcopy(before)
        for branch in after:
            for snapshot in branch["snapshots"]:
                surface = snapshot[surface_name]
                if surface_name == "runtime_surface":
                    surface["configured_signers"] = list(surface["configured_signers"]) + [
                        "fixture-witness-9"
                    ]
                elif surface_name == "export_surface":
                    surface["signers"] = list(surface["signers"]) + [
                        "fixture-witness-9"
                    ]
                else:
                    if snapshot["signed_root"]["version"] == 2:
                        surface["admitted_signers"] = list(
                            surface["admitted_signers"]
                        ) + ["fixture-witness-8"]
        return transition_input(before, after)

    def test_cross_set_runtime_digest_contradiction_fails_closed(self):
        with self.assertRaisesRegex(
            transition.BranchSetTransitionInputError,
            "cross-set digest/content inconsistency",
        ):
            transition.evaluate(self._cross_set_membership_mutation("runtime_surface"))

    def test_cross_set_export_digest_contradiction_fails_closed(self):
        with self.assertRaisesRegex(
            transition.BranchSetTransitionInputError,
            "cross-set digest/content inconsistency",
        ):
            transition.evaluate(self._cross_set_membership_mutation("export_surface"))

    def test_cross_set_root_digest_contradiction_fails_closed(self):
        with self.assertRaisesRegex(
            transition.BranchSetTransitionInputError,
            "cross-set digest/content inconsistency",
        ):
            transition.evaluate(self._cross_set_membership_mutation("signed_root"))

    def test_later_surface_alias_change_is_not_digest_contradiction(self):
        a, _, c = abc()
        before = [a, c]
        after = copy.deepcopy(before)
        for branch in after:
            if len(branch["snapshots"]) > 1:
                branch["snapshots"][1]["runtime_surface"]["id"] = "runtime-alias"
        receipt = transition.evaluate(transition_input(before, after))
        self.assertTrue(receipt["branch_membership_changed"])

    def test_later_signer_order_change_is_not_digest_contradiction(self):
        a, _, c = abc()
        before = [a, c]
        after = copy.deepcopy(before)
        for branch in after:
            if len(branch["snapshots"]) > 1:
                signers = branch["snapshots"][1]["runtime_surface"][
                    "configured_signers"
                ]
                branch["snapshots"][1]["runtime_surface"][
                    "configured_signers"
                ] = list(reversed(signers))
        receipt = transition.evaluate(transition_input(before, after))
        self.assertTrue(receipt["branch_membership_changed"])

    def test_unknown_top_level_fields_are_rejected(self):
        a, b, _ = abc()
        for field in (
            "timestamp",
            "trusted_time",
            "latest_branch",
            "canonical_branch",
            "branch_created",
            "branch_deleted",
            "score",
            "remediate",
        ):
            data = transition_input([a, b], [a, b])
            data[field] = True
            with self.subTest(field=field):
                with self.assertRaises(transition.BranchSetTransitionInputError):
                    transition.evaluate(data)

    def test_unknown_nested_set_fields_are_rejected(self):
        a, b, _ = abc()
        data = transition_input([a, b], [a, b])
        data["after_set"]["canonical"] = True
        with self.assertRaisesRegex(
            transition.BranchSetTransitionInputError, "after_set invalid"
        ):
            transition.evaluate(data)

    def test_input_is_not_mutated(self):
        a, b, _ = abc()
        data = transition_input([a, b], [a, b, b])
        original = copy.deepcopy(data)
        transition.evaluate(data)
        self.assertEqual(data, original)

    def test_output_is_deterministic(self):
        a, b, c = abc()
        data = transition_input([a, c], [a, b, c])
        self.assertEqual(transition.evaluate(data), transition.evaluate(copy.deepcopy(data)))

    def test_semantic_guards_remain_false(self):
        a, b, c = abc()
        guards = transition.evaluate(transition_input([a, c], [a, b, c]))[
            "semantic_guards"
        ]
        self.assertTrue(guards)
        self.assertTrue(all(value is False for value in guards.values()))

    def test_receipt_contains_no_aggregate_score_or_verdict(self):
        a, b, c = abc()
        receipt = transition.evaluate(transition_input([a, c], [a, b, c]))
        forbidden = {
            "score",
            "trust_score",
            "severity",
            "likelihood",
            "fraud",
            "failure_verdict",
            "equivocation_verdict",
        }
        self.assertTrue(forbidden.isdisjoint(receipt.keys()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
