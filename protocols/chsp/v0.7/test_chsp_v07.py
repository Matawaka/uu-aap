#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module():
    spec = importlib.util.spec_from_file_location("chsp_v07_test", ROOT / "chsp_v07.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load chsp_v07.py")
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


def v06_pair(at):
    proposal = {
        "artifact_type":"CHSPExternalBindingProposal","artifact_version":"0.6","proposal_id":"urn:test:v06:proposal",
        "project_id":"Matawaka/uu-aap","steward_id":"human:steward-2",
        "v05_stewardship_state_sha256":"1"*64,"v05_execution_receipt_sha256":"2"*64,"claim_sha256":"3"*64,
        "attestation_set_sha256":"4"*64,"supporting_attestation_sha256s":["5"*64,"6"*64,"7"*64],
        "observer_domain_ids":["observer:a","observer:b"],"evidence_classes":["identity_match","challenge_response"],
        "external_system_type":"github_repository","external_system_id":"Matawaka/uu-aap","external_principal_id":"github:successor",
        "claimed_role":"maintainer","proposed_binding_scope":"descriptive_external_stewardship_mapping","created_at":z(at),
        "proposal_sha256":"0"*64,
        "claims":{"proposal_only":True,"evidence_threshold_satisfied":True,"external_binding_established":False,"external_control_transition_authorized":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"universal_identity_proven":False,"distributed_consensus_established":False}
    }
    proposal["proposal_sha256"] = C.self_digest(proposal, "proposal_sha256")
    assessment = {
        "artifact_type":"CHSPExternalBindingAssessment","artifact_version":"0.6","assessment_id":"urn:test:v06:assessment",
        "evaluated_at":z(at + timedelta(hours=1)),"project_id":"Matawaka/uu-aap","steward_id":proposal["steward_id"],
        "v05_stewardship_state_sha256":"1"*64,"v05_execution_receipt_sha256":"2"*64,"claim_sha256":"3"*64,
        "attestation_set_sha256":"4"*64,"proposal_sha256":proposal["proposal_sha256"],"state":"binding_review_eligible",
        "decision":"external_binding_human_review_may_be_requested",
        "metrics":{"supporting_attestations":3,"contradictory_attestations":0,"indeterminate_attestations":0,"observer_domains":2,"evidence_classes":2,"strong_possession_present":True,"oldest_support_age_days":1},
        "reasons":[],"assessment_sha256":"0"*64,
        "claims":{"policy_sufficiency_only":True,"external_binding_review_eligible":True,"external_binding_established":False,"external_control_transition_authorized":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"universal_identity_proven":False,"domain_independence_proven":False,"distributed_consensus_established":False}
    }
    assessment["assessment_sha256"] = C.self_digest(assessment, "assessment_sha256")
    return proposal, assessment


