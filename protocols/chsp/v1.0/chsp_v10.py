#!/usr/bin/env python3
"""CHSP v1.0 provider-neutral bounded external transition executor core.

The core has no network implementation. A provider adapter is injected explicitly.
CI uses only a fake adapter. Runtime credentials never enter CHSP artifacts.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
EXECUTION_TOKEN = "EXECUTE_CHSP_V1_EXACT_EXTERNAL_TRANSITION_ONLY"
ALLOWED_KINDS = {
    "ensure_principal_presence",
    "ensure_role_at_least",
    "ensure_release_signer_binding",
    "record_external_stewardship_mapping",
}
ROLE_RANK = {
    "absent": 0,
    "unknown": -1,
    "identity_only": 1,
    "collaborator": 2,
    "release_signer": 2,
    "maintainer": 3,
    "admin": 4,
    "owner": 5,
}
MUTATING_KINDS = {"ensure_role_at_least", "ensure_release_signer_binding"}


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def self_digest(value: dict[str, Any], field: str) -> str:
    work = copy.deepcopy(value)
    work[field] = "0" * 64
    return sha256_json(work)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.tzinfo is not None, "timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    require(path.is_file() and not path.is_symlink(), f"JSON input must be regular non-symlink file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def reserve_once(state_dir: Path, category: str, key: str, payload: dict[str, Any]) -> None:
    target_dir = state_dir / category
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / (hashlib.sha256(key.encode("utf-8")).hexdigest() + ".json")
    try:
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise ValueError(f"local reservation already exists for {category}") from exc
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    dfd = os.open(target_dir, os.O_RDONLY)
    try:
        os.fsync(dfd)
    finally:
        os.close(dfd)


def _valid_self(value: dict[str, Any], field: str) -> bool:
    digest = value.get(field, "")
    return isinstance(digest, str) and HEX64_RE.fullmatch(digest) is not None and self_digest(value, field) == digest


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPExternalExecutorPolicy", "CHSPExternalExecutorPolicy required")
    require(policy.get("artifact_version") == "1.0", "CHSPExternalExecutorPolicy v1.0 required")
    require(policy.get("project_id"), "project_id required")
    for key in ["maximum_v09_assessment_age_minutes", "maximum_execution_request_age_minutes", "maximum_execution_duration_seconds"]:
        require(isinstance(policy.get(key), int) and policy[key] >= 1, f"invalid policy threshold: {key}")
    require(policy.get("maximum_provider_mutations") == 1, "reference executor requires one-mutation maximum")
    require(policy.get("maximum_executable_role") in {"identity_only", "collaborator", "maintainer"}, "unsafe maximum executable role")
    require(policy.get("allowed_external_system_types") == ["github_repository"], "reference v1.0 supports github_repository only")
    req = policy.get("requirements") or {}
    for key in [
        "v09_active_authorization_required", "exact_envelope_binding_required", "exact_operations_digest_required",
        "explicit_execution_request_required", "typed_execution_confirmation_required", "operator_evidence_digest_required",
        "credentials_runtime_only", "preflight_before_any_mutation", "fresh_provider_observation_required",
        "all_operations_preflight_required", "post_write_verification_required", "single_mutation_limit_required",
        "ownership_transfer_prohibited", "predecessor_access_removal_prohibited", "credential_rotation_prohibited",
        "canonical_origin_mutation_prohibited", "canonical_publication_prohibited", "kontur_activation_prohibited",
    ]:
        require(req.get(key) is True, f"unsafe missing policy requirement: {key}")
    require(req.get("automatic_execution_on_merge_or_ci") is False, "automatic execution must remain false")


def validate_operations(operations: list[dict[str, Any]], policy: dict[str, Any]) -> None:
    require(isinstance(operations, list) and 1 <= len(operations) <= 16, "invalid operation set")
    ids: list[str] = []
    mutating = 0
    max_rank = ROLE_RANK[policy["maximum_executable_role"]]
    for op in operations:
        require(isinstance(op, dict), "operation must be object")
        require(op.get("kind") in ALLOWED_KINDS, "unsafe operation kind")
        require(op.get("force") is False, "force operation prohibited")
        require(op.get("destructive") is False, "destructive operation prohibited")
        oid = op.get("operation_id")
        require(isinstance(oid, str) and oid, "operation_id required")
        ids.append(oid)
        role = op.get("intended_role")
        if role is not None:
            require(role in ROLE_RANK and ROLE_RANK[role] <= max_rank, "intended role exceeds v1.0 policy cap")
        if op.get("kind") in MUTATING_KINDS:
            mutating += 1
    require(len(ids) == len(set(ids)), "duplicate operation_id")
    require(mutating <= policy["maximum_provider_mutations"], "too many provider-mutating operations")


def validate_predecessors(
    envelope: dict[str, Any], recheck: dict[str, Any], authorization: dict[str, Any],
    authorization_assessment: dict[str, Any], policy: dict[str, Any], at: datetime,
) -> None:
    validate_policy(policy)
    require(envelope.get("artifact_type") == "CHSPExternalTransitionEnvelope" and envelope.get("artifact_version") == "0.8", "CHSPExternalTransitionEnvelope v0.8 required")
    require(_valid_self(envelope, "envelope_sha256"), "v0.8 envelope self-digest mismatch")
    require(envelope.get("project_id") == policy["project_id"], "envelope project mismatch")
    require(envelope.get("external_system_type") in policy["allowed_external_system_types"], "external system type not executable by policy")
    validate_operations(envelope.get("operations"), policy)
    require(parse_time(envelope["expires_at"]) > at, "v0.8 envelope expired")

    require(recheck.get("artifact_type") == "CHSPExternalExecutionRecheck" and recheck.get("artifact_version") == "0.9", "CHSPExternalExecutionRecheck v0.9 required")
    require(_valid_self(recheck, "recheck_sha256"), "v0.9 recheck self-digest mismatch")
    require(recheck.get("v08_envelope_sha256") == envelope["envelope_sha256"], "recheck/envelope binding mismatch")
    require(recheck.get("result") == "match", "execution recheck is not a no-drift match")
    require(recheck.get("contains_credentials") is False, "credentials prohibited in execution recheck")

    require(authorization.get("artifact_type") == "CHSPExternalExecutionAuthorization" and authorization.get("artifact_version") == "0.9", "CHSPExternalExecutionAuthorization v0.9 required")
    require(_valid_self(authorization, "authorization_sha256"), "v0.9 authorization self-digest mismatch")
    require(authorization.get("v08_envelope_sha256") == envelope["envelope_sha256"], "authorization/envelope binding mismatch")
    require(authorization.get("execution_recheck_sha256") == recheck["recheck_sha256"], "authorization/recheck binding mismatch")
    require(authorization.get("operations_sha256") == sha256_json(envelope["operations"]), "authorization operation-set digest mismatch")
    require(authorization.get("authorized_action") == "execute_exact_bounded_external_transition_envelope", "unexpected authorized action")
    require(parse_time(authorization["expires_at"]) > at, "v0.9 authorization expired")
    claims = authorization.get("claims") or {}
    require(claims.get("bounded_exact_external_execution_authorized") is True, "bounded execution authorization missing")
    require(claims.get("exact_envelope_operations_authorized") is True, "exact operation authorization missing")
    for key in ["unbounded_external_mutation_authorized", "ownership_transfer_authorized", "account_control_transfer_authorized", "predecessor_access_removal_authorized", "credential_rotation_authorized", "canonical_origin_mutation_authorized", "canonical_publication_authorized", "kontur_activation_authorized", "executor_invoked", "execution_performed"]:
        require(claims.get(key) is False, f"unsafe v0.9 authorization claim: {key}")

    require(authorization_assessment.get("artifact_type") == "CHSPExternalExecutionAuthorizationAssessment" and authorization_assessment.get("artifact_version") == "0.9", "CHSPExternalExecutionAuthorizationAssessment v0.9 required")
    require(_valid_self(authorization_assessment, "assessment_sha256"), "v0.9 authorization assessment self-digest mismatch")
    require(authorization_assessment.get("authorization_sha256") == authorization["authorization_sha256"], "v0.9 assessment/authorization binding mismatch")
    require(authorization_assessment.get("execution_recheck_sha256") == recheck["recheck_sha256"], "v0.9 assessment/recheck binding mismatch")
    require(authorization_assessment.get("state") == "execution_authorization_active", "v0.9 execution authorization is not active")
    require(authorization_assessment.get("decision") == "bounded_external_execution_executor_may_be_requested", "v0.9 assessment does not permit executor request")
    assessed_at = parse_time(authorization_assessment["evaluated_at"])
    require(at >= assessed_at, "execution predates v0.9 authorization assessment")
    require(at - assessed_at <= timedelta(minutes=policy["maximum_v09_assessment_age_minutes"]), "v0.9 authorization assessment too old")


def build_execution_request(
    envelope: dict[str, Any], authorization: dict[str, Any], authorization_assessment: dict[str, Any],
    policy: dict[str, Any], operator_id: str, operator_domain_id: str, operator_evidence_sha256: str,
    nonce: str, requested_at: str, confirmation_token: str, state_dir: Path | None = None,
) -> dict[str, Any]:
    now = parse_time(requested_at)
    require(operator_id and operator_domain_id, "operator identity fields required")
    require(HEX64_RE.fullmatch(operator_evidence_sha256 or "") is not None, "invalid operator evidence digest")
    require(isinstance(nonce, str) and len(nonce) >= 16, "execution request nonce too short")
    require(confirmation_token == EXECUTION_TOKEN, "execution typed confirmation mismatch")
    value = {
        "artifact_type":"CHSPExternalExecutionRequest","artifact_version":"1.0",
        "request_id":"urn:uu-aap:chsp:external-execution-request:" + sha256_json({"authorization":authorization["authorization_sha256"],"operator":operator_id,"nonce":nonce})[:24],
        "project_id":policy["project_id"],"steward_id":envelope["steward_id"],
        "v08_envelope_sha256":envelope["envelope_sha256"],"v09_execution_authorization_sha256":authorization["authorization_sha256"],"v09_execution_authorization_assessment_sha256":authorization_assessment["assessment_sha256"],
        "operator_id":operator_id,"operator_domain_id":operator_domain_id,"operator_evidence_sha256":operator_evidence_sha256,
        "requested_at":iso_z(now),"nonce":nonce,"confirmation_token":confirmation_token,"request_sha256":"0"*64,
        "claims":{"explicit_execution_event_requested":True,"exact_authorization_bound":True,"credential_embedded":False,"executor_invoked":False,"external_mutation_performed":False,"ownership_transfer_requested":False,"predecessor_access_removal_requested":False,"canonical_origin_mutation_requested":False,"canonical_publication_requested":False,"kontur_activation_requested":False},
    }
    value["request_sha256"] = self_digest(value, "request_sha256")
    if state_dir is not None:
        reserve_once(state_dir, "execution-request-nonces", nonce, {"request_sha256":value["request_sha256"],"requested_at":value["requested_at"]})
    return value


def validate_request(request: dict[str, Any], envelope: dict[str, Any], authorization: dict[str, Any], authorization_assessment: dict[str, Any], policy: dict[str, Any], at: datetime) -> None:
    require(request.get("artifact_type") == "CHSPExternalExecutionRequest" and request.get("artifact_version") == "1.0", "CHSPExternalExecutionRequest v1.0 required")
    require(_valid_self(request, "request_sha256"), "execution request self-digest mismatch")
    require(request.get("project_id") == policy["project_id"] == envelope.get("project_id"), "execution request project mismatch")
    require(request.get("steward_id") == envelope.get("steward_id"), "execution request steward mismatch")
    require(request.get("v08_envelope_sha256") == envelope["envelope_sha256"], "execution request envelope mismatch")
    require(request.get("v09_execution_authorization_sha256") == authorization["authorization_sha256"], "execution request authorization mismatch")
    require(request.get("v09_execution_authorization_assessment_sha256") == authorization_assessment["assessment_sha256"], "execution request assessment mismatch")
    require(request.get("confirmation_token") == EXECUTION_TOKEN, "execution request confirmation mismatch")
    require(HEX64_RE.fullmatch(request.get("operator_evidence_sha256", "")) is not None, "invalid operator evidence digest")
    requested_at = parse_time(request["requested_at"])
    require(at >= requested_at, "execution predates request")
    require(at - requested_at <= timedelta(minutes=policy["maximum_execution_request_age_minutes"]), "execution request too old")
    claims = request.get("claims") or {}
    require(claims.get("explicit_execution_event_requested") is True and claims.get("exact_authorization_bound") is True, "execution request boundary missing")
    require(claims.get("credential_embedded") is False, "credential material must not be embedded")


def _receipt_claims(mutation: bool, verified: bool) -> dict[str, Any]:
    return {
        "executor_invoked":True,"exact_authorization_consumed_locally":True,
        "external_mutation_performed":mutation,"exact_external_transition_verified":verified,
        "credential_material_persisted":False,"repository_ownership_transferred":False,
        "account_control_transferred":False,"predecessor_access_removed":False,
        "canonical_origin_mutated":False,"canonical_publication_executed":False,
        "kontur_activated":False,"global_provider_state_proven":False,
    }


def _make_receipt(envelope: dict[str, Any], authorization: dict[str, Any], authorization_assessment: dict[str, Any], request: dict[str, Any], adapter_id: str, started: datetime, completed: datetime, result: str, preflight: dict[str, Any], operation_results: list[dict[str, Any]], post: dict[str, Any] | None, mutation: bool, verified: bool) -> dict[str, Any]:
    value = {
        "artifact_type":"CHSPExternalExecutionReceipt","artifact_version":"1.0",
        "receipt_id":"urn:uu-aap:chsp:external-execution-receipt:" + sha256_json({"request":request["request_sha256"],"started":iso_z(started),"adapter":adapter_id})[:24],
        "project_id":envelope["project_id"],"steward_id":envelope["steward_id"],
        "v08_envelope_sha256":envelope["envelope_sha256"],"v09_execution_authorization_sha256":authorization["authorization_sha256"],"v09_execution_authorization_assessment_sha256":authorization_assessment["assessment_sha256"],"execution_request_sha256":request["request_sha256"],
        "provider_adapter_id":adapter_id,"started_at":iso_z(started),"completed_at":iso_z(completed),"result":result,
        "preflight_observed_role":preflight["role"],"preflight_evidence_sha256":preflight["evidence_sha256"],
        "operation_results":operation_results,"post_observed_role":None if post is None else post["role"],"post_evidence_sha256":None if post is None else post["evidence_sha256"],
        "receipt_sha256":"0"*64,"claims":_receipt_claims(mutation, verified),
    }
    value["receipt_sha256"] = self_digest(value, "receipt_sha256")
    return value


def execute_exact_transition(
    envelope: dict[str, Any], recheck: dict[str, Any], authorization: dict[str, Any], authorization_assessment: dict[str, Any], request: dict[str, Any], policy: dict[str, Any], adapter: Any, state_dir: Path, started_at: str,
) -> dict[str, Any]:
    started = parse_time(started_at)
    validate_predecessors(envelope, recheck, authorization, authorization_assessment, policy, started)
    validate_request(request, envelope, authorization, authorization_assessment, policy, started)
    adapter_id = getattr(adapter, "adapter_id", "")
    require(isinstance(adapter_id, str) and adapter_id, "provider adapter id required")

    preflight = adapter.observe(envelope)
    require(preflight.get("role") in ROLE_RANK, "adapter returned invalid role")
    require(HEX64_RE.fullmatch(preflight.get("evidence_sha256", "")) is not None, "adapter preflight evidence digest invalid")
    require(preflight["role"] == recheck.get("current_observed_role"), "provider state drifted after v0.9 recheck")

    plans: list[dict[str, Any]] = []
    for op in envelope["operations"]:
        if op["kind"] == "record_external_stewardship_mapping":
            plans.append({"supported":True,"mutation_needed":False,"projected_role":preflight["role"],"reason":"receipt-local protocol record"})
        else:
            plans.append(adapter.preflight(op, preflight, policy))
    require(all(p.get("supported") is True for p in plans), "provider adapter cannot safely execute every operation")
    require(sum(1 for p in plans if p.get("mutation_needed") is True) <= policy["maximum_provider_mutations"], "provider preflight exceeds one-mutation limit")

    reservation = {"authorization_sha256":authorization["authorization_sha256"],"request_sha256":request["request_sha256"],"reserved_at":iso_z(started),"claims":{"global_replay_prevention_established":False}}
    reserve_once(state_dir, "executed-authorizations", authorization["authorization_sha256"], reservation)
    reserve_once(state_dir, "executed-requests", request["request_sha256"], reservation)

    current = preflight
    results: list[dict[str, Any]] = []
    mutation_attempted = False
    mutation_performed = False
    failed = False
    uncertain = False
    for op, plan in zip(envelope["operations"], plans):
        if failed:
            results.append({"operation_id":op["operation_id"],"kind":op["kind"],"status":"not_run","mutation_attempted":False,"mutation_performed":False,"before_role":current["role"],"after_role":current["role"],"provider_evidence_sha256":current["evidence_sha256"],"provider_request_id":None,"reason":"prior operation failed"})
            continue
        if op["kind"] == "record_external_stewardship_mapping":
            results.append({"operation_id":op["operation_id"],"kind":op["kind"],"status":"recorded_in_receipt","mutation_attempted":False,"mutation_performed":False,"before_role":current["role"],"after_role":current["role"],"provider_evidence_sha256":current["evidence_sha256"],"provider_request_id":None,"reason":"protocol-local record"})
            continue
        try:
            outcome = adapter.apply(op, current, policy)
            attempted = bool(outcome.get("mutation_attempted"))
            changed = bool(outcome.get("mutation_performed"))
            mutation_attempted = mutation_attempted or attempted
            mutation_performed = mutation_performed or changed
            after = outcome.get("observation") or current
            require(after.get("role") in ROLE_RANK and HEX64_RE.fullmatch(after.get("evidence_sha256", "")) is not None, "adapter returned invalid post-operation observation")
            status = outcome.get("status")
            require(status in {"already_satisfied", "changed", "verification_failed"}, "adapter returned invalid operation status")
            if status == "verification_failed":
                failed, uncertain = True, True
            results.append({"operation_id":op["operation_id"],"kind":op["kind"],"status":status,"mutation_attempted":attempted,"mutation_performed":changed,"before_role":current["role"],"after_role":after["role"],"provider_evidence_sha256":after["evidence_sha256"],"provider_request_id":outcome.get("request_id"),"reason":str(outcome.get("reason", ""))})
            current = after
        except Exception as exc:
            failed = True
            results.append({"operation_id":op["operation_id"],"kind":op["kind"],"status":"rejected","mutation_attempted":False,"mutation_performed":False,"before_role":current["role"],"after_role":current["role"],"provider_evidence_sha256":current["evidence_sha256"],"provider_request_id":None,"reason":f"adapter failure: {type(exc).__name__}"})

    post: dict[str, Any] | None = None
    if not failed or mutation_attempted:
        try:
            post = adapter.observe(envelope)
            require(post.get("role") in ROLE_RANK and HEX64_RE.fullmatch(post.get("evidence_sha256", "")) is not None, "invalid final provider observation")
        except Exception:
            uncertain = True
            post = None

    verified = not failed and post is not None
    if verified:
        for op in envelope["operations"]:
            if op["kind"] == "ensure_principal_presence" and post["role"] == "absent":
                verified = False
            elif op["kind"] == "ensure_role_at_least":
                target = op.get("intended_role")
                if target is None or ROLE_RANK.get(post["role"], -1) < ROLE_RANK.get(target, 999):
                    verified = False
            elif op["kind"] == "ensure_release_signer_binding":
                verified = False
    completed = started
    if verified and mutation_performed:
        result = "verified_success"
    elif verified:
        result = "no_change_verified"
    elif uncertain or (mutation_attempted and post is None):
        result = "verification_uncertain"
    elif mutation_attempted:
        result = "failed_after_mutation"
    else:
        result = "failed_before_mutation"
    return _make_receipt(envelope, authorization, authorization_assessment, request, adapter_id, started, completed, result, preflight, results, post, mutation_performed, verified)


def assess_execution(receipt: dict[str, Any], evaluated_at: str) -> dict[str, Any]:
    require(receipt.get("artifact_type") == "CHSPExternalExecutionReceipt" and receipt.get("artifact_version") == "1.0", "CHSPExternalExecutionReceipt v1.0 required")
    require(_valid_self(receipt, "receipt_sha256"), "execution receipt self-digest mismatch")
    result = receipt["result"]
    if result == "verified_success":
        state, decision, reasons = "execution_verified_changed", "external_transition_effect_may_be_recorded", []
    elif result == "no_change_verified":
        state, decision, reasons = "execution_verified_no_change", "external_transition_effect_may_be_recorded", []
    elif result == "verification_uncertain":
        state, decision, reasons = "execution_uncertain", "investigate_provider_state_before_further_action", ["post-execution provider state is uncertain"]
    elif result == "failed_after_mutation":
        state, decision, reasons = "execution_failed", "investigate_provider_state_before_further_action", ["execution failed after provider mutation attempt"]
    else:
        state, decision, reasons = "execution_rejected", "do_not_record_external_effect", ["execution did not produce a verified external effect"]
    verified = state in {"execution_verified_changed", "execution_verified_no_change"}
    value = {
        "artifact_type":"CHSPExternalExecutionAssessment","artifact_version":"1.0",
        "assessment_id":"urn:uu-aap:chsp:external-execution-assessment:" + receipt["receipt_sha256"][:24],
        "evaluated_at":iso_z(parse_time(evaluated_at)),"project_id":receipt["project_id"],"steward_id":receipt["steward_id"],"execution_receipt_sha256":receipt["receipt_sha256"],
        "state":state,"decision":decision,"reasons":reasons,"assessment_sha256":"0"*64,
        "claims":{"policy_sufficiency_only":True,"exact_external_transition_verified":verified,"external_effect_recordable":verified,"repository_ownership_transferred":False,"account_control_transferred":False,"predecessor_access_removed":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"global_provider_state_proven":False},
    }
    value["assessment_sha256"] = self_digest(value, "assessment_sha256")
    return value
