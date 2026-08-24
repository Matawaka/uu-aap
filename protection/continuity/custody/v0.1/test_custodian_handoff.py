#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent
ENVELOPE_SCHEMA = json.loads((ROOT / "custodian-handoff-envelope.schema.json").read_text(encoding="utf-8"))
RECEIPT_SCHEMA = json.loads((ROOT / "custody-receipt.schema.json").read_text(encoding="utf-8"))

spec = importlib.util.spec_from_file_location("custodian_handoff", ROOT / "custodian_handoff.py")
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

MAIN = "2a0fbd4d67e9db4913658da825336d2c4a8c2888"
TREE = "db02276c32a374eb80bae1ed3701762a9dda7c92"


def envelope(slot="sealed-offline-copy"):
    return mod.build_envelope(
        main_sha=MAIN,
        tree_sha=TREE,
        copy_slot=slot,
        custodian_role_id="custodian-role-b",
        bundle_sha256="1" * 64,
        capture_manifest_sha256="2" * 64,
        metadata_manifest_sha256="3" * 64,
        verification_evidence_sha256="4" * 64,
    )


def receipt(env):
    return {
        "document_type": "uu-aap.continuity-human-custody-receipt",
        "version": "0.1",
        "status": "human-custody-attestation",
        "envelope_digest_sha256": env["envelope_digest_sha256"],
        "copy_slot": env["copy_slot"],
        "custodian_role_id": env["custodian_role_id"],
        "observed_at_utc": "2026-08-24T03:30:00Z",
        "storage_domain_id": "storage-domain-b",
        "custody_evidence_sha256": "5" * 64,
        "copy_bytes_verified": True,
        "offline_confirmed": env["storage_requirements"]["offline_required"],
        "human_attestation_required": True,
        "boundary": {
            "physical_possession_proven": False,
            "custodian_is_successor": False,
            "repository_authority_transferred": False,
            "canonical_successor_claimed": False,
            "rescue_authorized": False,
            "failover_authorized": False,
            "external_execution_authorized": False,
            "kontur_activation_authorized": False,
        },
    }


