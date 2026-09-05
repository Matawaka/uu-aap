#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
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


adapter = load_module("public_review_candidate_adapter_tests", HERE / "adapter.py")


class PublicReviewAdapterTests(unittest.TestCase):
    def test_canonical_checkpoint_projects_one_actual_external_source(self):
        receipt = adapter.project_checkpoint()
        candidate = receipt["candidate_receipt"]
        self.assertEqual(receipt["candidate_profile_sha256"], adapter.candidate_profile_sha256())
        self.assertEqual(candidate["schema"], adapter.profile.SET_RECEIPT_SCHEMA)
        self.assertEqual(candidate["candidate_status"], adapter.profile.CANDIDATE_STATUS)
        self.assertEqual(candidate["observation_count"], 1)
        self.assertEqual(candidate["distinct_observation_count"], 1)
        self.assertEqual(receipt["source_counts"], {
            "known_historical_external_sources": 1,
            "new_external_account_sources": 0,
            "external_discussion_sources": 0,
            "projected_external_sources": 1,
        })
        self.assertTrue(all(receipt["parity"].values()))

    def test_candidate_input_is_neutral_and_coverage_bound(self):
        receipt = adapter.project_checkpoint()
        candidate_input = receipt["candidate_input"]
        checkpoint = json.loads(adapter.CHECKPOINT_PATH.read_text(encoding="utf-8"))
        expected_scope = adapter.profile.canonical_sha256({
            "repository": checkpoint["repository"],
            "covered_surfaces": checkpoint["covered_surfaces"],
        })
        self.assertEqual(candidate_input["scope_binding_sha256"], expected_scope)
        self.assertEqual(set(candidate_input), {"schema", "scope_binding_sha256", "observations"})
        self.assertEqual(
            set(candidate_input["observations"][0]),
            {"semantic_fingerprint_sha256", "source_binding_sha256"},
        )
        text = json.dumps(candidate_input, sort_keys=True)
        for forbidden in ("admission_decision", "disposition_decision", "claim_truth", "verified_human_identity"):
            self.assertNotIn(forbidden, text)

    def test_semantic_source_identity_excludes_account_identity_claims(self):
        issue_receipt = json.loads(adapter.ISSUE_RECEIPT_PATH.read_text(encoding="utf-8"))
        source = issue_receipt["known_historical_external_sources"][0]
        alias = copy.deepcopy(source)
        alias["author_account_identifier"] = "different-public-account-label"
        alias["author_association"] = "COLLABORATOR"
        self.assertEqual(
            adapter.profile.canonical_sha256(
                adapter._issue_source_semantic_identity(issue_receipt["repository"], source)
            ),
            adapter.profile.canonical_sha256(
                adapter._issue_source_semantic_identity(issue_receipt["repository"], alias)
            ),
        )
        self.assertNotEqual(
            adapter.profile.canonical_sha256(source),
            adapter.profile.canonical_sha256(alias),
        )

    def test_exact_source_binding_matches_full_accepted_source_object(self):
        issue_receipt = json.loads(adapter.ISSUE_RECEIPT_PATH.read_text(encoding="utf-8"))
        source = issue_receipt["known_historical_external_sources"][0]
        receipt = adapter.project_checkpoint()
        observation = receipt["candidate_input"]["observations"][0]
        self.assertEqual(
            observation["source_binding_sha256"],
            adapter.profile.canonical_sha256(source),
        )
        expected_semantic = adapter.profile.canonical_sha256(
            adapter._issue_source_semantic_identity(issue_receipt["repository"], source)
        )
        self.assertEqual(observation["semantic_fingerprint_sha256"], expected_semantic)

    def test_checkpoint_coverage_mutation_fails_before_projection(self):
        checkpoint = json.loads(adapter.CHECKPOINT_PATH.read_text(encoding="utf-8"))
        checkpoint["covered_surfaces"]["github_discussions"]["all_repository_discussions"] = True
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "checkpoint.json"
            path.write_text(json.dumps(checkpoint), encoding="utf-8")
            with self.assertRaises(adapter.PublicReviewObservationSetAdapterError):
                adapter.project_checkpoint(path, adapter.ISSUE_RECEIPT_PATH, adapter.DISCUSSION_RECEIPT_PATH)

    def test_issue_source_digest_mutation_fails_before_projection(self):
        issue_receipt = json.loads(adapter.ISSUE_RECEIPT_PATH.read_text(encoding="utf-8"))
        issue_receipt["known_historical_external_sources"][0]["body_sha256"] = "0" * 64
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "issues.json"
            path.write_text(json.dumps(issue_receipt), encoding="utf-8")
            with self.assertRaises(adapter.PublicReviewObservationSetAdapterError):
                adapter.project_checkpoint(adapter.CHECKPOINT_PATH, path, adapter.DISCUSSION_RECEIPT_PATH)

    def test_non_empty_discussion_source_shape_requires_successor_adapter(self):
        discussion = json.loads(adapter.DISCUSSION_RECEIPT_PATH.read_text(encoding="utf-8"))
        discussion["external_account_sources"] = [{"synthetic": "unsupported"}]
        # Directly prove this adapter does not guess a future Discussion identity schema.
        self.assertNotEqual(discussion["external_account_sources"], [])
        # Accepted validator would also reject the mutation; the adapter must never
        # silently project it as an issue-shaped source.
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "discussions.json"
            path.write_text(json.dumps(discussion), encoding="utf-8")
            with self.assertRaises(adapter.PublicReviewObservationSetAdapterError):
                adapter.project_checkpoint(adapter.CHECKPOINT_PATH, adapter.ISSUE_RECEIPT_PATH, path)

    def test_public_review_non_effects_remain_false(self):
        receipt = adapter.project_checkpoint()
        self.assertTrue(all(value is False for value in receipt["non_effects"].values()))
        candidate = receipt["candidate_receipt"]
        self.assertFalse(candidate["semantic_guards"]["truth_proven"])
        self.assertFalse(candidate["semantic_guards"]["authority_created"])
        self.assertFalse(candidate["semantic_guards"]["admission_decision_made"])
        self.assertFalse(candidate["semantic_guards"]["disposition_decision_made"])

    def test_projection_is_deterministic(self):
        self.assertEqual(adapter.project_checkpoint(), adapter.project_checkpoint())


if __name__ == "__main__":
    unittest.main(verbosity=2)
