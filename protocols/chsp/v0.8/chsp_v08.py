#!/usr/bin/env python3
"""CHSP v0.8 local-only External Transition Envelope & Dry-Run Verifier.

No network, Git, GitHub API, subprocess, account, repository, ownership,
canonical-origin, publication, credential, or KONTUR mutation is performed.
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
ALLOWED_ROLES = {None, "identity_only", "collaborator", "maintainer", "admin", "release_signer"}


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
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())
    dfd = os.open(target_dir, os.O_RDONLY)
    try:
        os.fsync(dfd)
    finally:
        os.close(dfd)


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPExternalDryRunPolicy", "CHSPExternalDryRunPolicy required")
    require(policy.get("artifact_version") == "0.8", "CHSPExternalDryRunPolicy v0.8 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    for key in ["maximum_v07_assessment_age_minutes", "maximum_observed_state_age_minutes", "maximum_envelope_hours"]:
        require(isinstance(policy.get(key), int) and policy[key] >= 1, f"invalid policy threshold: {key}")
    allowed = policy.get("allowed_operation_kinds") or []
    require(set(allowed) == {"ensure_principal_presence", "ensure_role_at_least", "ensure_release_signer_binding", "record_external_stewardship_mapping"}, "unexpected allowed operation set")
    req = policy.get("requirements") or {}
    for key in [
        "v07_transition_preparation_authorized_required", "exact_v07_authorization_binding_required",
        "exact_v06_binding_proposal_required", "observed_state_required", "credentials_prohibited",
        "force_prohibited", "destructive_operations_prohibited", "ownership_transfer_prohibited",
        "predecessor_removal_prohibited", "credential_rotation_prohibited",
        "canonical_origin_mutation_prohibited", "canonical_publication_prohibited",
        "kontur_activation_prohibited", "network_prohibited", "git_mutation_prohibited",
        "external_process_prohibited",
    ]:
        require(req.get(key) is True, f"unsafe policy requirement: {key}")
    claims = policy.get("claims") or {}
    require(claims.get("descriptive_policy_only") is True, "policy must remain descriptive")
    for key in ["external_mutation_authorized", "external_mutation_performed", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "global_provider_state_proven"]:
        require(claims.get(key) is False, f"unsafe policy claim: {key}")


def validate_v06_proposal(proposal: dict[str, Any], policy: dict[str, Any]) -> None:
    require(proposal.get("artifact_type") == "CHSPExternalBindingProposal" and proposal.get("artifact_version") == "0.6", "CHSPExternalBindingProposal v0.6 required")
    digest = proposal.get("proposal_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(proposal, "proposal_sha256") == digest, "v0.6 proposal self-digest mismatch")
    require(proposal.get("project_id") == policy["project_id"], "v0.6 proposal project mismatch")
    require(proposal.get("proposed_binding_scope") == "descriptive_external_stewardship_mapping", "unexpected v0.6 proposal scope")
    claims = proposal.get("claims") or {}
    require(claims.get("proposal_only") is True and claims.get("evidence_threshold_satisfied") is True, "v0.6 evidence boundary missing")
    for key in ["external_binding_established", "external_control_transition_authorized", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "universal_identity_proven", "distributed_consensus_established"]:
        require(claims.get(key) is False, f"unsafe v0.6 proposal claim: {key}")


def validate_v07(authorization: dict[str, Any], assessment: dict[str, Any], proposal: dict[str, Any], policy: dict[str, Any], at: datetime) -> None:
    validate_v06_proposal(proposal, policy)
    require(authorization.get("artifact_type") == "CHSPExternalTransitionPreparationAuthorization" and authorization.get("artifact_version") == "0.7", "CHSPExternalTransitionPreparationAuthorization v0.7 required")
    adigest = authorization.get("authorization_sha256", "")
    require(HEX64_RE.fullmatch(adigest) is not None and self_digest(authorization, "authorization_sha256") == adigest, "v0.7 authorization self-digest mismatch")
    require(assessment.get("artifact_type") == "CHSPExternalTransitionAssessment" and assessment.get("artifact_version") == "0.7", "CHSPExternalTransitionAssessment v0.7 required")
    sdigest = assessment.get("assessment_sha256", "")
    require(HEX64_RE.fullmatch(sdigest) is not None and self_digest(assessment, "assessment_sha256") == sdigest, "v0.7 assessment self-digest mismatch")
    require(authorization.get("project_id") == policy["project_id"] == assessment.get("project_id"), "v0.7 project mismatch")
    require(authorization.get("steward_id") == proposal.get("steward_id") == assessment.get("steward_id"), "v0.7 steward mismatch")
    require(authorization.get("v06_binding_proposal_sha256") == proposal["proposal_sha256"], "v0.7 authorization proposal mismatch")
    require(assessment.get("v06_binding_proposal_sha256") == proposal["proposal_sha256"], "v0.7 assessment proposal mismatch")
    require(assessment.get("authorization_sha256") == adigest, "v0.7 assessment authorization mismatch")
    require(assessment.get("state") == "transition_preparation_authorized", "v0.7 transition not authorized for preparation")
    require(assessment.get("decision") == "bounded_external_transition_executor_may_be_requested", "v0.7 executor request not permitted")
    require(parse_time(authorization["authorized_at"]) <= at <= parse_time(authorization["expires_at"]), "v0.7 authorization not active at dry-run time")
    assessed = parse_time(assessment["evaluated_at"])
    require(at >= assessed, "dry-run predates v0.7 assessment")
    require(at - assessed <= timedelta(minutes=policy["maximum_v07_assessment_age_minutes"]), "v0.7 assessment too old for dry-run")
    aclaims = authorization.get("claims") or {}
    require(aclaims.get("bounded_external_transition_preparation_authorized") is True and aclaims.get("steward_consent_recorded") is True, "v0.7 preparation authorization claims missing")
    for key in ["external_binding_established", "external_control_mutation_authorized", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "executor_invoked", "distributed_consensus_established"]:
        require(aclaims.get(key) is False, f"unsafe v0.7 authorization claim: {key}")
    sclaims = assessment.get("claims") or {}
    require(sclaims.get("policy_sufficiency_only") is True and sclaims.get("transition_preparation_authorization_validated") is True, "v0.7 assessment validation claim missing")
    for key in ["executor_invoked", "external_binding_established", "external_control_mutation_authorized", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "distributed_consensus_established"]:
        require(sclaims.get(key) is False, f"unsafe v0.7 assessment claim: {key}")


def observed_claims() -> dict[str, Any]:
    return {"bounded_observation_recorded": True, "global_provider_state_proven": False, "external_control_changed": False, "ownership_proven": False, "credentials_embedded": False}


def issue_observed_state(proposal: dict[str, Any], policy: dict[str, Any], observed_role: str, observer_id: str, observer_domain_id: str, evidence_sha256: str, at: str) -> dict[str, Any]:
    validate_v06_proposal(proposal, policy)
    require(observed_role in {"absent", "identity_only", "collaborator", "maintainer", "admin", "owner", "release_signer", "unknown"}, "invalid observed role")
    require(observer_id and observer_domain_id, "observer identity/domain required")
    require(HEX64_RE.fullmatch(evidence_sha256 or "") is not None, "invalid observation evidence digest")
    now = parse_time(at)
    value = {
        "artifact_type": "CHSPExternalObservedState", "artifact_version": "0.8",
        "observation_id": "urn:uu-aap:chsp:external-observation:" + sha256_json({"proposal": proposal["proposal_sha256"], "at": iso_z(now), "observer": observer_id})[:24],
        "project_id": policy["project_id"], "steward_id": proposal["steward_id"], "v06_binding_proposal_sha256": proposal["proposal_sha256"],
        "external_system_type": proposal["external_system_type"], "external_system_id": proposal["external_system_id"], "external_principal_id": proposal["external_principal_id"],
        "observed_role": observed_role, "observed_at": iso_z(now), "observer_id": observer_id, "observer_domain_id": observer_domain_id, "evidence_sha256": evidence_sha256,
        "contains_credentials": False, "state_sha256": "0" * 64, "claims": observed_claims(),
    }
    value["state_sha256"] = self_digest(value, "state_sha256")
    return value


def validate_observed_state(observed: dict[str, Any], proposal: dict[str, Any], policy: dict[str, Any], at: datetime) -> None:
    validate_v06_proposal(proposal, policy)
    require(observed.get("artifact_type") == "CHSPExternalObservedState" and observed.get("artifact_version") == "0.8", "CHSPExternalObservedState v0.8 required")
    digest = observed.get("state_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(observed, "state_sha256") == digest, "observed state self-digest mismatch")
    require(observed.get("project_id") == policy["project_id"] and observed.get("steward_id") == proposal["steward_id"], "observed state scope mismatch")
    require(observed.get("v06_binding_proposal_sha256") == proposal["proposal_sha256"], "observed state proposal mismatch")
    for key in ["external_system_type", "external_system_id", "external_principal_id"]:
        require(observed.get(key) == proposal.get(key), f"observed state target mismatch: {key}")
    require(observed.get("contains_credentials") is False, "credentials prohibited in observed state")
    require(HEX64_RE.fullmatch(observed.get("evidence_sha256", "")) is not None, "invalid observed evidence digest")
    observed_at = parse_time(observed["observed_at"])
    require(at >= observed_at, "dry-run predates external observation")
    require(at - observed_at <= timedelta(minutes=policy["maximum_observed_state_age_minutes"]), "observed external state too old for dry-run")
    claims = observed.get("claims") or {}
    require(claims.get("bounded_observation_recorded") is True, "observation claim missing")
    for key in ["global_provider_state_proven", "external_control_changed", "ownership_proven", "credentials_embedded"]:
        require(claims.get(key) is False, f"unsafe observed state claim: {key}")


def validate_operations(operations: list[dict[str, Any]], policy: dict[str, Any]) -> None:
    require(isinstance(operations, list) and 1 <= len(operations) <= 16, "operations must contain 1..16 items")
    ids: set[str] = set()
    for op in operations:
        require(isinstance(op, dict), "operation must be object")
        oid = op.get("operation_id")
        require(isinstance(oid, str) and oid and oid not in ids, "duplicate/invalid operation_id")
        ids.add(oid)
        require(op.get("kind") in policy["allowed_operation_kinds"], "operation kind is not policy-bounded")
        require(op.get("force") is False, "force operation prohibited")
        require(op.get("destructive") is False, "destructive operation prohibited")
        role = op.get("intended_role")
        require(role in ALLOWED_ROLES, "unsafe intended role")
        if op["kind"] == "ensure_role_at_least":
            require(role in {"identity_only", "collaborator", "maintainer", "admin", "release_signer"}, "ensure_role_at_least requires bounded intended role")
        elif op["kind"] == "ensure_release_signer_binding":
            require(role == "release_signer", "release signer operation requires release_signer role")
        else:
            require(role is None or role in ALLOWED_ROLES, "unexpected intended role")


def envelope_claims() -> dict[str, Any]:
    return {"dry_run_only": True, "non_destructive_plan": True, "external_mutation_authorized": False, "external_mutation_performed": False, "external_control_transferred": False, "repository_ownership_transferred": False, "account_control_transferred": False, "canonical_origin_mutated": False, "canonical_publication_executed": False, "kontur_activated": False}


def build_envelope(proposal: dict[str, Any], authorization: dict[str, Any], assessment: dict[str, Any], observed: dict[str, Any], policy: dict[str, Any], operations: list[dict[str, Any]], nonce: str, state_dir: Path, at: str, expires_at: str) -> dict[str, Any]:
    validate_policy(policy)
    now = parse_time(at)
    validate_v07(authorization, assessment, proposal, policy, now)
    validate_observed_state(observed, proposal, policy, now)
    validate_operations(operations, policy)
    require(isinstance(nonce, str) and len(nonce) >= 16, "envelope nonce too short")
    expires = parse_time(expires_at)
    require(expires > now, "envelope must expire after creation")
    require(expires - now <= timedelta(hours=policy["maximum_envelope_hours"]), "envelope validity exceeds policy")
    require(expires <= parse_time(authorization["expires_at"]), "envelope cannot outlive v0.7 authorization")
    reservation = {"artifact_type": "CHSPLocalDryRunEnvelopeReservation", "artifact_version": "0.8", "authorization_sha256": authorization["authorization_sha256"], "reserved_at": iso_z(now), "claims": {"global_replay_prevention_established": False}}
    reserve_once(state_dir, "dry-run-envelope-nonces", nonce, reservation)
    value = {
        "artifact_type": "CHSPExternalTransitionEnvelope", "artifact_version": "0.8",
        "envelope_id": "urn:uu-aap:chsp:external-transition-envelope:" + sha256_json({"authorization": authorization["authorization_sha256"], "observation": observed["state_sha256"], "nonce": nonce})[:24],
        "project_id": policy["project_id"], "steward_id": proposal["steward_id"], "v06_binding_proposal_sha256": proposal["proposal_sha256"],
        "v07_transition_authorization_sha256": authorization["authorization_sha256"], "v07_transition_assessment_sha256": assessment["assessment_sha256"], "observed_state_sha256": observed["state_sha256"],
        "external_system_type": proposal["external_system_type"], "external_system_id": proposal["external_system_id"], "external_principal_id": proposal["external_principal_id"],
        "operations": copy.deepcopy(operations), "created_at": iso_z(now), "expires_at": iso_z(expires), "nonce": nonce, "envelope_sha256": "0" * 64, "claims": envelope_claims(),
    }
    value["envelope_sha256"] = self_digest(value, "envelope_sha256")
    return value


def validate_envelope(envelope: dict[str, Any], proposal: dict[str, Any], authorization: dict[str, Any], assessment: dict[str, Any], observed: dict[str, Any], policy: dict[str, Any], at: datetime) -> None:
    validate_v07(authorization, assessment, proposal, policy, at)
    validate_observed_state(observed, proposal, policy, at)
    require(envelope.get("artifact_type") == "CHSPExternalTransitionEnvelope" and envelope.get("artifact_version") == "0.8", "CHSPExternalTransitionEnvelope v0.8 required")
    digest = envelope.get("envelope_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(envelope, "envelope_sha256") == digest, "transition envelope self-digest mismatch")
    require(envelope.get("project_id") == policy["project_id"] and envelope.get("steward_id") == proposal["steward_id"], "envelope scope mismatch")
    require(envelope.get("v06_binding_proposal_sha256") == proposal["proposal_sha256"], "envelope proposal mismatch")
    require(envelope.get("v07_transition_authorization_sha256") == authorization["authorization_sha256"], "envelope authorization mismatch")
    require(envelope.get("v07_transition_assessment_sha256") == assessment["assessment_sha256"], "envelope assessment mismatch")
    require(envelope.get("observed_state_sha256") == observed["state_sha256"], "envelope observation mismatch")
    for key in ["external_system_type", "external_system_id", "external_principal_id"]:
        require(envelope.get(key) == proposal.get(key), f"envelope target mismatch: {key}")
    validate_operations(envelope.get("operations") or [], policy)
    created = parse_time(envelope["created_at"])
    expires = parse_time(envelope["expires_at"])
    require(created <= at <= expires, "transition envelope not active at verification time")
    require(expires - created <= timedelta(hours=policy["maximum_envelope_hours"]), "transition envelope validity exceeds policy")
    require(expires <= parse_time(authorization["expires_at"]), "transition envelope outlives v0.7 authorization")
    claims = envelope.get("claims") or {}
    require(claims.get("dry_run_only") is True and claims.get("non_destructive_plan") is True, "envelope dry-run boundary missing")
    for key in ["external_mutation_authorized", "external_mutation_performed", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated"]:
        require(claims.get(key) is False, f"unsafe envelope claim: {key}")


def dry_run_claims(verified: bool) -> dict[str, Any]:
    return {"dry_run_verification_completed": verified, "external_execution_authorized": False, "external_mutation_performed": False, "external_control_transferred": False, "repository_ownership_transferred": False, "account_control_transferred": False, "canonical_origin_mutated": False, "canonical_publication_executed": False, "kontur_activated": False, "legal_ownership_adjudicated": False, "global_provider_state_proven": False}


def verify_dry_run(proposal: dict[str, Any], authorization: dict[str, Any], assessment: dict[str, Any], observed: dict[str, Any], envelope: dict[str, Any], policy: dict[str, Any], at: str) -> dict[str, Any]:
    now = parse_time(at)
    checks = {"v07_authorization_active": False, "v07_assessment_fresh": False, "observation_fresh": False, "exact_external_target_match": False, "operations_policy_bounded": False, "all_operations_non_destructive": False, "credentials_absent": False, "envelope_unexpired": False}
    reasons: list[str] = []
    try:
        validate_policy(policy)
        validate_v07(authorization, assessment, proposal, policy, now)
        checks["v07_authorization_active"] = True
        checks["v07_assessment_fresh"] = True
        validate_observed_state(observed, proposal, policy, now)
        checks["observation_fresh"] = True
        checks["credentials_absent"] = observed.get("contains_credentials") is False
        validate_envelope(envelope, proposal, authorization, assessment, observed, policy, now)
        checks["exact_external_target_match"] = True
        checks["operations_policy_bounded"] = True
        checks["all_operations_non_destructive"] = all(op.get("force") is False and op.get("destructive") is False for op in envelope["operations"])
        checks["envelope_unexpired"] = now <= parse_time(envelope["expires_at"])
        verified = all(checks.values())
        result = "verified" if verified else "rejected"
        if verified:
            reasons.append("exact bounded transition envelope is internally consistent with fresh supplied pre-state and active v0.7 preparation authorization")
    except Exception as exc:
        verified = False
        result = "rejected"
        reasons.append(str(exc))
    receipt = {
        "artifact_type": "CHSPExternalTransitionDryRunReceipt", "artifact_version": "0.8",
        "receipt_id": "urn:uu-aap:chsp:external-dry-run-receipt:" + sha256_json({"envelope": envelope.get("envelope_sha256"), "at": iso_z(now)})[:24],
        "project_id": policy.get("project_id", ""), "steward_id": proposal.get("steward_id", ""),
        "envelope_sha256": envelope.get("envelope_sha256", "0" * 64), "observed_state_sha256": observed.get("state_sha256", "0" * 64),
        "v07_transition_authorization_sha256": authorization.get("authorization_sha256", "0" * 64), "v07_transition_assessment_sha256": assessment.get("assessment_sha256", "0" * 64),
        "verified_at": iso_z(now), "result": result, "checks": checks, "reasons": reasons, "receipt_sha256": "0" * 64, "claims": dry_run_claims(verified),
    }
    receipt["receipt_sha256"] = self_digest(receipt, "receipt_sha256")
    return receipt


def validate_receipt(receipt: dict[str, Any], envelope: dict[str, Any]) -> None:
    require(receipt.get("artifact_type") == "CHSPExternalTransitionDryRunReceipt" and receipt.get("artifact_version") == "0.8", "CHSPExternalTransitionDryRunReceipt v0.8 required")
    digest = receipt.get("receipt_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(receipt, "receipt_sha256") == digest, "dry-run receipt self-digest mismatch")
    require(receipt.get("envelope_sha256") == envelope.get("envelope_sha256"), "receipt envelope mismatch")
    claims = receipt.get("claims") or {}
    for key in ["external_execution_authorized", "external_mutation_performed", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "global_provider_state_proven"]:
        require(claims.get(key) is False, f"unsafe dry-run receipt claim: {key}")


def assess_dry_run(envelope: dict[str, Any], receipt: dict[str, Any], at: str) -> dict[str, Any]:
    now = parse_time(at)
    reasons: list[str] = []
    state = "dry_run_rejected"
    decision = "revise_transition_envelope"
    verified = False
    try:
        validate_receipt(receipt, envelope)
        if now > parse_time(envelope["expires_at"]):
            state = "dry_run_expired"
            decision = "repeat_dry_run_with_fresh_state"
            reasons.append("transition envelope has expired after dry-run")
        elif receipt.get("result") == "verified" and all((receipt.get("checks") or {}).values()):
            state = "dry_run_verified"
            decision = "external_transition_execution_authorization_may_be_requested"
            verified = True
            reasons.append("dry-run verified; a separate human execution authorization may be requested")
        else:
            reasons.extend(receipt.get("reasons") or ["dry-run receipt rejected"])
    except Exception as exc:
        reasons.append(str(exc))
    result = {
        "artifact_type": "CHSPExternalDryRunAssessment", "artifact_version": "0.8",
        "assessment_id": "urn:uu-aap:chsp:external-dry-run-assessment:" + sha256_json({"envelope": envelope.get("envelope_sha256"), "receipt": receipt.get("receipt_sha256"), "at": iso_z(now)})[:24],
        "evaluated_at": iso_z(now), "project_id": envelope.get("project_id", ""), "steward_id": envelope.get("steward_id", ""),
        "envelope_sha256": envelope.get("envelope_sha256", "0" * 64), "dry_run_receipt_sha256": receipt.get("receipt_sha256"),
        "state": state, "decision": decision, "reasons": reasons, "assessment_sha256": "0" * 64,
        "claims": {"policy_sufficiency_only": True, "dry_run_verified": verified, "external_execution_authorized": False, "executor_invoked": False, "external_mutation_performed": False, "repository_ownership_transferred": False, "account_control_transferred": False, "canonical_origin_mutated": False, "canonical_publication_executed": False, "kontur_activated": False},
    }
    result["assessment_sha256"] = self_digest(result, "assessment_sha256")
    return result
