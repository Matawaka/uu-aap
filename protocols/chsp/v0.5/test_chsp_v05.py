#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


C = load_module("chsp_v05_test", ROOT / "chsp_v05.py")
V04 = load_module("chsp_v04_fixture", ROOT.parent / "v0.4" / "chsp_v04.py")


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


def make_disposition():
    value = {
        "artifact_type": "CHSPPredecessorDisposition",
        "artifact_version": "0.3",
        "disposition_id": "urn:test:chsp:v03:disposition:acknowledged",
        "project_id": "Matawaka/uu-aap",
        "candidate_id": "human:candidate-1",
        "predecessor_steward_id": "human:predecessor-1",
        "v02_transition_assessment_sha256": "4" * 64,
        "mode": "acknowledged",
        "recorded_at": "2026-08-01T03:00:00Z",
        "acknowledged_by_human_id": "human:predecessor-1",
        "acknowledgement_evidence_sha256": "a" * 64,
        "confirmation_token": "ACKNOWLEDGE_CHSP_DUAL_CONTROL_HANDOVER_CONSIDERATION_ONLY",
        "unavailability_attestations": [],
        "disposition_sha256": "0" * 64,
        "claims": {
            "disposition_recorded": True,
            "predecessor_acknowledgement_recorded": True,
            "protocol_unavailability_only": False,
            "legal_incapacity_certified": False,
            "medical_incapacity_certified": False,
            "death_certified": False,
            "ownership_waived": False,
            "canonical_successor_established": False,
            "kontur_activated": False,
        },
    }
    value["disposition_sha256"] = V04.self_digest(value, "disposition_sha256")
    return value


