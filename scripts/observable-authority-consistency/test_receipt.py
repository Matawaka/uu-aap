#!/usr/bin/env python3

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from receipt import ReceiptInputError, evaluate  # noqa: E402


def load(name):
    return json.loads((HERE / "fixtures" / name).read_text(encoding="utf-8"))


class ObservableAuthorityConsistencyTests(unittest.TestCase):
    def test_external_shape_prints_exported_unadmitted_delta(self):
        receipt = evaluate(load("external-shape.json"))
        self.assertEqual(
            receipt["consistency"]["state"],
            "EXPORTED_UNADMITTED_PRESENT",
        )
        self.assertTrue(receipt["consistency"]["delta_present"])
        self.assertEqual(
            receipt["consistency"]["exported_but_unadmitted"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["consistency"]["admitted_but_unexported"],
            [],
        )
        self.assertFalse(
            receipt["semantic_guards"]["alert_policy_required_for_observability"]
        )

    def test_aligned(self):
        receipt = evaluate(load("aligned.json"))
        self.assertEqual(receipt["consistency"]["state"], "ALIGNED")
        self.assertFalse(receipt["consistency"]["delta_present"])
        self.assertEqual(receipt["consistency"]["exported_but_unadmitted"], [])
        self.assertEqual(receipt["consistency"]["admitted_but_unexported"], [])

    def test_reverse_delta(self):
        receipt = evaluate(load("reverse-delta.json"))
        self.assertEqual(
            receipt["consistency"]["state"],
            "ADMITTED_UNEXPORTED_PRESENT",
        )
        self.assertEqual(
            receipt["consistency"]["admitted_but_unexported"],
            ["fixture-witness-7"],
        )

    def test_bidirectional_delta(self):
        receipt = evaluate(load("bidirectional.json"))
        self.assertEqual(receipt["consistency"]["state"], "BIDIRECTIONAL_DELTA")
        self.assertEqual(
            receipt["consistency"]["exported_but_unadmitted"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["consistency"]["admitted_but_unexported"],
            ["fixture-witness-7"],
        )

    def test_successor_root_does_not_rewrite_v2(self):
        v2 = evaluate(load("external-shape.json"))
        v3 = evaluate(load("successor-v3.json"))
        self.assertEqual(v2["signed_root"]["version"], 2)
        self.assertEqual(v3["signed_root"]["version"], 3)
        self.assertNotEqual(
            v2["signed_root"]["document_sha256"],
            v3["signed_root"]["document_sha256"],
        )
        self.assertEqual(
            v2["consistency"]["state"],
            "EXPORTED_UNADMITTED_PRESENT",
        )
        self.assertEqual(v3["consistency"]["state"], "ALIGNED")
        self.assertFalse(
            v2["semantic_guards"]["successor_root_backfills_historical_receipt"]
        )

    def test_unverified_root_rejected(self):
        data = load("external-shape.json")
        data["signed_root"]["verification_status"] = "UNVERIFIED"
        with self.assertRaises(ReceiptInputError):
            evaluate(data)

    def test_duplicate_exported_signer_rejected(self):
        data = load("external-shape.json")
        data["export_surface"]["signers"].append("fixture-witness-1")
        with self.assertRaises(ReceiptInputError):
            evaluate(data)

    def test_duplicate_admitted_signer_rejected(self):
        data = load("external-shape.json")
        data["signed_root"]["admitted_signers"].append("fixture-witness-1")
        with self.assertRaises(ReceiptInputError):
            evaluate(data)

    def test_empty_signer_rejected(self):
        data = load("external-shape.json")
        data["export_surface"]["signers"].append("")
        with self.assertRaises(ReceiptInputError):
            evaluate(data)

    def test_malformed_export_digest_rejected(self):
        data = load("external-shape.json")
        data["export_surface"]["document_sha256"] = "bad"
        with self.assertRaises(ReceiptInputError):
            evaluate(data)

    def test_malformed_root_digest_rejected(self):
        data = load("external-shape.json")
        data["signed_root"]["document_sha256"] = "BAD"
        with self.assertRaises(ReceiptInputError):
            evaluate(data)

    def test_forbidden_score_or_remediation_fields_rejected(self):
        for key, value in [
            ("aggregate_score", 1),
            ("trust_score", 0.9),
            ("severity", "high"),
            ("remediation_command", "revoke"),
            ("quorum_override", 3),
            ("revoke", ["fixture-witness-8"]),
        ]:
            data = load("external-shape.json")
            data[key] = value
            with self.subTest(key=key):
                with self.assertRaises(ReceiptInputError):
                    evaluate(data)

    def test_alert_policy_field_rejected(self):
        data = load("external-shape.json")
        data["alert_policy"] = "NONE"
        with self.assertRaises(ReceiptInputError):
            evaluate(data)

    def test_unknown_nested_fields_rejected(self):
        for section, key in [
            ("export_surface", "display_hint"),
            ("signed_root", "latest"),
        ]:
            data = load("external-shape.json")
            data[section][key] = True
            with self.subTest(section=section, key=key):
                with self.assertRaises(ReceiptInputError):
                    evaluate(data)

    def test_receipt_has_no_score_or_remediation_action(self):
        receipt = evaluate(load("external-shape.json"))
        serialized = json.dumps(receipt, sort_keys=True).lower()
        for forbidden in [
            '"aggregate_score"',
            '"trust_score"',
            '"severity"',
            '"remediation_command"',
            '"quorum_override"',
        ]:
            self.assertNotIn(forbidden, serialized)

    def test_wrong_schema_rejected(self):
        data = load("external-shape.json")
        data["schema"] = "urn:wrong"
        with self.assertRaises(ReceiptInputError):
            evaluate(data)


if __name__ == "__main__":
    unittest.main()
