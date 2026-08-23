#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module():
    spec = importlib.util.spec_from_file_location("chsp_v08_test", ROOT / "chsp_v08.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load chsp_v08.py")
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


def make_v06_proposal(base):
    value = {
        "artifact_type":"CHSPExternalBindingProposal","artifact_version":"0.6","proposal_id":"urn:test:v06:proposal",
        "project_id":"Matawaka/uu-aap","steward_id":"human:steward-2",
        "v05_stewardship_state_sha256":"1"*64,"v05_execution_receipt_sha256":"2"*64,"claim_sha256":"3"*64,
        "attestation_set_sha256":"4"*64,"supporting_attestation_sha256s":["5"*64,"6"*64,"7"*64],
        "observer_domain_ids":["observer:a","observer:b"],"evidence_classes":["identity_match","challenge_response"],
        "external_system_type":"github_repository","external_system_id":"Matawaka/uu-aap","external_principal_id":"github:successor",
        "claimed_role":"maintainer","proposed_binding_scope":"descriptive_external_stewardship_mapping","created_at":z(base),
        "proposal_sha256":"0"*64,
        "claims":{"proposal_only":True,"evidence_threshold_satisfied":True,"external_binding_established":False,"external_control_transition_authorized":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"universal_identity_proven":False,"distributed_consensus_established":False}
    }
    value["proposal_sha256"] = C.self_digest(value, "proposal_sha256")
    return value


def make_v07(proposal, base):
    auth = {
        "artifact_type":"CHSPExternalTransitionPreparationAuthorization","artifact_version":"0.7","authorization_id":"urn:test:v07:auth",
        "project_id":"Matawaka/uu-aap","steward_id":proposal["steward_id"],"recognition_sha256":"8"*64,
        "v06_binding_proposal_sha256":proposal["proposal_sha256"],"v06_binding_assessment_sha256":"9"*64,
        "decision_set_sha256":"a"*64,"decision_sha256s":["b"*64,"c"*64],"authorizer_ids":[proposal["steward_id"],"human:authorizer"],
        "authorizer_domain_ids":["domain:steward","domain:authorizer"],"authorized_action":"prepare_bounded_external_stewardship_transition_envelope",
        "authorized_at":z(base+timedelta(minutes=5)),"expires_at":z(base+timedelta(hours=1)),"nonce":"v07-authorization-nonce-0001",
        "authorization_sha256":"0"*64,
        "claims":{"bounded_external_transition_preparation_authorized":True,"steward_consent_recorded":True,"external_binding_established":False,"external_control_mutation_authorized":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"executor_invoked":False,"distributed_consensus_established":False}
    }
    auth["authorization_sha256"] = C.self_digest(auth, "authorization_sha256")
    assessment = {
        "artifact_type":"CHSPExternalTransitionAssessment","artifact_version":"0.7","assessment_id":"urn:test:v07:assessment",
        "evaluated_at":z(base+timedelta(minutes=10)),"project_id":"Matawaka/uu-aap","steward_id":proposal["steward_id"],
        "v06_binding_proposal_sha256":proposal["proposal_sha256"],"v06_binding_assessment_sha256":"9"*64,
        "recognition_sha256":"8"*64,"authorization_sha256":auth["authorization_sha256"],"revocation_set_sha256":"d"*64,
        "state":"transition_preparation_authorized","decision":"bounded_external_transition_executor_may_be_requested",
        "metrics":{"recognizer_count":2,"recognizer_domains":2,"transition_authorizer_count":2,"transition_authorizer_domains":2,"recognition_expired":False,"authorization_expired":False,"revocation_count":0},
        "reasons":[],"assessment_sha256":"0"*64,
        "claims":{"policy_sufficiency_only":True,"human_binding_recognition_validated":True,"transition_preparation_authorization_validated":True,"executor_invoked":False,"external_binding_established":False,"external_control_mutation_authorized":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"distributed_consensus_established":False}
    }
    assessment["assessment_sha256"] = C.self_digest(assessment, "assessment_sha256")
    return auth, assessment