class CustodianHandoffTests(unittest.TestCase):
    def validate_envelope(self, env):
        Draft202012Validator(ENVELOPE_SCHEMA).validate(env)
        mod.verify_envelope(env)

    def validate_receipt(self, rec):
        Draft202012Validator(RECEIPT_SCHEMA, format_checker=Draft202012Validator.FORMAT_CHECKER).validate(rec)

    def test_envelope_is_deterministic_and_valid(self):
        a = envelope()
        b = envelope()
        self.assertEqual(a, b)
        self.validate_envelope(a)

    def test_offline_slot_requires_offline_storage(self):
        env = envelope("sealed-offline-copy")
        self.assertTrue(env["storage_requirements"]["offline_required"])

    def test_nonoffline_slot_does_not_claim_offline_requirement(self):
        env = envelope("active-local-copy")
        self.assertFalse(env["storage_requirements"]["offline_required"])

    def test_no_credentials_or_account_access_in_envelope(self):
        env = envelope()
        req = env["storage_requirements"]
        self.assertFalse(req["credential_material_included"])
        self.assertFalse(req["encryption_key_included"])
        self.assertFalse(req["account_access_included"])

    def test_envelope_never_executes_handoff(self):
        env = envelope()
        self.assertFalse(env["boundary"]["handoff_executed"])
        self.assertEqual(env["boundary"]["strongest_safe_effect"], "prepare_human_custody_handoff_only")

    def test_digest_tamper_fails_closed(self):
        env = envelope()
        env["artifacts"]["bundle_sha256"] = "9" * 64
        with self.assertRaises(mod.HandoffError):
            mod.verify_envelope(env)

    def test_boundary_tamper_with_recomputed_digest_fails(self):
        env = envelope()
        env["boundary"]["repository_authority_transferred"] = True
        unsigned = copy.deepcopy(env)
        unsigned.pop("envelope_digest_sha256")
        env["envelope_digest_sha256"] = mod.digest_payload(unsigned)
        with self.assertRaises(mod.HandoffError):
            mod.verify_envelope(env)

    def test_unknown_slot_rejected(self):
        with self.assertRaises(mod.HandoffError):
            mod.build_envelope(
                main_sha=MAIN,
                tree_sha=TREE,
                copy_slot="owner-successor-copy",
                custodian_role_id="custodian-role-b",
                bundle_sha256="1" * 64,
                capture_manifest_sha256="2" * 64,
                metadata_manifest_sha256="3" * 64,
                verification_evidence_sha256="4" * 64,
            )

    def test_invalid_hash_rejected(self):
        with self.assertRaises(mod.HandoffError):
            mod.build_envelope(
                main_sha=MAIN,
                tree_sha=TREE,
                copy_slot="sealed-offline-copy",
                custodian_role_id="custodian-role-b",
                bundle_sha256="abc",
                capture_manifest_sha256="2" * 64,
                metadata_manifest_sha256="3" * 64,
                verification_evidence_sha256="4" * 64,
            )

    def test_valid_receipt_is_review_eligible(self):
        env = envelope()
        rec = receipt(env)
        self.validate_envelope(env)
        self.validate_receipt(rec)
        result = mod.assess_receipt(env, rec)
        self.assertEqual(result["state"], "custody_receipt_review_eligible")
        self.assertTrue(result["claims"]["human_custody_attestation_bound"])
        self.assertFalse(result["claims"]["physical_possession_proven"])
        self.assertFalse(result["claims"]["custodian_is_successor"])
        self.assertFalse(result["claims"]["kontur_activation_authorized"])

    def test_wrong_envelope_digest_is_insufficient(self):
        env = envelope()
        rec = receipt(env)
        rec["envelope_digest_sha256"] = "0" * 64
        result = mod.assess_receipt(env, rec)
        self.assertEqual(result["state"], "custody_receipt_insufficient")
        self.assertIn("envelope_digest_mismatch", result["reasons"])

    def test_wrong_copy_slot_is_insufficient(self):
        env = envelope()
        rec = receipt(env)
        rec["copy_slot"] = "active-local-copy"
        result = mod.assess_receipt(env, rec)
        self.assertEqual(result["state"], "custody_receipt_insufficient")
        self.assertIn("copy_slot_mismatch", result["reasons"])

    def test_wrong_custodian_role_is_insufficient(self):
        env = envelope()
        rec = receipt(env)
        rec["custodian_role_id"] = "custodian-role-x"
        result = mod.assess_receipt(env, rec)
        self.assertEqual(result["state"], "custody_receipt_insufficient")
        self.assertIn("custodian_role_mismatch", result["reasons"])

    def test_offline_slot_requires_human_offline_confirmation(self):
        env = envelope()
        rec = receipt(env)
        rec["offline_confirmed"] = False
        result = mod.assess_receipt(env, rec)
        self.assertEqual(result["state"], "custody_receipt_insufficient")
        self.assertIn("offline_custody_not_confirmed", result["reasons"])

    def test_authority_overclaim_rejected_by_receipt_schema(self):
        env = envelope()
        rec = receipt(env)
        rec["boundary"]["repository_authority_transferred"] = True
        with self.assertRaises(Exception):
            self.validate_receipt(rec)

    def test_successor_overclaim_rejected_by_receipt_schema(self):
        env = envelope()
        rec = receipt(env)
        rec["boundary"]["custodian_is_successor"] = True
        with self.assertRaises(Exception):
            self.validate_receipt(rec)

    def test_kontur_overclaim_rejected_by_receipt_schema(self):
        env = envelope()
        rec = receipt(env)
        rec["boundary"]["kontur_activation_authorized"] = True
        with self.assertRaises(Exception):
            self.validate_receipt(rec)


if __name__ == "__main__":
    unittest.main()
