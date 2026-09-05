#!/usr/bin/env python3

import copy
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from receipt import TransitionInputError, evaluate  # noqa: E402


def load(name: str) -> dict:
    return json.loads((HERE / "fixtures" / name).read_text(encoding="utf-8"))


class AuthoritySurfaceTransitionTests(unittest.TestCase):
    def test_root_successor_preserves_exact_lifecycle(self):
        receipt = evaluate(load("root-successor.json"))
        self.assertEqual(receipt["root_relation"], "SUCCESSOR_ROOT")
        self.assertEqual(
            receipt["surface_transitions"]["root_admission"]["added"],
            ["fixture-witness-8"],
        )
        self.assertEqual(receipt["surface_transitions"]["runtime"]["added"], [])
        self.assertEqual(receipt["surface_transitions"]["export"]["added"], [])
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["exported_but_unadmitted"]["resolved"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["admitted_but_unconfigured"]["introduced"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["exported_but_unconfigured"]["persisted"],
            ["fixture-witness-8"],
        )
        self.assertFalse(receipt["surface_transitions"]["runtime"]["document_sha256_changed"])
        self.assertFalse(receipt["surface_transitions"]["export"]["document_sha256_changed"])
        self.assertTrue(receipt["surface_transitions"]["root_admission"]["document_sha256_changed"])

    def test_same_root_export_correction_does_not_imply_authority_change(self):
        receipt = evaluate(load("same-root-export-correction.json"))
        self.assertEqual(receipt["root_relation"], "SAME_ROOT")
        self.assertEqual(
            receipt["surface_transitions"]["export"]["removed"],
            ["fixture-witness-8"],
        )
        self.assertEqual(receipt["surface_transitions"]["root_admission"]["added"], [])
        self.assertEqual(receipt["surface_transitions"]["root_admission"]["removed"], [])
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["exported_but_unadmitted"]["resolved"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["exported_but_unconfigured"]["resolved"],
            ["fixture-witness-8"],
        )

    def test_same_root_runtime_update_does_not_imply_root_admission(self):
        receipt = evaluate(load("same-root-runtime-update.json"))
        self.assertEqual(receipt["root_relation"], "SAME_ROOT")
        self.assertEqual(
            receipt["surface_transitions"]["runtime"]["added"],
            ["fixture-witness-8"],
        )
        self.assertEqual(receipt["surface_transitions"]["root_admission"]["added"], [])
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["configured_but_unadmitted"]["introduced"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["exported_but_unconfigured"]["resolved"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["exported_but_unadmitted"]["persisted"],
            ["fixture-witness-8"],
        )

    def test_noop_transition_is_descriptive_only(self):
        receipt = evaluate(load("no-op.json"))
        self.assertEqual(receipt["root_relation"], "SAME_ROOT")
        self.assertFalse(receipt["any_membership_change"])
        self.assertFalse(receipt["any_delta_lifecycle_change"])
        for surface in receipt["surface_transitions"].values():
            self.assertEqual(surface["added"], [])
            self.assertEqual(surface["removed"], [])
            self.assertFalse(surface["document_sha256_changed"])
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["exported_but_unadmitted"]["persisted"],
            ["fixture-witness-8"],
        )
        self.assertEqual(
            receipt["directional_delta_lifecycle"]["exported_but_unconfigured"]["persisted"],
            ["fixture-witness-8"],
        )

    def test_same_version_different_root_digest_rejected(self):
        data = load("no-op.json")
        data["after"]["signed_root"]["document_sha256"] = "9" * 64
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_root_version_rollback_rejected(self):
        data = load("root-successor.json")
        data["after"]["signed_root"]["version"] = 1
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_successor_version_reusing_same_digest_rejected(self):
        data = load("no-op.json")
        data["after"]["signed_root"]["version"] = 3
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_root_identity_substitution_rejected(self):
        data = load("root-successor.json")
        data["after"]["signed_root"]["id"] = "other-root"
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_same_runtime_digest_with_changed_set_rejected(self):
        data = load("no-op.json")
        data["after"]["runtime_surface"]["configured_signers"].append("fixture-witness-8")
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_same_export_digest_with_changed_set_rejected(self):
        data = load("no-op.json")
        data["after"]["export_surface"]["signers"].remove("fixture-witness-8")
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_same_root_digest_with_changed_admitted_set_rejected(self):
        data = load("no-op.json")
        data["after"]["signed_root"]["admitted_signers"].append("fixture-witness-8")
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_unverified_snapshot_root_rejected_by_predecessor(self):
        data = load("no-op.json")
        data["after"]["signed_root"]["verification_status"] = "UNVERIFIED"
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_unknown_transition_controls_rejected_closed_world(self):
        for key, value in [
            ("timestamp", "2026-09-05T00:00:00Z"),
            ("trusted_time", True),
            ("latest_root", True),
            ("alert_policy", "always"),
            ("remediation", "sync"),
            ("trust_score", 0.9),
        ]:
            data = load("no-op.json")
            data[key] = value
            with self.subTest(key=key):
                with self.assertRaises(TransitionInputError):
                    evaluate(data)

    def test_unknown_nested_snapshot_field_rejected_by_predecessor(self):
        data = load("no-op.json")
        data["after"]["runtime_surface"]["latest"] = True
        with self.assertRaises(TransitionInputError):
            evaluate(data)

    def test_semantic_guards_prevent_temporal_and_authority_promotion(self):
        receipt = evaluate(load("root-successor.json"))
        guards = receipt["semantic_guards"]
        self.assertFalse(guards["before_after_roles_prove_trusted_time"])
        self.assertFalse(guards["transition_proves_causality"])
        self.assertFalse(guards["resolved_delta_proves_safety"])
        self.assertFalse(guards["transition_mints_or_mutates_authority"])
        self.assertFalse(guards["latest_root_substitution_performed"])
        self.assertFalse(guards["successor_state_backfills_historical_snapshot"])
        serialized = json.dumps(receipt, sort_keys=True).lower()
        self.assertNotIn('"trust_score"', serialized)
        self.assertNotIn('"severity"', serialized)
        self.assertNotIn('"remediation_command"', serialized)

    def test_inputs_are_not_mutated(self):
        data = load("root-successor.json")
        original = copy.deepcopy(data)
        evaluate(data)
        self.assertEqual(data, original)


if __name__ == "__main__":
    unittest.main()