def main():
    policy = C.load_json(ROOT / "reference.chsp-external-dry-run-policy.json")
    C.validate_policy(policy)
    base = datetime(2026, 8, 23, 16, 0, tzinfo=timezone.utc)
    proposal = make_v06_proposal(base)
    auth, assessment = make_v07(proposal, base)

    operations = [
        {"operation_id":"op-1","kind":"ensure_principal_presence","intended_role":None,"force":False,"destructive":False},
        {"operation_id":"op-2","kind":"ensure_role_at_least","intended_role":"maintainer","force":False,"destructive":False},
        {"operation_id":"op-3","kind":"record_external_stewardship_mapping","intended_role":None,"force":False,"destructive":False},
    ]

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v08-") as td:
        state = Path(td)
        observed = C.issue_observed_state(proposal, policy, "collaborator", "observer:1", "observer-domain:1", "e"*64, z(base+timedelta(minutes=12)))
        envelope = C.build_envelope(proposal, auth, assessment, observed, policy, operations, "dry-run-envelope-nonce-0001", state, z(base+timedelta(minutes=13)), z(base+timedelta(minutes=45)))
        assert envelope["claims"]["dry_run_only"] is True
        assert envelope["claims"]["external_mutation_authorized"] is False

        receipt = C.verify_dry_run(proposal, auth, assessment, observed, envelope, policy, z(base+timedelta(minutes=14)))
        assert receipt["result"] == "verified"
        assert receipt["claims"]["dry_run_verification_completed"] is True
        assert receipt["claims"]["external_execution_authorized"] is False
        assert all(receipt["checks"].values())

        final = C.assess_dry_run(envelope, receipt, z(base+timedelta(minutes=15)))
        assert final["state"] == "dry_run_verified"
        assert final["decision"] == "external_transition_execution_authorization_may_be_requested"
        assert final["claims"]["external_execution_authorized"] is False
        assert final["claims"]["executor_invoked"] is False

        # One nonce cannot create a second envelope locally.
        expect_fail(lambda: C.build_envelope(proposal, auth, assessment, observed, policy, operations, "dry-run-envelope-nonce-0001", state, z(base+timedelta(minutes=14)), z(base+timedelta(minutes=46))), "dry-run-envelope-nonces")

        # Planning ownership elevation is prohibited even at dry-run stage.
        unsafe_owner = [{"operation_id":"owner","kind":"ensure_role_at_least","intended_role":"owner","force":False,"destructive":False}]
        expect_fail(lambda: C.build_envelope(proposal, auth, assessment, observed, policy, unsafe_owner, "dry-run-envelope-nonce-owner", state, z(base+timedelta(minutes=14)), z(base+timedelta(minutes=46))), "unsafe intended role")

        # Force/destructive plans are rejected.
        unsafe_force = [{"operation_id":"force","kind":"ensure_principal_presence","intended_role":None,"force":True,"destructive":False}]
        expect_fail(lambda: C.build_envelope(proposal, auth, assessment, observed, policy, unsafe_force, "dry-run-envelope-nonce-force", state, z(base+timedelta(minutes=14)), z(base+timedelta(minutes=46))), "force operation prohibited")

        # Tampering with the envelope cannot produce a positive receipt.
        bad_envelope = copy.deepcopy(envelope)
        bad_envelope["external_principal_id"] = "github:attacker"
        bad_receipt = C.verify_dry_run(proposal, auth, assessment, observed, bad_envelope, policy, z(base+timedelta(minutes=14)))
        assert bad_receipt["result"] == "rejected"
        assert bad_receipt["claims"]["external_mutation_performed"] is False

        # A previously valid receipt expires with its exact envelope and requires a fresh dry-run.
        expired = C.assess_dry_run(envelope, receipt, z(base+timedelta(minutes=46)))
        assert expired["state"] == "dry_run_expired"
        assert expired["decision"] == "repeat_dry_run_with_fresh_state"

    # Stale v0.7 assessment is fail-closed.
    observed = C.issue_observed_state(proposal, policy, "maintainer", "observer:2", "observer-domain:2", "f"*64, z(base+timedelta(minutes=24)))
    fake_envelope = {"artifact_type":"CHSPExternalTransitionEnvelope","artifact_version":"0.8","envelope_sha256":"0"*64}
    stale_receipt = C.verify_dry_run(proposal, auth, assessment, observed, fake_envelope, policy, z(base+timedelta(minutes=30)))
    assert stale_receipt["result"] == "rejected"
    assert any("too old" in reason for reason in stale_receipt["reasons"])

    # Stale observed state is independently fail-closed while v0.7 assessment is still fresh enough for this test.
    old_observed = C.issue_observed_state(proposal, policy, "maintainer", "observer:3", "observer-domain:3", "1"*64, z(base))
    stale_obs_receipt = C.verify_dry_run(proposal, auth, assessment, old_observed, fake_envelope, policy, z(base+timedelta(minutes=14)))
    assert stale_obs_receipt["result"] == "rejected"
    assert any("observed external state too old" in reason for reason in stale_obs_receipt["reasons"])

    # Credential-bearing or target-tampered observations are not acceptable.
    observed = C.issue_observed_state(proposal, policy, "maintainer", "observer:4", "observer-domain:4", "2"*64, z(base+timedelta(minutes=12)))
    bad_observed = copy.deepcopy(observed)
    bad_observed["contains_credentials"] = True
    bad_observed["state_sha256"] = C.self_digest(bad_observed, "state_sha256")
    rejected = C.verify_dry_run(proposal, auth, assessment, bad_observed, fake_envelope, policy, z(base+timedelta(minutes=14)))
    assert rejected["result"] == "rejected"
    assert any("credentials prohibited" in reason for reason in rejected["reasons"])

    # v0.7 tamper cannot be hidden behind a fresh v0.8 envelope.
    tampered_assessment = copy.deepcopy(assessment)
    tampered_assessment["state"] = "recognition_active"
    rejected = C.verify_dry_run(proposal, auth, tampered_assessment, observed, fake_envelope, policy, z(base+timedelta(minutes=14)))
    assert rejected["result"] == "rejected"
    assert any("self-digest mismatch" in reason for reason in rejected["reasons"])

    print("CHSP v0.8 tests: PASS")


if __name__ == "__main__":
    main()
