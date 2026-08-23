#!/usr/bin/env python3
"""CHSP v0.4 local-only canonical stewardship handover authorization tooling.

This module records and assesses bounded human authorization artifacts. It does
not perform network, Git, repository/account, canonical-origin, publication,
ownership, or KONTUR actions.
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
APPROVAL_CONFIRMATION_TOKEN = "APPROVE_CHSP_CANONICAL_STEWARDSHIP_HANDOVER_AUTHORIZATION_ONLY"
AUTHORIZED_ACTION = "record_protocol_canonical_stewardship_handover"


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def self_digest(value: dict[str, Any], field: str) -> str:
    work = copy.deepcopy(value)
    work[field] = "0" * 64
    return sha256_json(work)


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def load_json(path: Path) -> dict[str, Any]:
    require(path.is_file() and not path.is_symlink(), f"JSON input must be a regular non-symlink file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_fsync(path: Path, value: dict[str, Any]) -> None:
    require(not path.exists(), f"output already exists: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as f:
        f.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())
    dfd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(dfd)
    finally:
        os.close(dfd)


def reserve_once(state_dir: Path, category: str, key: str, payload: dict[str, Any]) -> None:
    target_dir = state_dir / category
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / f"{hashlib.sha256(key.encode('utf-8')).hexdigest()}.json"
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
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


def artifact_set_sha(items: list[dict[str, Any]], digest_field: str) -> str:
    digests: list[str] = []
    for item in items:
        digest = item.get(digest_field, "")
        require(HEX64_RE.fullmatch(digest) is not None, f"invalid {digest_field} in artifact set")
        digests.append(digest)
    return sha256_json(sorted(digests))


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPHandoverAuthorizationPolicy", "CHSPHandoverAuthorizationPolicy required")
    require(policy.get("artifact_version") == "0.4", "CHSPHandoverAuthorizationPolicy v0.4 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    for key, minimum in [
        ("minimum_authorizers", 2),
        ("minimum_authorizer_domains", 2),
        ("unavailability_minimum_authorizers", 3),
        ("unavailability_minimum_authorizer_domains", 3),
        ("maximum_source_assessment_age_days", 1),
        ("maximum_approval_spread_hours", 1),
        ("maximum_authorization_days", 1),
    ]:
        require(isinstance(policy.get(key), int) and policy[key] >= minimum, f"invalid policy threshold: {key}")
    require(policy.get("authorized_action") == AUTHORIZED_ACTION, "unexpected authorized action")
    req = policy.get("requirements") or {}
    for key in [
        "v03_handover_review_eligibility_required",
        "candidate_cannot_approve",
        "distinct_authorizer_ids_required",
        "declared_authorizer_domains_required",
        "acknowledged_path_requires_predecessor_approval",
        "unavailability_path_predecessor_approval_prohibited",
        "authority_evidence_digest_required",
        "typed_confirmation_required",
        "authorization_expires",
        "authorization_revocable_before_execution",
        "candidate_withdrawal_blocks_execution",
    ]:
        require(req.get(key) is True, f"unsafe policy requirement: {key}")
    for key in ["automatic_execution", "automatic_ownership_transfer", "automatic_canonical_origin_mutation", "automatic_kontur_activation"]:
        require(req.get(key) is False, f"unsafe automatic policy setting: {key}")
    claims = policy.get("claims") or {}
    require(claims.get("descriptive_policy_only") is True, "policy must remain descriptive")
    require(claims.get("domain_independence_proven") is False, "policy cannot prove domain independence")
    for key in [
        "canonical_successor_established", "repository_ownership_transferred",
        "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated",
        "distributed_consensus_established", "legal_effect_established", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe policy claim: {key}")


def validate_v03_assessment(assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    require(assessment.get("artifact_type") == "CHSPFinalHandoverAssessment", "CHSPFinalHandoverAssessment required")
    require(assessment.get("artifact_version") == "0.3", "CHSPFinalHandoverAssessment v0.3 required")
    require(assessment.get("project_id") == policy.get("project_id"), "v0.3 assessment project mismatch")
    digest = assessment.get("assessment_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid v0.3 assessment digest")
    require(self_digest(assessment, "assessment_sha256") == digest, "v0.3 assessment self-digest mismatch")
    require(assessment.get("state") == "canonical_stewardship_handover_review_eligible", "v0.3 assessment is not handover review eligible")
    require(assessment.get("decision") == "canonical_stewardship_handover_may_be_requested", "v0.3 assessment does not permit handover request")
    require(HEX64_RE.fullmatch(assessment.get("handover_sha256", "")) is not None, "v0.3 handover binding missing")
    require(HEX64_RE.fullmatch(assessment.get("outcome_sha256", "")) is not None, "v0.3 handover outcome binding missing")
    require(isinstance(assessment.get("candidate_id"), str) and assessment["candidate_id"], "invalid candidate_id")
    claims = assessment.get("claims") or {}
    require(claims.get("policy_sufficiency_only") is True, "v0.3 assessment must remain policy-sufficiency only")
    for key in [
        "automatic_stewardship_transfer", "exclusive_successor_authority", "canonical_successor_established",
        "canonical_origin_mutated", "canonical_publication_executed", "ownership_transferred",
        "account_control_transferred", "kontur_activated", "legal_incapacity_certified",
        "medical_incapacity_certified", "distributed_consensus_established", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe v0.3 assessment claim: {key}")


def validate_disposition(disposition: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_v03_assessment(assessment, policy)
    require(disposition.get("artifact_type") == "CHSPPredecessorDisposition", "CHSPPredecessorDisposition required")
    require(disposition.get("artifact_version") == "0.3", "CHSPPredecessorDisposition v0.3 required")
    digest = disposition.get("disposition_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid predecessor disposition digest")
    require(self_digest(disposition, "disposition_sha256") == digest, "predecessor disposition self-digest mismatch")
    require(assessment.get("predecessor_disposition_sha256") == digest, "assessment/disposition binding mismatch")
    require(disposition.get("project_id") == policy["project_id"], "disposition project mismatch")
    require(disposition.get("candidate_id") == assessment["candidate_id"], "disposition candidate mismatch")
    predecessor = disposition.get("predecessor_steward_id")
    require(isinstance(predecessor, str) and predecessor and predecessor != assessment["candidate_id"], "invalid predecessor steward")
    mode = disposition.get("mode")
    require(mode in {"acknowledged", "protocol_unavailability_attested"}, "invalid predecessor disposition mode")
    metrics = assessment.get("metrics") or {}
    require(metrics.get("predecessor_disposition_mode") == mode, "assessment/disposition mode mismatch")
    claims = disposition.get("claims") or {}
    require(claims.get("disposition_recorded") is True, "predecessor disposition not recorded")
    for key in ["legal_incapacity_certified", "medical_incapacity_certified", "death_certified", "ownership_waived", "canonical_successor_established", "kontur_activated"]:
        require(claims.get(key) is False, f"unsafe predecessor disposition claim: {key}")
    if mode == "acknowledged":
        require(disposition.get("acknowledged_by_human_id") == predecessor, "acknowledged path must be acknowledged by predecessor")
        require(claims.get("predecessor_acknowledgement_recorded") is True, "predecessor acknowledgement claim missing")
        require(claims.get("protocol_unavailability_only") is False, "acknowledged path cannot claim protocol unavailability only")
    else:
        require(disposition.get("acknowledged_by_human_id") is None, "unavailability path cannot include predecessor acknowledgement")
        require(claims.get("predecessor_acknowledgement_recorded") is False, "unavailability path cannot claim predecessor acknowledgement")
        require(claims.get("protocol_unavailability_only") is True, "unavailability path must remain protocol-unavailability only")
        attestations = disposition.get("unavailability_attestations") or []
        require(len(attestations) == metrics.get("unavailability_attestations"), "unavailability attestation count mismatch")
        domains = {a.get("attestor_domain_id") for a in attestations}
        require(len(domains) == metrics.get("unavailability_attestor_domains"), "unavailability attestor domain count mismatch")
        for attestation in attestations:
            require(attestation.get("attestor_id") not in {assessment["candidate_id"], predecessor}, "candidate/predecessor cannot self-attest unavailability")
            require(HEX64_RE.fullmatch(attestation.get("evidence_sha256", "")) is not None, "invalid unavailability evidence digest")


def approval_claims() -> dict[str, Any]:
    return {
        "human_approval_recorded": True,
        "approval_bound_to_exact_assessment": True,
        "approval_grants_stewardship_immediately": False,
        "domain_independence_proven": False,
        "canonical_successor_established": False,
        "repository_ownership_transferred": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "kontur_activated": False,
        "legal_effect_established": False,
        "universal_trust_established": False,
    }


def issue_approval(
    assessment: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any],
    authorizer_id: str, authorizer_domain_id: str, authority_evidence_sha256: str,
    nonce: str, confirmation_token: str, state_dir: Path, at: str,
) -> dict[str, Any]:
    validate_policy(policy)
    validate_disposition(disposition, assessment, policy)
    candidate = assessment["candidate_id"]
    predecessor = disposition["predecessor_steward_id"]
    require(authorizer_id and authorizer_id != candidate, "candidate cannot approve own handover")
    require(isinstance(authorizer_domain_id, str) and authorizer_domain_id, "authorizer domain required")
    require(HEX64_RE.fullmatch(authority_evidence_sha256 or "") is not None, "invalid authority evidence digest")
    require(isinstance(nonce, str) and len(nonce) >= 16, "approval nonce too short")
    require(confirmation_token == APPROVAL_CONFIRMATION_TOKEN, "approval typed confirmation mismatch")
    if disposition["mode"] == "protocol_unavailability_attested":
        require(authorizer_id != predecessor, "predecessor approval is inconsistent with protocol-unavailability disposition")
    now = parse_time(at)
    source_time = parse_time(assessment["evaluated_at"])
    require(now >= source_time, "approval cannot predate source assessment")
    require(now <= source_time + timedelta(days=policy["maximum_source_assessment_age_days"]), "source assessment too old for approval")
    reservation = {
        "artifact_type": "CHSPLocalHandoverApprovalReservation",
        "artifact_version": "0.4",
        "v03_final_handover_assessment_sha256": assessment["assessment_sha256"],
        "authorizer_id": authorizer_id,
        "reserved_at": iso_z(now),
        "claims": {"global_replay_prevention_established": False},
    }
    reserve_once(state_dir, "handover-approval-authorizers", assessment["assessment_sha256"] + ":" + authorizer_id, reservation)
    reserve_once(state_dir, "handover-approval-nonces", nonce, reservation)
    approval = {
        "artifact_type": "CHSPHandoverAuthorizationApproval",
        "artifact_version": "0.4",
        "approval_id": "urn:uu-aap:chsp:handover-approval:" + sha256_json({"assessment": assessment["assessment_sha256"], "authorizer": authorizer_id, "nonce": nonce})[:24],
        "project_id": policy["project_id"],
        "candidate_id": candidate,
        "predecessor_steward_id": predecessor,
        "v03_final_handover_assessment_sha256": assessment["assessment_sha256"],
        "predecessor_disposition_sha256": disposition["disposition_sha256"],
        "authorizer_id": authorizer_id,
        "authorizer_domain_id": authorizer_domain_id,
        "authority_evidence_sha256": authority_evidence_sha256,
        "approved_at": iso_z(now),
        "nonce": nonce,
        "confirmation_token": confirmation_token,
        "approval_sha256": "0" * 64,
        "claims": approval_claims(),
    }
    approval["approval_sha256"] = self_digest(approval, "approval_sha256")
    return approval


def validate_approval(approval: dict[str, Any], assessment: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_disposition(disposition, assessment, policy)
    require(approval.get("artifact_type") == "CHSPHandoverAuthorizationApproval", "CHSPHandoverAuthorizationApproval required")
    require(approval.get("artifact_version") == "0.4", "CHSPHandoverAuthorizationApproval v0.4 required")
    digest = approval.get("approval_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid approval digest")
    require(self_digest(approval, "approval_sha256") == digest, "approval self-digest mismatch")
    require(approval.get("project_id") == policy["project_id"], "approval project mismatch")
    require(approval.get("candidate_id") == assessment["candidate_id"], "approval candidate mismatch")
    require(approval.get("predecessor_steward_id") == disposition["predecessor_steward_id"], "approval predecessor mismatch")
    require(approval.get("v03_final_handover_assessment_sha256") == assessment["assessment_sha256"], "approval source assessment mismatch")
    require(approval.get("predecessor_disposition_sha256") == disposition["disposition_sha256"], "approval disposition mismatch")
    require(approval.get("authorizer_id") != assessment["candidate_id"], "candidate cannot approve own handover")
    require(isinstance(approval.get("authorizer_domain_id"), str) and approval["authorizer_domain_id"], "invalid authorizer domain")
    require(HEX64_RE.fullmatch(approval.get("authority_evidence_sha256", "")) is not None, "invalid approval authority evidence digest")
    require(approval.get("confirmation_token") == APPROVAL_CONFIRMATION_TOKEN, "approval typed confirmation mismatch")
    require(isinstance(approval.get("nonce"), str) and len(approval["nonce"]) >= 16, "invalid approval nonce")
    approved_at = parse_time(approval["approved_at"])
    source_time = parse_time(assessment["evaluated_at"])
    require(approved_at >= source_time, "approval predates source assessment")
    require(approved_at <= source_time + timedelta(days=policy["maximum_source_assessment_age_days"]), "approval uses stale source assessment")
    if disposition["mode"] == "protocol_unavailability_attested":
        require(approval["authorizer_id"] != disposition["predecessor_steward_id"], "predecessor approval invalidates unavailability-path approval set")
    claims = approval.get("claims") or {}
    require(claims.get("human_approval_recorded") is True, "human approval not recorded")
    require(claims.get("approval_bound_to_exact_assessment") is True, "approval source binding missing")
    for key in [
        "approval_grants_stewardship_immediately", "domain_independence_proven", "canonical_successor_established",
        "repository_ownership_transferred", "canonical_origin_mutated", "canonical_publication_executed",
        "kontur_activated", "legal_effect_established", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe approval claim: {key}")


def authorization_claims() -> dict[str, Any]:
    return {
        "human_quorum_authorization_recorded": True,
        "bounded_handover_recording_authorized": True,
        "authorization_revocable": True,
        "authorization_expires": True,
        "candidate_stewardship_effective": False,
        "execution_performed": False,
        "canonical_successor_established": False,
        "repository_ownership_transferred": False,
        "account_control_transferred": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "kontur_activated": False,
        "distributed_consensus_established": False,
        "legal_effect_established": False,
        "universal_trust_established": False,
    }


def _validate_approval_quorum(approvals: list[dict[str, Any]], assessment: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any]) -> tuple[list[str], list[str], list[str], int]:
    require(approvals, "approval set is empty")
    for approval in approvals:
        validate_approval(approval, assessment, disposition, policy)
    approval_digests = [a["approval_sha256"] for a in approvals]
    require(len(approval_digests) == len(set(approval_digests)), "duplicate approval artifact")
    authorizers = [a["authorizer_id"] for a in approvals]
    require(len(authorizers) == len(set(authorizers)), "duplicate authorizer")
    domains = [a["authorizer_domain_id"] for a in approvals]
    unique_domains = sorted(set(domains))
    if disposition["mode"] == "acknowledged":
        require(len(authorizers) >= policy["minimum_authorizers"], "insufficient authorizers")
        require(len(unique_domains) >= policy["minimum_authorizer_domains"], "insufficient authorizer domains")
        require(disposition["predecessor_steward_id"] in authorizers, "acknowledged path requires predecessor approval")
    else:
        require(len(authorizers) >= policy["unavailability_minimum_authorizers"], "insufficient unavailability-path authorizers")
        require(len(unique_domains) >= policy["unavailability_minimum_authorizer_domains"], "insufficient unavailability-path authorizer domains")
        require(disposition["predecessor_steward_id"] not in authorizers, "predecessor approval prohibited on unavailability path")
    times = sorted(parse_time(a["approved_at"]) for a in approvals)
    spread_hours = int((times[-1] - times[0]).total_seconds() // 3600) if len(times) > 1 else 0
    require(times[-1] - times[0] <= timedelta(hours=policy["maximum_approval_spread_hours"]), "approval quorum spread exceeds policy")
    return sorted(approval_digests), sorted(authorizers), unique_domains, spread_hours


def issue_authorization(
    assessment: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any],
    approvals: list[dict[str, Any]], nonce: str, state_dir: Path, at: str, expires_at: str,
) -> dict[str, Any]:
    validate_policy(policy)
    validate_disposition(disposition, assessment, policy)
    approval_digests, authorizers, domains, _ = _validate_approval_quorum(approvals, assessment, disposition, policy)
    require(isinstance(nonce, str) and len(nonce) >= 16, "authorization nonce too short")
    now = parse_time(at)
    expires = parse_time(expires_at)
    source_time = parse_time(assessment["evaluated_at"])
    latest_approval = max(parse_time(a["approved_at"]) for a in approvals)
    require(now >= latest_approval, "authorization cannot predate latest approval")
    require(now <= source_time + timedelta(days=policy["maximum_source_assessment_age_days"]), "source assessment too old for authorization")
    require(expires > now, "authorization must expire after issuance")
    require(expires - now <= timedelta(days=policy["maximum_authorization_days"]), "authorization validity exceeds policy")
    reservation = {
        "artifact_type": "CHSPLocalHandoverAuthorizationReservation",
        "artifact_version": "0.4",
        "v03_final_handover_assessment_sha256": assessment["assessment_sha256"],
        "candidate_id": assessment["candidate_id"],
        "reserved_at": iso_z(now),
        "claims": {"global_replay_prevention_established": False},
    }
    reserve_once(state_dir, "handover-authorized-assessments", assessment["assessment_sha256"], reservation)
    reserve_once(state_dir, "handover-authorization-nonces", nonce, reservation)
    approval_set_sha = sha256_json(approval_digests)
    authorization = {
        "artifact_type": "CHSPCanonicalStewardshipHandoverAuthorization",
        "artifact_version": "0.4",
        "authorization_id": "urn:uu-aap:chsp:handover-authorization:" + sha256_json({"assessment": assessment["assessment_sha256"], "approvals": approval_set_sha, "nonce": nonce})[:24],
        "project_id": policy["project_id"],
        "candidate_id": assessment["candidate_id"],
        "predecessor_steward_id": disposition["predecessor_steward_id"],
        "predecessor_disposition_mode": disposition["mode"],
        "v03_final_handover_assessment_sha256": assessment["assessment_sha256"],
        "predecessor_disposition_sha256": disposition["disposition_sha256"],
        "v03_handover_sha256": assessment["handover_sha256"],
        "v03_handover_outcome_sha256": assessment["outcome_sha256"],
        "approval_set_sha256": approval_set_sha,
        "approval_sha256s": approval_digests,
        "authorizer_ids": authorizers,
        "authorizer_domain_ids": domains,
        "authorized_action": AUTHORIZED_ACTION,
        "authorized_at": iso_z(now),
        "expires_at": iso_z(expires),
        "nonce": nonce,
        "authorization_sha256": "0" * 64,
        "claims": authorization_claims(),
    }
    authorization["authorization_sha256"] = self_digest(authorization, "authorization_sha256")
    return authorization


def validate_authorization(
    authorization: dict[str, Any], assessment: dict[str, Any], disposition: dict[str, Any],
    policy: dict[str, Any], approvals: list[dict[str, Any]],
) -> None:
    validate_policy(policy)
    validate_disposition(disposition, assessment, policy)
    approval_digests, authorizers, domains, _ = _validate_approval_quorum(approvals, assessment, disposition, policy)
    require(authorization.get("artifact_type") == "CHSPCanonicalStewardshipHandoverAuthorization", "CHSPCanonicalStewardshipHandoverAuthorization required")
    require(authorization.get("artifact_version") == "0.4", "CHSPCanonicalStewardshipHandoverAuthorization v0.4 required")
    digest = authorization.get("authorization_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid authorization digest")
    require(self_digest(authorization, "authorization_sha256") == digest, "authorization self-digest mismatch")
    require(authorization.get("project_id") == policy["project_id"], "authorization project mismatch")
    require(authorization.get("candidate_id") == assessment["candidate_id"], "authorization candidate mismatch")
    require(authorization.get("predecessor_steward_id") == disposition["predecessor_steward_id"], "authorization predecessor mismatch")
    require(authorization.get("predecessor_disposition_mode") == disposition["mode"], "authorization predecessor mode mismatch")
    require(authorization.get("v03_final_handover_assessment_sha256") == assessment["assessment_sha256"], "authorization source assessment mismatch")
    require(authorization.get("predecessor_disposition_sha256") == disposition["disposition_sha256"], "authorization disposition mismatch")
    require(authorization.get("v03_handover_sha256") == assessment["handover_sha256"], "authorization handover binding mismatch")
    require(authorization.get("v03_handover_outcome_sha256") == assessment["outcome_sha256"], "authorization outcome binding mismatch")
    require(authorization.get("approval_sha256s") == approval_digests, "authorization approval digest set mismatch")
    require(authorization.get("approval_set_sha256") == sha256_json(approval_digests), "authorization approval set digest mismatch")
    require(authorization.get("authorizer_ids") == authorizers, "authorization authorizer set mismatch")
    require(authorization.get("authorizer_domain_ids") == domains, "authorization domain set mismatch")
    require(authorization.get("authorized_action") == AUTHORIZED_ACTION, "authorization action mismatch")
    require(isinstance(authorization.get("nonce"), str) and len(authorization["nonce"]) >= 16, "invalid authorization nonce")
    issued = parse_time(authorization["authorized_at"])
    expires = parse_time(authorization["expires_at"])
    source_time = parse_time(assessment["evaluated_at"])
    latest_approval = max(parse_time(a["approved_at"]) for a in approvals)
    require(issued >= latest_approval, "authorization predates latest approval")
    require(issued <= source_time + timedelta(days=policy["maximum_source_assessment_age_days"]), "authorization uses stale source assessment")
    require(expires > issued, "authorization expiry invalid")
    require(expires - issued <= timedelta(days=policy["maximum_authorization_days"]), "authorization validity exceeds policy")
    claims = authorization.get("claims") or {}
    for key in ["human_quorum_authorization_recorded", "bounded_handover_recording_authorized", "authorization_revocable", "authorization_expires"]:
        require(claims.get(key) is True, f"required authorization claim missing: {key}")
    for key in [
        "candidate_stewardship_effective", "execution_performed", "canonical_successor_established",
        "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated",
        "canonical_publication_executed", "kontur_activated", "distributed_consensus_established",
        "legal_effect_established", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe authorization claim: {key}")


def revocation_claims() -> dict[str, Any]:
    return {
        "revocation_recorded": True,
        "future_execution_blocked": True,
        "original_authorization_erased": False,
        "canonical_state_mutated": False,
        "repository_ownership_transferred": False,
        "canonical_origin_mutated": False,
        "kontur_activated": False,
        "legal_effect_established": False,
        "truth_certified": False,
    }


def record_revocation(
    authorization: dict[str, Any], assessment: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any],
    approvals: list[dict[str, Any]], mode: str, actor_id: str, authority_evidence_sha256: str,
    reason_code: str, nonce: str, state_dir: Path, at: str,
) -> dict[str, Any]:
    validate_authorization(authorization, assessment, disposition, policy, approvals)
    require(mode in {"authorizer_revocation", "candidate_withdrawal"}, "invalid revocation mode")
    require(HEX64_RE.fullmatch(authority_evidence_sha256 or "") is not None, "invalid revocation authority evidence digest")
    require(reason_code in {"new_adverse_information", "process_integrity_concern", "authority_scope_concern", "candidate_withdrawal", "superseded_review_required", "other"}, "invalid revocation reason")
    require(isinstance(nonce, str) and len(nonce) >= 16, "revocation nonce too short")
    if mode == "candidate_withdrawal":
        require(actor_id == assessment["candidate_id"], "candidate withdrawal must be recorded by candidate")
        require(reason_code == "candidate_withdrawal", "candidate withdrawal requires candidate_withdrawal reason")
    else:
        require(actor_id in authorization["authorizer_ids"], "authorizer revocation must be recorded by original authorizer")
    now = parse_time(at)
    require(now >= parse_time(authorization["authorized_at"]), "revocation cannot predate authorization")
    reservation = {
        "artifact_type": "CHSPLocalHandoverAuthorizationRevocationReservation",
        "artifact_version": "0.4",
        "authorization_sha256": authorization["authorization_sha256"],
        "mode": mode,
        "actor_id": actor_id,
        "reserved_at": iso_z(now),
        "claims": {"global_replay_prevention_established": False},
    }
    reserve_once(state_dir, "handover-authorization-revocations", authorization["authorization_sha256"] + ":" + mode + ":" + actor_id, reservation)
    reserve_once(state_dir, "handover-revocation-nonces", nonce, reservation)
    revocation = {
        "artifact_type": "CHSPHandoverAuthorizationRevocation",
        "artifact_version": "0.4",
        "revocation_id": "urn:uu-aap:chsp:handover-authorization-revocation:" + sha256_json({"authorization": authorization["authorization_sha256"], "mode": mode, "actor": actor_id, "nonce": nonce})[:24],
        "project_id": policy["project_id"],
        "candidate_id": assessment["candidate_id"],
        "authorization_sha256": authorization["authorization_sha256"],
        "mode": mode,
        "actor_id": actor_id,
        "authority_evidence_sha256": authority_evidence_sha256,
        "revoked_at": iso_z(now),
        "reason_code": reason_code,
        "nonce": nonce,
        "revocation_sha256": "0" * 64,
        "claims": revocation_claims(),
    }
    revocation["revocation_sha256"] = self_digest(revocation, "revocation_sha256")
    return revocation


def validate_revocation(
    revocation: dict[str, Any], authorization: dict[str, Any], assessment: dict[str, Any],
    policy: dict[str, Any], approvals: list[dict[str, Any]],
) -> None:
    require(revocation.get("artifact_type") == "CHSPHandoverAuthorizationRevocation", "CHSPHandoverAuthorizationRevocation required")
    require(revocation.get("artifact_version") == "0.4", "CHSPHandoverAuthorizationRevocation v0.4 required")
    digest = revocation.get("revocation_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid revocation digest")
    require(self_digest(revocation, "revocation_sha256") == digest, "revocation self-digest mismatch")
    require(revocation.get("project_id") == policy["project_id"], "revocation project mismatch")
    require(revocation.get("candidate_id") == assessment["candidate_id"], "revocation candidate mismatch")
    require(revocation.get("authorization_sha256") == authorization["authorization_sha256"], "revocation authorization mismatch")
    mode = revocation.get("mode")
    require(mode in {"authorizer_revocation", "candidate_withdrawal"}, "invalid revocation mode")
    actor = revocation.get("actor_id")
    if mode == "candidate_withdrawal":
        require(actor == assessment["candidate_id"], "candidate withdrawal actor mismatch")
        require(revocation.get("reason_code") == "candidate_withdrawal", "candidate withdrawal reason mismatch")
    else:
        require(actor in {a["authorizer_id"] for a in approvals}, "revocation actor is not original authorizer")
    require(HEX64_RE.fullmatch(revocation.get("authority_evidence_sha256", "")) is not None, "invalid revocation authority evidence digest")
    require(parse_time(revocation["revoked_at"]) >= parse_time(authorization["authorized_at"]), "revocation predates authorization")
    require(isinstance(revocation.get("nonce"), str) and len(revocation["nonce"]) >= 16, "invalid revocation nonce")
    claims = revocation.get("claims") or {}
    require(claims.get("revocation_recorded") is True, "revocation not recorded")
    require(claims.get("future_execution_blocked") is True, "revocation must block future execution")
    for key in ["original_authorization_erased", "canonical_state_mutated", "repository_ownership_transferred", "canonical_origin_mutated", "kontur_activated", "legal_effect_established", "truth_certified"]:
        require(claims.get(key) is False, f"unsafe revocation claim: {key}")


def assessment_claims(validated: bool) -> dict[str, Any]:
    return {
        "policy_sufficiency_only": True,
        "authorization_validated": validated,
        "executor_invoked": False,
        "candidate_stewardship_effective": False,
        "canonical_successor_established": False,
        "repository_ownership_transferred": False,
        "account_control_transferred": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "kontur_activated": False,
        "distributed_consensus_established": False,
        "legal_effect_established": False,
        "universal_trust_established": False,
    }


def assess_authorization(
    source_assessment: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any],
    approvals: list[dict[str, Any]], authorization: dict[str, Any] | None,
    revocations: list[dict[str, Any]], at: str,
) -> dict[str, Any]:
    validate_policy(policy)
    validate_disposition(disposition, source_assessment, policy)
    now = parse_time(at)
    reasons: list[str] = []
    state = "authorization_invalid"
    decision = "reject_authorization"
    validated = False
    approval_count = 0
    domain_count = 0
    source_age_days = 0
    spread_hours = 0
    expired = False
    revocation_set_sha = artifact_set_sha(revocations, "revocation_sha256") if revocations else sha256_json([])
    auth_sha: str | None = None
    try:
        approval_digests, authorizers, domains, spread_hours = _validate_approval_quorum(approvals, source_assessment, disposition, policy)
        del approval_digests, authorizers
        approval_count = len(approvals)
        domain_count = len(domains)
        source_age_days = max(0, int((max(parse_time(a["approved_at"]) for a in approvals) - parse_time(source_assessment["evaluated_at"])).total_seconds() // 86400))
        require(authorization is not None, "authorization artifact missing")
        validate_authorization(authorization, source_assessment, disposition, policy, approvals)
        auth_sha = authorization["authorization_sha256"]
        valid_revocations: list[dict[str, Any]] = []
        seen_revocations: set[str] = set()
        for revocation in revocations:
            validate_revocation(revocation, authorization, source_assessment, policy, approvals)
            require(revocation["revocation_sha256"] not in seen_revocations, "duplicate revocation artifact")
            seen_revocations.add(revocation["revocation_sha256"])
            valid_revocations.append(revocation)
        validated = True
        if valid_revocations:
            state = "authorization_revoked"
            decision = "do_not_execute_revoked_authorization"
            reasons.append("one or more valid immutable revocation/withdrawal events block future execution")
        elif now < parse_time(authorization["authorized_at"]):
            state = "authorization_invalid"
            decision = "reject_authorization"
            reasons.append("assessment time predates authorization")
            validated = False
        elif now > parse_time(authorization["expires_at"]):
            state = "authorization_expired"
            decision = "renew_human_authorization_if_still_appropriate"
            expired = True
            reasons.append("authorization validity window has expired")
        else:
            state = "authorization_active"
            decision = "bounded_handover_executor_may_be_requested"
            reasons.append("bounded human-quorum authorization is active and no valid revocation is present")
    except Exception as exc:
        reasons.append(str(exc))
        state = "authorization_invalid"
        decision = "reject_authorization"
        validated = False

    result = {
        "artifact_type": "CHSPHandoverAuthorizationAssessment",
        "artifact_version": "0.4",
        "assessment_id": "urn:uu-aap:chsp:handover-authorization-assessment:" + sha256_json({"source": source_assessment["assessment_sha256"], "authorization": auth_sha, "at": iso_z(now), "revocations": revocation_set_sha})[:24],
        "evaluated_at": iso_z(now),
        "project_id": policy["project_id"],
        "candidate_id": source_assessment["candidate_id"],
        "predecessor_steward_id": disposition["predecessor_steward_id"],
        "v03_final_handover_assessment_sha256": source_assessment["assessment_sha256"],
        "predecessor_disposition_sha256": disposition["disposition_sha256"],
        "policy_sha256": sha256_json(policy),
        "authorization_sha256": auth_sha,
        "revocation_set_sha256": revocation_set_sha,
        "state": state,
        "decision": decision,
        "metrics": {
            "predecessor_disposition_mode": disposition["mode"],
            "approval_count": approval_count,
            "authorizer_domains": domain_count,
            "source_assessment_age_days": source_age_days,
            "approval_spread_hours": spread_hours,
            "revocation_count": len(revocations),
            "authorization_expired": expired,
        },
        "reasons": reasons,
        "assessment_sha256": "0" * 64,
        "claims": assessment_claims(validated),
    }
    result["assessment_sha256"] = self_digest(result, "assessment_sha256")
    return result
