#!/usr/bin/env python3

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from receipt import TriangulationInputError, evaluate  # noqa: E402


def load(name):
    return json.loads((HERE / "fixtures" / name).read_text(encoding="utf-8"))


class AuthoritySurfaceTriangulationTests(unittest.TestCase):
    def test_corrected_external_shape_keeps_three_surfaces_distinct(self):
        receipt = evaluate(load("corrected-external-shape.json"))
        rr = receipt["comparisons"]["runtime_vs_signed_root"]
        er = receipt["comparisons"]["export_vs_signed_root"]
        re = receipt["comparisons"]["runtime_vs_export"]

        self.assertFalse(rr["delta_present"])
        self.assertEqual(rr["configured_but_unadmitted"], [])
        self.assertEqual(rr["admitted_but_unconfigured"], [])

        self.assertTrue(er["delta_present"])
        self.assertEqual(er["exported_but_unadmitted"], ["fixture-witness-8"])
        self.assertEqual(er["admitted_but_unexported"], [])

        self.assertTrue(re["delta_present"])
        self.assertEqual(re["configured_but_unexported"], [])
        self.assertEqual(re["exported_but_unconfigured"], ["fixture-witness-8"])
        self.assertTrue(receipt["any_delta_present"])

    def test_all_aligned_has_no_delta(self):
        receipt = evaluate(load("aligned.json"))
        self.assertFalse(receipt["any_delta_present"])
        for pair in receipt["comparisons"].values():
            self.assertFalse(pair["delta_present"])

    def test_runtime_only_drift_is_not_misattributed_to_export(self):
        receipt = evaluate(load("runtime-only.json"))
        rr = receipt["comparisons"]["runtime_vs_signed_root"]
        er = receipt["comparisons"]["export_vs_signed_root"]
        re = receipt["comparisons"]["runtime_vs_export"]
        self.assertEqual(rr["configured_but_unadmitted"], ["fixture-witness-8"])
        self.assertFalse(er["delta_present"])
        self.assertEqual(re["configured_but_unexported"], ["fixture-witness-8"])
        self.assertEqual(re["exported_but_unconfigured"], [])

    def test_root_only_drift_is_visible_on_both_root_edges(self):
        receipt = evaluate(load("root-only.json"))
        rr = receipt["comparisons"]["runtime_vs_signed_root"]
        er = receipt["comparisons"]["export_vs_signed_root"]
        re = receipt["comparisons"]["runtime_vs_export"]
        self.assertEqual(rr["admitted_but_unconfigured"], ["fixture-witness-7"])
        self.assertEqual(er["admitted_but_unexported"], ["fixture-witness-7"])
        self.assertFalse(re["delta_present"])

    def test_independent_bidirectional_shape_preserves_all_six_directions(self):
        receipt = evaluate(load("independent-bidirectional.json"))
        rr = receipt["comparisons"]["runtime_vs_signed_root"]
        er = receipt["comparisons"]["export_vs_signed_root"]
        re = receipt["comparisons"]["runtime_vs_export"]

        self.assertEqual(
            rr["configured_but_unadmitted"],
            sorted(["fixture-witness-2", "fixture-witness-8"]),
        )
        self.assertEqual(
            rr["admitted_but_unconfigured"],
            sorted(["fixture-witness-4", "fixture-witness-10"]),
        )
        self.assertEqual(
            er["exported_but_unadmitted"],
            sorted(["fixture-witness-3", "fixture-witness-9"]),
        )
        self.assertEqual(
            er["admitted_but_unexported"],
            sorted(["fixture-witness-4", "fixture-witness-10"]),
        )
        self.assertEqual(
            re["configured_but_unexported"],
            sorted(["fixture-witness-2", "fixture-witness-8"]),
        )
        self.assertEqual(
            re["exported_but_unconfigured"],
            sorted(["fixture-witness-3", "fixture-witness-9"]),
        )

    def test_successor_root_does_not_backfill_v2_or_imply_runtime_update(self):
        v2 = evaluate(load("corrected-external-shape.json"))
        v3 = evaluate(load("successor-v3.json"))
        self.assertEqual(v2["signed_root"]["version"], 2)
        self.assertEqual(v3["signed_root"]["version"], 3)
        self.assertNotEqual(
            v2["signed_root"]["document_sha256"],
            v3["signed_root"]["document_sha256"],
        )
        self.assertEqual(
            v2["comparisons"]["export_vs_signed_root"]["exported_but_unadmitted"],
            ["fixture-witness-8"],
        )
        self.assertFalse(v3["comparisons"]["export_vs_signed_root"]["delta_present"])
        self.assertEqual(
            v3["comparisons"]["runtime_vs_signed_root"]["admitted_but_unconfigured"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            v3["comparisons"]["runtime_vs_export"]["exported_but_unconfigured"],
            ["fixture-witness-8"],
        )
        self.assertFalse(
            v2["semantic_guards"]["successor_root_backfills_historical_receipt"]
        )

    def test_unverified_root_rejected(self):
        data = load("corrected-external-shape.json")
        data["signed_root"]["verification_status"] = "UNVERIFIED"
        with self.assertRaises(TriangulationInputError):
            evaluate(data)

    def test_duplicate_signers_rejected_on_each_surface(self):
        cases = [
            ("runtime_surface", "configured_signers"),
            ("export_surface", "signers"),
            ("signed_root", "admitted_signers"),
        ]
        for object_name, key in cases:
            data = load("corrected-external-shape.json")
            data[object_name][key].append(data[object_name][key][0])
            with self.subTest(surface=object_name):
                with self.assertRaises(TriangulationInputError):
                    evaluate(data)

    def test_empty_signer_rejected(self):
        data = load("corrected-external-shape.json")
        data["runtime_surface"]["configured_signers"].append("")
        with self.assertRaises(TriangulationInputError):
            evaluate(data)

    def test_malformed_digest_rejected_on_each_surface(self):
        cases = [
            ("runtime_surface", "document_sha256"),
            ("export_surface", "document_sha256"),
            ("signed_root", "document_sha256"),
        ]
        for object_name, key in cases:
            data = load("corrected-external-shape.json")
            data[object_name][key] = "bad"
            with self.subTest(surface=object_name):
                with self.assertRaises(TriangulationInputError):
                    evaluate(data)

    def test_wrong_schema_rejected(self):
        data = load("corrected-external-shape.json")
        data["schema"] = "urn:wrong"
        with self.assertRaises(TriangulationInputError):
            evaluate(data)

    def test_nonpositive_or_boolean_root_version_rejected(self):
        for value in [0, True]:
            data = load("corrected-external-shape.json")
            data["signed_root"]["version"] = value
            with self.subTest(version=value):
                with self.assertRaises(TriangulationInputError):
                    evaluate(data)

    def test_unknown_top_level_field_rejected(self):
        data = load("corrected-external-shape.json")
        data["alert_policy"] = "NONE"
        with self.assertRaises(TriangulationInputError):
            evaluate(data)

    def test_unknown_nested_field_rejected_on_each_surface(self):
        for object_name in ["runtime_surface", "export_surface", "signed_root"]:
            data = load("corrected-external-shape.json")
            data[object_name]["latest"] = True
            with self.subTest(surface=object_name):
                with self.assertRaises(TriangulationInputError):
                    evaluate(data)

    def test_all_six_directional_delta_fields_are_always_present(self):
        receipt = evaluate(load("aligned.json"))
        self.assertEqual(
            set(receipt["comparisons"]["runtime_vs_signed_root"]),
            {"configured_but_unadmitted", "admitted_but_unconfigured", "delta_present"},
        )
        self.assertEqual(
            set(receipt["comparisons"]["export_vs_signed_root"]),
            {"exported_but_unadmitted", "admitted_but_unexported", "delta_present"},
        )
        self.assertEqual(
            set(receipt["comparisons"]["runtime_vs_export"]),
            {"configured_but_unexported", "exported_but_unconfigured", "delta_present"},
        )

    def test_receipt_has_no_score_alert_remediation_or_quorum_action(self):
        receipt = evaluate(load("corrected-external-shape.json"))
        serialized = json.dumps(receipt, sort_keys=True).lower()
        for forbidden in [
            '"aggregate_score"',
            '"trust_score"',
            '"severity"',
            '"rank"',
            '"alert_policy"',
            '"remediation_command"',
            '"quorum_override"',
            '"admit"',
            '"revoke"',
        ]:
            self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
