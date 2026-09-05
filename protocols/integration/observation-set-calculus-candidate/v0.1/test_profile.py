#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


profile = load_module("observation_set_calculus_candidate_tests", HERE / "profile.py")


def obs(semantic: str, source: str) -> dict:
    return {
        "semantic_fingerprint_sha256": semantic * 64,
        "source_binding_sha256": source * 64,
    }


def set_input(items, scope="a") -> dict:
    return {
        "schema": profile.SET_INPUT_SCHEMA,
        "scope_binding_sha256": scope * 64,
        "observations": copy.deepcopy(items),
    }


class CandidateProfileTests(unittest.TestCase):
    def test_empty_observed_set_is_valid_and_not_complete_world(self):
        receipt = profile.evaluate_set(set_input([]))
        self.assertEqual(receipt["observation_count"], 0)
        self.assertEqual(receipt["distinct_observation_count"], 0)
        self.assertFalse(receipt["semantic_guards"]["complete_world_state_proven"])
        self.assertFalse(receipt["semantic_guards"]["all_existing_observations_observed"])

    def test_set_input_order_changes_exact_binding_not_semantic_set(self):
        left = set_input([obs("1", "a"), obs("2", "b")])
        right = set_input([obs("2", "b"), obs("1", "a")])
        a = profile.evaluate_set(left)
        b = profile.evaluate_set(right)
        self.assertNotEqual(a["exact_input_fingerprint_sha256"], b["exact_input_fingerprint_sha256"])
        self.assertEqual(a["semantic_set_fingerprint_sha256"], b["semantic_set_fingerprint_sha256"])

    def test_same_semantic_observation_can_have_different_source_representation(self):
        receipt = profile.evaluate_set(set_input([obs("1", "a"), obs("1", "b")]))
        self.assertEqual(receipt["observation_count"], 2)
        self.assertEqual(receipt["distinct_observation_count"], 1)
        item = receipt["distinct_observations"][0]
        self.assertEqual(item["observation_count"], 2)
        self.assertEqual(item["distinct_source_binding_sha256"], ["a" * 64, "b" * 64])

    def test_same_source_binding_cannot_map_to_different_semantics(self):
        with self.assertRaises(profile.ObservationSetInputError):
            profile.evaluate_set(set_input([obs("1", "a"), obs("2", "a")]))

    def test_duplicate_multiplicity_is_explicit(self):
        receipt = profile.evaluate_set(set_input([obs("1", "a"), obs("1", "a")]))
        self.assertEqual(receipt["duplicate_observations"], [
            {"semantic_fingerprint_sha256": "1" * 64, "observation_count": 2}
        ])

    def test_transition_tracks_new_absent_and_persisted_membership(self):
        data = {
            "schema": profile.TRANSITION_INPUT_SCHEMA,
            "before_set": set_input([obs("1", "a"), obs("2", "b")]),
            "after_set": set_input([obs("2", "b"), obs("3", "c")]),
        }
        receipt = profile.evaluate_transition(data)
        self.assertEqual(receipt["relation"], "OBSERVED_MEMBERSHIP_CHANGED")
        self.assertEqual(receipt["newly_observed_semantic_fingerprints_sha256"], ["3" * 64])
        self.assertEqual(receipt["not_observed_in_after_semantic_fingerprints_sha256"], ["1" * 64])
        self.assertEqual(receipt["observed_in_both_semantic_fingerprints_sha256"], ["2" * 64])
        self.assertFalse(receipt["semantic_guards"]["newly_observed_proves_creation"])
        self.assertFalse(receipt["semantic_guards"]["not_observed_in_after_proves_deletion"])

    def test_transition_distinguishes_multiplicity_only_change(self):
        data = {
            "schema": profile.TRANSITION_INPUT_SCHEMA,
            "before_set": set_input([obs("1", "a")]),
            "after_set": set_input([obs("1", "a"), obs("1", "b")]),
        }
        receipt = profile.evaluate_transition(data)
        self.assertEqual(receipt["relation"], "OBSERVATION_MULTIPLICITY_ONLY_CHANGED")
        self.assertFalse(receipt["membership_changed"])
        self.assertTrue(receipt["persisted_multiplicity_changed"])

    def test_transition_combines_membership_and_persisted_multiplicity(self):
        data = {
            "schema": profile.TRANSITION_INPUT_SCHEMA,
            "before_set": set_input([obs("1", "a"), obs("2", "b")]),
            "after_set": set_input([obs("1", "a"), obs("1", "c"), obs("3", "d")]),
        }
        receipt = profile.evaluate_transition(data)
        self.assertEqual(receipt["relation"], "OBSERVED_MEMBERSHIP_AND_MULTIPLICITY_CHANGED")
        self.assertTrue(receipt["membership_changed"])
        self.assertTrue(receipt["persisted_multiplicity_changed"])

    def test_identical_semantic_set_under_reorder_is_identical_transition(self):
        data = {
            "schema": profile.TRANSITION_INPUT_SCHEMA,
            "before_set": set_input([obs("1", "a"), obs("2", "b")]),
            "after_set": set_input([obs("2", "b"), obs("1", "a")]),
        }
        receipt = profile.evaluate_transition(data)
        self.assertEqual(receipt["relation"], "IDENTICAL_OBSERVED_SET")
        self.assertEqual(receipt["before_set_fingerprint_sha256"], receipt["after_set_fingerprint_sha256"])

    def test_transition_rejects_scope_change(self):
        data = {
            "schema": profile.TRANSITION_INPUT_SCHEMA,
            "before_set": set_input([obs("1", "a")], scope="a"),
            "after_set": set_input([obs("1", "a")], scope="b"),
        }
        with self.assertRaises(profile.ObservationSetInputError):
            profile.evaluate_transition(data)

    def test_transition_rejects_cross_set_source_semantic_collision(self):
        data = {
            "schema": profile.TRANSITION_INPUT_SCHEMA,
            "before_set": set_input([obs("1", "a")]),
            "after_set": set_input([obs("2", "a")]),
        }
        with self.assertRaises(profile.ObservationSetInputError):
            profile.evaluate_transition(data)

    def test_minimum_chain_has_one_exactly_bound_edge(self):
        data = {
            "schema": profile.CHAIN_INPUT_SCHEMA,
            "sets": [set_input([obs("1", "a")]), set_input([obs("1", "a"), obs("2", "b")])],
        }
        receipt = profile.evaluate_chain(data)
        self.assertEqual(receipt["set_count"], 2)
        self.assertEqual(receipt["edge_count"], 1)
        self.assertTrue(receipt["local_observation_set_adjacency"])
        self.assertEqual(receipt["edges"][0]["before_set_fingerprint_sha256"], receipt["sets"][0]["semantic_set_fingerprint_sha256"])
        self.assertEqual(receipt["edges"][0]["after_set_fingerprint_sha256"], receipt["sets"][1]["semantic_set_fingerprint_sha256"])

    def test_chain_preserves_relation_sequence_and_counts(self):
        data = {
            "schema": profile.CHAIN_INPUT_SCHEMA,
            "sets": [
                set_input([obs("1", "a")]),
                set_input([obs("1", "a"), obs("2", "b")]),
                set_input([obs("1", "a"), obs("2", "b"), obs("2", "c")]),
            ],
        }
        receipt = profile.evaluate_chain(data)
        self.assertEqual(receipt["relation_sequence"], [
            "OBSERVED_MEMBERSHIP_CHANGED",
            "OBSERVATION_MULTIPLICITY_ONLY_CHANGED",
        ])
        self.assertEqual(receipt["relation_counts"]["OBSERVED_MEMBERSHIP_CHANGED"], 1)
        self.assertEqual(receipt["relation_counts"]["OBSERVATION_MULTIPLICITY_ONLY_CHANGED"], 1)
        self.assertFalse(receipt["semantic_guards"]["complete_observation_history_proven"])
        self.assertFalse(receipt["semantic_guards"]["trusted_time_proven"])

    def test_chain_rejects_non_adjacent_source_semantic_collision(self):
        data = {
            "schema": profile.CHAIN_INPUT_SCHEMA,
            "sets": [
                set_input([obs("1", "a")]),
                set_input([]),
                set_input([obs("2", "a")]),
            ],
        }
        with self.assertRaises(profile.ObservationSetInputError):
            profile.evaluate_chain(data)

    def test_chain_rejects_single_set(self):
        with self.assertRaises(profile.ObservationSetInputError):
            profile.evaluate_chain({"schema": profile.CHAIN_INPUT_SCHEMA, "sets": [set_input([])]})

    def test_closed_world_rejects_unknown_fields_at_each_layer(self):
        bad_set = set_input([])
        bad_set["truth"] = True
        with self.assertRaises(profile.ObservationSetInputError):
            profile.evaluate_set(bad_set)

        bad_obs_set = set_input([obs("1", "a")])
        bad_obs_set["observations"][0]["authority"] = True
        with self.assertRaises(profile.ObservationSetInputError):
            profile.evaluate_set(bad_obs_set)

        bad_transition = {
            "schema": profile.TRANSITION_INPUT_SCHEMA,
            "before_set": set_input([]),
            "after_set": set_input([]),
            "trusted_time": True,
        }
        with self.assertRaises(profile.ObservationSetInputError):
            profile.evaluate_transition(bad_transition)

    def test_receipts_have_no_aggregate_score_or_authority_effects(self):
        receipts = [
            profile.evaluate_set(set_input([obs("1", "a")])),
            profile.evaluate_transition({
                "schema": profile.TRANSITION_INPUT_SCHEMA,
                "before_set": set_input([obs("1", "a")]),
                "after_set": set_input([obs("1", "a")]),
            }),
            profile.evaluate_chain({
                "schema": profile.CHAIN_INPUT_SCHEMA,
                "sets": [set_input([obs("1", "a")]), set_input([obs("1", "a")])],
            }),
        ]
        forbidden = {"trust_score", "truth_score", "severity", "rank", "action_permit", "authorized"}
        for receipt in receipts:
            text = str(receipt).lower()
            for key in forbidden:
                self.assertNotIn(key, receipt)
            self.assertEqual(receipt["candidate_status"], profile.CANDIDATE_STATUS)
            self.assertNotIn("action_permit_created': true", text)

    def test_evaluation_is_deterministic_and_input_immutable(self):
        data = {
            "schema": profile.CHAIN_INPUT_SCHEMA,
            "sets": [set_input([obs("1", "a")]), set_input([obs("1", "a"), obs("2", "b")])],
        }
        original = copy.deepcopy(data)
        first = profile.evaluate_chain(data)
        second = profile.evaluate_chain(data)
        self.assertEqual(first, second)
        self.assertEqual(data, original)


if __name__ == "__main__":
    unittest.main(verbosity=2)
