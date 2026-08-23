#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


C = load("chsp_v10_test", ROOT / "chsp_v10.py")
G = load("github_adapter_v10_test", ROOT / "github_rest_adapter.py")


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


def make_chain(base, initial_role="collaborator", intended_role="maintainer", include_mapping=True):
    operations = [{"operation_id":"op-role","kind":"ensure_role_at_least","intended_role":intended_role,"force":False,"destructive":False}]
    if include_mapping:
        operations.append({"operation_id":"op-record","kind":"record_external_stewardship_mapping","intended_role":None,"force":False,"destructive":False})
    envelope = {
        "artifact_type":"CHSPExternalTransitionEnvelope","artifact_version":"0.8","envelope_id":"urn:test:v08:envelope",
        "project_id":"Matawaka/uu-aap","steward_id":"human:steward-2","v06_binding_proposal_sha256":"1"*64,
        "v07_transition_authorization_sha256":"2"*64,"v07_transition_assessment_sha256":"3"*64,"observed_state_sha256":"4"*64,
        "external_system_type":"github_repository","external_system_id":"Matawaka/uu-aap","external_principal_id":"github:successor",
        "operations":operations,"created_at":z(base),"expires_at":z(base+timedelta(hours=1)),"nonce":"v08-envelope-nonce-0001","envelope_sha256":"0"*64,
        "claims":{"dry_run_only":True,"non_destructive_plan":True,"external_mutation_authorized":False,"external_mutation_performed":False,"external_control_transferred":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False},
    }
    envelope["envelope_sha256"] = C.self_digest(envelope, "envelope_sha256")
    recheck = {
        "artifact_type":"CHSPExternalExecutionRecheck","artifact_version":"0.9","recheck_id":"urn:test:v09:recheck",
        "project_id":"Matawaka/uu-aap","steward_id":envelope["steward_id"],"v08_envelope_sha256":envelope["envelope_sha256"],
        "v08_dry_run_receipt_sha256":"5"*64,"v08_dry_run_assessment_sha256":"6"*64,"previous_observed_state_sha256":"4"*64,
        "external_system_type":"github_repository","external_system_id":envelope["external_system_id"],"external_principal_id":envelope["external_principal_id"],
        "previous_observed_role":initial_role,"current_observed_role":initial_role,"observer_id":"observer:1","observer_domain_id":"domain:observer",
        "evidence_sha256":"7"*64,"checked_at":z(base+timedelta(minutes=4)),"contains_credentials":False,"result":"match","drift_fields":[],"recheck_sha256":"0"*64,
        "claims":{"fresh_observation_recorded":True,"global_provider_state_proven":False,"external_mutation_performed":False,"ownership_proven":False,"credentials_present":False},
    }
    recheck["recheck_sha256"] = C.self_digest(recheck, "recheck_sha256")
    authorization = {
        "artifact_type":"CHSPExternalExecutionAuthorization","artifact_version":"0.9","authorization_id":"urn:test:v09:authorization",
        "project_id":"Matawaka/uu-aap","steward_id":envelope["steward_id"],"v08_envelope_sha256":envelope["envelope_sha256"],
        "v08_dry_run_receipt_sha256":"5"*64,"v08_dry_run_assessment_sha256":"6"*64,"execution_recheck_sha256":recheck["recheck_sha256"],
        "operations_sha256":C.sha256_json(envelope["operations"]),"decision_set_sha256":"8"*64,"decision_sha256s":["9"*64,"a"*64],
        "authorizer_ids":[envelope["steward_id"],"human:authorizer"],"authorizer_domain_ids":["domain:steward","domain:authorizer"],
        "authorized_action":"execute_exact_bounded_external_transition_envelope","authorized_at":z(base+timedelta(minutes=5)),"expires_at":z(base+timedelta(minutes=20)),
        "nonce":"v09-authorization-nonce","authorization_sha256":"0"*64,
        "claims":{"bounded_exact_external_execution_authorized":True,"exact_envelope_operations_authorized":True,"steward_execution_consent_recorded":True,"unbounded_external_mutation_authorized":False,"ownership_transfer_authorized":False,"account_control_transfer_authorized":False,"predecessor_access_removal_authorized":False,"credential_rotation_authorized":False,"canonical_origin_mutation_authorized":False,"canonical_publication_authorized":False,"kontur_activation_authorized":False,"executor_invoked":False,"execution_performed":False,"legal_ownership_adjudicated":False,"distributed_consensus_established":False},
    }
    authorization["authorization_sha256"] = C.self_digest(authorization, "authorization_sha256")
    assessment = {
        "artifact_type":"CHSPExternalExecutionAuthorizationAssessment","artifact_version":"0.9","assessment_id":"urn:test:v09:assessment",
        "evaluated_at":z(base+timedelta(minutes=6)),"project_id":"Matawaka/uu-aap","steward_id":envelope["steward_id"],
        "v08_envelope_sha256":envelope["envelope_sha256"],"v08_dry_run_receipt_sha256":"5"*64,"v08_dry_run_assessment_sha256":"6"*64,
        "execution_recheck_sha256":recheck["recheck_sha256"],"authorization_sha256":authorization["authorization_sha256"],"revocation_set_sha256":"b"*64,
        "state":"execution_authorization_active","decision":"bounded_external_execution_executor_may_be_requested",
        "metrics":{"authorizer_count":2,"authorizer_domains":2,"recheck_age_seconds":120,"authorization_expired":False,"revocation_count":0},
        "reasons":[],"assessment_sha256":"0"*64,
        "claims":{"policy_sufficiency_only":True,"bounded_exact_external_execution_authorized":True,"executor_invoked":False,"execution_performed":False,"unbounded_external_mutation_authorized":False,"repository_ownership_transferred":False,"account_control_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"global_provider_state_proven":False},
    }
    assessment["assessment_sha256"] = C.self_digest(assessment, "assessment_sha256")
    return envelope, recheck, authorization, assessment


class FakeAdapter:
    adapter_id = "fake-provider-v1.0"
    def __init__(self, role="collaborator", fail_verify=False, raise_on_apply=False):
        self.role = role
        self.fail_verify = fail_verify
        self.raise_on_apply = raise_on_apply
        self.writes = 0
        self.observes = 0
    def observation(self):
        self.observes += 1
        return {"role":self.role,"evidence_sha256":C.sha256_json({"role":self.role,"n":self.observes}),"request_id":f"fake-{self.observes}"}
    def observe(self, envelope):
        return self.observation()
    def preflight(self, op, observation, policy):
        if op["kind"] == "ensure_release_signer_binding":
            return {"supported":False,"mutation_needed":False,"projected_role":observation["role"],"reason":"unsupported"}
        if op["kind"] == "ensure_principal_presence":
            return {"supported":observation["role"] != "absent","mutation_needed":False,"projected_role":observation["role"],"reason":"presence"}
        if op["kind"] == "ensure_role_at_least":
            target = op["intended_role"]
            need = C.ROLE_RANK[observation["role"]] < C.ROLE_RANK[target]
            return {"supported":True,"mutation_needed":need,"projected_role":target if need else observation["role"],"reason":"role"}
        return {"supported":False,"mutation_needed":False,"projected_role":observation["role"],"reason":"unsupported"}
    def apply(self, op, observation, policy):
        if self.raise_on_apply:
            raise RuntimeError("synthetic provider failure")
        plan = self.preflight(op, observation, policy)
        if not plan["mutation_needed"]:
            return {"status":"already_satisfied","mutation_attempted":False,"mutation_performed":False,"observation":observation,"request_id":"fake-nochange","reason":"already satisfied"}
        self.writes += 1
        self.role = op["intended_role"]
        after = self.observation()
        if self.fail_verify:
            after = {"role":"collaborator","evidence_sha256":C.sha256_json({"role":"collaborator","failed":True}),"request_id":"fake-failed"}
            return {"status":"verification_failed","mutation_attempted":True,"mutation_performed":True,"observation":after,"request_id":"fake-write","reason":"synthetic verification failure"}
        return {"status":"changed","mutation_attempted":True,"mutation_performed":True,"observation":after,"request_id":"fake-write","reason":"synthetic change"}


def make_request(envelope, authorization, assessment, policy, state, at):
    return C.build_execution_request(envelope, authorization, assessment, policy, "operator:1", "domain:operator", "c"*64, "v10-execution-request-nonce", z(at), C.EXECUTION_TOKEN, state)


def main():
    policy = C.load_json(ROOT / "reference.chsp-external-executor-policy.json")
    C.validate_policy(policy)
    base = datetime(2026, 8, 23, 16, 40, tzinfo=timezone.utc)

    # Positive changed execution.
    with tempfile.TemporaryDirectory(prefix="chsp-v10-positive-") as td:
        state = Path(td)
        envelope, recheck, auth, assessment = make_chain(base)
        request = make_request(envelope, auth, assessment, policy, state, base+timedelta(minutes=7))
        adapter = FakeAdapter("collaborator")
        receipt = C.execute_exact_transition(envelope, recheck, auth, assessment, request, policy, adapter, state, z(base+timedelta(minutes=7, seconds=30)))
        assert receipt["result"] == "verified_success"
        assert adapter.writes == 1
        assert receipt["claims"]["external_mutation_performed"] is True
        assert receipt["claims"]["exact_external_transition_verified"] is True
        assert receipt["claims"]["repository_ownership_transferred"] is False
        final = C.assess_execution(receipt, z(base+timedelta(minutes=8)))
        assert final["state"] == "execution_verified_changed"
        assert final["decision"] == "external_transition_effect_may_be_recorded"
        serialized = json.dumps(receipt)
        assert "CHSP_GITHUB_TOKEN" not in serialized and "token-secret" not in serialized
        expect_fail(lambda: C.execute_exact_transition(envelope, recheck, auth, assessment, request, policy, adapter, state, z(base+timedelta(minutes=8))), "executed-authorizations")

    # No-change execution still consumes exact authorization once.
    with tempfile.TemporaryDirectory(prefix="chsp-v10-nochange-") as td:
        state = Path(td)
        envelope, recheck, auth, assessment = make_chain(base, initial_role="maintainer")
        request = make_request(envelope, auth, assessment, policy, state, base+timedelta(minutes=7))
        adapter = FakeAdapter("maintainer")
        receipt = C.execute_exact_transition(envelope, recheck, auth, assessment, request, policy, adapter, state, z(base+timedelta(minutes=7, seconds=20)))
        assert receipt["result"] == "no_change_verified"
        assert adapter.writes == 0
        assert C.assess_execution(receipt, z(base+timedelta(minutes=8)))["state"] == "execution_verified_no_change"

    # Live provider drift after v0.9 recheck is blocked before mutation and before authorization consumption.
    with tempfile.TemporaryDirectory(prefix="chsp-v10-drift-") as td:
        state = Path(td)
        envelope, recheck, auth, assessment = make_chain(base)
        request = make_request(envelope, auth, assessment, policy, state, base+timedelta(minutes=7))
        adapter = FakeAdapter("identity_only")
        expect_fail(lambda: C.execute_exact_transition(envelope, recheck, auth, assessment, request, policy, adapter, state, z(base+timedelta(minutes=7, seconds=10))), "drifted")
        assert adapter.writes == 0
        assert not (state / "executed-authorizations").exists()

    # v1.0 role cap refuses admin even if v0.8 could describe it.
    envelope, recheck, auth, assessment = make_chain(base, intended_role="admin")
    expect_fail(lambda: C.validate_predecessors(envelope, recheck, auth, assessment, policy, base+timedelta(minutes=7)), "role exceeds")

    # Unsupported signer transition fails in provider preflight before mutation consumption.
    with tempfile.TemporaryDirectory(prefix="chsp-v10-unsupported-") as td:
        state = Path(td)
        envelope, recheck, auth, assessment = make_chain(base, include_mapping=False)
        envelope["operations"] = [{"operation_id":"signer","kind":"ensure_release_signer_binding","intended_role":"release_signer","force":False,"destructive":False}]
        envelope["envelope_sha256"] = C.self_digest(envelope, "envelope_sha256")
        recheck["v08_envelope_sha256"] = envelope["envelope_sha256"]; recheck["recheck_sha256"] = C.self_digest(recheck, "recheck_sha256")
        auth["v08_envelope_sha256"] = envelope["envelope_sha256"]; auth["execution_recheck_sha256"] = recheck["recheck_sha256"]; auth["operations_sha256"] = C.sha256_json(envelope["operations"]); auth["authorization_sha256"] = C.self_digest(auth, "authorization_sha256")
        assessment["v08_envelope_sha256"] = envelope["envelope_sha256"]; assessment["execution_recheck_sha256"] = recheck["recheck_sha256"]; assessment["authorization_sha256"] = auth["authorization_sha256"]; assessment["assessment_sha256"] = C.self_digest(assessment, "assessment_sha256")
        request = make_request(envelope, auth, assessment, policy, state, base+timedelta(minutes=7))
        adapter = FakeAdapter("collaborator")
        expect_fail(lambda: C.execute_exact_transition(envelope, recheck, auth, assessment, request, policy, adapter, state, z(base+timedelta(minutes=7, seconds=10))), "cannot safely execute")
        assert adapter.writes == 0

    # Provider says write happened but verification fails -> uncertain, never success.
    with tempfile.TemporaryDirectory(prefix="chsp-v10-uncertain-") as td:
        state = Path(td)
        envelope, recheck, auth, assessment = make_chain(base)
        request = make_request(envelope, auth, assessment, policy, state, base+timedelta(minutes=7))
        adapter = FakeAdapter("collaborator", fail_verify=True)
        receipt = C.execute_exact_transition(envelope, recheck, auth, assessment, request, policy, adapter, state, z(base+timedelta(minutes=7, seconds=20)))
        assert receipt["result"] in {"verification_uncertain","failed_after_mutation"}
        assert receipt["claims"]["exact_external_transition_verified"] is False
        assert C.assess_execution(receipt, z(base+timedelta(minutes=8)))["decision"] == "investigate_provider_state_before_further_action"

    # Stale request and tampered authorization are fail-closed.
    with tempfile.TemporaryDirectory(prefix="chsp-v10-stale-") as td:
        state = Path(td)
        envelope, recheck, auth, assessment = make_chain(base)
        request = make_request(envelope, auth, assessment, policy, state, base+timedelta(minutes=7))
        expect_fail(lambda: C.execute_exact_transition(envelope, recheck, auth, assessment, request, policy, FakeAdapter("collaborator"), state, z(base+timedelta(minutes=10))), "request too old")
        bad = copy.deepcopy(auth); bad["claims"]["ownership_transfer_authorized"] = True
        expect_fail(lambda: C.validate_predecessors(envelope, recheck, bad, assessment, policy, base+timedelta(minutes=7)), "self-digest mismatch")

    # Pure GitHub adapter mappings are testable without network.
    assert G.parse_target({"external_system_type":"github_repository","external_system_id":"Matawaka/uu-aap","external_principal_id":"github:successor"}) == ("Matawaka","uu-aap","successor")
    assert G.ROLE_TO_PERMISSION["maintainer"] == "maintain"
    assert "admin" not in G.ROLE_TO_PERMISSION and "owner" not in G.ROLE_TO_PERMISSION
    expect_fail(lambda: G.parse_target({"external_system_type":"github_repository","external_system_id":"Matawaka/uu-aap","external_principal_id":"github:bad/user"}), "invalid GitHub login")

    print("CHSP v1.0 tests: PASS")


if __name__ == "__main__":
    main()
