#!/usr/bin/env python3
"""Hostile and positive coverage for observed branch-set transition chains."""

from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


chain_receipt = _load_module(
    "observed_authority_branch_set_transition_chain_test",
    HERE / "receipt.py",
)
branch_set = _load_module(
    "observed_authority_branch_set_for_chain_test",
    SCRIPTS / "observed-authority-branch-set" / "receipt.py",
)

THREE_FIXTURE = (
    SCRIPTS / "observed-authority-branch-set" / "fixtures" / "three-branches.json"
)


def three_fixture() -> dict:
    return json.loads(THREE_FIXTURE.read_text(encoding="utf-8"))


def make_set(*branches: dict) -> dict:
    return {
        "schema": branch_set.INPUT_SCHEMA,
        "branches": [copy.deepcopy(item) for item in branches],
    }


def make_input(*sets: dict) -> dict:
    return {
        "schema": chain_receipt.INPUT_SCHEMA,
        "sets": [copy.deepcopy(item) for item in sets],
    }


def abc_branches() -> tuple[dict, dict, dict]:
    data = three_fixture()
    return tuple(copy.deepcopy(item) for item in data["branches"])  # type: ignore[return-value]


class BranchSetTransitionChainTests(unittest.TestCase):
    def test_minimum_two_set_chain(self):
        a, b, c = abc_branches()
        receipt = chain_receipt.evaluate(make_input(make_set(a, b), make_set(a, b, c)))
        self.assertEqual(receipt["set_count"], 2)
        self.assertEqual(receipt["edge_count"], 1)
        self.assertEqual(
            receipt["transition_relation_sequence"],
            ["OBSERVED_BRANCH_MEMBERSHIP_CHANGED"],
        )
        self.assertTrue(receipt["local_observation_set_adjacency"])

    def test_three_set_membership_sequence_is_observation_only(self):
        a, b, c = abc_branches()
        receipt = chain_receipt.evaluate(
            make_input(make_set(a, b), make_set(a, b, c), make_set(a, b))
        )
        self.assertEqual(
            receipt["transition_relation_sequence"],
            [
                "OBSERVED_BRANCH_MEMBERSHIP_CHANGED",
                "OBSERVED_BRANCH_MEMBERSHIP_CHANGED",
            ],
        )
        first = receipt["edges"][0]["distinct_branch_observation_lifecycle"]
        second = receipt["edges"][1]["distinct_branch_observation_lifecycle"]
        self.assertEqual(len(first["newly_observed_branch_fingerprints"]), 1)
        self.assertEqual(len(second["not_observed_in_after_branch_fingerprints"]), 1)
        self.assertFalse(
            receipt["semantic_guards"]["newly_observed_proves_branch_creation"]
        )
        self.assertFalse(
            receipt["semantic_guards"]["not_observed_in_next_proves_branch_deletion"]
        )

    def test_multiplicity_only_interior_sequence(self):
        a, b, _ = abc_branches()
        receipt = chain_receipt.evaluate(
            make_input(make_set(a, b), make_set(a, b, a), make_set(a, b))
        )
        self.assertEqual(
            receipt["transition_relation_sequence"],
            [
                "OBSERVATION_MULTIPLICITY_ONLY_CHANGED",
                "OBSERVATION_MULTIPLICITY_ONLY_CHANGED",
            ],
        )
        self.assertEqual(
            receipt["transition_relation_counts"][
                "OBSERVATION_MULTIPLICITY_ONLY_CHANGED"
            ],
            2,
        )

    def test_semantic_noop_under_input_reorder(self):
        a, b, _ = abc_branches()
        receipt = chain_receipt.evaluate(make_input(make_set(a, b), make_set(b, a)))
        self.assertEqual(
            receipt["transition_relation_sequence"], ["IDENTICAL_OBSERVED_SET"]
        )
        self.assertEqual(
            receipt["sets"][0]["branch_set_fingerprint_sha256"],
            receipt["sets"][1]["branch_set_fingerprint_sha256"],
        )
        self.assertNotEqual(
            receipt["sets"][0]["set_input_fingerprint_sha256"],
            receipt["sets"][1]["set_input_fingerprint_sha256"],
        )

    def test_repeated_exact_set_is_valid_noop(self):
        a, b, _ = abc_branches()
        observed = make_set(a, b)
        receipt = chain_receipt.evaluate(make_input(observed, observed))
        self.assertEqual(
            receipt["transition_relation_sequence"], ["IDENTICAL_OBSERVED_SET"]
        )
        self.assertEqual(
            receipt["sets"][0]["set_input_fingerprint_sha256"],
            receipt["sets"][1]["set_input_fingerprint_sha256"],
        )
        self.assertFalse(
            receipt["semantic_guards"]["repeated_observation_proves_continuous_existence"]
        )

    def test_single_set_rejected(self):
        a, b, _ = abc_branches()
        with self.assertRaisesRegex(
            chain_receipt.BranchSetTransitionChainInputError,
            "at least two",
        ):
            chain_receipt.evaluate(make_input(make_set(a, b)))

    def test_sets_must_be_array(self):
        data = {"schema": chain_receipt.INPUT_SCHEMA, "sets": {}}
        with self.assertRaisesRegex(
            chain_receipt.BranchSetTransitionChainInputError, "must be an array"
        ):
            chain_receipt.evaluate(data)

    def test_wrong_schema_rejected(self):
        a, b, _ = abc_branches()
        data = make_input(make_set(a, b), make_set(a, b))
        data["schema"] = "wrong"
        with self.assertRaisesRegex(
            chain_receipt.BranchSetTransitionChainInputError, "unexpected input schema"
        ):
            chain_receipt.evaluate(data)

    def test_unknown_top_level_field_rejected(self):
        a, b, _ = abc_branches()
        data = make_input(make_set(a, b), make_set(a, b))
        data["transition_receipts"] = []
        with self.assertRaisesRegex(
            chain_receipt.BranchSetTransitionChainInputError, "keys mismatch"
        ):
            chain_receipt.evaluate(data)

    def test_invalid_interior_set_fails_closed(self):
        a, b, c = abc_branches()
        invalid = make_set(a, b)
        invalid["branches"][0]["snapshots"] = invalid["branches"][0]["snapshots"][:1]
        with self.assertRaisesRegex(
            chain_receipt.BranchSetTransitionChainInputError, r"sets\[1\] invalid"
        ):
            chain_receipt.evaluate(
                make_input(make_set(a, b), invalid, make_set(a, b, c))
            )

    def test_changed_common_origin_fails_closed(self):
        a, b, _ = abc_branches()
        changed_a = copy.deepcopy(a)
        changed_b = copy.deepcopy(b)
        for branch in (changed_a, changed_b):
            branch["snapshots"][0]["runtime_surface"]["document_sha256"] = "9" * 64
        changed = make_set(changed_a, changed_b)
        # The set itself remains structurally valid; chain semantics reject the
        # different canonical observed origin.
        branch_set.evaluate(changed)
        with self.assertRaisesRegex(
            chain_receipt.BranchSetTransitionChainInputError,
            "OBSERVED_SET_ORIGIN_CHANGED",
        ):
            chain_receipt.evaluate(make_input(make_set(a, b), changed))

    def test_nonadjacent_same_root_digest_contradiction_fails_closed(self):
        a, b, c = abc_branches()
        bad_a = copy.deepcopy(a)
        bad_a["snapshots"][1]["signed_root"]["admitted_signers"] = bad_a[
            "snapshots"
        ][1]["signed_root"]["admitted_signers"][:-1]

        before = make_set(a, b)
        middle = make_set(c, c)
        after = make_set(bad_a, c)

        # Each set and each adjacent pair can be valid in isolation because the
        # conflicting root digest is absent from the middle observation set.
        branch_set.evaluate(before)
        branch_set.evaluate(middle)
        branch_set.evaluate(after)

        with self.assertRaisesRegex(
            chain_receipt.BranchSetTransitionChainInputError,
            "chain-wide digest/content inconsistency",
        ):
            chain_receipt.evaluate(make_input(before, middle, after))

    def test_nonadjacent_alias_and_order_semantics_remain_admissible(self):
        a, b, c = abc_branches()
        alias_a = copy.deepcopy(a)
        second = alias_a["snapshots"][1]
        second["runtime_surface"]["id"] = "fixture-runtime-alias"
        second["export_surface"]["id"] = "fixture-export-alias"
        second["runtime_surface"]["configured_signers"] = list(
            reversed(second["runtime_surface"]["configured_signers"])
        )
        second["export_surface"]["signers"] = list(
            reversed(second["export_surface"]["signers"])
        )
        second["signed_root"]["admitted_signers"] = list(
            reversed(second["signed_root"]["admitted_signers"])
        )

        receipt = chain_receipt.evaluate(
            make_input(make_set(a, b), make_set(c, c), make_set(alias_a, c))
        )
        self.assertEqual(receipt["set_count"], 3)
        self.assertTrue(receipt["local_observation_set_adjacency"])

    def test_edge_fingerprints_bind_neighboring_semantic_sets(self):
        a, b, c = abc_branches()
        receipt = chain_receipt.evaluate(
            make_input(make_set(a, b), make_set(a, b, c), make_set(a, c))
        )
        for index, edge in enumerate(receipt["edges"]):
            self.assertEqual(
                edge["before_set_fingerprint_sha256"],
                receipt["sets"][index]["branch_set_fingerprint_sha256"],
            )
            self.assertEqual(
                edge["after_set_fingerprint_sha256"],
                receipt["sets"][index + 1]["branch_set_fingerprint_sha256"],
            )

    def test_edge_count_is_set_count_minus_one(self):
        a, b, c = abc_branches()
        receipt = chain_receipt.evaluate(
            make_input(make_set(a, b), make_set(a, b, c), make_set(a, c))
        )
        self.assertEqual(receipt["edge_count"], receipt["set_count"] - 1)
        self.assertEqual(len(receipt["edges"]), receipt["edge_count"])

    def test_relation_counts_are_complete_and_deterministic(self):
        a, b, c = abc_branches()
        receipt = chain_receipt.evaluate(
            make_input(make_set(a, b), make_set(a, b, a), make_set(a, b, c))
        )
        self.assertEqual(
            set(receipt["transition_relation_counts"]),
            set(chain_receipt.ALLOWED_RELATIONS),
        )
        self.assertEqual(
            sum(receipt["transition_relation_counts"].values()),
            receipt["edge_count"],
        )

    def test_common_origin_repeated_on_every_set_and_edge(self):
        a, b, c = abc_branches()
        receipt = chain_receipt.evaluate(
            make_input(make_set(a, b), make_set(a, b, c), make_set(a, c))
        )
        origin = receipt["common_origin_snapshot_fingerprint_sha256"]
        self.assertTrue(all(item["common_origin_snapshot_fingerprint_sha256"] == origin for item in receipt["sets"]))
        self.assertTrue(all(item["common_origin_snapshot_fingerprint_sha256"] == origin for item in receipt["edges"]))

    def test_input_is_not_mutated(self):
        a, b, c = abc_branches()
        data = make_input(make_set(a, b), make_set(a, b, c))
        original = copy.deepcopy(data)
        chain_receipt.evaluate(data)
        self.assertEqual(data, original)

    def test_output_is_deterministic(self):
        a, b, c = abc_branches()
        data = make_input(make_set(a, b), make_set(a, b, c), make_set(a, c))
        self.assertEqual(chain_receipt.evaluate(data), chain_receipt.evaluate(data))

    def test_semantic_nonclaims_are_explicit(self):
        a, b, _ = abc_branches()
        receipt = chain_receipt.evaluate(make_input(make_set(a, b), make_set(b, a)))
        guards = receipt["semantic_guards"]
        for key in (
            "complete_observation_history_proven",
            "no_omitted_observation_sets_proven",
            "trusted_time_proven",
            "set_sequence_proves_chronology",
            "newly_observed_proves_branch_creation",
            "not_observed_in_next_proves_branch_deletion",
            "repeated_observation_proves_continuous_existence",
            "complete_fork_topology_proven",
            "global_non_equivocation_proven",
            "global_equivocation_proven",
            "append_only_log_proven",
            "canonical_branch_selected",
            "preferred_branch_selected",
            "authority_mutated",
            "quorum_mutated",
            "remediation_triggered",
        ):
            self.assertIs(guards[key], False)

    def test_no_aggregate_score_or_verdict(self):
        a, b, c = abc_branches()
        receipt = chain_receipt.evaluate(make_input(make_set(a, b), make_set(a, b, c)))
        encoded = json.dumps(receipt, sort_keys=True)
        for forbidden in (
            "trust_score",
            "severity_score",
            "fraud_score",
            "progress_score",
            "aggregate_score",
            "global_verdict",
        ):
            self.assertNotIn(forbidden, encoded)

    def test_caller_supplied_timestamp_control_rejected(self):
        a, b, _ = abc_branches()
        data = make_input(make_set(a, b), make_set(a, b))
        data["trusted_timestamp"] = "2026-09-05T00:00:00Z"
        with self.assertRaises(chain_receipt.BranchSetTransitionChainInputError):
            chain_receipt.evaluate(data)

    def test_caller_supplied_completeness_claim_rejected(self):
        a, b, _ = abc_branches()
        data = make_input(make_set(a, b), make_set(a, b))
        data["complete_observation_history"] = True
        with self.assertRaises(chain_receipt.BranchSetTransitionChainInputError):
            chain_receipt.evaluate(data)

    def test_caller_supplied_transition_receipts_rejected(self):
        a, b, _ = abc_branches()
        data = make_input(make_set(a, b), make_set(a, b))
        data["edges"] = []
        with self.assertRaises(chain_receipt.BranchSetTransitionChainInputError):
            chain_receipt.evaluate(data)


if __name__ == "__main__":
    unittest.main(verbosity=2)
