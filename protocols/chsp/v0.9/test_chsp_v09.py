#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module():
    spec = importlib.util.spec_from_file_location("chsp_v09_test", ROOT / "chsp_v09.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load chsp_v09.py")
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


def make_v08(base):
    project = "Matawaka/uu-aap"
    steward = "human:steward-2"
    observed = {
        "artifact_type":"CHSPExternalObservedState","artifact_version":"0.8","observation_id":"urn:test:v08:observed",
        "project_id":project,"steward_id":steward,"v06_binding_proposal_sha256":"1"*64,
        "external_system_type":"github_repository","external_system_id":"Matawaka/uu-aap","external_principal_id":"github:successor","observed_role":"collaborator",
        "observed_at":z(base),"observer_id":"observer:v08","observer_domain_id":"observer-domain:v08","evidence_sha256":"2"*64,"contains_credentials":False,"state_sha256":"0"*64,
        "claims":{"bounded_observation_recorded":True,"global_provider_state_proven":False,"external_control_changed":False,"ownership_proven":False,"credentials_embedded":False}
    }
    observed["state_sha256"] = C.self_digest(observed, "state_sha256")
    operations = [
        {"operation_id":"op-1","kind":"ensure_principal_presence","intended_role":None,"force":False,"destructive":False},
        {"operation_id":"op-2","kind":"ensure_role_at_least","intended_role":"maintainer","force":False,"destructive":False},
        {"operation_id":"op-3","kind":"record_external_stewardship_mapping","intended_role":None,"force":False,"destructive":False},
    ]
    envelope = {
        "artifact_type":"CHSPExternalTransitionEnvelope","artifact_version":"0.8","envelope_id":"urn:test:v08:envelope",
        "project_id":project,"steward_id":steward,"v06_binding_proposal_sha256":"1"*64,"v07_transition_authorization_sha256":"3"*64,"v07_transition_assessment_sha256":"4"*64,"observed_state_sha256":observed["state_sha256"],
        "external_system_type":"github_repository","external_system_id":"Matawaka/uu-aap","external_principal_id":"github:successor","operations":operations,
        "created_at":z(base+timedelta(minutes=1)),"expires_at":z(base+timedelta(hours=1)),"nonce":"v08-envelope-nonce-0001","envelope_sha256":"0"*64,
        "claims":{"dry_run_only":True,"non_destructive_plan":True,"external_mutation_authorized":False,"external_mutation_performed":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False}
    }
    envelope["envelope_sha256"] = C.self_digest(envelope, "envelope_sha256")
    receipt = {
        "artifact_type":"CHSPExternalTransitionDryRunReceipt","artifact_version":"0.8","receipt_id":"urn:test:v08:receipt","project_id":project,"steward_id":steward,
        "envelope_sha256":envelope["envelope_sha256"],"observed_state_sha256":observed["state_sha256"],"v07_transition_authorization_sha256":"3"*64,"v07_transition_assessment_sha256":"4"*64,
        "verified_at":z(base+timedelta(minutes=2)),"result":"verified",
        "checks":{"v07_authorization_active":True,"v07_assessment_fresh":True,"observation_fresh":True,"exact_external_target_match":True,"operations_policy_bounded":True,"all_operations_non_destructive":True,"credentials_absent":True,"envelope_unexpired":True},
        "receipt_sha256":"0"*64,
        "claims":{"dry_run_verification_completed":True,"external_execution_authorized":False,"external_mutation_performed":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"global_provider_state_proven":False}
    }
    receipt["receipt_sha256"] = C.self_digest(receipt, "receipt_sha256")
    assessment = {
        "artifact_type":"CHSPExternalDryRunAssessment","artifact_version":"0.8","assessment_id":"urn:test:v08:assessment","evaluated_at":z(base+timedelta(minutes=3)),"project_id":project,"steward_id":steward,
        "envelope_sha256":envelope["envelope_sha256"],"dry_run_receipt_sha256":receipt["receipt_sha256"],"state":"dry_run_verified","decision":"external_transition_execution_authorization_may_be_requested","reasons":[],"assessment_sha256":"0"*64,
        "claims":{"policy_sufficiency_only":True,"dry_run_verified":True,"external_execution_authorized":False,"executor_invoked":False,"external_mutation_performed":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False}
    }
    assessment["assessment_sha256"] = C.self_digest(assessment, "assessment_sha256")
    return envelope, observed, receipt, assessment


