#!/usr/bin/env python3
"""CHSP v0.7 local-only external binding recognition and transition-preparation authorization.

This module records human decisions and bounded preparation authorization only.
It performs no network, Git, GitHub API, repository/account, ownership, canonical-origin,
publication, external-process, or KONTUR mutation.
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
RECOGNITION_TOKEN = "RECOGNIZE_CHSP_EXTERNAL_BINDING_FOR_TRANSITION_PREPARATION_ONLY"
TRANSITION_TOKEN = "AUTHORIZE_CHSP_EXTERNAL_TRANSITION_PREPARATION_ONLY"
AUTHORIZED_ACTION = "prepare_bounded_external_stewardship_transition_envelope"


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


def artifact_set_sha(items: list[dict[str, Any]], field: str) -> str:
    digests = []
    for item in items:
        digest = item.get(field, "")
        require(HEX64_RE.fullmatch(digest) is not None, f"invalid {field}")
        digests.append(digest)
    require(len(digests) == len(set(digests)), f"duplicate {field}")
    return sha256_json(sorted(digests))


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPExternalTransitionPolicy", "CHSPExternalTransitionPolicy required")
    require(policy.get("artifact_version") == "0.7", "CHSPExternalTransitionPolicy v0.7 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    for key, minimum in [
        ("minimum_recognizers", 2), ("minimum_recognizer_domains", 2),
        ("minimum_transition_authorizers", 2), ("minimum_transition_authorizer_domains", 2),
        ("maximum_source_assessment_age_hours", 1), ("maximum_decision_spread_hours", 1),
        ("maximum_recognition_days", 1), ("maximum_transition_authorization_hours", 1),
    ]:
        require(isinstance(policy.get(key), int) and policy[key] >= minimum, f"invalid policy threshold: {key}")
    req = policy.get("requirements") or {}
    for key in [
        "v06_review_eligible_required", "distinct_humans_required", "declared_domains_required",
        "non_steward_recognizer_required", "steward_transition_consent_required",
        "non_steward_transition_authorizer_required", "typed_confirmation_required",
        "authority_evidence_digest_required", "revocable_before_execution",
    ]:
        require(req.get(key) is True, f"unsafe missing requirement: {key}")
    for key in ["automatic_external_execution", "automatic_ownership_transfer", "automatic_origin_mutation", "automatic_kontur_activation"]:
        require(req.get(key) is False, f"unsafe automatic policy: {key}")
    claims = policy.get("claims") or {}
    require(claims.get("descriptive_policy_only") is True, "policy must be descriptive")
    for key in [
        "external_binding_established", "external_control_transferred", "repository_ownership_transferred",
        "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed",
        "kontur_activated", "legal_ownership_adjudicated", "universal_identity_proven",
        "domain_independence_proven", "distributed_consensus_established",
    ]:
        require(claims.get(key) is False, f"unsafe policy claim: {key}")


def validate_v06(proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_policy(policy)
    require(proposal.get("artifact_type") == "CHSPExternalBindingProposal" and proposal.get("artifact_version") == "0.6", "CHSPExternalBindingProposal v0.6 required")
    require(assessment.get("artifact_type") == "CHSPExternalBindingAssessment" and assessment.get("artifact_version") == "0.6", "CHSPExternalBindingAssessment v0.6 required")
    psha = proposal.get("proposal_sha256", "")
    asha = assessment.get("assessment_sha256", "")
    require(HEX64_RE.fullmatch(psha) is not None and self_digest(proposal, "proposal_sha256") == psha, "v0.6 proposal self-digest mismatch")
    require(HEX64_RE.fullmatch(asha) is not None and self_digest(assessment, "assessment_sha256") == asha, "v0.6 assessment self-digest mismatch")
    require(proposal.get("project_id") == policy["project_id"] == assessment.get("project_id"), "v0.6 project mismatch")
    require(proposal.get("steward_id") == assessment.get("steward_id"), "v0.6 steward mismatch")
    require(assessment.get("proposal_sha256") == psha, "v0.6 assessment/proposal binding mismatch")
    require(assessment.get("state") == "binding_review_eligible", "v0.6 binding is not review eligible")
    require(assessment.get("decision") == "external_binding_human_review_may_be_requested", "v0.6 assessment does not permit human review")
    pc = proposal.get("claims") or {}
    require(pc.get("proposal_only") is True and pc.get("evidence_threshold_satisfied") is True, "v0.6 proposal evidence boundary missing")
    for key in ["external_binding_established", "external_control_transition_authorized", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "universal_identity_proven", "distributed_consensus_established"]:
        require(pc.get(key) is False, f"unsafe v0.6 proposal claim: {key}")
    ac = assessment.get("claims") or {}
    require(ac.get("policy_sufficiency_only") is True and ac.get("external_binding_review_eligible") is True, "v0.6 assessment review claim missing")
    for key in ["external_binding_established", "external_control_transition_authorized", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "universal_identity_proven", "domain_independence_proven", "distributed_consensus_established"]:
        require(ac.get(key) is False, f"unsafe v0.6 assessment claim: {key}")


def decision_claims() -> dict[str, Any]:
    return {
        "human_decision_recorded": True, "phase_specific_consent": True,
        "authority_granted_immediately": False, "external_control_mutated": False,
        "repository_ownership_transferred": False, "account_control_transferred": False,
        "canonical_origin_mutated": False, "canonical_publication_executed": False,
        "kontur_activated": False, "legal_effect_established": False,
        "universal_identity_proven": False,
    }


def issue_decision(
    proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any],
    phase: str, human_id: str, human_domain_id: str, authority_evidence_sha256: str,
    nonce: str, confirmation_token: str, state_dir: Path, at: str,
    recognition: dict[str, Any] | None = None,
) -> dict[str, Any]:
    validate_v06(proposal, assessment, policy)
    require(phase in {"recognition", "transition_preparation"}, "invalid decision phase")
    require(human_id and human_domain_id, "human and domain IDs required")
    require(HEX64_RE.fullmatch(authority_evidence_sha256 or "") is not None, "invalid authority evidence digest")
    require(isinstance(nonce, str) and len(nonce) >= 16, "decision nonce too short")
    expected_token = RECOGNITION_TOKEN if phase == "recognition" else TRANSITION_TOKEN
    require(confirmation_token == expected_token, "phase typed confirmation mismatch")
    now = parse_time(at)
    recognition_sha = None
    if phase == "recognition":
        require(recognition is None, "recognition-phase decision cannot bind existing recognition")
    else:
        require(recognition is not None, "transition decision requires exact recognition")
        validate_recognition(recognition, proposal, assessment, policy, None)
        require(now >= parse_time(recognition["recognized_at"]), "transition decision predates recognition")
        require(now <= parse_time(recognition["expires_at"]), "recognition expired before transition decision")
        recognition_sha = recognition["recognition_sha256"]
    reservation = {
        "artifact_type": "CHSPLocalExternalDecisionReservation", "artifact_version": "0.7",
        "phase": phase, "proposal_sha256": proposal["proposal_sha256"], "human_id": human_id,
        "reserved_at": iso_z(now), "claims": {"global_replay_prevention_established": False},
    }
    reserve_once(state_dir, "external-decision-humans", phase + ":" + proposal["proposal_sha256"] + ":" + human_id, reservation)
    reserve_once(state_dir, "external-decision-nonces", nonce, reservation)
    value = {
        "artifact_type": "CHSPExternalBindingHumanDecision", "artifact_version": "0.7",
        "decision_id": "urn:uu-aap:chsp:external-decision:" + sha256_json({"phase": phase, "proposal": proposal["proposal_sha256"], "human": human_id, "nonce": nonce})[:24],
        "phase": phase, "project_id": policy["project_id"], "steward_id": proposal["steward_id"],
        "v06_binding_proposal_sha256": proposal["proposal_sha256"], "v06_binding_assessment_sha256": assessment["assessment_sha256"],
        "recognition_sha256": recognition_sha, "human_id": human_id, "human_domain_id": human_domain_id,
        "authority_evidence_sha256": authority_evidence_sha256, "decided_at": iso_z(now), "nonce": nonce,
        "confirmation_token": confirmation_token, "decision_sha256": "0" * 64, "claims": decision_claims(),
    }
    value["decision_sha256"] = self_digest(value, "decision_sha256")
    return value


def validate_decision(decision: dict[str, Any], proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any], phase: str, recognition: dict[str, Any] | None) -> None:
    validate_v06(proposal, assessment, policy)
    require(decision.get("artifact_type") == "CHSPExternalBindingHumanDecision" and decision.get("artifact_version") == "0.7", "CHSPExternalBindingHumanDecision v0.7 required")
    digest = decision.get("decision_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(decision, "decision_sha256") == digest, "human decision self-digest mismatch")
    require(decision.get("phase") == phase, "human decision phase mismatch")
    require(decision.get("project_id") == policy["project_id"] and decision.get("steward_id") == proposal["steward_id"], "human decision scope mismatch")
    require(decision.get("v06_binding_proposal_sha256") == proposal["proposal_sha256"] and decision.get("v06_binding_assessment_sha256") == assessment["assessment_sha256"], "human decision v0.6 binding mismatch")
    expected_token = RECOGNITION_TOKEN if phase == "recognition" else TRANSITION_TOKEN
    require(decision.get("confirmation_token") == expected_token, "human decision typed confirmation mismatch")
    require(HEX64_RE.fullmatch(decision.get("authority_evidence_sha256", "")) is not None, "invalid human authority evidence digest")
    require(isinstance(decision.get("nonce"), str) and len(decision["nonce"]) >= 16, "invalid decision nonce")
    if phase == "recognition":
        require(decision.get("recognition_sha256") is None, "recognition decision must not bind recognition")
    else:
        require(recognition is not None, "transition decision missing recognition")
        require(decision.get("recognition_sha256") == recognition["recognition_sha256"], "transition decision recognition mismatch")
    claims = decision.get("claims") or {}
    require(claims.get("human_decision_recorded") is True and claims.get("phase_specific_consent") is True, "human decision claims missing")
    for key in ["authority_granted_immediately", "external_control_mutated", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_effect_established", "universal_identity_proven"]:
        require(claims.get(key) is False, f"unsafe human decision claim: {key}")


def _quorum(decisions: list[dict[str, Any]], proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any], phase: str, recognition: dict[str, Any] | None) -> tuple[list[str], list[str], list[str], int]:
    require(decisions, "human decision set is empty")
    for d in decisions:
        validate_decision(d, proposal, assessment, policy, phase, recognition)
    digests = sorted(d["decision_sha256"] for d in decisions)
    require(len(digests) == len(set(digests)), "duplicate human decision artifact")
    humans = [d["human_id"] for d in decisions]
    require(len(humans) == len(set(humans)), "duplicate human decision actor")
    domains = sorted({d["human_domain_id"] for d in decisions})
    steward = proposal["steward_id"]
    if phase == "recognition":
        require(len(humans) >= policy["minimum_recognizers"], "insufficient recognizers")
        require(len(domains) >= policy["minimum_recognizer_domains"], "insufficient recognizer domains")
        require(any(h != steward for h in humans), "at least one non-steward recognizer required")
    else:
        require(len(humans) >= policy["minimum_transition_authorizers"], "insufficient transition authorizers")
        require(len(domains) >= policy["minimum_transition_authorizer_domains"], "insufficient transition authorizer domains")
        require(steward in humans, "current CHSP steward transition consent required")
        require(any(h != steward for h in humans), "at least one non-steward transition authorizer required")
    times = sorted(parse_time(d["decided_at"]) for d in decisions)
    spread = int((times[-1] - times[0]).total_seconds() // 3600) if len(times) > 1 else 0
    require(times[-1] - times[0] <= timedelta(hours=policy["maximum_decision_spread_hours"]), "human decision quorum spread exceeds policy")
    return digests, sorted(humans), domains, spread


def recognition_claims() -> dict[str, Any]:
    return {
        "human_binding_recognition_recorded": True,
        "external_mapping_recognized_for_transition_preparation": True,
        "external_binding_established": False, "external_control_mutation_authorized": False,
        "external_control_transferred": False, "repository_ownership_transferred": False,
        "account_control_transferred": False, "canonical_origin_mutated": False,
        "canonical_publication_executed": False, "kontur_activated": False,
        "legal_ownership_adjudicated": False, "universal_identity_proven": False,
        "distributed_consensus_established": False,
    }


def issue_recognition(proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any], decisions: list[dict[str, Any]], nonce: str, state_dir: Path, at: str, expires_at: str) -> dict[str, Any]:
    validate_v06(proposal, assessment, policy)
    digests, humans, domains, _ = _quorum(decisions, proposal, assessment, policy, "recognition", None)
    require(isinstance(nonce, str) and len(nonce) >= 16, "recognition nonce too short")
    now, expires = parse_time(at), parse_time(expires_at)
    source_time = parse_time(assessment["evaluated_at"])
    latest = max(parse_time(d["decided_at"]) for d in decisions)
    require(now >= latest, "recognition predates latest decision")
    require(now - source_time <= timedelta(hours=policy["maximum_source_assessment_age_hours"]), "v0.6 assessment too old for recognition")
    require(expires > now and expires - now <= timedelta(days=policy["maximum_recognition_days"]), "recognition validity exceeds policy")
    reservation = {"artifact_type": "CHSPLocalExternalRecognitionReservation", "artifact_version": "0.7", "proposal_sha256": proposal["proposal_sha256"], "reserved_at": iso_z(now), "claims": {"global_replay_prevention_established": False}}
    reserve_once(state_dir, "external-recognized-proposals", proposal["proposal_sha256"], reservation)
    reserve_once(state_dir, "external-recognition-nonces", nonce, reservation)
    value = {
        "artifact_type": "CHSPExternalBindingRecognition", "artifact_version": "0.7",
        "recognition_id": "urn:uu-aap:chsp:external-recognition:" + sha256_json({"proposal": proposal["proposal_sha256"], "decisions": digests, "nonce": nonce})[:24],
        "project_id": policy["project_id"], "steward_id": proposal["steward_id"], "v06_binding_proposal_sha256": proposal["proposal_sha256"], "v06_binding_assessment_sha256": assessment["assessment_sha256"],
        "decision_set_sha256": sha256_json(digests), "decision_sha256s": digests, "recognizer_ids": humans, "recognizer_domain_ids": domains,
        "recognized_at": iso_z(now), "expires_at": iso_z(expires), "nonce": nonce, "recognition_sha256": "0" * 64, "claims": recognition_claims(),
    }
    value["recognition_sha256"] = self_digest(value, "recognition_sha256")
    return value


def validate_recognition(recognition: dict[str, Any], proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any], decisions: list[dict[str, Any]] | None) -> None:
    validate_v06(proposal, assessment, policy)
    require(recognition.get("artifact_type") == "CHSPExternalBindingRecognition" and recognition.get("artifact_version") == "0.7", "CHSPExternalBindingRecognition v0.7 required")
    digest = recognition.get("recognition_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(recognition, "recognition_sha256") == digest, "recognition self-digest mismatch")
    require(recognition.get("project_id") == policy["project_id"] and recognition.get("steward_id") == proposal["steward_id"], "recognition scope mismatch")
    require(recognition.get("v06_binding_proposal_sha256") == proposal["proposal_sha256"] and recognition.get("v06_binding_assessment_sha256") == assessment["assessment_sha256"], "recognition v0.6 binding mismatch")
    if decisions is not None:
        digests, humans, domains, _ = _quorum(decisions, proposal, assessment, policy, "recognition", None)
        require(recognition.get("decision_sha256s") == digests and recognition.get("decision_set_sha256") == sha256_json(digests), "recognition decision set mismatch")
        require(recognition.get("recognizer_ids") == humans and recognition.get("recognizer_domain_ids") == domains, "recognition recognizer set mismatch")
    issued, expires = parse_time(recognition["recognized_at"]), parse_time(recognition["expires_at"])
    require(expires > issued and expires - issued <= timedelta(days=policy["maximum_recognition_days"]), "recognition validity exceeds policy")
    claims = recognition.get("claims") or {}
    require(claims.get("human_binding_recognition_recorded") is True and claims.get("external_mapping_recognized_for_transition_preparation") is True, "recognition claims missing")
    for key in ["external_binding_established", "external_control_mutation_authorized", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "universal_identity_proven", "distributed_consensus_established"]:
        require(claims.get(key) is False, f"unsafe recognition claim: {key}")


def authorization_claims() -> dict[str, Any]:
    return {
        "bounded_external_transition_preparation_authorized": True, "steward_consent_recorded": True,
        "external_binding_established": False, "external_control_mutation_authorized": False,
        "external_control_transferred": False, "repository_ownership_transferred": False,
        "account_control_transferred": False, "canonical_origin_mutated": False,
        "canonical_publication_executed": False, "kontur_activated": False,
        "legal_ownership_adjudicated": False, "executor_invoked": False,
        "distributed_consensus_established": False,
    }


def issue_transition_authorization(proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any], recognition: dict[str, Any], recognition_decisions: list[dict[str, Any]], decisions: list[dict[str, Any]], nonce: str, state_dir: Path, at: str, expires_at: str) -> dict[str, Any]:
    validate_recognition(recognition, proposal, assessment, policy, recognition_decisions)
    digests, humans, domains, _ = _quorum(decisions, proposal, assessment, policy, "transition_preparation", recognition)
    require(isinstance(nonce, str) and len(nonce) >= 16, "transition authorization nonce too short")
    now, expires = parse_time(at), parse_time(expires_at)
    latest = max(parse_time(d["decided_at"]) for d in decisions)
    require(now >= latest, "transition authorization predates latest decision")
    require(now <= parse_time(recognition["expires_at"]), "recognition expired before transition authorization")
    require(expires > now and expires - now <= timedelta(hours=policy["maximum_transition_authorization_hours"]), "transition authorization validity exceeds policy")
    reservation = {"artifact_type": "CHSPLocalExternalTransitionAuthorizationReservation", "artifact_version": "0.7", "recognition_sha256": recognition["recognition_sha256"], "reserved_at": iso_z(now), "claims": {"global_replay_prevention_established": False}}
    reserve_once(state_dir, "external-transition-recognitions", recognition["recognition_sha256"], reservation)
    reserve_once(state_dir, "external-transition-authorization-nonces", nonce, reservation)
    value = {
        "artifact_type": "CHSPExternalTransitionPreparationAuthorization", "artifact_version": "0.7",
        "authorization_id": "urn:uu-aap:chsp:external-transition-authorization:" + sha256_json({"recognition": recognition["recognition_sha256"], "decisions": digests, "nonce": nonce})[:24],
        "project_id": policy["project_id"], "steward_id": proposal["steward_id"], "recognition_sha256": recognition["recognition_sha256"],
        "v06_binding_proposal_sha256": proposal["proposal_sha256"], "v06_binding_assessment_sha256": assessment["assessment_sha256"],
        "decision_set_sha256": sha256_json(digests), "decision_sha256s": digests, "authorizer_ids": humans, "authorizer_domain_ids": domains,
        "authorized_action": AUTHORIZED_ACTION, "authorized_at": iso_z(now), "expires_at": iso_z(expires), "nonce": nonce,
        "authorization_sha256": "0" * 64, "claims": authorization_claims(),
    }
    value["authorization_sha256"] = self_digest(value, "authorization_sha256")
    return value


def validate_transition_authorization(authorization: dict[str, Any], proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any], recognition: dict[str, Any], recognition_decisions: list[dict[str, Any]], decisions: list[dict[str, Any]]) -> None:
    validate_recognition(recognition, proposal, assessment, policy, recognition_decisions)
    require(authorization.get("artifact_type") == "CHSPExternalTransitionPreparationAuthorization" and authorization.get("artifact_version") == "0.7", "CHSPExternalTransitionPreparationAuthorization v0.7 required")
    digest = authorization.get("authorization_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(authorization, "authorization_sha256") == digest, "transition authorization self-digest mismatch")
    digests, humans, domains, _ = _quorum(decisions, proposal, assessment, policy, "transition_preparation", recognition)
    require(authorization.get("project_id") == policy["project_id"] and authorization.get("steward_id") == proposal["steward_id"], "transition authorization scope mismatch")
    require(authorization.get("recognition_sha256") == recognition["recognition_sha256"], "transition authorization recognition mismatch")
    require(authorization.get("v06_binding_proposal_sha256") == proposal["proposal_sha256"] and authorization.get("v06_binding_assessment_sha256") == assessment["assessment_sha256"], "transition authorization v0.6 binding mismatch")
    require(authorization.get("decision_sha256s") == digests and authorization.get("decision_set_sha256") == sha256_json(digests), "transition authorization decision set mismatch")
    require(authorization.get("authorizer_ids") == humans and authorization.get("authorizer_domain_ids") == domains, "transition authorization authorizer set mismatch")
    require(authorization.get("authorized_action") == AUTHORIZED_ACTION, "transition authorization action mismatch")
    issued, expires = parse_time(authorization["authorized_at"]), parse_time(authorization["expires_at"])
    require(expires > issued and expires - issued <= timedelta(hours=policy["maximum_transition_authorization_hours"]), "transition authorization validity exceeds policy")
    claims = authorization.get("claims") or {}
    require(claims.get("bounded_external_transition_preparation_authorized") is True and claims.get("steward_consent_recorded") is True, "transition authorization claims missing")
    for key in ["external_binding_established", "external_control_mutation_authorized", "external_control_transferred", "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated", "executor_invoked", "distributed_consensus_established"]:
        require(claims.get(key) is False, f"unsafe transition authorization claim: {key}")


def record_revocation(target_type: str, target: dict[str, Any], proposal: dict[str, Any], policy: dict[str, Any], actor_id: str, mode: str, authority_evidence_sha256: str, reason_code: str, nonce: str, state_dir: Path, at: str) -> dict[str, Any]:
    require(target_type in {"recognition", "transition_preparation_authorization"}, "invalid revocation target type")
    require(mode in {"human_revocation", "steward_withdrawal"}, "invalid revocation mode")
    require(HEX64_RE.fullmatch(authority_evidence_sha256 or "") is not None, "invalid revocation authority evidence digest")
    require(isinstance(nonce, str) and len(nonce) >= 16, "revocation nonce too short")
    steward = proposal["steward_id"]
    if target_type == "recognition":
        target_sha = target["recognition_sha256"]
        allowed = set(target["recognizer_ids"])
        target_time = parse_time(target["recognized_at"])
    else:
        target_sha = target["authorization_sha256"]
        allowed = set(target["authorizer_ids"])
        target_time = parse_time(target["authorized_at"])
    if mode == "steward_withdrawal":
        require(actor_id == steward, "steward withdrawal actor mismatch")
    else:
        require(actor_id in allowed, "revocation actor is not original human decision actor")
    now = parse_time(at)
    require(now >= target_time, "revocation predates target")
    reservation = {"artifact_type": "CHSPLocalExternalRevocationReservation", "artifact_version": "0.7", "target_sha256": target_sha, "actor_id": actor_id, "mode": mode, "reserved_at": iso_z(now), "claims": {"global_replay_prevention_established": False}}
    reserve_once(state_dir, "external-revocation-actors", target_sha + ":" + mode + ":" + actor_id, reservation)
    reserve_once(state_dir, "external-revocation-nonces", nonce, reservation)
    value = {
        "artifact_type": "CHSPExternalTransitionRevocation", "artifact_version": "0.7",
        "revocation_id": "urn:uu-aap:chsp:external-revocation:" + sha256_json({"target": target_sha, "actor": actor_id, "nonce": nonce})[:24],
        "project_id": policy["project_id"], "steward_id": steward, "target_type": target_type, "target_sha256": target_sha,
        "mode": mode, "actor_id": actor_id, "authority_evidence_sha256": authority_evidence_sha256,
        "revoked_at": iso_z(now), "reason_code": reason_code, "nonce": nonce, "revocation_sha256": "0" * 64,
        "claims": {"revocation_recorded": True, "future_execution_blocked": True, "historical_target_erased": False, "external_control_mutated": False, "repository_ownership_transferred": False, "canonical_origin_mutated": False, "kontur_activated": False, "legal_effect_established": False, "truth_certified": False},
    }
    value["revocation_sha256"] = self_digest(value, "revocation_sha256")
    return value


def validate_revocation(revocation: dict[str, Any], recognition: dict[str, Any], authorization: dict[str, Any] | None, proposal: dict[str, Any], policy: dict[str, Any]) -> None:
    require(revocation.get("artifact_type") == "CHSPExternalTransitionRevocation" and revocation.get("artifact_version") == "0.7", "CHSPExternalTransitionRevocation v0.7 required")
    digest = revocation.get("revocation_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(revocation, "revocation_sha256") == digest, "revocation self-digest mismatch")
    require(revocation.get("project_id") == policy["project_id"] and revocation.get("steward_id") == proposal["steward_id"], "revocation scope mismatch")
    target_type = revocation.get("target_type")
    if target_type == "recognition":
        target = recognition
        target_sha = recognition["recognition_sha256"]
        allowed = set(recognition["recognizer_ids"])
    else:
        require(target_type == "transition_preparation_authorization" and authorization is not None, "invalid transition revocation target")
        target = authorization
        target_sha = authorization["authorization_sha256"]
        allowed = set(authorization["authorizer_ids"])
    require(revocation.get("target_sha256") == target_sha, "revocation target digest mismatch")
    mode, actor = revocation.get("mode"), revocation.get("actor_id")
    if mode == "steward_withdrawal":
        require(actor == proposal["steward_id"], "steward withdrawal actor mismatch")
    else:
        require(mode == "human_revocation" and actor in allowed, "invalid human revocation actor")
    require(HEX64_RE.fullmatch(revocation.get("authority_evidence_sha256", "")) is not None, "invalid revocation evidence digest")
    claims = revocation.get("claims") or {}
    require(claims.get("revocation_recorded") is True and claims.get("future_execution_blocked") is True, "revocation claims missing")
    for key in ["historical_target_erased", "external_control_mutated", "repository_ownership_transferred", "canonical_origin_mutated", "kontur_activated", "legal_effect_established", "truth_certified"]:
        require(claims.get(key) is False, f"unsafe revocation claim: {key}")
    del target


def assess_transition(proposal: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any], recognition_decisions: list[dict[str, Any]], recognition: dict[str, Any] | None, transition_decisions: list[dict[str, Any]], authorization: dict[str, Any] | None, revocations: list[dict[str, Any]], at: str) -> dict[str, Any]:
    validate_v06(proposal, assessment, policy)
    now = parse_time(at)
    state, decision = "recognition_invalid", "reject_transition"
    reasons: list[str] = []
    recognition_valid = False
    authorization_valid = False
    rec_count = len(recognition_decisions)
    rec_domains = len({d.get("human_domain_id") for d in recognition_decisions})
    auth_count = len(transition_decisions)
    auth_domains = len({d.get("human_domain_id") for d in transition_decisions})
    rec_expired = False
    auth_expired = False
    rec_sha = recognition.get("recognition_sha256") if recognition else None
    auth_sha = authorization.get("authorization_sha256") if authorization else None
    rev_set_sha = artifact_set_sha(revocations, "revocation_sha256") if revocations else sha256_json([])
    try:
        require(recognition is not None, "recognition artifact missing")
        validate_recognition(recognition, proposal, assessment, policy, recognition_decisions)
        recognition_valid = True
        valid_revocations = []
        for rev in revocations:
            validate_revocation(rev, recognition, authorization, proposal, policy)
            valid_revocations.append(rev)
        if valid_revocations:
            state, decision = "transition_revoked", "do_not_execute_revoked_transition"
            reasons.append("one or more valid immutable revocation events block future external transition execution")
        elif now > parse_time(recognition["expires_at"]):
            rec_expired = True
            state, decision = "transition_expired", "renew_human_transition_authorization_if_still_appropriate"
            reasons.append("binding recognition has expired")
        elif authorization is None:
            state, decision = "recognition_active", "collect_transition_authorization"
            reasons.append("binding recognition is active; separate transition-preparation authorization is still required")
        else:
            validate_transition_authorization(authorization, proposal, assessment, policy, recognition, recognition_decisions, transition_decisions)
            authorization_valid = True
            if now < parse_time(authorization["authorized_at"]):
                raise ValueError("assessment time predates transition authorization")
            if now > parse_time(authorization["expires_at"]):
                auth_expired = True
                state, decision = "transition_expired", "renew_human_transition_authorization_if_still_appropriate"
                reasons.append("transition-preparation authorization has expired")
            else:
                state, decision = "transition_preparation_authorized", "bounded_external_transition_executor_may_be_requested"
                reasons.append("human binding recognition and separate bounded transition-preparation authorization are active")
    except Exception as exc:
        reasons.append(str(exc))
        state, decision = "recognition_invalid", "reject_transition"
        recognition_valid = False
        authorization_valid = False
    result = {
        "artifact_type": "CHSPExternalTransitionAssessment", "artifact_version": "0.7",
        "assessment_id": "urn:uu-aap:chsp:external-transition-assessment:" + sha256_json({"proposal": proposal["proposal_sha256"], "recognition": rec_sha, "authorization": auth_sha, "revocations": rev_set_sha, "at": iso_z(now)})[:24],
        "evaluated_at": iso_z(now), "project_id": policy["project_id"], "steward_id": proposal["steward_id"],
        "v06_binding_proposal_sha256": proposal["proposal_sha256"], "v06_binding_assessment_sha256": assessment["assessment_sha256"],
        "recognition_sha256": rec_sha, "authorization_sha256": auth_sha, "revocation_set_sha256": rev_set_sha,
        "state": state, "decision": decision,
        "metrics": {"recognizer_count": rec_count, "recognizer_domains": rec_domains, "transition_authorizer_count": auth_count, "transition_authorizer_domains": auth_domains, "recognition_expired": rec_expired, "authorization_expired": auth_expired, "revocation_count": len(revocations)},
        "reasons": reasons, "assessment_sha256": "0" * 64,
        "claims": {"policy_sufficiency_only": True, "human_binding_recognition_validated": recognition_valid, "transition_preparation_authorization_validated": authorization_valid, "executor_invoked": False, "external_binding_established": False, "external_control_mutation_authorized": False, "external_control_transferred": False, "repository_ownership_transferred": False, "account_control_transferred": False, "canonical_origin_mutated": False, "canonical_publication_executed": False, "kontur_activated": False, "legal_ownership_adjudicated": False, "distributed_consensus_established": False},
    }
    result["assessment_sha256"] = self_digest(result, "assessment_sha256")
    return result