def make_v03_assessment(disposition):
    value = {
        "artifact_type": "CHSPFinalHandoverAssessment",
        "artifact_version": "0.3",
        "assessment_id": "urn:test:chsp:v03:final-assessment:ack",
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
            "predecessor_disposition_mode": "acknowledged",
            "unavailability_attestations": 0,
            "unavailability_attestor_domains": 0,
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
    value["assessment_sha256"] = V04.self_digest(value, "assessment_sha256")
    return value


def make_chain(root, base):
    v04_policy = V04.load_json(ROOT.parent / "v0.4" / "reference.chsp-handover-authorization-policy.json")
    disposition = make_disposition()
    source = make_v03_assessment(disposition)
    v04_state = root / "v04-state"
    a1 = V04.issue_approval(
        source, disposition, v04_policy,
        disposition["predecessor_steward_id"], "domain:predecessor", "b" * 64,
        "v05-fixture-pred-approval-0001", V04.APPROVAL_CONFIRMATION_TOKEN, v04_state,
        z(base + timedelta(days=1)),
    )
    a2 = V04.issue_approval(
        source, disposition, v04_policy,
        "human:independent-authorizer", "domain:independent", "c" * 64,
        "v05-fixture-ind-approval-00001", V04.APPROVAL_CONFIRMATION_TOKEN, v04_state,
        z(base + timedelta(days=1, hours=2)),
    )
    authorization = V04.issue_authorization(
        source, disposition, v04_policy, [a1, a2], "v05-fixture-authorization-0001",
        v04_state, z(base + timedelta(days=1, hours=3)), z(base + timedelta(days=6)),
    )
    assessment_at = base + timedelta(days=2)
    active = V04.assess_authorization(source, disposition, v04_policy, [a1, a2], authorization, [], z(assessment_at))
    assert active["state"] == "authorization_active"
    return v04_policy, disposition, source, [a1, a2], authorization, active, assessment_at


def tamper(value, field, replacement):
    out = copy.deepcopy(value)
    out[field] = replacement
    return out


def main():
    execution_policy = C.load_json(ROOT / "reference.chsp-handover-execution-policy.json")
    C.validate_policy(execution_policy)
    base = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v05-") as td:
        root = Path(td)
        v04_policy, disposition, source, approvals, auth, active, assessment_at = make_chain(root, base)
        v05_state = root / "v05-state"
        out = root / "execution"
        execute_at = assessment_at + timedelta(minutes=5)
        state, receipt = C.execute_handover(
            source, disposition, v04_policy, approvals, auth, [], active, execution_policy,
            "human:technical-recorder", "d" * 64, "v05-execution-nonce-00001",
            v05_state, out, z(execute_at),
        )
        assert out.is_dir()
        assert (out / C.MARKER_FILE).read_text().strip() == receipt["receipt_sha256"]
        assert state["current_steward_id"] == source["candidate_id"]
        assert state["claims"]["chsp_protocol_canonical_stewardship_effective"] is True
        assert state["claims"]["repository_ownership_transferred"] is False
        assert state["claims"]["external_system_control_changed"] is False
        assert receipt["claims"]["chsp_handover_execution_performed"] is True
        assert receipt["claims"]["recorder_is_authority_source"] is False
        assert receipt["claims"]["canonical_publication_executed"] is False
        assert receipt["claims"]["kontur_activated"] is False

        loaded_state, loaded_receipt = C.verify_execution_bundle(out)
        assert loaded_state["state_sha256"] == state["state_sha256"]
        assert loaded_receipt["receipt_sha256"] == receipt["receipt_sha256"]

        assessed = C.assess_execution(
            source, disposition, v04_policy, approvals, auth, [], active, execution_policy,
            state, receipt, z(execute_at + timedelta(minutes=1)),
        )
        assert assessed["state"] == "protocol_handover_recorded"
        assert assessed["decision"] == "chsp_protocol_canonical_stewardship_is_effective"
        assert assessed["claims"]["chsp_protocol_canonical_stewardship_effective"] is True
        assert assessed["claims"]["account_control_transferred"] is False

        # Same authorization cannot be locally executed again.
        expect_fail(
            lambda: C.execute_handover(
                source, disposition, v04_policy, approvals, auth, [], active, execution_policy,
                "human:technical-recorder", "e" * 64, "v05-execution-nonce-00002",
                v05_state, root / "replay-output", z(execute_at + timedelta(minutes=2)),
            ),
            "handover-executed-authorizations",
        )

        # Tampering with the sealed receipt is detected.
        receipt_path = out / C.RECEIPT_FILE
        original_receipt_text = receipt_path.read_text(encoding="utf-8")
        bad_receipt = copy.deepcopy(receipt)
        bad_receipt["recorder_id"] = "human:tampered"
        receipt_path.write_text(__import__("json").dumps(bad_receipt, indent=2) + "\n", encoding="utf-8")
        expect_fail(lambda: C.verify_execution_bundle(out), "receipt digest")
        receipt_path.write_text(original_receipt_text, encoding="utf-8")

        # Missing completion marker is fail-closed.
        marker = out / C.MARKER_FILE
        marker_text = marker.read_text(encoding="utf-8")
        marker.unlink()
        expect_fail(lambda: C.verify_execution_bundle(out), "missing or unsafe")
        marker.write_text(marker_text, encoding="utf-8")

    # Stale active assessment cannot be used for execution.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v05-stale-") as td:
        root = Path(td)
        v04_policy, disposition, source, approvals, auth, active, assessment_at = make_chain(root, base)
        expect_fail(
            lambda: C.execute_handover(
                source, disposition, v04_policy, approvals, auth, [], active, execution_policy,
                "human:recorder", "1" * 64, "v05-stale-execution-00001",
                root / "v05-state", root / "out", z(assessment_at + timedelta(minutes=16)),
            ),
            "too old",
        )

    # Presented revocation blocks execution through the exact v0.4 assessment chain.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v05-revoked-") as td:
        root = Path(td)
        v04_policy, disposition, source, approvals, auth, active, assessment_at = make_chain(root, base)
        revocation = V04.record_revocation(
            auth, source, disposition, v04_policy, approvals,
            "candidate_withdrawal", source["candidate_id"], "2" * 64,
            "candidate_withdrawal", "v05-revocation-nonce-0001", root / "v04-state",
            z(assessment_at + timedelta(minutes=1)),
        )
        revoked_assessment = V04.assess_authorization(
            source, disposition, v04_policy, approvals, auth, [revocation], z(assessment_at + timedelta(minutes=2)),
        )
        assert revoked_assessment["state"] == "authorization_revoked"
        expect_fail(
            lambda: C.execute_handover(
                source, disposition, v04_policy, approvals, auth, [revocation], revoked_assessment, execution_policy,
                "human:recorder", "3" * 64, "v05-revoked-execution-0001",
                root / "v05-state", root / "out", z(assessment_at + timedelta(minutes=3)),
            ),
            "not active",
        )

    # Existing destination fails before local execution reservation is consumed.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v05-dest-") as td:
        root = Path(td)
        v04_policy, disposition, source, approvals, auth, active, assessment_at = make_chain(root, base)
        out = root / "out"
        out.mkdir()
        state_dir = root / "v05-state"
        expect_fail(
            lambda: C.execute_handover(
                source, disposition, v04_policy, approvals, auth, [], active, execution_policy,
                "human:recorder", "4" * 64, "v05-existing-dest-00001",
                state_dir, out, z(assessment_at + timedelta(minutes=5)),
            ),
            "already exists",
        )
        shutil.rmtree(out)
        state, receipt = C.execute_handover(
            source, disposition, v04_policy, approvals, auth, [], active, execution_policy,
            "human:recorder", "4" * 64, "v05-existing-dest-00001",
            state_dir, out, z(assessment_at + timedelta(minutes=5)),
        )
        assert state["state_sha256"] == receipt["stewardship_state_sha256"]

    # Tampered active assessment is rejected even if its visible state says active.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v05-tamper-") as td:
        root = Path(td)
        v04_policy, disposition, source, approvals, auth, active, assessment_at = make_chain(root, base)
        bad = tamper(active, "candidate_id", "human:other")
        expect_fail(
            lambda: C.execute_handover(
                source, disposition, v04_policy, approvals, auth, [], bad, execution_policy,
                "human:recorder", "5" * 64, "v05-tamper-execution-0001",
                root / "v05-state", root / "out", z(assessment_at + timedelta(minutes=5)),
            ),
            "self-digest",
        )

    print("CHSP v0.5 bounded stewardship handover execution tests: PASS")


if __name__ == "__main__":
    main()
