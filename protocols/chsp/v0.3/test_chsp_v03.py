#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module():
    spec = importlib.util.spec_from_file_location("chsp_v03_test", ROOT / "chsp_v03.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load chsp_v03.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


C = load_module()


def z(dt):
    return C.iso_z(dt)


def expect_fail(fn, contains=None):
    try:
        fn()
    except Exception as exc:
        if contains and contains not in str(exc):
            raise AssertionError(f"failure did not contain {contains!r}: {exc}") from exc
        return
    raise AssertionError("operation unexpectedly succeeded")


def make_v02_assessment():
    value = {
        "artifact_type": "CHSPTransitionAssessment",
        "artifact_version": "0.2",
        "assessment_id": "urn:test:chsp:v02:final:1",
        "evaluated_at": "2026-08-01T00:00:00Z",
        "project_id": "Matawaka/uu-aap",
        "candidate_id": "human:candidate-1",
        "v01_assessment_sha256": "1" * 64,
        "recognition_sha256": "2" * 64,
        "policy_sha256": "3" * 64,
        "challenge_set_sha256": "4" * 64,
        "envelope_set_sha256": "5" * 64,
        "outcome_set_sha256": "6" * 64,
        "state": "final_succession_review_eligible",
        "decision": "canonical_human_succession_recognition_may_be_requested",
        "metrics": {
            "cooling_complete": True,
            "challenge_window_complete": True,
            "blocking_challenges": 0,
            "resolved_challenges": 0,
            "envelope_count": 4,
            "completed_positive_stages": 4,
            "latest_stage": "A4_canonical_preparation",
            "latest_effective_state": "completed_positive",
            "latest_outcome": "positive"
        },
        "reasons": [],
        "assessment_sha256": "0" * 64,
        "claims": {
            "policy_sufficiency_only": True,
            "automatic_authority_progression": False,
            "authority_granted_by_assessment": False,
            "canonical_successor_established": False,
            "canonical_origin_mutated": False,
            "canonical_publication_executed": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "global_replay_prevention_established": False,
            "legal_identity_certified": False,
            "psychological_fitness_certified": False,
            "universal_trust_established": False
        }
    }
    value["assessment_sha256"] = C.self_digest(value, "assessment_sha256")
    return value


def make_challenge(recognition, status="open", suffix="1"):
    value = {
        "artifact_type": "CHSPFinalChallenge",
        "artifact_version": "0.3",
        "challenge_id": f"urn:test:chsp:final-challenge:{suffix}",
        "project_id": recognition["project_id"],
        "candidate_id": recognition["candidate_id"],
        "final_recognition_sha256": recognition["recognition_sha256"],
        "challenger_id": f"human:challenger-{suffix}",
        "challenger_domain_id": f"domain:{suffix}",
        "raised_at": "2026-08-10T00:00:00Z",
        "category": "process_integrity",
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


def attestations(base):
    return [
        {"attestor_id": "human:attestor-1", "attestor_domain_id": "domain:provider", "observed_at": z(base), "evidence_sha256": "a" * 64},
        {"attestor_id": "human:attestor-2", "attestor_domain_id": "domain:custodian", "observed_at": z(base), "evidence_sha256": "b" * 64},
        {"attestor_id": "human:attestor-3", "attestor_domain_id": "domain:external", "observed_at": z(base), "evidence_sha256": "c" * 64},
    ]


def main():
    policy = C.load_json(ROOT / "reference.chsp-final-handover-policy.json")
    C.validate_policy(policy)
    assessment = make_v02_assessment()
    C.validate_v02_assessment(assessment, policy)
    base = datetime(2026, 8, 1, tzinfo=timezone.utc)

    # Normal acknowledged-predecessor path.
    disposition = C.build_acknowledged_disposition(assessment, policy, "human:predecessor-1", "7" * 64, z(base))
    C.validate_disposition(disposition, assessment, policy)
    assert disposition["claims"]["ownership_waived"] is False

    expect_fail(
        lambda: C.build_acknowledged_disposition(assessment, policy, "human:predecessor-1", "7" * 64, z(base), "WRONG"),
        "acknowledgement token",
    )

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v03-") as td:
        state = Path(td) / "state"
        recognition = C.issue_final_recognition(
            assessment, disposition, policy, "human:final-recognizer", "8" * 64,
            "final-recognition-nonce-0001", state, z(base),
        )
        C.validate_final_recognition(recognition, assessment, disposition, policy)
        assert recognition["claims"]["exclusive_successor_authority"] is False

        expect_fail(
            lambda: C.issue_final_recognition(
                assessment, disposition, policy, "human:another-recognizer", "9" * 64,
                "final-recognition-nonce-0002", state, z(base),
            ),
            "final-recognized-assessments",
        )

        early = C.assess_final_transition(assessment, disposition, recognition, policy, [], None, [], z(base + timedelta(days=7)))
        assert early["state"] == "final_cooling_active"

        ready = C.assess_final_transition(assessment, disposition, recognition, policy, [], None, [], z(base + timedelta(days=15)))
        assert ready["state"] == "dual_control_handover_eligible"

        open_challenge = make_challenge(recognition, "open", "open")
        blocked = C.assess_final_transition(assessment, disposition, recognition, policy, [open_challenge], None, [], z(base + timedelta(days=15)))
        assert blocked["state"] == "final_challenge_blocked"

        remediated = make_challenge(recognition, "resolved_remediated", "fixed")
        remediated_ready = C.assess_final_transition(assessment, disposition, recognition, policy, [remediated], None, [], z(base + timedelta(days=15)))
        assert remediated_ready["state"] == "dual_control_handover_eligible"
        assert remediated_ready["metrics"]["resolved_challenges"] == 1

        with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v03-bad-scope-") as bad_td:
            expect_fail(
                lambda: C.issue_handover(
                    assessment, disposition, recognition, policy, [], ["account_administration"],
                    "human:predecessor-1", "9" * 64, "bad-scope-handover-nonce", Path(bad_td),
                    z(base + timedelta(days=15)), z(base + timedelta(days=60)),
                ),
                "scope is not permitted",
            )

        handover = C.issue_handover(
            assessment, disposition, recognition, policy, [],
            ["canonical_review", "release_review", "provenance_verification"],
            "human:predecessor-1", "9" * 64, "dual-control-handover-nonce-001", state,
            z(base + timedelta(days=15)), z(base + timedelta(days=60)),
        )
        C.validate_handover(handover, recognition, disposition, policy)
        assert handover["participation_mode"] == "predecessor_participating"
        assert handover["claims"]["nonexclusive"] is True
        assert handover["claims"]["canonical_publication_authorized"] is False

        active = C.assess_final_transition(assessment, disposition, recognition, policy, [], handover, [], z(base + timedelta(days=20)))
        assert active["state"] == "dual_control_active"

        expect_fail(
            lambda: C.record_handover_outcome(handover, recognition, disposition, policy, "positive", "human:reviewer", "a" * 64, z(base + timedelta(days=30))),
            "minimum dual-control observation",
        )
        positive = C.record_handover_outcome(handover, recognition, disposition, policy, "positive", "human:reviewer", "a" * 64, z(base + timedelta(days=46)))
        final = C.assess_final_transition(assessment, disposition, recognition, policy, [], handover, [positive], z(base + timedelta(days=47)))
        assert final["state"] == "canonical_stewardship_handover_review_eligible"
        assert final["decision"] == "canonical_stewardship_handover_may_be_requested"
        assert final["claims"]["canonical_successor_established"] is False
        assert final["claims"]["automatic_stewardship_transfer"] is False

        revoked = C.record_handover_outcome(handover, recognition, disposition, policy, "revoked", "human:reviewer", "b" * 64, z(base + timedelta(days=25)))
        reset = C.assess_final_transition(assessment, disposition, recognition, policy, [], handover, [revoked], z(base + timedelta(days=26)))
        assert reset["state"] == "handover_reset_required"

        expired = C.assess_final_transition(assessment, disposition, recognition, policy, [], handover, [], z(base + timedelta(days=61)))
        assert expired["state"] == "handover_reset_required"

        duplicate = C.assess_final_transition(assessment, disposition, recognition, policy, [], handover, [positive, copy.deepcopy(positive)], z(base + timedelta(days=47)))
        assert duplicate["state"] == "handover_reset_required"

        bad_recognition = copy.deepcopy(recognition)
        bad_recognition["final_recognizer_id"] = "human:tampered"
        invalid = C.assess_final_transition(assessment, disposition, bad_recognition, policy, [], None, [], z(base + timedelta(days=15)))
        assert invalid["state"] == "final_recognition_invalid"

        expect_fail(
            lambda: C.record_handover_outcome(handover, recognition, disposition, policy, "positive", assessment["candidate_id"], "c" * 64, z(base + timedelta(days=46))),
            "candidate cannot solely record",
        )

    # Final recognizer cannot be candidate or predecessor.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v03-recognizer-") as td:
        expect_fail(
            lambda: C.issue_final_recognition(
                assessment, disposition, policy, assessment["candidate_id"], "8" * 64,
                "candidate-recognizer-nonce", Path(td), z(base),
            ),
            "differ from candidate and predecessor",
        )

    # Predecessor protocol-unavailability alternative.
    ua = attestations(base)
    unavailable = C.build_unavailability_disposition(assessment, policy, "human:predecessor-1", ua, z(base))
    C.validate_disposition(unavailable, assessment, policy)
    assert unavailable["claims"]["protocol_unavailability_only"] is True
    assert unavailable["claims"]["legal_incapacity_certified"] is False
    assert unavailable["claims"]["death_certified"] is False

    insufficient = ua[:2]
    expect_fail(
        lambda: C.build_unavailability_disposition(assessment, policy, "human:predecessor-1", insufficient, z(base)),
        "insufficient unavailability attestations",
    )

    shared_domains = copy.deepcopy(ua)
    shared_domains[1]["attestor_domain_id"] = shared_domains[0]["attestor_domain_id"]
    shared_domains[2]["attestor_domain_id"] = shared_domains[0]["attestor_domain_id"]
    expect_fail(
        lambda: C.build_unavailability_disposition(assessment, policy, "human:predecessor-1", shared_domains, z(base)),
        "insufficient unavailability attestor domains",
    )

    candidate_attests = copy.deepcopy(ua)
    candidate_attests[0]["attestor_id"] = assessment["candidate_id"]
    expect_fail(
        lambda: C.build_unavailability_disposition(assessment, policy, "human:predecessor-1", candidate_attests, z(base)),
        "invalid unavailability attestor",
    )

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v03-unavailable-") as td:
        state = Path(td) / "state"
        recognition = C.issue_final_recognition(
            assessment, unavailable, policy, "human:final-recognizer-2", "d" * 64,
            "unavailable-recognition-nonce", state, z(base),
        )
        handover = C.issue_handover(
            assessment, unavailable, recognition, policy, [], ["succession_package_validation"],
            "human:independent-handover-authorizer", "e" * 64, "unavailable-handover-nonce", state,
            z(base + timedelta(days=15)), z(base + timedelta(days=60)),
        )
        assert handover["participation_mode"] == "predecessor_protocol_unavailability_alternative"
        expect_fail(
            lambda: C.validate_handover(
                {**handover, "authorized_by_human_id": "human:predecessor-1"}, recognition, unavailable, policy
            ),
            "self-digest mismatch",
        )
        positive = C.record_handover_outcome(handover, recognition, unavailable, policy, "positive", "human:reviewer-2", "f" * 64, z(base + timedelta(days=46)))
        final = C.assess_final_transition(assessment, unavailable, recognition, policy, [], handover, [positive], z(base + timedelta(days=47)))
        assert final["state"] == "canonical_stewardship_handover_review_eligible"
        assert final["metrics"]["unavailability_attestations"] == 3
        assert final["metrics"]["unavailability_attestor_domains"] == 3
        assert final["claims"]["legal_incapacity_certified"] is False
        assert final["claims"]["ownership_transferred"] is False
        assert final["claims"]["kontur_activated"] is False

    print("CHSP v0.3 final-recognition/dual-control tests: PASS")


if __name__ == "__main__":
    main()