def main():
    policy = C.load_json(ROOT / "reference.chsp-external-execution-authorization-policy.json")
    C.validate_policy(policy)
    base = datetime(2026, 8, 23, 16, 30, tzinfo=timezone.utc)
    envelope, observed, receipt, assessment = make_v08(base)

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v09-") as td:
        state = Path(td)
        recheck = C.issue_recheck(envelope, receipt, assessment, observed, policy, "collaborator", "observer:v09", "observer-domain:v09", "5"*64, z(base+timedelta(minutes=4)))
        assert recheck["result"] == "match"
        assert recheck["claims"]["global_provider_state_proven"] is False

        d1 = C.issue_execution_decision(envelope, receipt, assessment, observed, recheck, policy, envelope["steward_id"], "domain:steward", "6"*64, "execution-decision-nonce-0001", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=5)))
        d2 = C.issue_execution_decision(envelope, receipt, assessment, observed, recheck, policy, "human:authorizer-2", "domain:authorizer", "7"*64, "execution-decision-nonce-0002", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=6)))
        auth = C.issue_authorization(envelope, receipt, assessment, observed, recheck, policy, [d1,d2], "execution-authorization-nonce-0001", state, z(base+timedelta(minutes=7)), z(base+timedelta(minutes=15)))
        assert auth["claims"]["bounded_exact_external_execution_authorized"] is True
        assert auth["claims"]["ownership_transfer_authorized"] is False
        assert auth["claims"]["executor_invoked"] is False
        assert auth["operations_sha256"] == C.sha256_json(envelope["operations"])

        ready = C.assess_authorization(envelope, receipt, assessment, observed, recheck, policy, [d1,d2], auth, [], z(base+timedelta(minutes=8)))
        assert ready["state"] == "execution_authorization_active"
        assert ready["decision"] == "bounded_external_execution_executor_may_be_requested"
        assert ready["claims"]["bounded_exact_external_execution_authorized"] is True
        assert ready["claims"]["execution_performed"] is False

        rev = C.record_revocation(auth, policy["project_id"], envelope["steward_id"], "human:authorizer-2", "8"*64, "execution_deferred", "execution-revocation-nonce-0001", state, z(base+timedelta(minutes=8)))
        revoked = C.assess_authorization(envelope, receipt, assessment, observed, recheck, policy, [d1,d2], auth, [rev], z(base+timedelta(minutes=8,seconds=30)))
        assert revoked["state"] == "execution_authorization_revoked"
        assert revoked["decision"] == "do_not_execute_revoked_authorization"
        assert revoked["claims"]["bounded_exact_external_execution_authorized"] is False
        assert rev["claims"]["historical_authorization_erased"] is False

        # One human cannot submit a second decision for the same exact recheck locally.
        expect_fail(lambda: C.issue_execution_decision(envelope, receipt, assessment, observed, recheck, policy, envelope["steward_id"], "domain:steward", "9"*64, "execution-decision-nonce-0003", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=5))), "external-execution-decision-humans")
        # One recheck cannot produce a second local execution authorization.
        expect_fail(lambda: C.issue_authorization(envelope, receipt, assessment, observed, recheck, policy, [d1,d2], "execution-authorization-nonce-0002", state, z(base+timedelta(minutes=7)), z(base+timedelta(minutes=14))), "external-execution-authorized-rechecks")

    # Material drift blocks any human execution decision and requires a new dry-run.
    drift = C.issue_recheck(envelope, receipt, assessment, observed, policy, "maintainer", "observer:drift", "observer-domain:drift", "a"*64, z(base+timedelta(minutes=4)))
    assert drift["result"] == "drift_detected"
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v09-drift-") as td:
        expect_fail(lambda: C.issue_execution_decision(envelope, receipt, assessment, observed, drift, policy, envelope["steward_id"], "domain:steward", "b"*64, "drift-decision-nonce-01", C.CONFIRMATION_TOKEN, Path(td), z(base+timedelta(minutes=5))), "must match")

    # Indeterminate current state also blocks authorization.
    indeterminate = C.issue_recheck(envelope, receipt, assessment, observed, policy, "unknown", "observer:unknown", "observer-domain:unknown", "c"*64, z(base+timedelta(minutes=4)))
    assert indeterminate["result"] == "indeterminate"

    # Wrong typed confirmation cannot be reinterpreted as execution consent.
    recheck = C.issue_recheck(envelope, receipt, assessment, observed, policy, "collaborator", "observer:token", "observer-domain:token", "d"*64, z(base+timedelta(minutes=4)))
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v09-token-") as td:
        expect_fail(lambda: C.issue_execution_decision(envelope, receipt, assessment, observed, recheck, policy, envelope["steward_id"], "domain:steward", "e"*64, "wrong-token-nonce-0001", "AUTHORIZE_SOMETHING_ELSE", Path(td), z(base+timedelta(minutes=5))), "typed confirmation")

    # Recheck freshness is independent and fail-closed.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v09-stale-recheck-") as td:
        expect_fail(lambda: C.issue_execution_decision(envelope, receipt, assessment, observed, recheck, policy, envelope["steward_id"], "domain:steward", "f"*64, "stale-recheck-nonce-01", C.CONFIRMATION_TOKEN, Path(td), z(base+timedelta(minutes=10))), "too old")

    # Stale v0.8 assessment cannot be refreshed by a later recheck.
    expect_fail(lambda: C.issue_recheck(envelope, receipt, assessment, observed, policy, "collaborator", "observer:late", "observer-domain:late", "1"*64, z(base+timedelta(minutes=20))), "v0.8 assessment too old")

    # Quorum must include the steward and a non-steward in two declared domains.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v09-quorum-") as td:
        state = Path(td)
        fresh = C.issue_recheck(envelope, receipt, assessment, observed, policy, "collaborator", "observer:q", "observer-domain:q", "2"*64, z(base+timedelta(minutes=4)))
        a1 = C.issue_execution_decision(envelope, receipt, assessment, observed, fresh, policy, "human:a1", "domain:a1", "3"*64, "quorum-decision-nonce-001", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=5)))
        a2 = C.issue_execution_decision(envelope, receipt, assessment, observed, fresh, policy, "human:a2", "domain:a2", "4"*64, "quorum-decision-nonce-002", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=6)))
        expect_fail(lambda: C.issue_authorization(envelope, receipt, assessment, observed, fresh, policy, [a1,a2], "quorum-auth-nonce-0001", state, z(base+timedelta(minutes=7)), z(base+timedelta(minutes=14))), "steward execution consent required")

    # A valid authorization becomes stale if the exact recheck ages out, even before authorization expiry.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v09-stale-assess-") as td:
        state = Path(td)
        fresh = C.issue_recheck(envelope, receipt, assessment, observed, policy, "collaborator", "observer:s", "observer-domain:s", "5"*64, z(base+timedelta(minutes=4)))
        s1 = C.issue_execution_decision(envelope, receipt, assessment, observed, fresh, policy, envelope["steward_id"], "domain:s1", "6"*64, "stale-assess-decision-1", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=5)))
        s2 = C.issue_execution_decision(envelope, receipt, assessment, observed, fresh, policy, "human:s2", "domain:s2", "7"*64, "stale-assess-decision-2", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=6)))
        sa = C.issue_authorization(envelope, receipt, assessment, observed, fresh, policy, [s1,s2], "stale-assess-auth-001", state, z(base+timedelta(minutes=7)), z(base+timedelta(minutes=15)))
        stale = C.assess_authorization(envelope, receipt, assessment, observed, fresh, policy, [s1,s2], sa, [], z(base+timedelta(minutes=10)))
        assert stale["state"] == "recheck_stale"
        expired = C.assess_authorization(envelope, receipt, assessment, observed, fresh, policy, [s1,s2], sa, [], z(base+timedelta(minutes=16)))
        assert expired["state"] == "execution_authorization_expired"

    # Tampered or authority-overclaiming artifacts fail closed.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v09-tamper-") as td:
        state = Path(td)
        fresh = C.issue_recheck(envelope, receipt, assessment, observed, policy, "collaborator", "observer:t", "observer-domain:t", "8"*64, z(base+timedelta(minutes=4)))
        t1 = C.issue_execution_decision(envelope, receipt, assessment, observed, fresh, policy, envelope["steward_id"], "domain:t1", "9"*64, "tamper-decision-nonce-01", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=5)))
        t2 = C.issue_execution_decision(envelope, receipt, assessment, observed, fresh, policy, "human:t2", "domain:t2", "a"*64, "tamper-decision-nonce-02", C.CONFIRMATION_TOKEN, state, z(base+timedelta(minutes=6)))
        ta = C.issue_authorization(envelope, receipt, assessment, observed, fresh, policy, [t1,t2], "tamper-auth-nonce-001", state, z(base+timedelta(minutes=7)), z(base+timedelta(minutes=14)))
        overclaim = copy.deepcopy(ta)
        overclaim["claims"]["ownership_transfer_authorized"] = True
        overclaim["authorization_sha256"] = C.self_digest(overclaim, "authorization_sha256")
        rejected = C.assess_authorization(envelope, receipt, assessment, observed, fresh, policy, [t1,t2], overclaim, [], z(base+timedelta(minutes=8)))
        assert rejected["state"] == "authorization_invalid"
        assert rejected["claims"]["bounded_exact_external_execution_authorized"] is False

        bad_envelope = copy.deepcopy(envelope)
        bad_envelope["operations"][0]["force"] = True
        bad_envelope["envelope_sha256"] = C.self_digest(bad_envelope, "envelope_sha256")
        rejected = C.assess_authorization(bad_envelope, receipt, assessment, observed, fresh, policy, [t1,t2], ta, [], z(base+timedelta(minutes=8)))
        assert rejected["state"] == "authorization_invalid"

    print("CHSP v0.9 tests: PASS")


if __name__ == "__main__":
    main()
