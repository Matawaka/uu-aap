#!/usr/bin/env python3

import copy
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from receipt import ChainInputError, evaluate  # noqa: E402


def load(name):
    return json.loads((HERE / "fixtures" / name).read_text(encoding="utf-8"))


class AuthoritySurfaceContinuityChainTests(unittest.TestCase):
    def test_three_snapshot_mixed_chain(self):
        receipt = evaluate(load("three-snapshot.json"))
        self.assertEqual(receipt["snapshot_count"], 3)
        self.assertEqual(receipt["edge_count"], 2)
        self.assertEqual(
            receipt["root_relation_sequence"],
            ["SAME_ROOT", "SUCCESSOR_ROOT"],
        )
        self.assertEqual(receipt["root_relation_counts"]["same_root"], 1)
        self.assertEqual(receipt["root_relation_counts"]["successor_root"], 1)
        self.assertTrue(receipt["local_adjacency_continuous"])

    def test_edge_fingerprints_bind_exact_interior_snapshot(self):
        receipt = evaluate(load("three-snapshot.json"))
        self.assertEqual(
            receipt["edges"][0]["after_snapshot_fingerprint_sha256"],
            receipt["snapshots"][1]["snapshot_fingerprint_sha256"],
        )
        self.assertEqual(
            receipt["edges"][1]["before_snapshot_fingerprint_sha256"],
            receipt["snapshots"][1]["snapshot_fingerprint_sha256"],
        )

    def test_all_same_root_chain(self):
        receipt = evaluate(load("all-same-root.json"))
        self.assertEqual(
            receipt["root_relation_sequence"], ["SAME_ROOT", "SAME_ROOT"]
        )
        self.assertEqual(receipt["root_relation_counts"]["same_root"], 2)
        self.assertEqual(receipt["root_relation_counts"]["successor_root"], 0)

    def test_no_op_interior_edge_is_valid(self):
        receipt = evaluate(load("no-op-interior.json"))
        edge0 = receipt["edges"][0]
        self.assertEqual(edge0["root_relation"], "SAME_ROOT")
        self.assertFalse(edge0["any_membership_change"])
        self.assertFalse(edge0["any_delta_lifecycle_change"])
        self.assertEqual(
            edge0["before_snapshot_fingerprint_sha256"],
            edge0["after_snapshot_fingerprint_sha256"],
        )

    def test_two_snapshot_minimum(self):
        receipt = evaluate(load("two-snapshot.json"))
        self.assertEqual(receipt["snapshot_count"], 2)
        self.assertEqual(receipt["edge_count"], 1)
        self.assertTrue(receipt["local_adjacency_continuous"])

    def test_single_snapshot_rejected(self):
        data = load("two-snapshot.json")
        data["snapshots"] = data["snapshots"][:1]
        with self.assertRaises(ChainInputError):
            evaluate(data)

    def test_snapshots_must_be_array(self):
        data = load("two-snapshot.json")
        data["snapshots"] = {}
        with self.assertRaises(ChainInputError):
            evaluate(data)

    def test_wrong_schema_rejected(self):
        data = load("two-snapshot.json")
        data["schema"] = "urn:wrong"
        with self.assertRaises(ChainInputError):
            evaluate(data)

    def test_unknown_top_level_semantic_control_rejected(self):
        for key, value in [
            ("trusted_timestamp", "2026-01-01T00:00:00Z"),
            ("latest_root", True),
            ("history_complete", True),
            ("global_non_equivocation_proven", True),
            ("append_only", True),
            ("edge_receipts", []),
            ("remediation", "apply"),
            ("trust_score", 1.0),
        ]:
            data = load("two-snapshot.json")
            data[key] = value
            with self.subTest(key=key):
                with self.assertRaises(ChainInputError):
                    evaluate(data)

    def test_unknown_nested_snapshot_field_rejected(self):
        data = load("two-snapshot.json")
        data["snapshots"][1]["timestamp"] = "2026-01-01T00:00:00Z"
        with self.assertRaises(ChainInputError):
            evaluate(data)

    def test_malformed_interior_snapshot_rejected(self):
        data = load("three-snapshot.json")
        data["snapshots"][1]["signed_root"]["verification_status"] = "UNVERIFIED"
        with self.assertRaises(ChainInputError):
            evaluate(data)

    def test_interior_root_rollback_rejected(self):
        data = load("three-snapshot.json")
        data["snapshots"][2]["signed_root"]["version"] = 1
        data["snapshots"][2]["signed_root"]["document_sha256"] = "6666666666666666666666666666666666666666666666666666666666666666"
        with self.assertRaises(ChainInputError):
            evaluate(data)

    def test_same_version_root_replacement_rejected(self):
        data = load("three-snapshot.json")
        data["snapshots"][2]["signed_root"]["version"] = 2
        with self.assertRaises(ChainInputError):
            evaluate(data)

    def test_same_digest_changed_export_content_rejected(self):
        data = load("two-snapshot.json")
        data["snapshots"][1]["export_surface"]["document_sha256"] = data[
            "snapshots"
        ][0]["export_surface"]["document_sha256"]
        with self.assertRaises(ChainInputError):
            evaluate(data)

    def test_input_is_not_mutated(self):
        data = load("three-snapshot.json")
        original = copy.deepcopy(data)
        evaluate(data)
        self.assertEqual(data, original)

    def test_deterministic_receipt(self):
        data = load("three-snapshot.json")
        first = evaluate(data)
        second = evaluate(copy.deepcopy(data))
        self.assertEqual(first, second)

    def test_edge_count_is_snapshot_count_minus_one(self):
        for name in [
            "two-snapshot.json",
            "three-snapshot.json",
            "all-same-root.json",
            "no-op-interior.json",
        ]:
            with self.subTest(name=name):
                receipt = evaluate(load(name))
                self.assertEqual(
                    receipt["edge_count"], receipt["snapshot_count"] - 1
                )
                self.assertEqual(len(receipt["edges"]), receipt["edge_count"])
                self.assertEqual(
                    len(receipt["snapshots"]), receipt["snapshot_count"]
                )

    def test_nonclaims_remain_explicit_false(self):
        receipt = evaluate(load("three-snapshot.json"))
        guards = receipt["semantic_guards"]
        for key in [
            "history_complete",
            "no_omitted_states_proven",
            "global_non_equivocation_proven",
            "no_parallel_fork_proven",
            "append_only_log_proven",
            "trusted_time_proven",
            "chain_order_proves_chronology",
            "chain_proves_causality",
            "chain_mints_or_mutates_authority",
            "chain_calculates_or_mutates_quorum",
            "chain_triggers_alert_or_remediation",
        ]:
            with self.subTest(key=key):
                self.assertIs(guards[key], False)

    def test_no_aggregate_score_or_verdict(self):
        receipt = evaluate(load("three-snapshot.json"))
        serialized = json.dumps(receipt, sort_keys=True).lower()
        for forbidden in [
            '"aggregate_score"',
            '"trust_score"',
            '"severity"',
            '"failure_verdict"',
            '"complete_history"',
        ]:
            self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
