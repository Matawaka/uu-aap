#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[3]
FIXTURE = REPO_ROOT / "scripts/observed-authority-branch-set/fixtures/three-branches.json"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


adapter = load_module("c2pa_observation_set_candidate_adapter_tests", HERE / "adapter.py")


def fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def set_with(branches) -> dict:
    return {"schema": adapter.branch_set.INPUT_SCHEMA, "branches": copy.deepcopy(branches)}


class C2PAAdapterTests(unittest.TestCase):
    def test_set_projection_consumes_candidate_profile_and_preserves_902_counts(self):
        source = fixture()
        source_receipt = adapter.branch_set.evaluate(source)
        receipt = adapter.project_set(source)
        candidate = receipt["candidate_receipt"]
        self.assertEqual(receipt["candidate_profile_sha256"], adapter.candidate_profile_sha256())
        self.assertEqual(candidate["schema"], adapter.profile.SET_RECEIPT_SCHEMA)
        self.assertEqual(candidate["candidate_status"], adapter.profile.CANDIDATE_STATUS)
        self.assertEqual(candidate["observation_count"], source_receipt["observation_count"])
        self.assertEqual(candidate["distinct_observation_count"], source_receipt["distinct_branch_count"])
        self.assertEqual(candidate["observed_semantic_fingerprints_sha256"], source_receipt["observed_branch_fingerprints_sha256"])
        self.assertTrue(all(receipt["parity"].values()))

    def test_projection_keeps_only_neutral_observation_fields(self):
        projected = adapter.project_set(fixture())["candidate_input"]
        self.assertEqual(set(projected), {"schema", "scope_binding_sha256", "observations"})
        for observation in projected["observations"]:
            self.assertEqual(
                set(observation),
                {"semantic_fingerprint_sha256", "source_binding_sha256"},
            )
        text = json.dumps(projected, sort_keys=True)
        for forbidden in ("quorum", "signed_root", "configured_signers", "admitted_signers", "trust_score"):
            self.assertNotIn(forbidden, text)

    def test_source_binding_is_exact_canonical_branch_input_hash(self):
        source = fixture()
        projected = adapter.project_set(source)["candidate_input"]
        expected = [adapter.profile.canonical_sha256(branch) for branch in source["branches"]]
        actual = [item["source_binding_sha256"] for item in projected["observations"]]
        self.assertEqual(actual, expected)

    def test_membership_transition_parity_with_904(self):
        source = fixture()
        before = set_with(source["branches"][:2])
        after = set_with(source["branches"])
        transition_input = {
            "schema": adapter.set_transition.INPUT_SCHEMA,
            "before_set": before,
            "after_set": after,
        }
        source_receipt = adapter.set_transition.evaluate(transition_input)
        receipt = adapter.project_transition(transition_input)
        self.assertEqual(source_receipt["relation"], "OBSERVED_BRANCH_MEMBERSHIP_CHANGED")
        self.assertEqual(receipt["candidate_receipt"]["relation"], "OBSERVED_MEMBERSHIP_CHANGED")
        self.assertTrue(all(receipt["parity"].values()))

    def test_multiplicity_transition_parity_with_904(self):
        source = fixture()
        before = set_with(source["branches"][:2])
        after = set_with([source["branches"][0], source["branches"][1], source["branches"][1]])
        transition_input = {
            "schema": adapter.set_transition.INPUT_SCHEMA,
            "before_set": before,
            "after_set": after,
        }
        receipt = adapter.project_transition(transition_input)
        self.assertEqual(receipt["candidate_receipt"]["relation"], "OBSERVATION_MULTIPLICITY_ONLY_CHANGED")
        self.assertTrue(receipt["parity"]["multiplicity_lifecycle"])

    def test_chain_parity_with_906(self):
        source = fixture()
        sets = [
            set_with(source["branches"][:2]),
            set_with(source["branches"]),
            set_with([source["branches"][0], source["branches"][1], source["branches"][1]]),
        ]
        chain_input = {"schema": adapter.set_chain.INPUT_SCHEMA, "sets": sets}
        source_receipt = adapter.set_chain.evaluate(chain_input)
        receipt = adapter.project_chain(chain_input)
        candidate = receipt["candidate_receipt"]
        self.assertEqual(candidate["set_count"], source_receipt["set_count"])
        self.assertEqual(candidate["edge_count"], source_receipt["edge_count"])
        self.assertEqual(
            candidate["relation_sequence"],
            [adapter._mapped_relation(item) for item in source_receipt["transition_relation_sequence"]],
        )
        self.assertTrue(candidate["local_observation_set_adjacency"])
        self.assertTrue(all(receipt["parity"].values()))
        self.assertFalse(candidate["semantic_guards"]["complete_observation_history_proven"])
        self.assertFalse(candidate["semantic_guards"]["trusted_time_proven"])

    def test_invalid_902_source_fails_before_candidate_projection(self):
        source = fixture()
        source["unexpected"] = True
        with self.assertRaises(adapter.C2PAObservationSetAdapterError):
            adapter.project_set(source)

    def test_transition_scope_and_semantic_membership_are_source_derived(self):
        source = fixture()
        before = set_with(source["branches"][:2])
        after = set_with(source["branches"])
        receipt = adapter.project_transition({
            "schema": adapter.set_transition.INPUT_SCHEMA,
            "before_set": before,
            "after_set": after,
        })
        candidate = receipt["candidate_receipt"]
        source_receipt = adapter.set_transition.evaluate({
            "schema": adapter.set_transition.INPUT_SCHEMA,
            "before_set": before,
            "after_set": after,
        })
        self.assertEqual(candidate["scope_binding_sha256"], source_receipt["common_origin_snapshot_fingerprint_sha256"])
        self.assertEqual(
            candidate["newly_observed_semantic_fingerprints_sha256"],
            source_receipt["distinct_branch_observation_lifecycle"]["newly_observed_branch_fingerprints"],
        )

    def test_candidate_does_not_promote_c2pa_domain_claims(self):
        receipts = [adapter.project_set(fixture())]
        text = json.dumps(receipts, sort_keys=True)
        self.assertIn('"c2pa_reclassified": false', text)
        self.assertIn('"authority_created": false', text)
        self.assertIn('"stable_core_admitted": false', text)
        self.assertNotIn('"c2pa_reclassified": true', text)
        self.assertNotIn('"authority_created": true', text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
