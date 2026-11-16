#!/usr/bin/env python3
"""Personal Anchor trial regressions against existing UU Society guards.

All observations are synthetic, explicitly supplied evidence assumptions.
No biometric model, real challenge issuer, or personal dataset is exercised.
"""
from __future__ import annotations

import copy
import unittest

import run_scenarios as model


def case(prefix):
    path = next(model.SCENARIOS_DIR.glob(f"{prefix}-*/scenario.json"))
    scenario = model.load_json(path)
    snapshot = model.load_json(path.parent / scenario["initial_snapshot"])
    return scenario, snapshot


class PersonalAnchorTrials(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = model.load_json(model.MANIFEST_PATH)
        cls.state_schema = model.load_json(model.STATE_SCHEMA_PATH)

    def fresh_response(self, snapshot, event, kind="personal_continuity_response"):
        response = copy.deepcopy(snapshot["evidence_events"][0])
        response.update({
            "id": "urn:uu-aap:uu-society:evidence-event:trial-response",
            "state": "attested",
            "event_type": kind,
            "observed_at": "2026-11-15T08:29:00Z",
            "claim": "Synthetic response accepted by an upstream observer; confidence 0.999.",
            "retention_until": "2026-11-15T09:00:00Z",
        })
        snapshot["evidence_events"].append(response)
        event["evidence_refs"].append(response["id"])
        self.assertEqual(model.format_errors(
            model.validator(self.state_schema).iter_errors(snapshot)), [])
        self.assertEqual(model.validate_references(snapshot), [])

    def assert_rejected(self, snapshot, event, when):
        before = copy.deepcopy(snapshot)
        ok, violations, _ = model.apply_event(
            snapshot, event, self.manifest, set(), when)
        self.assertFalse(ok)
        self.assertIn("I-014", violations)
        self.assertEqual(snapshot, before, "rejected action must retain evidence and actor state")

    def test_fresh_correct_response_does_not_override_retained_expired_lease(self):
        scenario, snapshot = case("S08")
        event = scenario["events"][0]
        self.fresh_response(snapshot, event)
        self.assertEqual(snapshot["action_leases"][0]["state"], "active")
        self.assert_rejected(snapshot, event, scenario["evaluation_time"])

    def test_revocation_wins_even_with_unexpired_lease_and_fresh_response(self):
        scenario, snapshot = case("S08")
        event = scenario["events"][0]
        snapshot["action_leases"][0].update({
            "state": "revoked", "expires_at": "2026-11-15T09:00:00Z"})
        self.fresh_response(snapshot, event)
        self.assert_rejected(snapshot, event, scenario["evaluation_time"])

    def test_new_response_cannot_replace_missing_authority(self):
        scenario, snapshot = case("S08")
        event = scenario["events"][0]
        snapshot["action_leases"][0].update({
            "expires_at": "2026-11-15T09:00:00Z", "authority_refs": []})
        self.fresh_response(snapshot, event)
        self.assert_rejected(snapshot, event, scenario["evaluation_time"])

    def test_synthetic_audio_acceptance_cannot_bypass_expired_authority(self):
        # These labels are NOT results from an audio detector or attack dataset.
        for kind in ("audio_rerecording", "unseen_synthesis", "high_confidence_false_acceptance"):
            with self.subTest(kind=kind):
                scenario, snapshot = case("S08")
                event = scenario["events"][0]
                self.fresh_response(snapshot, event, kind)
                self.assert_rejected(snapshot, event, scenario["evaluation_time"])

    def test_fresh_valid_authority_positive_control(self):
        scenario, snapshot = case("S08")
        event = scenario["events"][0]
        snapshot["action_leases"][0]["expires_at"] = "2026-11-15T09:00:00Z"
        self.fresh_response(snapshot, event)
        evidence_before = copy.deepcopy(snapshot["evidence_events"])
        ok, violations, _ = model.apply_event(
            snapshot, event, self.manifest, set(), scenario["evaluation_time"])
        self.assertTrue(ok)
        self.assertEqual(violations, [])
        self.assertEqual(snapshot["actions"][0]["state"], "admitted")
        self.assertEqual(snapshot["evidence_events"], evidence_before)

    def test_failed_challenge_retains_actor_while_allowing_scoped_narrowing(self):
        scenario, snapshot = case("S09")
        facts = set(scenario["semantic_facts"])
        for event in scenario["events"][:-1]:
            ok, violations, _ = model.apply_event(
                snapshot, event, self.manifest, facts, scenario["evaluation_time"])
            self.assertTrue(ok)
            self.assertEqual(violations, [])
        self.assertEqual(snapshot["arae_states"][0]["state"], "narrowed")
        before = copy.deepcopy(snapshot)
        ok, violations, _ = model.apply_event(
            snapshot, scenario["events"][-1], self.manifest,
            facts, scenario["evaluation_time"])
        self.assertFalse(ok)
        self.assertIn("I-013", violations)
        self.assertEqual(snapshot, before)
        self.assertEqual(snapshot["actors"][0]["state"], "active")

    def test_scoped_recovery_remains_possible_with_declared_fresh_independent_evidence(self):
        scenario, snapshot = case("S10")
        for event in scenario["events"]:
            ok, violations, _ = model.apply_event(
                snapshot, event, self.manifest,
                set(scenario["semantic_facts"]), scenario["evaluation_time"])
            self.assertTrue(ok)
            self.assertEqual(violations, [])
        self.assertEqual(snapshot["personal_anchors"][0]["state"], "sufficient_for_declared_scope")
        self.assertEqual(snapshot["arae_states"][0]["state"], "active")
        self.assertEqual(snapshot["actors"][0]["state"], "active")


if __name__ == "__main__":
    unittest.main()
