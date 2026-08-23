#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module():
    spec = importlib.util.spec_from_file_location("chsp_v04_test", ROOT / "chsp_v04.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load chsp_v04.py")
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


def make_disposition(mode="acknowledged"):
    candidate = "human:candidate-1"
    predecessor = "human:predecessor-1"
    attestations = []
    acknowledged_by = predecessor
    evidence = "a" * 64
    token = "ACKNOWLEDGE_CHSP_DUAL_CONTROL_HANDOVER_CONSIDERATION_ONLY"
    predecessor_ack = True
    unavailability_only = False
    if mode == "protocol_unavailability_attested":
        acknowledged_by = None
        evidence = None
        token = None
        predecessor_ack = False
        unavailability_only = True
        attestations = [
            {"attestor_id": "human:attestor-1", "attestor_domain_id": "domain:attestor-1", "observed_at": "2026-08-01T00:00:00Z", "evidence_sha256": "1" * 64},
            {"attestor_id": "human:attestor-2", "attestor_domain_id": "domain:attestor-2", "observed_at": "2026-08-01T01:00:00Z", "evidence_sha256": "2" * 64},
            {"attestor_id": "human:attestor-3", "attestor_domain_id": "domain:attestor-3", "observed_at": "2026-08-01T02:00:00Z", "evidence_sha256": "3" * 64},
        ]
    value = {
        "artifact_type": "CHSPPredecessorDisposition",
        "artifact_version": "0.3",
        "disposition_id": "urn:test:chsp:v03:disposition:" + mode,
        "project_id": "Matawaka/uu-aap",
        "candidate_id": candidate,
        "predecessor_steward_id": predecessor,
        "v02_transition_assessment_sha256": "4" * 64,
        "mode": mode,
        "recorded_at": "2026-08-01T03:00:00Z",
        "acknowledged_by_human_id": acknowledged_by,
        "acknowledgement_evidence_sha256": evidence,
        "confirmation_token": token,
        "unavailability_attestations": attestations,
        "disposition_sha256": "0" * 64,
        "claims": {
            "disposition_recorded": True,
            "predecessor_acknowledgement_recorded": predecessor_ack,
            "protocol_unavailability_only": unavailability_only,
            "legal_incapacity_certified": False,
            "medical_incapacity_certified": False,
            "death_certified": False,
            "ownership_waived": False,
            "canonical_successor_established": False,
            "kontur_activated": False,
        },
    }
    value["disposition_sha256"] = C.self_digest(value, "disposition_sha256")
    return value


def make_v03_assessment(disposition):
    att_count = len(disposition["unavailability_attestations"])
    domain_count = len({a["attestor_domain_id"] for a in disposition["unavailability_attestations"]})
    value = {
        "artifact_type": "CHSPFinalHandoverAssessment",
        "artifact_version": "0.3",
        "assessment_id": "urn:test:chsp:v03:final-assessment:" + disposition["mode"],
        "evaluated_at": "2026-08-01T12:00:00Z",
        "project_id": "Matawaka/uu-aap",
        "candidate_id": disposition["candidate_id"],
        "v02_transition_assessment_sha256": "5" * 64,
        "predecessor_disposition_sha256": disposition["disposition_sha256"],
        "final_recognition_sha256": "6" * 64,
        "policy_sha256": "7" * 64,
        "challenge_set_sha256": "8" * 64,
        "handover_sha256": "9" * 64,
        "outcome_sha256": "a" * 64,
        "state": "canonical_stewardship_handover_review_eligible",
        "decision": "canonical_stewardship_handover_may_be_requested",
        "metrics": {
            "final_cooling_complete": True,
            "blocking_challenges": 0,
            "resolved_challenges": 1,
            "predecessor_disposition_mode": disposition["mode"],
            "unavailability_attestations": att_count,
            "unavailability_attestor_domains": domain_count,
            "handover_present": True,
            "handover_window_days": 30,
            "handover_outcome": "positive",
        },
        "reasons": [],
        "assessment_sha256": "0" * 64,
        "claims": {
            "policy_sufficiency_only": True,
            "automatic_stewardship_transfer": False,
            "exclusive_successor_authority": False,
            "canonical_successor_established": False,
            "canonical_origin_mutated": False,
            "canonical_publication_executed": False,
            "ownership_transferred": False,
            "account_control_transferred": False,
            "kontur_activated": False,
            "legal_incapacity_certified": False,
            "medical_incapacity_certified": False,
            "distributed_consensus_established": False,
            "universal_trust_established": False,
        },
    }
    value["assessment_sha256"] = C.self_digest(value, "assessment_sha256")
    return value


