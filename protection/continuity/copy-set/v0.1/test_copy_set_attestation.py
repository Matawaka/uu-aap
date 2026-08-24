#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent
SCHEMA = json.loads((ROOT / "copy-set-attestation.schema.json").read_text(encoding="utf-8"))
EXAMPLE = json.loads((ROOT / "reference.copy-set-attestation.json").read_text(encoding="utf-8"))

spec = importlib.util.spec_from_file_location("copy_set_assessor", ROOT / "copy_set_assessor.py")
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class CopySetAttestationTests(unittest.TestCase):
    def validate_schema(self, payload):
        Draft202012Validator(SCHEMA, format_checker=Draft202012Validator.FORMAT_CHECKER).validate(payload)

    def assess(self, payload):
        self.validate_schema(payload)
        return mod.assess(payload)

    def test_reference_example_is_review_eligible(self):
        result = self.assess(copy.deepcopy(EXAMPLE))
        self.assertEqual(result["state"], "copy_set_review_eligible")
        self.assertEqual(len(result["eligible_copy_ids"]), 3)
        self.assertTrue(result["claims"]["policy_thresholds_met_by_declared_evidence"])
        self.assertFalse(result["claims"]["physical_independence_proven"])
        self.assertFalse(result["claims"]["kontur_activation_authorized"])

    def test_two_copies_are_insufficient(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"] = payload["copies"][:2]
        payload["independence_attestations"] = payload["independence_attestations"][:1]
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")

    def test_one_custodian_is_insufficient(self):
        payload = copy.deepcopy(EXAMPLE)
        for item in payload["copies"]:
            item["custodian_id"] = "custodian-a"
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")

    def test_no_offline_copy_is_insufficient(self):
        payload = copy.deepcopy(EXAMPLE)
        for item in payload["copies"]:
            item["offline"] = False
            if item["access_mode"] == "offline":
                item["access_mode"] = "local"
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")

    def test_duplicate_storage_domain_is_insufficient(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"][2]["storage_domain_id"] = payload["copies"][0]["storage_domain_id"]
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")

    def test_reused_credential_domain_is_insufficient(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"][2]["credential_domain_id"] = payload["copies"][0]["credential_domain_id"]
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")

    def test_stale_capture_disqualifies_copy(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"][2]["captured_at_utc"] = "2026-08-01T00:00:00Z"
        payload["copies"][2]["verified_at_utc"] = "2026-08-02T00:00:00Z"
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")
        self.assertIn("capture_stale", result["disqualified_copies"]["copy-remote-c"])

    def test_future_timestamp_fails_copy(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"][0]["verified_at_utc"] = "2026-08-25T00:00:00Z"
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")
        self.assertIn("future_timestamp", result["disqualified_copies"]["copy-local-a"])

    def test_main_frontier_mismatch_disqualifies_copy(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"][1]["source_main_sha"] = "0" * 40
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")
        self.assertIn("main_frontier_mismatch", result["disqualified_copies"]["copy-offline-b"])

    def test_tree_frontier_mismatch_disqualifies_copy(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"][1]["source_tree_sha"] = "0" * 40
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")
        self.assertIn("tree_frontier_mismatch", result["disqualified_copies"]["copy-offline-b"])

    def test_metadata_backup_required(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"][0]["metadata_backup_present"] = False
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")

    def test_missing_pair_support_is_insufficient(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["independence_attestations"] = payload["independence_attestations"][:2]
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")

    def test_indeterminate_does_not_count_as_support(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["independence_attestations"][0]["result"] = "indeterminate"
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")

    def test_fresh_contradiction_blocks_pair(self):
        payload = copy.deepcopy(EXAMPLE)
        contradiction = copy.deepcopy(payload["independence_attestations"][0])
        contradiction["attestation_id"] = "contradiction-local-offline"
        contradiction["result"] = "contradict"
        contradiction["evidence_sha256"] = "9" * 64
        payload["independence_attestations"].append(contradiction)
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")
        self.assertEqual(result["fresh_contradict_pair_count"], 1)

    def test_stale_support_does_not_count(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["independence_attestations"][0]["observed_at_utc"] = "2026-06-01T00:00:00Z"
        result = self.assess(payload)
        self.assertEqual(result["state"], "copy_set_insufficient")
        self.assertEqual(result["stale_independence_attestation_count"], 1)

    def test_unknown_copy_in_attestation_fails_closed(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["independence_attestations"][0]["copy_b"] = "unknown-copy"
        with self.assertRaises(mod.AssessmentError):
            self.assess(payload)

    def test_self_pair_fails_closed(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["independence_attestations"][0]["copy_b"] = payload["independence_attestations"][0]["copy_a"]
        with self.assertRaises(mod.AssessmentError):
            self.assess(payload)

    def test_weakened_policy_fails_closed(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["policy_binding"]["minimum_independent_copies"] = 2
        with self.assertRaises(Exception):
            self.assess(payload)

    def test_boundary_overclaim_rejected_by_schema(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["boundary"]["authority_transferred"] = True
        with self.assertRaises(Exception):
            self.validate_schema(payload)

    def test_kontur_overclaim_rejected_by_schema(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["boundary"]["kontur_activation_authorized"] = True
        with self.assertRaises(Exception):
            self.validate_schema(payload)

    def test_shared_credentials_claim_rejected_by_schema(self):
        payload = copy.deepcopy(EXAMPLE)
        payload["copies"][0]["shared_credentials_declared"] = True
        with self.assertRaises(Exception):
            self.validate_schema(payload)


if __name__ == "__main__":
    unittest.main()
