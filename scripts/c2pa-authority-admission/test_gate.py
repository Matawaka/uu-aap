#!/usr/bin/env python3

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from gate import GateInputError, evaluate  # noqa: E402


def load_fixture(name):
    return json.loads((HERE / "fixtures" / name).read_text(encoding="utf-8"))


def by_signer(receipt, signer):
    return next(
        item for item in receipt["signatures"]["evaluations"]
        if item["signer"] == signer
    )


class AuthorityAdmissionGateTests(unittest.TestCase):
    def test_hostile_configured_extra_signature_cannot_satisfy_quorum(self):
        receipt = evaluate(load_fixture("hostile-drift.json"))
        self.assertEqual(
            receipt["configuration"]["authority_admission_status"],
            "CONFIGURED_UNADMITTED_PRESENT",
        )
        self.assertEqual(
            receipt["configuration"]["configured_but_unadmitted"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["signatures"]["cryptographically_valid_distinct_signer_count"], 4
        )
        self.assertEqual(receipt["signatures"]["eligible_distinct_signer_count"], 3)
        self.assertEqual(receipt["quorum_result"], "QUORUM_NOT_MET")
        w8 = by_signer(receipt, "fixture-witness-8")
        self.assertEqual(w8["state"], "CRYPTOGRAPHICALLY_VALID_BUT_UNADMITTED")
        self.assertEqual(
            w8["excluded_reason"], "VALID_BUT_NOT_ADMITTED_BY_SIGNED_ROOT"
        )
        self.assertFalse(w8["quorum_eligible"])

    def test_positive_quorum_counts_only_admitted_distinct_valid_signers(self):
        receipt = evaluate(load_fixture("positive.json"))
        self.assertEqual(receipt["signatures"]["eligible_distinct_signer_count"], 4)
        self.assertEqual(receipt["quorum_result"], "QUORUM_MET")
        self.assertFalse(by_signer(receipt, "fixture-witness-8")["quorum_eligible"])

    def test_duplicate_signature_does_not_inflate_quorum(self):
        data = load_fixture("hostile-drift.json")
        data["signatures"].append(
            {"signer": "fixture-witness-1", "crypto_status": "VALID"}
        )
        receipt = evaluate(data)
        self.assertEqual(receipt["signatures"]["observation_count"], 5)
        self.assertEqual(receipt["signatures"]["distinct_signer_count"], 4)
        self.assertEqual(receipt["signatures"]["eligible_distinct_signer_count"], 3)
        self.assertEqual(receipt["quorum_result"], "QUORUM_NOT_MET")
        self.assertEqual(by_signer(receipt, "fixture-witness-1")["observation_count"], 2)

    def test_conflicting_crypto_observations_fail_closed_for_that_signer(self):
        data = load_fixture("positive.json")
        data["signatures"].append(
            {"signer": "fixture-witness-4", "crypto_status": "INVALID"}
        )
        receipt = evaluate(data)
        w4 = by_signer(receipt, "fixture-witness-4")
        self.assertEqual(w4["state"], "CONFLICTING_CRYPTO_OBSERVATIONS")
        self.assertFalse(w4["quorum_eligible"])
        self.assertEqual(receipt["signatures"]["eligible_distinct_signer_count"], 3)
        self.assertEqual(receipt["quorum_result"], "QUORUM_NOT_MET")

    def test_invalid_admitted_signature_is_not_eligible(self):
        data = load_fixture("positive.json")
        for item in data["signatures"]:
            if item["signer"] == "fixture-witness-4":
                item["crypto_status"] = "INVALID"
        receipt = evaluate(data)
        self.assertEqual(receipt["signatures"]["eligible_distinct_signer_count"], 3)
        self.assertEqual(receipt["quorum_result"], "QUORUM_NOT_MET")
        self.assertEqual(
            by_signer(receipt, "fixture-witness-4")["state"],
            "CRYPTOGRAPHICALLY_INVALID",
        )

    def test_successor_root_does_not_backfill_v2(self):
        v2 = evaluate(load_fixture("successor-v2.json"))
        v3 = evaluate(load_fixture("successor-v3.json"))
        self.assertEqual(v2["trust_root"]["version"], 2)
        self.assertEqual(v3["trust_root"]["version"], 3)
        self.assertFalse(by_signer(v2, "fixture-witness-8")["quorum_eligible"])
        self.assertTrue(by_signer(v3, "fixture-witness-8")["quorum_eligible"])
        self.assertEqual(v2["quorum_result"], "QUORUM_NOT_MET")
        self.assertEqual(v3["quorum_result"], "QUORUM_MET")
        self.assertFalse(
            v2["semantic_guards"]["successor_root_backfills_historical_eligibility"]
        )

    def test_admitted_but_not_configured_is_drift_not_authority_revocation(self):
        data = load_fixture("positive.json")
        data["configured_signers"].remove("fixture-witness-4")
        receipt = evaluate(data)
        self.assertEqual(
            receipt["configuration"]["authority_admission_status"],
            "BIDIRECTIONAL_DRIFT",
        )
        self.assertIn(
            "fixture-witness-4",
            receipt["configuration"]["admitted_but_unconfigured"],
        )
        self.assertTrue(by_signer(receipt, "fixture-witness-4")["quorum_eligible"])
        self.assertEqual(receipt["quorum_result"], "QUORUM_MET")

    def test_duplicate_admitted_keys_are_rejected(self):
        data = load_fixture("hostile-drift.json")
        data["trust_root"]["admitted_signers"].append("fixture-witness-1")
        with self.assertRaises(GateInputError):
            evaluate(data)

    def test_impossible_quorum_is_rejected(self):
        data = load_fixture("hostile-drift.json")
        data["trust_root"]["quorum_required"] = 8
        with self.assertRaises(GateInputError):
            evaluate(data)

    def test_unknown_crypto_status_is_rejected(self):
        data = load_fixture("hostile-drift.json")
        data["signatures"][0]["crypto_status"] = "TRUSTED"
        with self.assertRaises(GateInputError):
            evaluate(data)

    def test_receipt_has_no_aggregate_score(self):
        receipt = evaluate(load_fixture("positive.json"))
        serialized = json.dumps(receipt, sort_keys=True).lower()
        self.assertNotIn('"aggregate_score"', serialized)
        self.assertNotIn('"trust_score"', serialized)


if __name__ == "__main__":
    unittest.main()