def tamper(value, field, replacement):
    out = copy.deepcopy(value)
    out[field] = replacement
    return out


def issue_acknowledged_chain(policy, base, root):
    disposition = make_disposition("acknowledged")
    assessment = make_v03_assessment(disposition)
    state = root / "state"
    a1 = C.issue_approval(
        assessment, disposition, policy,
        disposition["predecessor_steward_id"], "domain:predecessor", "b" * 64,
        "approval-predecessor-0001", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1)),
    )
    a2 = C.issue_approval(
        assessment, disposition, policy,
        "human:independent-authorizer", "domain:independent", "c" * 64,
        "approval-independent-0001", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1, hours=2)),
    )
    auth = C.issue_authorization(
        assessment, disposition, policy, [a1, a2],
        "authorization-nonce-00001", state, z(base + timedelta(days=1, hours=3)), z(base + timedelta(days=6)),
    )
    return disposition, assessment, [a1, a2], auth, state


def main():
    policy = C.load_json(ROOT / "reference.chsp-handover-authorization-policy.json")
    C.validate_policy(policy)
    base = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-ack-") as td:
        root = Path(td)
        disposition, assessment, approvals, auth, state = issue_acknowledged_chain(policy, base, root)
        assert auth["claims"]["bounded_handover_recording_authorized"] is True
        assert auth["claims"]["candidate_stewardship_effective"] is False
        assert auth["claims"]["execution_performed"] is False
        assert disposition["predecessor_steward_id"] in auth["authorizer_ids"]

        active = C.assess_authorization(
            assessment, disposition, policy, approvals, auth, [], z(base + timedelta(days=2)),
        )
        assert active["state"] == "authorization_active"
        assert active["decision"] == "bounded_handover_executor_may_be_requested"
        assert active["claims"]["authorization_validated"] is True
        assert active["claims"]["executor_invoked"] is False

        expect_fail(
            lambda: C.issue_approval(
                assessment, disposition, policy,
                disposition["predecessor_steward_id"], "domain:predecessor", "d" * 64,
                "approval-predecessor-0002", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1, hours=4)),
            ),
            "handover-approval-authorizers",
        )
        expect_fail(
            lambda: C.issue_authorization(
                assessment, disposition, policy, approvals,
                "authorization-nonce-00002", state, z(base + timedelta(days=2)), z(base + timedelta(days=7)),
            ),
            "handover-authorized-assessments",
        )

        withdrawal = C.record_revocation(
            auth, assessment, disposition, policy, approvals,
            "candidate_withdrawal", assessment["candidate_id"], "d" * 64,
            "candidate_withdrawal", "withdrawal-nonce-00001", state, z(base + timedelta(days=3)),
        )
        revoked = C.assess_authorization(
            assessment, disposition, policy, approvals, auth, [withdrawal], z(base + timedelta(days=3, hours=1)),
        )
        assert revoked["state"] == "authorization_revoked"
        assert revoked["decision"] == "do_not_execute_revoked_authorization"
        assert auth["claims"]["bounded_handover_recording_authorized"] is True
        assert withdrawal["claims"]["original_authorization_erased"] is False

        expired = C.assess_authorization(
            assessment, disposition, policy, approvals, auth, [], z(base + timedelta(days=7)),
        )
        assert expired["state"] == "authorization_expired"
        assert expired["decision"] == "renew_human_authorization_if_still_appropriate"

        bad_auth = tamper(auth, "authorized_action", "transfer_repository_ownership")
        invalid = C.assess_authorization(
            assessment, disposition, policy, approvals, bad_auth, [], z(base + timedelta(days=2)),
        )
        assert invalid["state"] == "authorization_invalid"
        assert invalid["claims"]["authorization_validated"] is False

    # Candidate self-approval fails before any useful approval can exist.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-self-") as td:
        disposition = make_disposition("acknowledged")
        assessment = make_v03_assessment(disposition)
        expect_fail(
            lambda: C.issue_approval(
                assessment, disposition, policy,
                assessment["candidate_id"], "domain:candidate", "e" * 64,
                "candidate-self-approval-0001", C.APPROVAL_CONFIRMATION_TOKEN, Path(td), z(base + timedelta(days=1)),
            ),
            "candidate cannot approve",
        )

    # Acknowledged path requires predecessor approval, not merely two other humans.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-no-pred-") as td:
        disposition = make_disposition("acknowledged")
        assessment = make_v03_assessment(disposition)
        state = Path(td)
        a1 = C.issue_approval(assessment, disposition, policy, "human:auth-1", "domain:1", "1" * 64, "no-pred-nonce-000001", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1)))
        a2 = C.issue_approval(assessment, disposition, policy, "human:auth-2", "domain:2", "2" * 64, "no-pred-nonce-000002", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1, hours=1)))
        expect_fail(
            lambda: C.issue_authorization(assessment, disposition, policy, [a1, a2], "no-pred-auth-nonce-01", state, z(base + timedelta(days=1, hours=2)), z(base + timedelta(days=5))),
            "requires predecessor approval",
        )

    # Stale source assessment cannot be converted into fresh authority by a late approval.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-stale-") as td:
        disposition = make_disposition("acknowledged")
        assessment = make_v03_assessment(disposition)
        expect_fail(
            lambda: C.issue_approval(
                assessment, disposition, policy,
                disposition["predecessor_steward_id"], "domain:predecessor", "3" * 64,
                "stale-approval-nonce-001", C.APPROVAL_CONFIRMATION_TOKEN, Path(td), z(base + timedelta(days=31)),
            ),
            "source assessment too old",
        )

    # Approval quorum must be contemporaneous enough.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-spread-") as td:
        disposition = make_disposition("acknowledged")
        assessment = make_v03_assessment(disposition)
        state = Path(td)
        a1 = C.issue_approval(assessment, disposition, policy, disposition["predecessor_steward_id"], "domain:pred", "4" * 64, "spread-approval-nonce-01", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1)))
        a2 = C.issue_approval(assessment, disposition, policy, "human:auth-2", "domain:2", "5" * 64, "spread-approval-nonce-02", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=5)))
        expect_fail(
            lambda: C.issue_authorization(assessment, disposition, policy, [a1, a2], "spread-auth-nonce-0001", state, z(base + timedelta(days=5, hours=1)), z(base + timedelta(days=7))),
            "spread exceeds policy",
        )

    # Authorization lifetime is bounded independently from approval freshness.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-long-") as td:
        disposition = make_disposition("acknowledged")
        assessment = make_v03_assessment(disposition)
        state = Path(td)
        a1 = C.issue_approval(assessment, disposition, policy, disposition["predecessor_steward_id"], "domain:pred", "6" * 64, "long-approval-nonce-001", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1)))
        a2 = C.issue_approval(assessment, disposition, policy, "human:auth-2", "domain:2", "7" * 64, "long-approval-nonce-002", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1, hours=1)))
        expect_fail(
            lambda: C.issue_authorization(assessment, disposition, policy, [a1, a2], "long-auth-nonce-000001", state, z(base + timedelta(days=1, hours=2)), z(base + timedelta(days=9))),
            "validity exceeds policy",
        )

    # Unavailability path requires stronger 3-human/3-domain quorum and excludes predecessor approval.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-unavail-") as td:
        disposition = make_disposition("protocol_unavailability_attested")
        assessment = make_v03_assessment(disposition)
        state = Path(td) / "state"
        approvals = []
        for idx in range(1, 4):
            approvals.append(C.issue_approval(
                assessment, disposition, policy,
                f"human:unavailability-authorizer-{idx}", f"domain:unavailability-authorizer-{idx}", str(idx) * 64,
                f"unavailability-approval-{idx:04d}", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1, hours=idx)),
            ))
        auth = C.issue_authorization(
            assessment, disposition, policy, approvals,
            "unavailability-auth-nonce-1", state, z(base + timedelta(days=1, hours=5)), z(base + timedelta(days=6)),
        )
        active = C.assess_authorization(assessment, disposition, policy, approvals, auth, [], z(base + timedelta(days=2)))
        assert active["state"] == "authorization_active"
        assert active["metrics"]["approval_count"] == 3
        assert active["metrics"]["authorizer_domains"] == 3
        assert disposition["predecessor_steward_id"] not in auth["authorizer_ids"]

        revocation = C.record_revocation(
            auth, assessment, disposition, policy, approvals,
            "authorizer_revocation", approvals[0]["authorizer_id"], "8" * 64,
            "new_adverse_information", "unavailability-revoke-01", state, z(base + timedelta(days=3)),
        )
        assert C.assess_authorization(assessment, disposition, policy, approvals, auth, [revocation], z(base + timedelta(days=3, hours=1)))["state"] == "authorization_revoked"

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-unavail-insufficient-") as td:
        disposition = make_disposition("protocol_unavailability_attested")
        assessment = make_v03_assessment(disposition)
        state = Path(td)
        approvals = [
            C.issue_approval(assessment, disposition, policy, "human:u1", "domain:u1", "9" * 64, "u-insufficient-nonce-01", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1))),
            C.issue_approval(assessment, disposition, policy, "human:u2", "domain:u2", "a" * 64, "u-insufficient-nonce-02", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1, hours=1))),
        ]
        expect_fail(
            lambda: C.issue_authorization(assessment, disposition, policy, approvals, "u-insufficient-auth-01", state, z(base + timedelta(days=1, hours=2)), z(base + timedelta(days=5))),
            "insufficient unavailability-path authorizers",
        )
        expect_fail(
            lambda: C.issue_approval(
                assessment, disposition, policy,
                disposition["predecessor_steward_id"], "domain:predecessor", "b" * 64,
                "u-predecessor-approval-01", C.APPROVAL_CONFIRMATION_TOKEN, Path(td) / "other", z(base + timedelta(days=1)),
            ),
            "inconsistent with protocol-unavailability",
        )

    # Distinct humans without distinct declared domains do not satisfy the quorum.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v04-domains-") as td:
        disposition = make_disposition("protocol_unavailability_attested")
        assessment = make_v03_assessment(disposition)
        state = Path(td)
        approvals = [
            C.issue_approval(assessment, disposition, policy, "human:d1", "domain:shared", "c" * 64, "domain-nonce-000001", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1))),
            C.issue_approval(assessment, disposition, policy, "human:d2", "domain:shared", "d" * 64, "domain-nonce-000002", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1, hours=1))),
            C.issue_approval(assessment, disposition, policy, "human:d3", "domain:other", "e" * 64, "domain-nonce-000003", C.APPROVAL_CONFIRMATION_TOKEN, state, z(base + timedelta(days=1, hours=2))),
        ]
        expect_fail(
            lambda: C.issue_authorization(assessment, disposition, policy, approvals, "domain-auth-nonce-0001", state, z(base + timedelta(days=1, hours=3)), z(base + timedelta(days=5))),
            "insufficient unavailability-path authorizer domains",
        )

    # Source/disposition tamper is fail-closed.
    disposition = make_disposition("acknowledged")
    assessment = make_v03_assessment(disposition)
    bad_disposition = tamper(disposition, "predecessor_steward_id", "human:other")
    expect_fail(lambda: C.validate_disposition(bad_disposition, assessment, policy), "self-digest mismatch")
    bad_assessment = tamper(assessment, "decision", "dual_control_handover_may_be_requested")
    expect_fail(lambda: C.validate_v03_assessment(bad_assessment, policy), "self-digest mismatch")

    print("CHSP v0.4 canonical stewardship handover authorization tests: PASS")


if __name__ == "__main__":
    main()
