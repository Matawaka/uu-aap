#!/usr/bin/env python3
"""CHSP v0.9 local-only exact external execution authorization.

This module performs authorization and assessment only. It has no network, Git,
GitHub API, account, ownership, publication, credential, external-process, or
KONTUR execution surface.
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
CONFIRMATION_TOKEN = "AUTHORIZE_CHSP_EXACT_EXTERNAL_EXECUTION_ONLY"
AUTHORIZED_ACTION = "execute_exact_bounded_external_transition_envelope"
ALLOWED_KINDS = {
    "ensure_principal_presence",
    "ensure_role_at_least",
    "ensure_release_signer_binding",
    "record_external_stewardship_mapping",
}
ALLOWED_ROLES = {None, "identity_only", "collaborator", "maintainer", "admin", "release_signer"}
OBSERVED_ROLES = {"absent", "identity_only", "collaborator", "maintainer", "admin", "owner", "release_signer", "unknown"}


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


def artifact_set_sha(items: list[dict[str, Any]], field: str) -> str:
    digests = []
    for item in items:
        digest = item.get(field, "")
        require(HEX64_RE.fullmatch(digest) is not None, f"invalid {field}")
        digests.append(digest)
    require(len(digests) == len(set(digests)), f"duplicate {field}")
    return sha256_json(sorted(digests))


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPExternalExecutionAuthorizationPolicy", "CHSPExternalExecutionAuthorizationPolicy required")
    require(policy.get("artifact_version") == "0.9", "CHSPExternalExecutionAuthorizationPolicy v0.9 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    for key, minimum in [
        ("minimum_execution_authorizers", 2),
        ("minimum_execution_authorizer_domains", 2),
        ("maximum_v08_assessment_age_minutes", 1),
        ("maximum_recheck_age_minutes", 1),
        ("maximum_decision_spread_minutes", 1),
        ("maximum_execution_authorization_minutes", 1),
    ]:
        require(isinstance(policy.get(key), int) and policy[key] >= minimum, f"invalid policy threshold: {key}")
    req = policy.get("requirements") or {}
    for key in [
        "v08_dry_run_verified_required", "exact_envelope_binding_required", "exact_receipt_binding_required",
        "fresh_recheck_required", "no_detected_drift_required", "distinct_humans_required",
        "declared_domains_required", "steward_execution_consent_required",
        "non_steward_execution_authorizer_required", "typed_confirmation_required",
        "authority_evidence_digest_required", "credentials_prohibited", "revocable_before_execution",
    ]:
        require(req.get(key) is True, f"unsafe missing requirement: {key}")
    for key in [
        "automatic_external_execution", "ownership_transfer_authorized", "account_control_transfer_authorized",
        "predecessor_access_removal_authorized", "credential_rotation_authorized",
        "canonical_origin_mutation_authorized", "canonical_publication_authorized", "kontur_activation_authorized",
    ]:
        require(req.get(key) is False, f"unsafe policy permission: {key}")
    claims = policy.get("claims") or {}
    require(claims.get("authorization_policy_only") is True, "policy boundary missing")
    for key in [
        "external_execution_performed", "repository_ownership_transferred", "account_control_transferred",
        "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated",
        "legal_ownership_adjudicated", "distributed_consensus_established",
    ]:
        require(claims.get(key) is False, f"unsafe policy claim: {key}")


def validate_operations(operations: list[dict[str, Any]]) -> None:
    require(isinstance(operations, list) and 1 <= len(operations) <= 16, "invalid operation set")
    ids = []
    for op in operations:
        require(isinstance(op, dict), "operation must be object")
        require(op.get("kind") in ALLOWED_KINDS, "unsafe operation kind")
        require(op.get("intended_role") in ALLOWED_ROLES, "unsafe intended role")
        require(op.get("force") is False, "force operation prohibited")
        require(op.get("destructive") is False, "destructive operation prohibited")
        oid = op.get("operation_id")
        require(isinstance(oid, str) and oid, "operation_id required")
        ids.append(oid)
    require(len(ids) == len(set(ids)), "duplicate operation_id")


def validate_v08(envelope: dict[str, Any], receipt: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_policy(policy)
    require(envelope.get("artifact_type") == "CHSPExternalTransitionEnvelope" and envelope.get("artifact_version") == "0.8", "CHSPExternalTransitionEnvelope v0.8 required")
    require(receipt.get("artifact_type") == "CHSPExternalTransitionDryRunReceipt" and receipt.get("artifact_version") == "0.8", "CHSPExternalTransitionDryRunReceipt v0.8 required")
    require(assessment.get("artifact_type") == "CHSPExternalDryRunAssessment" and assessment.get("artifact_version") == "0.8", "CHSPExternalDryRunAssessment v0.8 required")
    esha, rsha, asha = envelope.get("envelope_sha256", ""), receipt.get("receipt_sha256", ""), assessment.get("assessment_sha256", "")
    require(HEX64_RE.fullmatch(esha) is not None and self_digest(envelope, "envelope_sha256") == esha, "v0.8 envelope self-digest mismatch")
    require(HEX64_RE.fullmatch(rsha) is not None and self_digest(receipt, "receipt_sha256") == rsha, "v0.8 receipt self-digest mismatch")
    require(HEX64_RE.fullmatch(asha) is not None and self_digest(assessment, "assessment_sha256") == asha, "v0.8 assessment self-digest mismatch")
    require(envelope.get("project_id") == receipt.get("project_id") == assessment.get("project_id") == policy["project_id"], "v0.8 project mismatch")
    require(envelope.get("steward_id") == receipt.get("steward_id") == assessment.get("steward_id"), "v0.8 steward mismatch")
    require(receipt.get("envelope_sha256") == esha and assessment.get("envelope_sha256") == esha, "v0.8 envelope binding mismatch")
    require(assessment.get("dry_run_receipt_sha256") == rsha, "v0.8 receipt binding mismatch")
    require(receipt.get("result") == "verified", "v0.8 dry-run receipt is not verified")
    require(assessment.get("state") == "dry_run_verified", "v0.8 dry-run is not verified")
    require(assessment.get("decision") == "external_transition_execution_authorization_may_be_requested", "v0.8 assessment does not permit authorization request")
    validate_operations(envelope.get("operations"))
    ec = envelope.get("claims") or {}
    require(ec.get("dry_run_only") is True and ec.get("non_destructive_plan") is True, "v0.8 envelope boundary missing")
    for key in ["external_mutation_authorized", "external_mutation_performed", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated"]:
        require(ec.get(key) is False, f"unsafe v0.8 envelope claim: {key}")
    rc = receipt.get("claims") or {}
    require(rc.get("dry_run_verification_completed") is True, "v0.8 receipt verification claim missing")
    for key in ["external_execution_authorized", "external_mutation_performed", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "global_provider_state_proven"]:
        require(rc.get(key) is False, f"unsafe v0.8 receipt claim: {key}")
    ac = assessment.get("claims") or {}
    require(ac.get("policy_sufficiency_only") is True and ac.get("dry_run_verified") is True, "v0.8 assessment claims missing")
    for key in ["external_execution_authorized", "executor_invoked", "external_mutation_performed", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated"]:
        require(ac.get(key) is False, f"unsafe v0.8 assessment claim: {key}")


def validate_observed_state(observed: dict[str, Any], envelope: dict[str, Any], policy: dict[str, Any]) -> None:
    require(observed.get("artifact_type") == "CHSPExternalObservedState" and observed.get("artifact_version") == "0.8", "CHSPExternalObservedState v0.8 required")
    digest = observed.get("state_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(observed, "state_sha256") == digest, "v0.8 observed state self-digest mismatch")
    require(observed.get("project_id") == policy["project_id"] == envelope.get("project_id"), "observed state project mismatch")
    require(observed.get("steward_id") == envelope.get("steward_id"), "observed state steward mismatch")
    require(observed.get("external_system_type") == envelope.get("external_system_type"), "observed state system type mismatch")
    require(observed.get("external_system_id") == envelope.get("external_system_id"), "observed state system mismatch")
    require(observed.get("external_principal_id") == envelope.get("external_principal_id"), "observed state principal mismatch")
    require(observed.get("observed_role") in OBSERVED_ROLES, "invalid observed role")
    require(observed.get("contains_credentials") is False, "credentials prohibited in observed state")
    require(HEX64_RE.fullmatch(observed.get("evidence_sha256", "")) is not None, "invalid observed evidence digest")
    claims = observed.get("claims") or {}
    require(claims.get("bounded_observation_recorded") is True, "bounded observation claim missing")
    for key in ["global_provider_state_proven", "external_control_changed", "ownership_proven", "credentials_embedded"]:
        require(claims.get(key) is False, f"unsafe observed-state claim: {key}")


def issue_recheck(
    envelope: dict[str, Any], receipt: dict[str, Any], assessment: dict[str, Any], previous_observed: dict[str, Any],
    policy: dict[str, Any], current_observed_role: str, observer_id: str, observer_domain_id: str,
    evidence_sha256: str, checked_at: str,
) -> dict[str, Any]:
    validate_v08(envelope, receipt, assessment, policy)
    validate_observed_state(previous_observed, envelope, policy)
    require(previous_observed["state_sha256"] == envelope.get("observed_state_sha256"), "v0.8 envelope/observed-state binding mismatch")
    require(current_observed_role in OBSERVED_ROLES, "invalid current observed role")
    require(observer_id and observer_domain_id, "observer IDs required")
    require(HEX64_RE.fullmatch(evidence_sha256 or "") is not None, "invalid recheck evidence digest")
    now = parse_time(checked_at)
    assessed_at = parse_time(assessment["evaluated_at"])
    require(now >= assessed_at, "recheck predates v0.8 assessment")
    age = now - assessed_at
    require(age <= timedelta(minutes=policy["maximum_v08_assessment_age_minutes"]), "v0.8 assessment too old for execution recheck")
    require(now < parse_time(envelope["expires_at"]), "v0.8 envelope expired before execution recheck")
    previous_role = previous_observed["observed_role"]
    if current_observed_role == "unknown":
        result, drift_fields = "indeterminate", ["observed_role"]
    elif current_observed_role == previous_role:
        result, drift_fields = "match", []
    else:
        result, drift_fields = "drift_detected", ["observed_role"]
    value = {
        "artifact_type":"CHSPExternalExecutionRecheck","artifact_version":"0.9",
        "recheck_id":"urn:uu-aap:chsp:external-execution-recheck:" + sha256_json({"envelope":envelope["envelope_sha256"],"observer":observer_id,"at":iso_z(now),"evidence":evidence_sha256})[:24],
        "project_id":policy["project_id"],"steward_id":envelope["steward_id"],
        "v08_envelope_sha256":envelope["envelope_sha256"],"v08_dry_run_receipt_sha256":receipt["receipt_sha256"],"v08_dry_run_assessment_sha256":assessment["assessment_sha256"],
        "previous_observed_state_sha256":previous_observed["state_sha256"],"external_system_type":envelope["external_system_type"],"external_system_id":envelope["external_system_id"],"external_principal_id":envelope["external_principal_id"],
        "previous_observed_role":previous_role,"current_observed_role":current_observed_role,"observer_id":observer_id,"observer_domain_id":observer_domain_id,"evidence_sha256":evidence_sha256,
        "checked_at":iso_z(now),"contains_credentials":False,"result":result,"drift_fields":drift_fields,"recheck_sha256":"0"*64,
        "claims":{"fresh_observation_recorded":True,"global_provider_state_proven":False,"external_mutation_performed":False,"ownership_proven":False,"credentials_present":False},
    }
    value["recheck_sha256"] = self_digest(value, "recheck_sha256")
    return value


def validate_recheck(recheck: dict[str, Any], envelope: dict[str, Any], receipt: dict[str, Any], assessment: dict[str, Any], previous_observed: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_v08(envelope, receipt, assessment, policy)
    validate_observed_state(previous_observed, envelope, policy)
    require(recheck.get("artifact_type") == "CHSPExternalExecutionRecheck" and recheck.get("artifact_version") == "0.9", "CHSPExternalExecutionRecheck v0.9 required")
    digest = recheck.get("recheck_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(recheck, "recheck_sha256") == digest, "execution recheck self-digest mismatch")
    require(recheck.get("project_id") == policy["project_id"] and recheck.get("steward_id") == envelope["steward_id"], "execution recheck scope mismatch")
    require(recheck.get("v08_envelope_sha256") == envelope["envelope_sha256"], "execution recheck envelope mismatch")
    require(recheck.get("v08_dry_run_receipt_sha256") == receipt["receipt_sha256"], "execution recheck receipt mismatch")
    require(recheck.get("v08_dry_run_assessment_sha256") == assessment["assessment_sha256"], "execution recheck assessment mismatch")
    require(recheck.get("previous_observed_state_sha256") == previous_observed["state_sha256"] == envelope["observed_state_sha256"], "execution recheck previous-state mismatch")
    require(recheck.get("external_system_type") == envelope["external_system_type"] and recheck.get("external_system_id") == envelope["external_system_id"] and recheck.get("external_principal_id") == envelope["external_principal_id"], "execution recheck target mismatch")
    require(recheck.get("previous_observed_role") == previous_observed["observed_role"], "execution recheck previous role mismatch")
    require(recheck.get("current_observed_role") in OBSERVED_ROLES, "invalid recheck role")
    require(recheck.get("contains_credentials") is False, "credentials prohibited in execution recheck")
    require(HEX64_RE.fullmatch(recheck.get("evidence_sha256", "")) is not None, "invalid recheck evidence digest")
    if recheck.get("current_observed_role") == "unknown":
        require(recheck.get("result") == "indeterminate", "unknown recheck role must be indeterminate")
    elif recheck.get("current_observed_role") == recheck.get("previous_observed_role"):
        require(recheck.get("result") == "match" and recheck.get("drift_fields") == [], "matching recheck must report match")
    else:
        require(recheck.get("result") == "drift_detected" and "observed_role" in (recheck.get("drift_fields") or []), "role drift must be reported")
    claims = recheck.get("claims") or {}
    require(claims.get("fresh_observation_recorded") is True, "recheck observation claim missing")
    for key in ["global_provider_state_proven", "external_mutation_performed", "ownership_proven", "credentials_present"]:
        require(claims.get(key) is False, f"unsafe recheck claim: {key}")


def issue_execution_decision(
    envelope: dict[str, Any], receipt: dict[str, Any], assessment: dict[str, Any], previous_observed: dict[str, Any],
    recheck: dict[str, Any], policy: dict[str, Any], human_id: str, human_domain_id: str,
    authority_evidence_sha256: str, nonce: str, confirmation_token: str, state_dir: Path, decided_at: str,
) -> dict[str, Any]:
    validate_recheck(recheck, envelope, receipt, assessment, previous_observed, policy)
    require(recheck.get("result") == "match", "execution recheck must match")
    require(human_id and human_domain_id, "human and domain IDs required")
    require(HEX64_RE.fullmatch(authority_evidence_sha256 or "") is not None, "invalid authority evidence digest")
    require(isinstance(nonce, str) and len(nonce) >= 16, "decision nonce too short")
    require(confirmation_token == CONFIRMATION_TOKEN, "execution typed confirmation mismatch")
    now = parse_time(decided_at)
    checked = parse_time(recheck["checked_at"])
    require(now >= checked, "execution decision predates recheck")
    require(now - checked <= timedelta(minutes=policy["maximum_recheck_age_minutes"]), "execution recheck too old for human decision")
    require(now < parse_time(envelope["expires_at"]), "v0.8 envelope expired before human decision")
    reservation = {"artifact_type":"CHSPLocalExternalExecutionDecisionReservation","artifact_version":"0.9","recheck_sha256":recheck["recheck_sha256"],"human_id":human_id,"reserved_at":iso_z(now),"claims":{"global_replay_prevention_established":False}}
    reserve_once(state_dir, "external-execution-decision-humans", recheck["recheck_sha256"] + ":" + human_id, reservation)
    reserve_once(state_dir, "external-execution-decision-nonces", nonce, reservation)
    value = {
        "artifact_type":"CHSPExternalExecutionHumanDecision","artifact_version":"0.9",
        "decision_id":"urn:uu-aap:chsp:external-execution-decision:" + sha256_json({"recheck":recheck["recheck_sha256"],"human":human_id,"nonce":nonce})[:24],
        "project_id":policy["project_id"],"steward_id":envelope["steward_id"],"v08_envelope_sha256":envelope["envelope_sha256"],"v08_dry_run_receipt_sha256":receipt["receipt_sha256"],"v08_dry_run_assessment_sha256":assessment["assessment_sha256"],"execution_recheck_sha256":recheck["recheck_sha256"],
        "human_id":human_id,"human_domain_id":human_domain_id,"authority_evidence_sha256":authority_evidence_sha256,"decided_at":iso_z(now),"nonce":nonce,"confirmation_token":confirmation_token,"decision_sha256":"0"*64,
        "claims":{"human_execution_decision_recorded":True,"exact_scope_consent":True,"execution_authorized_by_single_decision":False,"external_mutation_performed":False,"ownership_transfer_authorized":False,"canonical_origin_mutation_authorized":False,"kontur_activation_authorized":False},
    }
    value["decision_sha256"] = self_digest(value, "decision_sha256")
    return value


def validate_decision(decision: dict[str, Any], envelope: dict[str, Any], receipt: dict[str, Any], assessment: dict[str, Any], recheck: dict[str, Any], policy: dict[str, Any]) -> None:
    require(decision.get("artifact_type") == "CHSPExternalExecutionHumanDecision" and decision.get("artifact_version") == "0.9", "CHSPExternalExecutionHumanDecision v0.9 required")
    digest = decision.get("decision_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(decision, "decision_sha256") == digest, "execution decision self-digest mismatch")
    require(decision.get("project_id") == policy["project_id"] and decision.get("steward_id") == envelope["steward_id"], "execution decision scope mismatch")
    require(decision.get("v08_envelope_sha256") == envelope["envelope_sha256"] and decision.get("v08_dry_run_receipt_sha256") == receipt["receipt_sha256"] and decision.get("v08_dry_run_assessment_sha256") == assessment["assessment_sha256"], "execution decision v0.8 binding mismatch")
    require(decision.get("execution_recheck_sha256") == recheck["recheck_sha256"], "execution decision recheck mismatch")
    require(decision.get("confirmation_token") == CONFIRMATION_TOKEN, "execution typed confirmation mismatch")
    require(HEX64_RE.fullmatch(decision.get("authority_evidence_sha256", "")) is not None, "invalid execution authority evidence digest")
    require(isinstance(decision.get("nonce"), str) and len(decision["nonce"]) >= 16, "invalid execution decision nonce")
    claims = decision.get("claims") or {}
    require(claims.get("human_execution_decision_recorded") is True and claims.get("exact_scope_consent") is True, "execution decision claims missing")
    for key in ["execution_authorized_by_single_decision", "external_mutation_performed", "ownership_transfer_authorized", "canonical_origin_mutation_authorized", "kontur_activation_authorized"]:
        require(claims.get(key) is False, f"unsafe execution decision claim: {key}")


def execution_quorum(decisions: list[dict[str, Any]], envelope: dict[str, Any], receipt: dict[str, Any], assessment: dict[str, Any], recheck: dict[str, Any], policy: dict[str, Any]) -> tuple[list[str], list[str], list[str], int]:
    require(decisions, "execution decision set is empty")
    for decision in decisions:
        validate_decision(decision, envelope, receipt, assessment, recheck, policy)
    digests = sorted(d["decision_sha256"] for d in decisions)
    require(len(digests) == len(set(digests)), "duplicate execution decision artifact")
    humans = [d["human_id"] for d in decisions]
    require(len(humans) == len(set(humans)), "duplicate execution decision actor")
    domains = sorted({d["human_domain_id"] for d in decisions})
    require(len(humans) >= policy["minimum_execution_authorizers"], "insufficient execution authorizers")
    require(len(domains) >= policy["minimum_execution_authorizer_domains"], "insufficient execution authorizer domains")
    require(envelope["steward_id"] in humans, "steward execution consent required")
    require(any(h != envelope["steward_id"] for h in humans), "non-steward execution authorizer required")
    times = sorted(parse_time(d["decided_at"]) for d in decisions)
    spread_seconds = int((times[-1] - times[0]).total_seconds())
    require(spread_seconds <= policy["maximum_decision_spread_minutes"] * 60, "execution decision spread too large")
    return digests, sorted(humans), domains, spread_seconds


def authorization_claims() -> dict[str, Any]:
    return {
        "bounded_exact_external_execution_authorized":True,"exact_envelope_operations_authorized":True,"steward_execution_consent_recorded":True,
        "unbounded_external_mutation_authorized":False,"ownership_transfer_authorized":False,"account_control_transfer_authorized":False,
        "predecessor_access_removal_authorized":False,"credential_rotation_authorized":False,"canonical_origin_mutation_authorized":False,
        "canonical_publication_authorized":False,"kontur_activation_authorized":False,"executor_invoked":False,"execution_performed":False,
        "legal_ownership_adjudicated":False,"distributed_consensus_established":False,
    }


def issue_authorization(
    envelope: dict[str, Any], receipt: dict[str, Any], assessment: dict[str, Any], previous_observed: dict[str, Any], recheck: dict[str, Any],
    policy: dict[str, Any], decisions: list[dict[str, Any]], nonce: str, state_dir: Path, authorized_at: str, expires_at: str,
) -> dict[str, Any]:
    validate_recheck(recheck, envelope, receipt, assessment, previous_observed, policy)
    require(recheck.get("result") == "match", "execution recheck must match")
    require(isinstance(nonce, str) and len(nonce) >= 16, "authorization nonce too short")
    digests, humans, domains, _spread = execution_quorum(decisions, envelope, receipt, assessment, recheck, policy)
    now, expires = parse_time(authorized_at), parse_time(expires_at)
    checked, assessed = parse_time(recheck["checked_at"]), parse_time(assessment["evaluated_at"])
    require(now >= max(parse_time(d["decided_at"]) for d in decisions), "authorization predates human decision")
    require(now >= checked, "authorization predates execution recheck")
    require(now - checked <= timedelta(minutes=policy["maximum_recheck_age_minutes"]), "execution recheck too old for authorization")
    require(now >= assessed and now - assessed <= timedelta(minutes=policy["maximum_v08_assessment_age_minutes"]), "v0.8 assessment too old for execution authorization")
    require(expires > now, "authorization expiry must follow authorization time")
    require(expires - now <= timedelta(minutes=policy["maximum_execution_authorization_minutes"]), "execution authorization lifetime exceeds policy")
    require(expires <= parse_time(envelope["expires_at"]), "execution authorization cannot outlive v0.8 envelope")
    reservation = {"artifact_type":"CHSPLocalExternalExecutionAuthorizationReservation","artifact_version":"0.9","recheck_sha256":recheck["recheck_sha256"],"reserved_at":iso_z(now),"claims":{"global_replay_prevention_established":False}}
    reserve_once(state_dir, "external-execution-authorized-rechecks", recheck["recheck_sha256"], reservation)
    reserve_once(state_dir, "external-execution-authorization-nonces", nonce, reservation)
    value = {
        "artifact_type":"CHSPExternalExecutionAuthorization","artifact_version":"0.9",
        "authorization_id":"urn:uu-aap:chsp:external-execution-authorization:" + sha256_json({"recheck":recheck["recheck_sha256"],"nonce":nonce})[:24],
        "project_id":policy["project_id"],"steward_id":envelope["steward_id"],"v08_envelope_sha256":envelope["envelope_sha256"],"v08_dry_run_receipt_sha256":receipt["receipt_sha256"],"v08_dry_run_assessment_sha256":assessment["assessment_sha256"],"execution_recheck_sha256":recheck["recheck_sha256"],
        "operations_sha256":sha256_json(envelope["operations"]),"decision_set_sha256":sha256_json(digests),"decision_sha256s":digests,"authorizer_ids":humans,"authorizer_domain_ids":domains,
        "authorized_action":AUTHORIZED_ACTION,"authorized_at":iso_z(now),"expires_at":iso_z(expires),"nonce":nonce,"authorization_sha256":"0"*64,"claims":authorization_claims(),
    }
    value["authorization_sha256"] = self_digest(value, "authorization_sha256")
    return value


def validate_authorization(authorization: dict[str, Any], envelope: dict[str, Any], receipt: dict[str, Any], assessment: dict[str, Any], recheck: dict[str, Any], decisions: list[dict[str, Any]], policy: dict[str, Any]) -> None:
    require(authorization.get("artifact_type") == "CHSPExternalExecutionAuthorization" and authorization.get("artifact_version") == "0.9", "CHSPExternalExecutionAuthorization v0.9 required")
    digest = authorization.get("authorization_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(authorization, "authorization_sha256") == digest, "execution authorization self-digest mismatch")
    digests, humans, domains, _spread = execution_quorum(decisions, envelope, receipt, assessment, recheck, policy)
    require(authorization.get("project_id") == policy["project_id"] and authorization.get("steward_id") == envelope["steward_id"], "execution authorization scope mismatch")
    require(authorization.get("v08_envelope_sha256") == envelope["envelope_sha256"] and authorization.get("v08_dry_run_receipt_sha256") == receipt["receipt_sha256"] and authorization.get("v08_dry_run_assessment_sha256") == assessment["assessment_sha256"], "execution authorization v0.8 binding mismatch")
    require(authorization.get("execution_recheck_sha256") == recheck["recheck_sha256"], "execution authorization recheck mismatch")
    require(authorization.get("operations_sha256") == sha256_json(envelope["operations"]), "execution authorization operation-set mismatch")
    require(authorization.get("decision_set_sha256") == sha256_json(digests) and authorization.get("decision_sha256s") == digests, "execution authorization decision-set mismatch")
    require(authorization.get("authorizer_ids") == humans and authorization.get("authorizer_domain_ids") == domains, "execution authorization quorum metadata mismatch")
    require(authorization.get("authorized_action") == AUTHORIZED_ACTION, "execution authorization action mismatch")
    require(parse_time(authorization["expires_at"]) > parse_time(authorization["authorized_at"]), "invalid authorization time window")
    require(parse_time(authorization["expires_at"]) - parse_time(authorization["authorized_at"]) <= timedelta(minutes=policy["maximum_execution_authorization_minutes"]), "execution authorization lifetime exceeds policy")
    require(parse_time(authorization["expires_at"]) <= parse_time(envelope["expires_at"]), "execution authorization outlives envelope")
    claims = authorization.get("claims") or {}
    require(claims.get("bounded_exact_external_execution_authorized") is True and claims.get("exact_envelope_operations_authorized") is True and claims.get("steward_execution_consent_recorded") is True, "execution authorization positive claims missing")
    for key in ["unbounded_external_mutation_authorized", "ownership_transfer_authorized", "account_control_transfer_authorized", "predecessor_access_removal_authorized", "credential_rotation_authorized", "canonical_origin_mutation_authorized", "canonical_publication_authorized", "kontur_activation_authorized", "executor_invoked", "execution_performed", "legal_ownership_adjudicated", "distributed_consensus_established"]:
        require(claims.get(key) is False, f"unsafe execution authorization claim: {key}")


def record_revocation(
    authorization: dict[str, Any], project_id: str, steward_id: str, actor_id: str, actor_evidence_sha256: str,
    reason_code: str, nonce: str, state_dir: Path, recorded_at: str,
) -> dict[str, Any]:
    require(authorization.get("artifact_type") == "CHSPExternalExecutionAuthorization" and authorization.get("artifact_version") == "0.9", "CHSPExternalExecutionAuthorization v0.9 required")
    require(self_digest(authorization, "authorization_sha256") == authorization.get("authorization_sha256"), "execution authorization self-digest mismatch")
    require(project_id == authorization.get("project_id") and steward_id == authorization.get("steward_id"), "revocation scope mismatch")
    require(actor_id and HEX64_RE.fullmatch(actor_evidence_sha256 or "") is not None, "invalid revocation actor evidence")
    require(reason_code in {"external_state_changed","human_authority_withdrawn","new_conflicting_evidence","execution_deferred","safety_boundary_changed","other"}, "invalid revocation reason")
    require(isinstance(nonce, str) and len(nonce) >= 16, "revocation nonce too short")
    now = parse_time(recorded_at)
    require(now >= parse_time(authorization["authorized_at"]), "revocation predates authorization")
    reservation = {"artifact_type":"CHSPLocalExternalExecutionRevocationReservation","artifact_version":"0.9","authorization_sha256":authorization["authorization_sha256"],"reserved_at":iso_z(now),"claims":{"global_replay_prevention_established":False}}
    reserve_once(state_dir, "external-execution-revocation-nonces", nonce, reservation)
    value = {
        "artifact_type":"CHSPExternalExecutionAuthorizationRevocation","artifact_version":"0.9",
        "revocation_id":"urn:uu-aap:chsp:external-execution-revocation:" + sha256_json({"authorization":authorization["authorization_sha256"],"actor":actor_id,"nonce":nonce})[:24],
        "project_id":project_id,"steward_id":steward_id,"authorization_sha256":authorization["authorization_sha256"],"actor_id":actor_id,"actor_evidence_sha256":actor_evidence_sha256,"reason_code":reason_code,"recorded_at":iso_z(now),"nonce":nonce,"revocation_sha256":"0"*64,
        "claims":{"revocation_recorded":True,"future_execution_blocked_in_supplied_evidence_context":True,"historical_authorization_erased":False,"external_mutation_performed":False},
    }
    value["revocation_sha256"] = self_digest(value, "revocation_sha256")
    return value


def validate_revocations(revocations: list[dict[str, Any]], authorization: dict[str, Any]) -> None:
    digests = []
    for rev in revocations:
        require(rev.get("artifact_type") == "CHSPExternalExecutionAuthorizationRevocation" and rev.get("artifact_version") == "0.9", "CHSPExternalExecutionAuthorizationRevocation v0.9 required")
        digest = rev.get("revocation_sha256", "")
        require(HEX64_RE.fullmatch(digest) is not None and self_digest(rev, "revocation_sha256") == digest, "execution revocation self-digest mismatch")
        require(rev.get("authorization_sha256") == authorization["authorization_sha256"], "execution revocation target mismatch")
        require(rev.get("project_id") == authorization["project_id"] and rev.get("steward_id") == authorization["steward_id"], "execution revocation scope mismatch")
        require(parse_time(rev["recorded_at"]) >= parse_time(authorization["authorized_at"]), "execution revocation predates authorization")
        require(HEX64_RE.fullmatch(rev.get("actor_evidence_sha256", "")) is not None, "invalid execution revocation evidence")
        claims = rev.get("claims") or {}
        require(claims.get("revocation_recorded") is True and claims.get("future_execution_blocked_in_supplied_evidence_context") is True, "execution revocation claims missing")
        require(claims.get("historical_authorization_erased") is False and claims.get("external_mutation_performed") is False, "unsafe execution revocation claim")
        digests.append(digest)
    require(len(digests) == len(set(digests)), "duplicate execution revocation artifact")


def assessment_claims(active: bool) -> dict[str, Any]:
    return {
        "policy_sufficiency_only":True,"bounded_exact_external_execution_authorized":active,"executor_invoked":False,"execution_performed":False,
        "unbounded_external_mutation_authorized":False,"repository_ownership_transferred":False,"account_control_transferred":False,
        "canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"global_provider_state_proven":False,
    }


def assess_authorization(
    envelope: dict[str, Any], receipt: dict[str, Any], dry_run_assessment: dict[str, Any], previous_observed: dict[str, Any],
    recheck: dict[str, Any], policy: dict[str, Any], decisions: list[dict[str, Any]], authorization: dict[str, Any] | None,
    revocations: list[dict[str, Any]], evaluated_at: str,
) -> dict[str, Any]:
    now = parse_time(evaluated_at)
    reasons: list[str] = []
    state, decision = "authorization_invalid", "reject_execution_authorization"
    authorizer_count = authorizer_domains = 0
    recheck_age_seconds = 0
    authorization_expired = False
    revocation_count = len(revocations)
    auth_sha = authorization.get("authorization_sha256") if isinstance(authorization, dict) else None
    try:
        validate_recheck(recheck, envelope, receipt, dry_run_assessment, previous_observed, policy)
        recheck_age_seconds = max(0, int((now - parse_time(recheck["checked_at"])).total_seconds()))
        if recheck.get("result") != "match":
            reasons.append("execution recheck is not an exact match")
            state, decision = "authorization_invalid", "reject_execution_authorization"
        elif authorization is None:
            reasons.append("execution authorization missing")
        else:
            validate_authorization(authorization, envelope, receipt, dry_run_assessment, recheck, decisions, policy)
            _digests, humans, domains, _spread = execution_quorum(decisions, envelope, receipt, dry_run_assessment, recheck, policy)
            authorizer_count, authorizer_domains = len(humans), len(domains)
            validate_revocations(revocations, authorization)
            authorization_expired = now >= parse_time(authorization["expires_at"]) or now >= parse_time(envelope["expires_at"])
            recheck_stale = now < parse_time(recheck["checked_at"]) or now - parse_time(recheck["checked_at"]) > timedelta(minutes=policy["maximum_recheck_age_minutes"])
            if revocations:
                state, decision = "execution_authorization_revoked", "do_not_execute_revoked_authorization"
                reasons.append("execution authorization revoked in supplied evidence set")
            elif authorization_expired:
                state, decision = "execution_authorization_expired", "repeat_execution_recheck_and_reauthorize"
                reasons.append("execution authorization or envelope expired")
            elif recheck_stale:
                state, decision = "recheck_stale", "repeat_execution_recheck_and_reauthorize"
                reasons.append("execution recheck too old")
            else:
                state, decision = "execution_authorization_active", "bounded_external_execution_executor_may_be_requested"
    except Exception as exc:
        reasons.append(str(exc))
        state, decision = "authorization_invalid", "reject_execution_authorization"
    active = state == "execution_authorization_active"
    value = {
        "artifact_type":"CHSPExternalExecutionAuthorizationAssessment","artifact_version":"0.9",
        "assessment_id":"urn:uu-aap:chsp:external-execution-authorization-assessment:" + sha256_json({"envelope":envelope.get("envelope_sha256"),"authorization":auth_sha,"at":iso_z(now)})[:24],
        "evaluated_at":iso_z(now),"project_id":policy.get("project_id", envelope.get("project_id")),"steward_id":envelope.get("steward_id",""),
        "v08_envelope_sha256":envelope.get("envelope_sha256","0"*64),"v08_dry_run_receipt_sha256":receipt.get("receipt_sha256","0"*64),"v08_dry_run_assessment_sha256":dry_run_assessment.get("assessment_sha256","0"*64),"execution_recheck_sha256":recheck.get("recheck_sha256","0"*64),"authorization_sha256":auth_sha,
        "revocation_set_sha256":sha256_json(sorted(r.get("revocation_sha256","") for r in revocations)),"state":state,"decision":decision,
        "metrics":{"authorizer_count":authorizer_count,"authorizer_domains":authorizer_domains,"recheck_age_seconds":recheck_age_seconds,"authorization_expired":authorization_expired,"revocation_count":revocation_count},
        "reasons":reasons,"assessment_sha256":"0"*64,"claims":assessment_claims(active),
    }
    value["assessment_sha256"] = self_digest(value, "assessment_sha256")
    return value
