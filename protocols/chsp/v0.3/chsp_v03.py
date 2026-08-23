#!/usr/bin/env python3
"""CHSP v0.3 local-only final-recognition and dual-control handover tooling.

No network, Git, account, publication, ownership, secret-recovery, or KONTUR
execution is performed by this module.
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
ACK_TOKEN = "ACKNOWLEDGE_CHSP_DUAL_CONTROL_HANDOVER_ONLY"
FINAL_RECOGNITION_TOKEN = "RECOGNIZE_CHSP_FINAL_SUCCESSION_CANDIDATE_FOR_DUAL_CONTROL_ONLY"


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


def reserve_once(state_dir: Path, category: str, key: str, payload: dict[str, Any]) -> None:
    target = state_dir / category
    target.mkdir(parents=True, exist_ok=True)
    path = target / f"{hashlib.sha256(key.encode('utf-8')).hexdigest()}.json"
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise ValueError(f"local reservation already exists for {category}") from exc
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())
    dfd = os.open(target, os.O_RDONLY)
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
    require(policy.get("artifact_type") == "CHSPFinalHandoverPolicy", "CHSPFinalHandoverPolicy required")
    require(policy.get("artifact_version") == "0.3", "CHSPFinalHandoverPolicy v0.3 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    for key in ["minimum_final_cooling_days", "minimum_dual_control_days", "maximum_handover_days"]:
        require(isinstance(policy.get(key), int) and policy[key] > 0, f"invalid policy threshold: {key}")
    require(policy["maximum_handover_days"] >= policy["minimum_dual_control_days"], "handover maximum shorter than minimum observation")
    for key in ["minimum_unavailability_attestations", "minimum_unavailability_attestor_domains"]:
        require(isinstance(policy.get(key), int) and policy[key] >= 2, f"invalid unavailability threshold: {key}")
    scopes = policy.get("allowed_handover_scopes")
    require(isinstance(scopes, list) and scopes and len(scopes) == len(set(scopes)), "invalid handover scopes")
    req = policy.get("requirements") or {}
    for key in [
        "v02_final_review_eligibility_required", "predecessor_disposition_required",
        "final_recognizer_distinct_from_candidate_and_predecessor", "final_cooling_required",
        "open_or_upheld_final_challenge_blocks", "handover_nonexclusive", "handover_reversible",
        "handover_expires", "positive_outcome_required",
    ]:
        require(req.get(key) is True, f"unsafe policy requirement: {key}")
    for key in ["automatic_stewardship_transfer", "automatic_canonical_publication", "automatic_kontur_activation"]:
        require(req.get(key) is False, f"unsafe automatic policy: {key}")
    claims = policy.get("claims") or {}
    require(claims.get("descriptive_policy_only") is True, "policy must remain descriptive")
    for key in ["canonical_successor_established", "ownership_transferred", "kontur_activated", "legal_incapacity_certified", "medical_incapacity_certified", "universal_trust_established"]:
        require(claims.get(key) is False, f"unsafe policy claim: {key}")


def validate_v02_assessment(assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    require(assessment.get("artifact_type") == "CHSPTransitionAssessment", "CHSPTransitionAssessment v0.2 required")
    require(assessment.get("artifact_version") == "0.2", "CHSPTransitionAssessment v0.2 required")
    require(assessment.get("project_id") == policy["project_id"], "v0.2 assessment project mismatch")
    digest = assessment.get("assessment_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid v0.2 assessment digest")
    require(self_digest(assessment, "assessment_sha256") == digest, "v0.2 assessment self-digest mismatch")
    require(assessment.get("state") == "final_succession_review_eligible", "v0.2 assessment is not final review eligible")
    require(assessment.get("decision") == "canonical_human_succession_recognition_may_be_requested", "v0.2 assessment does not permit final recognition request")
    require(isinstance(assessment.get("candidate_id"), str) and assessment["candidate_id"], "invalid candidate_id")
    claims = assessment.get("claims") or {}
    for key in ["automatic_authority_progression", "authority_granted_by_assessment", "canonical_successor_established", "canonical_origin_mutated", "canonical_publication_executed", "ownership_transferred", "kontur_activated", "global_replay_prevention_established", "legal_identity_certified", "psychological_fitness_certified", "universal_trust_established"]:
        require(claims.get(key) is False, f"unsafe v0.2 assessment claim: {key}")


def disposition_claims(acknowledged: bool) -> dict[str, Any]:
    return {
        "disposition_recorded": True,
        "predecessor_acknowledgement_recorded": acknowledged,
        "protocol_unavailability_only": not acknowledged,
        "legal_incapacity_certified": False,
        "medical_incapacity_certified": False,
        "death_certified": False,
        "ownership_waived": False,
        "canonical_successor_established": False,
        "kontur_activated": False,
    }


def build_acknowledged_disposition(
    assessment: dict[str, Any], policy: dict[str, Any], predecessor_steward_id: str,
    evidence_sha256: str, at: str, confirmation_token: str = ACK_TOKEN,
) -> dict[str, Any]:
    validate_policy(policy)
    validate_v02_assessment(assessment, policy)
    require(predecessor_steward_id and predecessor_steward_id != assessment["candidate_id"], "predecessor must differ from candidate")
    require(HEX64_RE.fullmatch(evidence_sha256 or "") is not None, "invalid acknowledgement evidence digest")
    require(confirmation_token == ACK_TOKEN, "predecessor acknowledgement token mismatch")
    now = parse_time(at)
    result = {
        "artifact_type": "CHSPPredecessorDisposition",
        "artifact_version": "0.3",
        "disposition_id": "urn:uu-aap:chsp:predecessor-disposition:" + sha256_json({"assessment": assessment["assessment_sha256"], "predecessor": predecessor_steward_id, "at": iso_z(now)})[:24],
        "project_id": policy["project_id"],
        "candidate_id": assessment["candidate_id"],
        "predecessor_steward_id": predecessor_steward_id,
        "v02_transition_assessment_sha256": assessment["assessment_sha256"],
        "mode": "acknowledged",
        "recorded_at": iso_z(now),
        "acknowledged_by_human_id": predecessor_steward_id,
        "acknowledgement_evidence_sha256": evidence_sha256,
        "confirmation_token": confirmation_token,
        "unavailability_attestations": [],
        "disposition_sha256": "0" * 64,
        "claims": disposition_claims(True),
    }
    result["disposition_sha256"] = self_digest(result, "disposition_sha256")
    return result


def build_unavailability_disposition(
    assessment: dict[str, Any], policy: dict[str, Any], predecessor_steward_id: str,
    attestations: list[dict[str, Any]], at: str,
) -> dict[str, Any]:
    validate_policy(policy)
    validate_v02_assessment(assessment, policy)
    require(predecessor_steward_id and predecessor_steward_id != assessment["candidate_id"], "predecessor must differ from candidate")
    now = parse_time(at)
    result = {
        "artifact_type": "CHSPPredecessorDisposition",
        "artifact_version": "0.3",
        "disposition_id": "urn:uu-aap:chsp:predecessor-disposition:" + sha256_json({"assessment": assessment["assessment_sha256"], "predecessor": predecessor_steward_id, "mode": "unavailable", "at": iso_z(now)})[:24],
        "project_id": policy["project_id"],
        "candidate_id": assessment["candidate_id"],
        "predecessor_steward_id": predecessor_steward_id,
        "v02_transition_assessment_sha256": assessment["assessment_sha256"],
        "mode": "protocol_unavailability_attested",
        "recorded_at": iso_z(now),
        "acknowledged_by_human_id": None,
        "acknowledgement_evidence_sha256": None,
        "confirmation_token": None,
        "unavailability_attestations": copy.deepcopy(attestations),
        "disposition_sha256": "0" * 64,
        "claims": disposition_claims(False),
    }
    result["disposition_sha256"] = self_digest(result, "disposition_sha256")
    validate_disposition(result, assessment, policy)
    return result


def validate_disposition(disposition: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_policy(policy)
    validate_v02_assessment(assessment, policy)
    require(disposition.get("artifact_type") == "CHSPPredecessorDisposition", "CHSPPredecessorDisposition required")
    require(disposition.get("artifact_version") == "0.3", "CHSPPredecessorDisposition v0.3 required")
    digest = disposition.get("disposition_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(disposition, "disposition_sha256") == digest, "predecessor disposition self-digest mismatch")
    require(disposition.get("project_id") == policy["project_id"], "disposition project mismatch")
    require(disposition.get("candidate_id") == assessment["candidate_id"], "disposition candidate mismatch")
    require(disposition.get("v02_transition_assessment_sha256") == assessment["assessment_sha256"], "disposition assessment binding mismatch")
    predecessor = disposition.get("predecessor_steward_id")
    require(isinstance(predecessor, str) and predecessor and predecessor != assessment["candidate_id"], "invalid predecessor steward")
    parse_time(disposition["recorded_at"])
    mode = disposition.get("mode")
    claims = disposition.get("claims") or {}
    require(claims.get("disposition_recorded") is True, "disposition must be recorded")
    for key in ["legal_incapacity_certified", "medical_incapacity_certified", "death_certified", "ownership_waived", "canonical_successor_established", "kontur_activated"]:
        require(claims.get(key) is False, f"unsafe disposition claim: {key}")
    if mode == "acknowledged":
        require(disposition.get("acknowledged_by_human_id") == predecessor, "predecessor acknowledgement must be by predecessor")
        require(HEX64_RE.fullmatch(disposition.get("acknowledgement_evidence_sha256") or "") is not None, "acknowledgement evidence required")
        require(disposition.get("confirmation_token") == ACK_TOKEN, "predecessor acknowledgement token mismatch")
        require(disposition.get("unavailability_attestations") == [], "acknowledged disposition cannot contain unavailability attestations")
        require(claims.get("predecessor_acknowledgement_recorded") is True and claims.get("protocol_unavailability_only") is False, "acknowledged claims mismatch")
    elif mode == "protocol_unavailability_attested":
        require(disposition.get("acknowledged_by_human_id") is None and disposition.get("acknowledgement_evidence_sha256") is None and disposition.get("confirmation_token") is None, "unavailability path cannot imply predecessor acknowledgement")
        attestations = disposition.get("unavailability_attestations")
        require(isinstance(attestations, list) and len(attestations) >= policy["minimum_unavailability_attestations"], "insufficient unavailability attestations")
        ids, domains = set(), set()
        for item in attestations:
            require(isinstance(item, dict), "invalid unavailability attestation")
            attestor = item.get("attestor_id")
            domain = item.get("attestor_domain_id")
            require(isinstance(attestor, str) and attestor and attestor not in {assessment["candidate_id"], predecessor}, "invalid unavailability attestor")
            require(isinstance(domain, str) and domain, "invalid unavailability attestor domain")
            require(attestor not in ids, "duplicate unavailability attestor")
            ids.add(attestor); domains.add(domain)
            parse_time(item["observed_at"])
            require(HEX64_RE.fullmatch(item.get("evidence_sha256", "")) is not None, "invalid unavailability evidence digest")
        require(len(domains) >= policy["minimum_unavailability_attestor_domains"], "insufficient unavailability attestor domains")
        require(claims.get("predecessor_acknowledgement_recorded") is False and claims.get("protocol_unavailability_only") is True, "unavailability claims mismatch")
    else:
        raise ValueError("invalid predecessor disposition mode")


def recognition_claims() -> dict[str, Any]:
    return {
        "final_human_recognition_recorded": True,
        "dual_control_consideration_only": True,
        "exclusive_successor_authority": False,
        "canonical_successor_established": False,
        "canonical_publication_authorized": False,
        "ownership_transferred": False,
        "kontur_activated": False,
        "legal_identity_certified": False,
        "universal_trust_established": False,
    }


def issue_final_recognition(
    assessment: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any],
    final_recognizer_id: str, recognizer_evidence_sha256: str, nonce: str,
    state_dir: Path, at: str, confirmation_token: str = FINAL_RECOGNITION_TOKEN,
) -> dict[str, Any]:
    validate_disposition(disposition, assessment, policy)
    candidate = assessment["candidate_id"]
    predecessor = disposition["predecessor_steward_id"]
    require(final_recognizer_id and final_recognizer_id not in {candidate, predecessor}, "final recognizer must differ from candidate and predecessor")
    require(HEX64_RE.fullmatch(recognizer_evidence_sha256 or "") is not None, "invalid final recognizer evidence digest")
    require(len(nonce) >= 16, "final recognition nonce too short")
    require(confirmation_token == FINAL_RECOGNITION_TOKEN, "final recognition typed confirmation mismatch")
    now = parse_time(at)
    reservation = {"artifact_type": "CHSPLocalFinalRecognitionReservation", "artifact_version": "0.3", "candidate_id": candidate, "v02_transition_assessment_sha256": assessment["assessment_sha256"], "reserved_at": iso_z(now), "claims": {"global_replay_prevention_established": False}}
    reserve_once(state_dir, "final-recognized-assessments", assessment["assessment_sha256"], reservation)
    reserve_once(state_dir, "final-recognition-nonces", nonce, reservation)
    result = {
        "artifact_type": "CHSPFinalHumanRecognition",
        "artifact_version": "0.3",
        "recognition_id": "urn:uu-aap:chsp:final-recognition:" + sha256_json({"assessment": assessment["assessment_sha256"], "disposition": disposition["disposition_sha256"], "recognizer": final_recognizer_id, "nonce": nonce})[:24],
        "project_id": policy["project_id"],
        "candidate_id": candidate,
        "predecessor_steward_id": predecessor,
        "v02_transition_assessment_sha256": assessment["assessment_sha256"],
        "predecessor_disposition_sha256": disposition["disposition_sha256"],
        "final_recognizer_id": final_recognizer_id,
        "recognizer_evidence_sha256": recognizer_evidence_sha256,
        "recognized_at": iso_z(now),
        "cooling_period_ends_at": iso_z(now + timedelta(days=policy["minimum_final_cooling_days"])),
        "nonce": nonce,
        "confirmation_token": confirmation_token,
        "recognition_sha256": "0" * 64,
        "claims": recognition_claims(),
    }
    result["recognition_sha256"] = self_digest(result, "recognition_sha256")
    return result


def validate_final_recognition(recognition: dict[str, Any], assessment: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_disposition(disposition, assessment, policy)
    require(recognition.get("artifact_type") == "CHSPFinalHumanRecognition" and recognition.get("artifact_version") == "0.3", "CHSPFinalHumanRecognition v0.3 required")
    digest = recognition.get("recognition_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(recognition, "recognition_sha256") == digest, "final recognition self-digest mismatch")
    require(recognition.get("project_id") == policy["project_id"], "final recognition project mismatch")
    require(recognition.get("candidate_id") == assessment["candidate_id"], "final recognition candidate mismatch")
    require(recognition.get("predecessor_steward_id") == disposition["predecessor_steward_id"], "final recognition predecessor mismatch")
    require(recognition.get("v02_transition_assessment_sha256") == assessment["assessment_sha256"], "final recognition assessment mismatch")
    require(recognition.get("predecessor_disposition_sha256") == disposition["disposition_sha256"], "final recognition disposition mismatch")
    require(recognition.get("final_recognizer_id") not in {recognition["candidate_id"], recognition["predecessor_steward_id"]}, "unsafe final recognizer identity")
    require(HEX64_RE.fullmatch(recognition.get("recognizer_evidence_sha256", "")) is not None, "invalid final recognizer evidence digest")
    require(recognition.get("confirmation_token") == FINAL_RECOGNITION_TOKEN, "final recognition typed confirmation mismatch")
    require(isinstance(recognition.get("nonce"), str) and len(recognition["nonce"]) >= 16, "invalid final recognition nonce")
    start = parse_time(recognition["recognized_at"]); cooling = parse_time(recognition["cooling_period_ends_at"])
    require(cooling >= start + timedelta(days=policy["minimum_final_cooling_days"]), "final cooling period too short")
    claims = recognition.get("claims") or {}
    require(claims.get("final_human_recognition_recorded") is True and claims.get("dual_control_consideration_only") is True, "invalid final recognition scope")
    for key in ["exclusive_successor_authority", "canonical_successor_established", "canonical_publication_authorized", "ownership_transferred", "kontur_activated", "legal_identity_certified", "universal_trust_established"]:
        require(claims.get(key) is False, f"unsafe final recognition claim: {key}")


def validate_final_challenge(challenge: dict[str, Any], recognition: dict[str, Any]) -> None:
    require(challenge.get("artifact_type") == "CHSPFinalChallenge" and challenge.get("artifact_version") == "0.3", "CHSPFinalChallenge v0.3 required")
    digest = challenge.get("challenge_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(challenge, "challenge_sha256") == digest, "final challenge self-digest mismatch")
    require(challenge.get("project_id") == recognition["project_id"] and challenge.get("candidate_id") == recognition["candidate_id"], "final challenge binding mismatch")
    require(challenge.get("final_recognition_sha256") == recognition["recognition_sha256"], "final challenge recognition mismatch")
    require(challenge.get("status") in {"open", "upheld", "rejected", "withdrawn", "resolved_remediated"}, "invalid final challenge status")
    require(HEX64_RE.fullmatch(challenge.get("evidence_sha256", "")) is not None, "invalid final challenge evidence digest")
    if challenge["status"] == "open":
        require(challenge.get("resolution_sha256") is None, "open final challenge cannot have resolution digest")
    else:
        require(HEX64_RE.fullmatch(challenge.get("resolution_sha256") or "") is not None, "resolved final challenge requires resolution digest")
    claims = challenge.get("claims") or {}
    require(claims.get("challenge_recorded") is True and claims.get("progression_blocked_when_open_or_upheld") is True, "final challenge boundary missing")
    require(claims.get("authority_automatically_revoked") is False and claims.get("canonical_successor_established") is False and claims.get("truth_certified") is False, "unsafe final challenge claim")


def handover_claims() -> dict[str, Any]:
    return {
        "bounded_dual_control_recorded": True,
        "nonexclusive": True,
        "revocable": True,
        "appeal_path_preserved": True,
        "recovery_path_preserved": True,
        "external_execution_performed": False,
        "exclusive_successor_authority": False,
        "canonical_successor_established": False,
        "canonical_publication_authorized": False,
        "ownership_transferred": False,
        "account_control_transferred": False,
        "kontur_activated": False,
    }


def validate_handover(handover: dict[str, Any], recognition: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any]) -> None:
    require(handover.get("artifact_type") == "CHSPDualControlHandover" and handover.get("artifact_version") == "0.3", "CHSPDualControlHandover v0.3 required")
    digest = handover.get("handover_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(handover, "handover_sha256") == digest, "handover self-digest mismatch")
    require(handover.get("project_id") == policy["project_id"] and handover.get("candidate_id") == recognition["candidate_id"], "handover binding mismatch")
    require(handover.get("predecessor_steward_id") == disposition["predecessor_steward_id"], "handover predecessor mismatch")
    require(handover.get("final_recognition_sha256") == recognition["recognition_sha256"] and handover.get("predecessor_disposition_sha256") == disposition["disposition_sha256"], "handover causal binding mismatch")
    expected_mode = "predecessor_participating" if disposition["mode"] == "acknowledged" else "predecessor_protocol_unavailability_alternative"
    require(handover.get("participation_mode") == expected_mode, "handover participation mode mismatch")
    scopes = handover.get("scopes")
    require(isinstance(scopes, list) and scopes and len(scopes) == len(set(scopes)), "invalid handover scopes")
    require(set(scopes).issubset(set(policy["allowed_handover_scopes"])), "handover scope is not permitted")
    authorizer = handover.get("authorized_by_human_id")
    require(isinstance(authorizer, str) and authorizer and authorizer not in {recognition["candidate_id"], recognition["final_recognizer_id"]}, "handover authorizer must differ from candidate and final recognizer")
    if disposition["mode"] == "protocol_unavailability_attested":
        require(authorizer != disposition["predecessor_steward_id"], "unavailable predecessor cannot authorize handover")
    require(HEX64_RE.fullmatch(handover.get("authorization_evidence_sha256", "")) is not None, "invalid handover authorization evidence digest")
    require(isinstance(handover.get("nonce"), str) and len(handover["nonce"]) >= 16, "invalid handover nonce")
    start = parse_time(handover["window_started_at"]); end = parse_time(handover["window_ends_at"])
    require(end > start, "handover window must be positive")
    duration = end - start
    require(duration >= timedelta(days=policy["minimum_dual_control_days"]), "handover window shorter than minimum dual-control interval")
    require(duration <= timedelta(days=policy["maximum_handover_days"]), "handover window exceeds maximum")
    claims = handover.get("claims") or {}
    for key in ["bounded_dual_control_recorded", "nonexclusive", "revocable", "appeal_path_preserved", "recovery_path_preserved"]:
        require(claims.get(key) is True, f"missing handover safeguard: {key}")
    for key in ["external_execution_performed", "exclusive_successor_authority", "canonical_successor_established", "canonical_publication_authorized", "ownership_transferred", "account_control_transferred", "kontur_activated"]:
        require(claims.get(key) is False, f"unsafe handover claim: {key}")


def outcome_claims() -> dict[str, Any]:
    return {"outcome_recorded": True, "positive_outcome_is_review_evidence_only": True, "canonical_successor_established": False, "ownership_transferred": False, "canonical_publication_executed": False, "kontur_activated": False, "truth_certified": False}


def issue_handover(
    assessment: dict[str, Any], disposition: dict[str, Any], recognition: dict[str, Any],
    policy: dict[str, Any], challenges: list[dict[str, Any]], scopes: list[str],
    authorizer_id: str, authorization_evidence_sha256: str, nonce: str,
    state_dir: Path, at: str, window_ends_at: str,
) -> dict[str, Any]:
    transition = assess_final_transition(assessment, disposition, recognition, policy, challenges, None, [], at)
    require(transition["state"] == "dual_control_handover_eligible", f"handover cannot be issued from state {transition['state']}")
    start = parse_time(at); end = parse_time(window_ends_at)
    result = {
        "artifact_type": "CHSPDualControlHandover",
        "artifact_version": "0.3",
        "handover_id": "urn:uu-aap:chsp:dual-control-handover:" + sha256_json({"recognition": recognition["recognition_sha256"], "nonce": nonce, "at": iso_z(start)})[:24],
        "project_id": policy["project_id"],
        "candidate_id": recognition["candidate_id"],
        "predecessor_steward_id": disposition["predecessor_steward_id"],
        "final_recognition_sha256": recognition["recognition_sha256"],
        "predecessor_disposition_sha256": disposition["disposition_sha256"],
        "participation_mode": "predecessor_participating" if disposition["mode"] == "acknowledged" else "predecessor_protocol_unavailability_alternative",
        "scopes": scopes,
        "authorized_by_human_id": authorizer_id,
        "authorization_evidence_sha256": authorization_evidence_sha256,
        "window_started_at": iso_z(start),
        "window_ends_at": iso_z(end),
        "nonce": nonce,
        "handover_sha256": "0" * 64,
        "claims": handover_claims(),
    }
    result["handover_sha256"] = self_digest(result, "handover_sha256")
    validate_handover(result, recognition, disposition, policy)
    reservation = {"artifact_type": "CHSPLocalHandoverReservation", "artifact_version": "0.3", "recognition_sha256": recognition["recognition_sha256"], "reserved_at": iso_z(start), "claims": {"global_replay_prevention_established": False}}
    reserve_once(state_dir, "dual-control-handovers", recognition["recognition_sha256"], reservation)
    reserve_once(state_dir, "dual-control-handover-nonces", nonce, reservation)
    return result


def record_handover_outcome(
    handover: dict[str, Any], recognition: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any],
    result: str, recorder_id: str, evidence_sha256: str, at: str,
) -> dict[str, Any]:
    validate_handover(handover, recognition, disposition, policy)
    require(result in {"positive", "adverse", "indeterminate", "revoked"}, "invalid handover outcome")
    require(recorder_id and recorder_id != recognition["candidate_id"], "candidate cannot solely record own handover outcome")
    require(HEX64_RE.fullmatch(evidence_sha256 or "") is not None, "invalid handover outcome evidence digest")
    recorded = parse_time(at); started = parse_time(handover["window_started_at"])
    if result == "positive":
        require(recorded >= started + timedelta(days=policy["minimum_dual_control_days"]), "positive handover outcome before minimum dual-control observation")
    value = {
        "artifact_type": "CHSPHandoverOutcome", "artifact_version": "0.3",
        "outcome_id": "urn:uu-aap:chsp:handover-outcome:" + sha256_json({"handover": handover["handover_sha256"], "result": result, "at": iso_z(recorded)})[:24],
        "project_id": policy["project_id"], "candidate_id": recognition["candidate_id"],
        "handover_sha256": handover["handover_sha256"], "result": result,
        "recorded_by_human_id": recorder_id, "evidence_sha256": evidence_sha256,
        "recorded_at": iso_z(recorded), "outcome_sha256": "0" * 64, "claims": outcome_claims(),
    }
    value["outcome_sha256"] = self_digest(value, "outcome_sha256")
    return value


def validate_outcome(outcome: dict[str, Any], handover: dict[str, Any], recognition: dict[str, Any], disposition: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_handover(handover, recognition, disposition, policy)
    require(outcome.get("artifact_type") == "CHSPHandoverOutcome" and outcome.get("artifact_version") == "0.3", "CHSPHandoverOutcome v0.3 required")
    digest = outcome.get("outcome_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None and self_digest(outcome, "outcome_sha256") == digest, "handover outcome self-digest mismatch")
    require(outcome.get("project_id") == policy["project_id"] and outcome.get("candidate_id") == recognition["candidate_id"], "handover outcome binding mismatch")
    require(outcome.get("handover_sha256") == handover["handover_sha256"], "handover outcome causal binding mismatch")
    require(outcome.get("result") in {"positive", "adverse", "indeterminate", "revoked"}, "invalid handover outcome result")
    require(outcome.get("recorded_by_human_id") != recognition["candidate_id"], "candidate cannot solely record own handover outcome")
    require(HEX64_RE.fullmatch(outcome.get("evidence_sha256", "")) is not None, "invalid outcome evidence digest")
    recorded = parse_time(outcome["recorded_at"]); started = parse_time(handover["window_started_at"])
    if outcome["result"] == "positive":
        require(recorded >= started + timedelta(days=policy["minimum_dual_control_days"]), "positive handover outcome before minimum dual-control observation")
    claims = outcome.get("claims") or {}
    require(claims.get("outcome_recorded") is True and claims.get("positive_outcome_is_review_evidence_only") is True, "invalid handover outcome scope")
    for key in ["canonical_successor_established", "ownership_transferred", "canonical_publication_executed", "kontur_activated", "truth_certified"]:
        require(claims.get(key) is False, f"unsafe handover outcome claim: {key}")


def assessment_claims() -> dict[str, Any]:
    return {
        "policy_sufficiency_only": True, "automatic_stewardship_transfer": False,
        "exclusive_successor_authority": False, "canonical_successor_established": False,
        "canonical_origin_mutated": False, "canonical_publication_executed": False,
        "ownership_transferred": False, "account_control_transferred": False,
        "kontur_activated": False, "legal_incapacity_certified": False,
        "medical_incapacity_certified": False, "distributed_consensus_established": False,
        "universal_trust_established": False,
    }


def assess_final_transition(
    assessment: dict[str, Any], disposition: dict[str, Any], recognition: dict[str, Any],
    policy: dict[str, Any], challenges: list[dict[str, Any]], handover: dict[str, Any] | None,
    outcomes: list[dict[str, Any]], at: str,
) -> dict[str, Any]:
    now = parse_time(at)
    reasons: list[str] = []
    valid = True
    try:
        validate_final_recognition(recognition, assessment, disposition, policy)
    except Exception as exc:
        valid = False; reasons.append(str(exc))
    mode = disposition.get("mode") if isinstance(disposition, dict) else "acknowledged"
    attestations = disposition.get("unavailability_attestations", []) if isinstance(disposition, dict) else []
    domains = {x.get("attestor_domain_id") for x in attestations if isinstance(x, dict) and x.get("attestor_domain_id")}
    blocking = 0; resolved = 0
    for challenge in challenges:
        try:
            validate_final_challenge(challenge, recognition)
            if challenge["status"] in {"open", "upheld"}: blocking += 1
            else: resolved += 1
        except Exception as exc:
            blocking += 1; reasons.append(f"invalid final challenge: {exc}")
    cooling_complete = False
    if valid:
        cooling_complete = now >= parse_time(recognition["cooling_period_ends_at"])
    state = "final_recognition_invalid"; decision = "reject_final_recognition"
    outcome_result = "none"; window_days = 0
    if valid:
        if not cooling_complete:
            state = "final_cooling_active"; decision = "wait_for_final_cooling"
        elif blocking:
            state = "final_challenge_blocked"; decision = "resolve_final_challenge"
        elif handover is None:
            state = "dual_control_handover_eligible"; decision = "dual_control_handover_may_be_requested"
        else:
            try:
                validate_handover(handover, recognition, disposition, policy)
                start = parse_time(handover["window_started_at"]); end = parse_time(handover["window_ends_at"])
                window_days = max(0, (end - start).days)
                if len(outcomes) > 1:
                    raise ValueError("multiple handover outcomes are ambiguous")
                if not outcomes:
                    if now > end:
                        state = "handover_reset_required"; decision = "return_to_prior_stewardship_state_or_new_human_review"; reasons.append("handover expired without outcome")
                    else:
                        state = "dual_control_active"; decision = "no_finalization_while_dual_control_active"
                else:
                    validate_outcome(outcomes[0], handover, recognition, disposition, policy)
                    outcome_result = outcomes[0]["result"]
                    if outcome_result == "positive":
                        state = "canonical_stewardship_handover_review_eligible"; decision = "canonical_stewardship_handover_may_be_requested"
                    else:
                        state = "handover_reset_required"; decision = "return_to_prior_stewardship_state_or_new_human_review"; reasons.append(f"handover outcome is {outcome_result}")
            except Exception as exc:
                state = "handover_reset_required"; decision = "return_to_prior_stewardship_state_or_new_human_review"; reasons.append(str(exc))
    result = {
        "artifact_type": "CHSPFinalHandoverAssessment", "artifact_version": "0.3",
        "assessment_id": "urn:uu-aap:chsp:final-handover-assessment:" + sha256_json({"candidate": assessment.get("candidate_id"), "at": iso_z(now), "recognition": recognition.get("recognition_sha256")})[:24],
        "evaluated_at": iso_z(now), "project_id": policy.get("project_id", ""), "candidate_id": assessment.get("candidate_id", ""),
        "v02_transition_assessment_sha256": assessment.get("assessment_sha256", "0" * 64),
        "predecessor_disposition_sha256": disposition.get("disposition_sha256", "0" * 64),
        "final_recognition_sha256": recognition.get("recognition_sha256", "0" * 64),
        "policy_sha256": sha256_json(policy), "challenge_set_sha256": artifact_set_sha(challenges, "challenge_sha256") if challenges else sha256_json([]),
        "handover_sha256": handover.get("handover_sha256") if isinstance(handover, dict) else None,
        "outcome_sha256": outcomes[0].get("outcome_sha256") if len(outcomes) == 1 else None,
        "state": state, "decision": decision,
        "metrics": {
            "final_cooling_complete": cooling_complete, "blocking_challenges": blocking, "resolved_challenges": resolved,
            "predecessor_disposition_mode": mode if mode in {"acknowledged", "protocol_unavailability_attested"} else "acknowledged",
            "unavailability_attestations": len(attestations), "unavailability_attestor_domains": len(domains),
            "handover_present": handover is not None, "handover_window_days": window_days, "handover_outcome": outcome_result,
        },
        "reasons": reasons, "assessment_sha256": "0" * 64, "claims": assessment_claims(),
    }
    result["assessment_sha256"] = self_digest(result, "assessment_sha256")
    return result