def main():
    policy = C.load_json(ROOT / "reference.chsp-external-transition-policy.json")
    C.validate_policy(policy)
    base = datetime(2026, 8, 23, 16, 0, tzinfo=timezone.utc)
    proposal, source = v06_pair(base)

    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v07-") as td:
        state = Path(td)
        r1 = C.issue_decision(proposal, source, policy, "recognition", proposal["steward_id"], "domain:steward", "a"*64, "recognition-decision-0001", C.RECOGNITION_TOKEN, state, z(base+timedelta(hours=2)))
        r2 = C.issue_decision(proposal, source, policy, "recognition", "human:reviewer-1", "domain:reviewer", "b"*64, "recognition-decision-0002", C.RECOGNITION_TOKEN, state, z(base+timedelta(hours=3)))
        recognition = C.issue_recognition(proposal, source, policy, [r1,r2], "recognition-nonce-0001", state, z(base+timedelta(hours=4)), z(base+timedelta(days=3)))
        assert recognition["claims"]["human_binding_recognition_recorded"] is True
        assert recognition["claims"]["external_binding_established"] is False

        recognition_only = C.assess_transition(proposal, source, policy, [r1,r2], recognition, [], None, [], z(base+timedelta(hours=5)))
        assert recognition_only["state"] == "recognition_active"
        assert recognition_only["decision"] == "collect_transition_authorization"

        t1 = C.issue_decision(proposal, source, policy, "transition_preparation", proposal["steward_id"], "domain:steward", "c"*64, "transition-decision-0001", C.TRANSITION_TOKEN, state, z(base+timedelta(hours=6)), recognition)
        t2 = C.issue_decision(proposal, source, policy, "transition_preparation", "human:authorizer-2", "domain:authorizer", "d"*64, "transition-decision-0002", C.TRANSITION_TOKEN, state, z(base+timedelta(hours=7)), recognition)
        auth = C.issue_transition_authorization(proposal, source, policy, recognition, [r1,r2], [t1,t2], "transition-auth-nonce-01", state, z(base+timedelta(hours=8)), z(base+timedelta(hours=20)))
        assert auth["claims"]["bounded_external_transition_preparation_authorized"] is True
        assert auth["claims"]["external_control_mutation_authorized"] is False

        ready = C.assess_transition(proposal, source, policy, [r1,r2], recognition, [t1,t2], auth, [], z(base+timedelta(hours=9)))
        assert ready["state"] == "transition_preparation_authorized"
        assert ready["decision"] == "bounded_external_transition_executor_may_be_requested"
        assert ready["claims"]["executor_invoked"] is False
        assert ready["claims"]["external_control_mutation_authorized"] is False

        rev = C.record_revocation("transition_preparation_authorization", auth, proposal, policy, "human:authorizer-2", "human_revocation", "e"*64, "new_external_evidence_requires_review", "transition-revoke-0001", state, z(base+timedelta(hours=10)))
        revoked = C.assess_transition(proposal, source, policy, [r1,r2], recognition, [t1,t2], auth, [rev], z(base+timedelta(hours=11)))
        assert revoked["state"] == "transition_revoked"
        assert revoked["decision"] == "do_not_execute_revoked_transition"
        assert rev["claims"]["historical_target_erased"] is False

        expect_fail(lambda: C.issue_decision(proposal, source, policy, "recognition", "human:reviewer-1", "domain:reviewer", "f"*64, "recognition-decision-0003", C.RECOGNITION_TOKEN, state, z(base+timedelta(hours=4))), "external-decision-humans")
        expect_fail(lambda: C.issue_recognition(proposal, source, policy, [r1,r2], "recognition-nonce-0002", state, z(base+timedelta(hours=5)), z(base+timedelta(days=4))), "external-recognized-proposals")
        expect_fail(lambda: C.issue_transition_authorization(proposal, source, policy, recognition, [r1,r2], [t1,t2], "transition-auth-nonce-02", state, z(base+timedelta(hours=9)), z(base+timedelta(hours=21))), "external-transition-recognitions")

    # Recognition requires a non-steward and two domains.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v07-recognition-quorum-") as td:
        s = Path(td)
        r1 = C.issue_decision(proposal, source, policy, "recognition", proposal["steward_id"], "domain:same", "1"*64, "rq-decision-000001", C.RECOGNITION_TOKEN, s, z(base+timedelta(hours=2)))
        expect_fail(lambda: C.issue_recognition(proposal, source, policy, [r1], "rq-recognition-0001", s, z(base+timedelta(hours=3)), z(base+timedelta(days=2))), "insufficient recognizers")

    # Transition requires explicit steward consent and a non-steward.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v07-transition-quorum-") as td:
        s = Path(td)
        r1 = C.issue_decision(proposal, source, policy, "recognition", proposal["steward_id"], "domain:steward", "2"*64, "tq-rec-decision-001", C.RECOGNITION_TOKEN, s, z(base+timedelta(hours=2)))
        r2 = C.issue_decision(proposal, source, policy, "recognition", "human:r2", "domain:r2", "3"*64, "tq-rec-decision-002", C.RECOGNITION_TOKEN, s, z(base+timedelta(hours=3)))
        rec = C.issue_recognition(proposal, source, policy, [r1,r2], "tq-recognition-0001", s, z(base+timedelta(hours=4)), z(base+timedelta(days=2)))
        t1 = C.issue_decision(proposal, source, policy, "transition_preparation", "human:a1", "domain:a1", "4"*64, "tq-auth-decision-001", C.TRANSITION_TOKEN, s, z(base+timedelta(hours=5)), rec)
        t2 = C.issue_decision(proposal, source, policy, "transition_preparation", "human:a2", "domain:a2", "5"*64, "tq-auth-decision-002", C.TRANSITION_TOKEN, s, z(base+timedelta(hours=6)), rec)
        expect_fail(lambda: C.issue_transition_authorization(proposal, source, policy, rec, [r1,r2], [t1,t2], "tq-auth-nonce-00001", s, z(base+timedelta(hours=7)), z(base+timedelta(hours=18))), "steward transition consent required")

    # Phase-specific token cannot be reused.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v07-token-") as td:
        expect_fail(lambda: C.issue_decision(proposal, source, policy, "recognition", "human:x", "domain:x", "6"*64, "wrong-token-nonce-01", C.TRANSITION_TOKEN, Path(td), z(base+timedelta(hours=2))), "typed confirmation")

    # Stale v0.6 assessment cannot be refreshed by later human decisions.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v07-stale-") as td:
        s = Path(td)
        r1 = C.issue_decision(proposal, source, policy, "recognition", proposal["steward_id"], "domain:s", "7"*64, "stale-rec-decision-01", C.RECOGNITION_TOKEN, s, z(base+timedelta(days=2)))
        r2 = C.issue_decision(proposal, source, policy, "recognition", "human:r", "domain:r", "8"*64, "stale-rec-decision-02", C.RECOGNITION_TOKEN, s, z(base+timedelta(days=2,hours=1)))
        expect_fail(lambda: C.issue_recognition(proposal, source, policy, [r1,r2], "stale-recognition-01", s, z(base+timedelta(days=2,hours=2)), z(base+timedelta(days=3))), "too old")

    # Expiry is fail-closed.
    with tempfile.TemporaryDirectory(prefix="uu-aap-chsp-v07-expiry-") as td:
        s = Path(td)
        r1 = C.issue_decision(proposal, source, policy, "recognition", proposal["steward_id"], "domain:s", "9"*64, "exp-rec-decision-001", C.RECOGNITION_TOKEN, s, z(base+timedelta(hours=2)))
        r2 = C.issue_decision(proposal, source, policy, "recognition", "human:r", "domain:r", "a"*64, "exp-rec-decision-002", C.RECOGNITION_TOKEN, s, z(base+timedelta(hours=3)))
        rec = C.issue_recognition(proposal, source, policy, [r1,r2], "exp-recognition-0001", s, z(base+timedelta(hours=4)), z(base+timedelta(hours=6)))
        expired = C.assess_transition(proposal, source, policy, [r1,r2], rec, [], None, [], z(base+timedelta(hours=7)))
        assert expired["state"] == "transition_expired"

    # Tamper exact proposal/assessment bindings.
    bad = copy.deepcopy(proposal)
    bad["claimed_role"] = "owner"
    invalid = C.assess_transition(bad, source, policy, [], None, [], None, [], z(base+timedelta(hours=2)))
    assert invalid["state"] == "recognition_invalid"
    assert invalid["claims"]["external_control_mutation_authorized"] is False

    print("CHSP v0.7 tests: PASS")


if __name__ == "__main__":
    main()
