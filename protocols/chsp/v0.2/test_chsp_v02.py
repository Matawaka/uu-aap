#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module():
    spec = importlib.util.spec_from_file_location("chsp_v02_test", ROOT / "chsp_v02.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load chsp_v02.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


C = load_module()


def expect_fail(fn, contains=None):
    try:
        fn()
    except Exception as exc:
        if contains and contains not in str(exc):
            raise AssertionError(f"failure did not contain {contains!r}: {exc}") from exc
        return
    raise AssertionError("operation unexpectedly succeeded")


def z(dt):
    return C.iso_z(dt)


def make_v01_assessment():
    value = {
        "artifact_type": "CHSPAssessment",
        "artifact_version": "0.1",
        "assessment_id": "urn:test:chsp:v01:assessment:1",
        "evaluated_at": "2026-08-01T00:00:00Z",
        "project_id": "Matawaka/uu-aap",
        "candidate_id": "human:candidate-1",
        "candidate_sha256": "1" * 64,
        "policy_sha256": "2" * 64,
        "evidence_set_sha256": "3" * 64,
        "delegation_set_sha256": "4" * 64,
        "state": "succession_eligible",
        "decision": "human_successor_recognition_may_be_requested",
        "metrics": {
            "immersion_days": 120,
            "valid_supportive_events": 10,
            "observer_domains": 4,
            "challenge_events": 3,
            "required_classes_satisfied": 8,
            "successful_delegations": 3,
            "blocking_adverse_events": 0
        },
        "reasons": [],
        "assessment_sha256": "0" * 64,
        "claims": {
            "policy_sufficiency_only": True,
            "observable_evidence_assessed": True,
            "automatic_authority_progression": False,
            "canonical_successor_established": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "legal_identity_certified": False,
            "psychological_fitness_certified": False,
            "universal_trust_established": False
        }
    }
    value["assessment_sha256"] = C.self_digest(value, "assessment_sha256")
    return value


def make_challenge(recognition, status="open", suffix="1"):
    value = {
        "artifact_type": "CHSPChallenge",
        "artifact_version": "0.2",
        "challenge_id": f"urn:test:chsp:challenge:{suffix}",
        "project_id": recognition["project_id"],
        "candidate_id": recognition["candidate_id"],
        "recognition_sha256": recognition["recognition_sha256"],
        "challenger_id": f"human:challenger-{suffix}",
        "challenger_domain_id": f"domain:{suffix}",
        "raised_at": "2026-08-16T00:00:00Z",
        "category": "protocol_boundary",
        "status": status,
        "evidence_sha256": "a" * 64,
        "resolution_sha256": None if status == "open" else "b" * 64,
        "challenge_sha256": "0" * 64,
        "claims": {
            "challenge_recorded": True,
            "progression_blocked_when_open_or_upheld": True,
            "authority_automatically_revoked": False,
            "canonical_successor_established": False,
            "truth_certified": False
        }
    }
    value["challenge_sha256"] = C.self_digest(value, "challenge_sha256")
    return value


def tamper(value, field, replacement):
    out = copy.deepcopy(value)
    out[field] = replacement
    return out


def main():
    policy = C.load_json(ROOT / "reference.chsp-recognition-policy.json")
    C.validate_policy(policy)
    assessment = make_v01_assessment()
    base = datetime(2026, 8, 1, tzinfo=timezone.utc)

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v02-") as td:
        state = Path(td) / "state"
        recognition = C.issue_recognition(
            assessment, policy, "human:recognizer-1", "5" * 64,
            "recognition-nonce-00000001", C.CONFIRMATION_TOKEN, state, z(base),
        )
        C.validate_recognition(recognition, assessment, policy)
        assert recognition["claims"]["authority_granted"] is False
        assert recognition["claims"]["canonical_successor_established"] is False

        expect_fail(
            lambda: C.issue_recognition(
                assessment, policy, "human:recognizer-2", "6" * 64,
                "recognition-nonce-00000002", C.CONFIRMATION_TOKEN, state, z(base),
            ),
            "recognized-assessments",
        )

        with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v02-token-") as td2:
            expect_fail(
                lambda: C.issue_recognition(
                    assessment, policy, "human:recognizer-2", "6" * 64,
                    "recognition-nonce-00000003", "WRONG", Path(td2), z(base),
                ),
                "typed confirmation",
            )

        early = C.assess_transition(assessment, recognition, policy, [], [], [], z(base + timedelta(days=7)))
        assert early["state"] == "cooling_active"
        assert early["claims"]["automatic_authority_progression"] is False

        open_challenge = make_challenge(recognition, "open", "open")
        blocked = C.assess_transition(assessment, recognition, policy, [open_challenge], [], [], z(base + timedelta(days=15)))
        assert blocked["state"] == "challenge_blocked"

        remediated = make_challenge(recognition, "resolved_remediated", "remediated")
        a1_ready = C.assess_transition(assessment, recognition, policy, [remediated], [], [], z(base + timedelta(days=15)))
        assert a1_ready["state"] == "stage_A1_eligible"
        assert a1_ready["metrics"]["resolved_challenges"] == 1

        expect_fail(
            lambda: C.issue_envelope(
                assessment, recognition, policy, [], [], [], "A2_reversible_limited",
                ["proposal_preparation"], "human:authorizer-1", "7" * 64,
                "skip-stage-nonce-00001", state, z(base + timedelta(days=15)), z(base + timedelta(days=60)),
            ),
            "expected next stage A1_advisory",
        )

        # Once an issuance reaches the reservation boundary, a later validation
        # failure intentionally consumes that local stage reservation. Isolate
        # such negative tests from the valid causal chain.
        with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v02-unsafe-scope-") as td3:
            unsafe_state = Path(td3) / "state"
            expect_fail(
                lambda: C.issue_envelope(
                    assessment, recognition, policy, [], [], [], "A1_advisory",
                    ["canonical_publication_preparation"], "human:authorizer-1", "7" * 64,
                    "unsafe-scope-nonce-001", unsafe_state, z(base + timedelta(days=15)), z(base + timedelta(days=60)),
                ),
                "scope is not permitted",
            )
            assert list((unsafe_state / "authority-stage-reservations").glob("*.json")), "fail-closed stage reservation was not retained"

        a1 = C.issue_envelope(
            assessment, recognition, policy, [], [], [], "A1_advisory",
            ["advisory_review", "documentation"], "human:authorizer-1", "7" * 64,
            "a1-envelope-nonce-00001", state, z(base + timedelta(days=15)), z(base + timedelta(days=70)),
        )
        active = C.assess_transition(assessment, recognition, policy, [], [a1], [], z(base + timedelta(days=20)))
        assert active["state"] == "progressive_authority_active"

        challenged_active = C.assess_transition(assessment, recognition, policy, [open_challenge], [a1], [], z(base + timedelta(days=20)))
        assert challenged_active["state"] == "challenge_blocked"
        assert a1["claims"]["authority_bound_to_envelope"] is True

        expect_fail(
            lambda: C.record_outcome(a1, recognition, policy, "positive", "human:reviewer-1", "8" * 64, z(base + timedelta(days=20))),
            "minimum stage observation",
        )
        a1_out = C.record_outcome(a1, recognition, policy, "positive", "human:reviewer-1", "8" * 64, z(base + timedelta(days=45)))
        next_ready = C.assess_transition(assessment, recognition, policy, [], [a1], [a1_out], z(base + timedelta(days=46)))
        assert next_ready["state"] == "next_stage_review_eligible"

        a2 = C.issue_envelope(
            assessment, recognition, policy, [], [a1], [a1_out], "A2_reversible_limited",
            ["proposal_preparation", "metadata_preparation"], "human:authorizer-1", "9" * 64,
            "a2-envelope-nonce-00001", state, z(base + timedelta(days=46)), z(base + timedelta(days=101)),
        )
        a2_out = C.record_outcome(a2, recognition, policy, "positive", "human:reviewer-1", "a" * 64, z(base + timedelta(days=76)))

        with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v02-bad-a3-") as td4:
            bad_a3_state = Path(td4) / "state"
            expect_fail(
                lambda: C.issue_envelope(
                    assessment, recognition, policy, [], [a1, a2], [a1_out, a2_out], "A3_supervised_stewardship",
                    ["supervised_policy_draft"], recognition["recognizer_id"], "b" * 64,
                    "a3-bad-authorizer-0001", bad_a3_state, z(base + timedelta(days=77)), z(base + timedelta(days=132)),
                ),
                "distinct from original recognizer",
            )
            assert list((bad_a3_state / "authority-stage-reservations").glob("*.json")), "fail-closed A3 reservation was not retained"

        a3 = C.issue_envelope(
            assessment, recognition, policy, [], [a1, a2], [a1_out, a2_out], "A3_supervised_stewardship",
            ["supervised_policy_draft", "supervised_incident_coordination"], "human:independent-authorizer", "b" * 64,
            "a3-envelope-nonce-00001", state, z(base + timedelta(days=77)), z(base + timedelta(days=132)),
        )
        a3_out = C.record_outcome(a3, recognition, policy, "positive", "human:reviewer-2", "c" * 64, z(base + timedelta(days=107)))

        a4 = C.issue_envelope(
            assessment, recognition, policy, [], [a1, a2, a3], [a1_out, a2_out, a3_out], "A4_canonical_preparation",
            ["canonical_publication_preparation", "succession_package_preparation"], "human:independent-authorizer-2", "d" * 64,
            "a4-envelope-nonce-00001", state, z(base + timedelta(days=108)), z(base + timedelta(days=163)),
        )
        assert "canonical_publication_preparation" in a4["scopes"]
        assert a4["claims"]["canonical_publication_authorized"] is False
        a4_out = C.record_outcome(a4, recognition, policy, "positive", "human:reviewer-2", "e" * 64, z(base + timedelta(days=138)))

        final = C.assess_transition(
            assessment, recognition, policy, [], [a1, a2, a3, a4], [a1_out, a2_out, a3_out, a4_out], z(base + timedelta(days=139)),
        )
        assert final["state"] == "final_succession_review_eligible"
        assert final["decision"] == "canonical_human_succession_recognition_may_be_requested"
        assert final["claims"]["canonical_successor_established"] is False
        assert final["claims"]["authority_granted_by_assessment"] is False

        revoked = C.record_outcome(a1, recognition, policy, "revoked", "human:reviewer-1", "f" * 64, z(base + timedelta(days=30)))
        reset = C.assess_transition(assessment, recognition, policy, [], [a1], [revoked], z(base + timedelta(days=31)))
        assert reset["state"] == "progression_reset_required"

        expired = C.assess_transition(assessment, recognition, policy, [], [a1], [], z(base + timedelta(days=71)))
        assert expired["state"] == "progression_reset_required"
        assert expired["metrics"]["latest_effective_state"] == "expired_without_outcome"

        bad_recognition = tamper(recognition, "recognizer_id", "human:tampered")
        invalid_rec = C.assess_transition(assessment, bad_recognition, policy, [], [], [], z(base + timedelta(days=15)))
        assert invalid_rec["state"] == "recognition_invalid"

        bad_challenge = tamper(open_challenge, "category", "other")
        bad_ch = C.assess_transition(assessment, recognition, policy, [bad_challenge], [], [], z(base + timedelta(days=15)))
        assert bad_ch["state"] == "challenge_blocked"

        bad_env = tamper(a1, "authorized_by_human_id", assessment["candidate_id"])
        bad_chain = C.assess_transition(assessment, recognition, policy, [], [bad_env], [], z(base + timedelta(days=20)))
        assert bad_chain["state"] == "progression_reset_required"

        duplicate_outcomes = C.assess_transition(assessment, recognition, policy, [], [a1], [a1_out, copy.deepcopy(a1_out)], z(base + timedelta(days=46)))
        assert duplicate_outcomes["state"] == "progression_reset_required"

    print("CHSP v0.2 recognition/progressive-authority tests: PASS")


if __name__ == "__main__":
    main()
