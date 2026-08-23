#!/usr/bin/env python3
"""CHSP v0.2 local-only recognition and progressive-authority tooling.

The module records local human-governance artifacts and assesses their causal
bindings. It performs no network, Git, account, publication, ownership, or
KONTUR action.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
CONFIRMATION_TOKEN = "RECOGNIZE_CHSP_SUCCESSOR_CANDIDATE_FOR_PROGRESSIVE_AUTHORITY_ONLY"
STAGES = [
    "A1_advisory",
    "A2_reversible_limited",
    "A3_supervised_stewardship",
    "A4_canonical_preparation",
]


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
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def artifact_set_sha(items: list[dict[str, Any]], digest_field: str) -> str:
    digests: list[str] = []
    for item in items:
        digest = item.get(digest_field, "")
        require(HEX64_RE.fullmatch(digest) is not None, f"invalid {digest_field} in artifact set")
        digests.append(digest)
    return sha256_json(sorted(digests))


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPRecognitionPolicy", "CHSPRecognitionPolicy required")
    require(policy.get("artifact_version") == "0.2", "CHSPRecognitionPolicy v0.2 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    require(policy.get("stage_order") == STAGES, "unexpected CHSP stage order")
    for key in ["minimum_cooling_days", "minimum_challenge_window_days", "minimum_stage_observation_days", "maximum_envelope_days"]:
        require(isinstance(policy.get(key), int) and policy[key] > 0, f"invalid policy threshold: {key}")
    scopes = policy.get("stage_scopes") or {}
    for stage in STAGES:
        require(isinstance(scopes.get(stage), list) and scopes[stage], f"missing scopes for {stage}")
        require(len(scopes[stage]) == len(set(scopes[stage])), f"duplicate scopes for {stage}")
    require(policy.get("higher_stage_independent_authorizer_from") == "A3_supervised_stewardship", "unexpected higher-stage independence boundary")
    req = policy.get("requirements") or {}
    for key in [
        "v01_succession_eligibility_required", "recognizer_distinct_from_candidate",
        "recognizer_evidence_digest_required", "typed_confirmation_required", "cooling_period_required",
        "challenge_window_required", "open_or_upheld_challenge_blocks_progression",
        "candidate_cannot_self_authorize", "stage_progression_must_be_sequential",
        "completed_positive_predecessor_required", "envelope_must_expire", "envelope_must_be_revocable",
    ]:
        require(req.get(key) is True, f"unsafe policy requirement: {key}")
    require(req.get("automatic_authority_progression") is False, "automatic authority progression must remain false")
    require(req.get("automatic_canonical_recognition") is False, "automatic canonical recognition must remain false")
    claims = policy.get("claims") or {}
    require(claims.get("descriptive_policy_only") is True, "policy must remain descriptive")
    for key in ["canonical_successor_established", "canonical_publication_authorized", "ownership_transferred", "kontur_activated", "universal_trust_established"]:
        require(claims.get(key) is False, f"unsafe policy claim: {key}")


def validate_v01_assessment(assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    require(assessment.get("artifact_type") == "CHSPAssessment", "CHSPAssessment v0.1 required")
    require(assessment.get("artifact_version") == "0.1", "CHSPAssessment v0.1 required")
    require(assessment.get("project_id") == policy.get("project_id"), "v0.1 assessment project mismatch")
    digest = assessment.get("assessment_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid v0.1 assessment digest")
    require(self_digest(assessment, "assessment_sha256") == digest, "v0.1 assessment self-digest mismatch")
    require(assessment.get("state") == "succession_eligible", "v0.1 assessment is not succession_eligible")
    require(assessment.get("decision") == "human_successor_recognition_may_be_requested", "v0.1 assessment does not permit recognition request")
    require(isinstance(assessment.get("candidate_id"), str) and assessment["candidate_id"], "invalid v0.1 candidate_id")
    claims = assessment.get("claims") or {}
    require(claims.get("automatic_authority_progression") is False, "unsafe v0.1 authority progression claim")
    for key in ["canonical_successor_established", "ownership_transferred", "kontur_activated", "legal_identity_certified", "psychological_fitness_certified", "universal_trust_established"]:
        require(claims.get(key) is False, f"unsafe v0.1 claim: {key}")


def recognition_claims() -> dict[str, Any]:
    return {
        "human_recognition_recorded": True,
        "progressive_authority_consideration_only": True,
        "authority_granted": False,
        "canonical_successor_established": False,
        "canonical_publication_authorized": False,
        "ownership_transferred": False,
        "kontur_activated": False,
        "legal_identity_certified": False,
        "psychological_fitness_certified": False,
        "universal_trust_established": False,
    }


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


def issue_recognition(
    assessment: dict[str, Any], policy: dict[str, Any], recognizer_id: str,
    recognizer_evidence_sha256: str, nonce: str, confirmation_token: str,
    state_dir: Path, at: str | None = None,
) -> dict[str, Any]:
    validate_policy(policy)
    validate_v01_assessment(assessment, policy)
    candidate_id = assessment["candidate_id"]
    require(recognizer_id and recognizer_id != candidate_id, "recognizer must be distinct from candidate")
    require(HEX64_RE.fullmatch(recognizer_evidence_sha256 or "") is not None, "invalid recognizer evidence digest")
    require(len(nonce) >= 16, "recognition nonce too short")
    require(confirmation_token == CONFIRMATION_TOKEN, "typed confirmation token mismatch")
    now = parse_time(at) if at else datetime.now(timezone.utc)
    assessment_sha = assessment["assessment_sha256"]
    reservation = {
        "artifact_type": "CHSPLocalRecognitionReservation",
        "artifact_version": "0.2",
        "candidate_id": candidate_id,
        "v01_assessment_sha256": assessment_sha,
        "recognizer_id": recognizer_id,
        "reserved_at": iso_z(now),
        "claims": {"global_replay_prevention_established": False},
    }
    # Fail-closed: a partial reservation intentionally remains consumed.
    reserve_once(state_dir, "recognized-assessments", assessment_sha, reservation)
    reserve_once(state_dir, "recognition-nonces", nonce, reservation)
    recognition = {
        "artifact_type": "CHSPHumanRecognition",
        "artifact_version": "0.2",
        "recognition_id": "urn:uu-aap:chsp:recognition:" + sha256_json({
            "assessment": assessment_sha, "recognizer": recognizer_id, "nonce": nonce, "at": iso_z(now)
        })[:24],
        "project_id": policy["project_id"],
        "candidate_id": candidate_id,
        "v01_assessment_sha256": assessment_sha,
        "recognizer_id": recognizer_id,
        "recognizer_evidence_sha256": recognizer_evidence_sha256,
        "recognized_at": iso_z(now),
        "cooling_period_ends_at": iso_z(now + timedelta(days=policy["minimum_cooling_days"])),
        "challenge_window_ends_at": iso_z(now + timedelta(days=policy["minimum_challenge_window_days"])),
        "nonce": nonce,
        "confirmation_token": confirmation_token,
        "recognition_sha256": "0" * 64,
        "claims": recognition_claims(),
    }
    recognition["recognition_sha256"] = self_digest(recognition, "recognition_sha256")
    return recognition


def validate_recognition(recognition: dict[str, Any], assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_policy(policy)
    validate_v01_assessment(assessment, policy)
    require(recognition.get("artifact_type") == "CHSPHumanRecognition", "CHSPHumanRecognition required")
    require(recognition.get("artifact_version") == "0.2", "CHSPHumanRecognition v0.2 required")
    digest = recognition.get("recognition_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid recognition digest")
    require(self_digest(recognition, "recognition_sha256") == digest, "recognition self-digest mismatch")
    require(recognition.get("project_id") == policy["project_id"], "recognition project mismatch")
    require(recognition.get("candidate_id") == assessment["candidate_id"], "recognition candidate mismatch")
    require(recognition.get("v01_assessment_sha256") == assessment["assessment_sha256"], "recognition assessment binding mismatch")
    require(recognition.get("recognizer_id") != recognition.get("candidate_id"), "candidate cannot recognize self")
    require(HEX64_RE.fullmatch(recognition.get("recognizer_evidence_sha256", "")) is not None, "invalid recognizer evidence digest")
    require(recognition.get("confirmation_token") == CONFIRMATION_TOKEN, "recognition typed confirmation mismatch")
    require(isinstance(recognition.get("nonce"), str) and len(recognition["nonce"]) >= 16, "invalid recognition nonce")
    start = parse_time(recognition["recognized_at"])
    cooling = parse_time(recognition["cooling_period_ends_at"])
    challenge_end = parse_time(recognition["challenge_window_ends_at"])
    require(cooling >= start + timedelta(days=policy["minimum_cooling_days"]), "cooling period too short")
    require(challenge_end >= start + timedelta(days=policy["minimum_challenge_window_days"]), "challenge window too short")
    claims = recognition.get("claims") or {}
    require(claims.get("human_recognition_recorded") is True, "recognition decision not recorded")
    require(claims.get("progressive_authority_consideration_only") is True, "recognition scope is unsafe")
    for key in ["authority_granted", "canonical_successor_established", "canonical_publication_authorized", "ownership_transferred", "kontur_activated", "legal_identity_certified", "psychological_fitness_certified", "universal_trust_established"]:
        require(claims.get(key) is False, f"unsafe recognition claim: {key}")


def validate_challenge(challenge: dict[str, Any], recognition: dict[str, Any]) -> None:
    require(challenge.get("artifact_type") == "CHSPChallenge", "CHSPChallenge required")
    require(challenge.get("artifact_version") == "0.2", "CHSPChallenge v0.2 required")
    digest = challenge.get("challenge_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid challenge digest")
    require(self_digest(challenge, "challenge_sha256") == digest, "challenge self-digest mismatch")
    require(challenge.get("project_id") == recognition.get("project_id"), "challenge project mismatch")
    require(challenge.get("candidate_id") == recognition.get("candidate_id"), "challenge candidate mismatch")
    require(challenge.get("recognition_sha256") == recognition.get("recognition_sha256"), "challenge recognition binding mismatch")
    require(isinstance(challenge.get("challenger_id"), str) and challenge["challenger_id"], "invalid challenger_id")
    require(isinstance(challenge.get("challenger_domain_id"), str) and challenge["challenger_domain_id"], "invalid challenger_domain_id")
    require(challenge.get("category") in {"protocol_boundary", "conflict_of_interest", "evidence_integrity", "process_integrity", "stewardship_concern", "authority_scope", "other"}, "invalid challenge category")
    status = challenge.get("status")
    require(status in {"open", "upheld", "rejected", "withdrawn", "resolved_remediated"}, "invalid challenge status")
    require(HEX64_RE.fullmatch(challenge.get("evidence_sha256", "")) is not None, "invalid challenge evidence digest")
    if status == "open":
        require(challenge.get("resolution_sha256") is None, "open challenge cannot have resolution digest")
    else:
        require(HEX64_RE.fullmatch(challenge.get("resolution_sha256", "")) is not None, "resolved challenge requires resolution digest")
    claims = challenge.get("claims") or {}
    require(claims.get("challenge_recorded") is True, "challenge not recorded")
    require(claims.get("progression_blocked_when_open_or_upheld") is True, "challenge must block progression when open/upheld")
    require(claims.get("authority_automatically_revoked") is False, "challenge cannot auto-revoke authority")
    require(claims.get("canonical_successor_established") is False, "challenge cannot establish successor")
    require(claims.get("truth_certified") is False, "challenge cannot certify truth")


def envelope_claims() -> dict[str, Any]:
    return {
        "bounded_human_authorization_recorded": True,
        "revocable": True,
        "authority_bound_to_envelope": True,
        "external_execution_performed": False,
        "automatic_stage_progression": False,
        "canonical_authority_granted": False,
        "canonical_successor_established": False,
        "canonical_publication_authorized": False,
        "ownership_transferred": False,
        "kontur_activated": False,
    }


def validate_envelope(
    envelope: dict[str, Any], recognition: dict[str, Any], policy: dict[str, Any],
    predecessor: dict[str, Any] | None = None, predecessor_outcome: dict[str, Any] | None = None,
) -> None:
    require(envelope.get("artifact_type") == "CHSPProgressiveAuthorityEnvelope", "CHSPProgressiveAuthorityEnvelope required")
    require(envelope.get("artifact_version") == "0.2", "CHSPProgressiveAuthorityEnvelope v0.2 required")
    digest = envelope.get("envelope_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid envelope digest")
    require(self_digest(envelope, "envelope_sha256") == digest, "envelope self-digest mismatch")
    require(envelope.get("project_id") == recognition.get("project_id") == policy.get("project_id"), "envelope project mismatch")
    require(envelope.get("candidate_id") == recognition.get("candidate_id"), "envelope candidate mismatch")
    require(envelope.get("recognition_sha256") == recognition.get("recognition_sha256"), "envelope recognition binding mismatch")
    stage = envelope.get("stage")
    require(stage in STAGES, "invalid authority stage")
    stage_index = STAGES.index(stage)
    scopes = envelope.get("scopes")
    require(isinstance(scopes, list) and scopes and len(scopes) == len(set(scopes)), "invalid envelope scopes")
    allowed = set((policy.get("stage_scopes") or {}).get(stage, []))
    require(set(scopes).issubset(allowed), "scope is not permitted for authority stage")
    authorizer = envelope.get("authorized_by_human_id")
    require(isinstance(authorizer, str) and authorizer and authorizer != recognition.get("candidate_id"), "candidate cannot self-authorize")
    if stage_index >= STAGES.index(policy["higher_stage_independent_authorizer_from"]):
        require(authorizer != recognition.get("recognizer_id"), "A3/A4 authorizer must be distinct from original recognizer")
    require(HEX64_RE.fullmatch(envelope.get("authorization_evidence_sha256", "")) is not None, "invalid authorization evidence digest")
    issued = parse_time(envelope["issued_at"])
    expires = parse_time(envelope["expires_at"])
    require(expires > issued, "envelope must expire after issue")
    require(expires <= issued + timedelta(days=policy["maximum_envelope_days"]), "envelope duration exceeds policy")
    gate = max(parse_time(recognition["cooling_period_ends_at"]), parse_time(recognition["challenge_window_ends_at"]))
    require(issued >= gate, "envelope issued before cooling/challenge gates completed")
    require(isinstance(envelope.get("nonce"), str) and len(envelope["nonce"]) >= 16, "invalid envelope nonce")
    if stage_index == 0:
        require(envelope.get("predecessor_envelope_sha256") is None, "A1 cannot bind predecessor envelope")
        require(envelope.get("predecessor_outcome_sha256") is None, "A1 cannot bind predecessor outcome")
    else:
        require(predecessor is not None and predecessor_outcome is not None, "higher stage requires predecessor envelope and outcome")
        require(predecessor.get("stage") == STAGES[stage_index - 1], "authority stages cannot be skipped")
        require(envelope.get("predecessor_envelope_sha256") == predecessor.get("envelope_sha256"), "predecessor envelope binding mismatch")
        require(envelope.get("predecessor_outcome_sha256") == predecessor_outcome.get("outcome_sha256"), "predecessor outcome binding mismatch")
        require(predecessor_outcome.get("result") == "positive", "higher stage requires positive predecessor outcome")
    claims = envelope.get("claims") or {}
    for key in ["bounded_human_authorization_recorded", "revocable", "authority_bound_to_envelope"]:
        require(claims.get(key) is True, f"required envelope claim missing: {key}")
    for key in ["external_execution_performed", "automatic_stage_progression", "canonical_authority_granted", "canonical_successor_established", "canonical_publication_authorized", "ownership_transferred", "kontur_activated"]:
        require(claims.get(key) is False, f"unsafe envelope claim: {key}")


def validate_outcome(outcome: dict[str, Any], envelope: dict[str, Any], recognition: dict[str, Any], policy: dict[str, Any]) -> None:
    require(outcome.get("artifact_type") == "CHSPAuthorityOutcome", "CHSPAuthorityOutcome required")
    require(outcome.get("artifact_version") == "0.2", "CHSPAuthorityOutcome v0.2 required")
    digest = outcome.get("outcome_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid outcome digest")
    require(self_digest(outcome, "outcome_sha256") == digest, "outcome self-digest mismatch")
    require(outcome.get("project_id") == recognition.get("project_id"), "outcome project mismatch")
    require(outcome.get("candidate_id") == recognition.get("candidate_id"), "outcome candidate mismatch")
    require(outcome.get("recognition_sha256") == recognition.get("recognition_sha256"), "outcome recognition mismatch")
    require(outcome.get("envelope_sha256") == envelope.get("envelope_sha256"), "outcome envelope binding mismatch")
    require(outcome.get("stage") == envelope.get("stage"), "outcome stage mismatch")
    require(outcome.get("recorded_by_human_id") != recognition.get("candidate_id"), "candidate cannot self-record stage outcome")
    require(outcome.get("result") in {"positive", "adverse", "indeterminate", "revoked"}, "invalid outcome result")
    require(HEX64_RE.fullmatch(outcome.get("evidence_sha256", "")) is not None, "invalid outcome evidence digest")
    recorded = parse_time(outcome["recorded_at"])
    issued = parse_time(envelope["issued_at"])
    expires = parse_time(envelope["expires_at"])
    require(recorded >= issued, "outcome precedes envelope")
    require(recorded <= expires, "outcome recorded after envelope expiry")
    if outcome.get("result") == "positive":
        require(recorded >= issued + timedelta(days=policy["minimum_stage_observation_days"]), "positive outcome recorded before minimum stage observation")
    claims = outcome.get("claims") or {}
    require(claims.get("outcome_recorded") is True, "outcome not recorded")
    require(claims.get("historical_envelope_mutated") is False, "outcome cannot mutate historical envelope")
    require(claims.get("authority_automatically_extended") is False, "outcome cannot extend authority automatically")
    require(claims.get("canonical_successor_established") is False, "outcome cannot establish successor")
    require(claims.get("truth_certified") is False, "outcome cannot certify truth")


def outcome_claims() -> dict[str, Any]:
    return {
        "outcome_recorded": True,
        "historical_envelope_mutated": False,
        "authority_automatically_extended": False,
        "canonical_successor_established": False,
        "truth_certified": False,
    }


def transition_claims() -> dict[str, Any]:
    return {
        "policy_sufficiency_only": True,
        "automatic_authority_progression": False,
        "authority_granted_by_assessment": False,
        "canonical_successor_established": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "ownership_transferred": False,
        "kontur_activated": False,
        "global_replay_prevention_established": False,
        "legal_identity_certified": False,
        "psychological_fitness_certified": False,
        "universal_trust_established": False,
    }


def assess_transition(
    assessment: dict[str, Any], recognition: dict[str, Any], policy: dict[str, Any],
    challenges: list[dict[str, Any]], envelopes: list[dict[str, Any]], outcomes: list[dict[str, Any]],
    at: str | None = None,
) -> dict[str, Any]:
    validate_policy(policy)
    now = parse_time(at) if at else datetime.now(timezone.utc)
    reasons: list[str] = []
    state = "recognition_invalid"
    decision = "reject_recognition"

    try:
        validate_recognition(recognition, assessment, policy)
        recognition_valid = True
    except Exception as exc:
        recognition_valid = False
        reasons.append(str(exc))

    blocking_challenges = 0
    resolved_challenges = 0
    challenge_valid = True
    if recognition_valid:
        for challenge in challenges:
            try:
                validate_challenge(challenge, recognition)
                if challenge["status"] in {"open", "upheld"}:
                    blocking_challenges += 1
                elif challenge["status"] == "resolved_remediated":
                    resolved_challenges += 1
            except Exception as exc:
                challenge_valid = False
                blocking_challenges += 1
                reasons.append("invalid challenge artifact: " + str(exc))

    cooling_complete = False
    challenge_window_complete = False
    if recognition_valid:
        cooling_complete = now >= parse_time(recognition["cooling_period_ends_at"])
        challenge_window_complete = now >= parse_time(recognition["challenge_window_ends_at"])

    sorted_envelopes = sorted(envelopes, key=lambda e: STAGES.index(e.get("stage")) if e.get("stage") in STAGES else 999)
    envelope_valid = True
    latest_stage = "none"
    latest_effective_state = "none"
    latest_outcome = "none"
    completed_positive = 0
    outcome_by_envelope: dict[str, dict[str, Any]] = {}

    if recognition_valid:
        for outcome in outcomes:
            key = outcome.get("envelope_sha256", "")
            if key in outcome_by_envelope:
                envelope_valid = False
                reasons.append("multiple outcomes recorded for one envelope")
            else:
                outcome_by_envelope[key] = outcome
        if len(sorted_envelopes) != len({e.get("stage") for e in sorted_envelopes}):
            envelope_valid = False
            reasons.append("multiple envelopes for one authority stage")
        for index, envelope in enumerate(sorted_envelopes):
            try:
                require(index < len(STAGES) and envelope.get("stage") == STAGES[index], "authority envelope chain must start at A1 and remain sequential")
                predecessor = sorted_envelopes[index - 1] if index > 0 else None
                predecessor_outcome = outcome_by_envelope.get(predecessor.get("envelope_sha256")) if predecessor else None
                validate_envelope(envelope, recognition, policy, predecessor, predecessor_outcome)
                bound_outcome = outcome_by_envelope.get(envelope["envelope_sha256"])
                if bound_outcome:
                    validate_outcome(bound_outcome, envelope, recognition, policy)
                    if bound_outcome["result"] == "positive":
                        completed_positive += 1
            except Exception as exc:
                envelope_valid = False
                reasons.append("invalid authority chain: " + str(exc))

    if recognition_valid and envelope_valid:
        envelope_digests = {e["envelope_sha256"] for e in sorted_envelopes}
        for outcome in outcomes:
            if outcome.get("envelope_sha256") not in envelope_digests:
                envelope_valid = False
                reasons.append("outcome references unknown envelope")

    if sorted_envelopes:
        latest = sorted_envelopes[-1]
        latest_stage = latest.get("stage", "none")
        bound_outcome = outcome_by_envelope.get(latest.get("envelope_sha256", ""))
        if bound_outcome:
            latest_outcome = bound_outcome.get("result", "none")
            latest_effective_state = {
                "positive": "completed_positive",
                "adverse": "completed_adverse",
                "indeterminate": "completed_indeterminate",
                "revoked": "revoked",
            }.get(latest_outcome, "completed_indeterminate")
        elif recognition_valid and parse_time(latest["expires_at"]) < now:
            latest_effective_state = "expired_without_outcome"
        else:
            latest_effective_state = "active"

    if not recognition_valid:
        state = "recognition_invalid"
        decision = "reject_recognition"
    elif blocking_challenges > 0 or not challenge_valid:
        state = "challenge_blocked"
        decision = "resolve_blocking_challenge"
        reasons.append("open, upheld, or invalid challenge blocks authority progression")
    elif not cooling_complete or not challenge_window_complete:
        state = "cooling_active"
        decision = "wait_for_cooling_and_challenge_window"
        reasons.append("cooling or challenge window is still active")
    elif not envelope_valid:
        state = "progression_reset_required"
        decision = "return_to_observation_or_new_human_review"
    elif not sorted_envelopes:
        state = "stage_A1_eligible"
        decision = "A1_authorization_may_be_requested"
    elif latest_effective_state == "active":
        state = "progressive_authority_active"
        decision = "no_new_stage_while_envelope_active"
    elif latest_effective_state == "completed_positive":
        if latest_stage == "A4_canonical_preparation":
            state = "final_succession_review_eligible"
            decision = "canonical_human_succession_recognition_may_be_requested"
        else:
            state = "next_stage_review_eligible"
            decision = "next_stage_authorization_may_be_requested"
    else:
        state = "progression_reset_required"
        decision = "return_to_observation_or_new_human_review"
        reasons.append("latest authority stage did not end in a positive attributable outcome")

    result = {
        "artifact_type": "CHSPTransitionAssessment",
        "artifact_version": "0.2",
        "assessment_id": "urn:uu-aap:chsp:transition-assessment:" + sha256_json({
            "recognition": recognition.get("recognition_sha256", "0" * 64),
            "challenges": artifact_set_sha(challenges, "challenge_sha256") if challenges and challenge_valid else sha256_json([]),
            "envelopes": artifact_set_sha(sorted_envelopes, "envelope_sha256") if sorted_envelopes and envelope_valid else sha256_json([]),
            "outcomes": artifact_set_sha(outcomes, "outcome_sha256") if outcomes and envelope_valid else sha256_json([]),
            "at": iso_z(now),
        })[:24],
        "evaluated_at": iso_z(now),
        "project_id": policy["project_id"],
        "candidate_id": assessment.get("candidate_id", recognition.get("candidate_id", "unknown")),
        "v01_assessment_sha256": assessment.get("assessment_sha256", "0" * 64),
        "recognition_sha256": recognition.get("recognition_sha256", "0" * 64),
        "policy_sha256": sha256_json(policy),
        "challenge_set_sha256": artifact_set_sha(challenges, "challenge_sha256") if challenges and challenge_valid else sha256_json([]),
        "envelope_set_sha256": artifact_set_sha(sorted_envelopes, "envelope_sha256") if sorted_envelopes and envelope_valid else sha256_json([]),
        "outcome_set_sha256": artifact_set_sha(outcomes, "outcome_sha256") if outcomes and envelope_valid else sha256_json([]),
        "state": state,
        "decision": decision,
        "metrics": {
            "cooling_complete": cooling_complete,
            "challenge_window_complete": challenge_window_complete,
            "blocking_challenges": blocking_challenges,
            "resolved_challenges": resolved_challenges,
            "envelope_count": len(envelopes),
            "outcome_count": len(outcomes),
            "completed_positive_stages": completed_positive,
            "latest_stage": latest_stage,
            "latest_effective_state": latest_effective_state,
            "latest_outcome": latest_outcome,
        },
        "reasons": reasons,
        "assessment_sha256": "0" * 64,
        "claims": transition_claims(),
    }
    result["assessment_sha256"] = self_digest(result, "assessment_sha256")
    return result


def issue_envelope(
    assessment: dict[str, Any], recognition: dict[str, Any], policy: dict[str, Any],
    challenges: list[dict[str, Any]], envelopes: list[dict[str, Any]], outcomes: list[dict[str, Any]],
    stage: str, scopes: list[str], authorizer_id: str, authorization_evidence_sha256: str,
    nonce: str, state_dir: Path, at: str, expires_at: str,
) -> dict[str, Any]:
    transition = assess_transition(assessment, recognition, policy, challenges, envelopes, outcomes, at)
    if transition["state"] == "stage_A1_eligible":
        expected = "A1_advisory"
    elif transition["state"] == "next_stage_review_eligible":
        latest = transition["metrics"]["latest_stage"]
        expected = STAGES[STAGES.index(latest) + 1]
    else:
        raise ValueError(f"authority envelope cannot be issued from transition state {transition['state']}")
    require(stage == expected, f"expected next stage {expected}")
    require(HEX64_RE.fullmatch(authorization_evidence_sha256 or "") is not None, "invalid authorization evidence digest")
    require(len(nonce) >= 16, "envelope nonce too short")
    predecessor = sorted(envelopes, key=lambda e: STAGES.index(e["stage"]))[-1] if envelopes else None
    outcome_by_envelope = {o["envelope_sha256"]: o for o in outcomes}
    predecessor_outcome = outcome_by_envelope.get(predecessor["envelope_sha256"]) if predecessor else None
    now = parse_time(at)
    expires = parse_time(expires_at)
    reservation = {
        "artifact_type": "CHSPLocalEnvelopeReservation",
        "artifact_version": "0.2",
        "recognition_sha256": recognition["recognition_sha256"],
        "stage": stage,
        "candidate_id": recognition["candidate_id"],
        "authorized_by_human_id": authorizer_id,
        "reserved_at": iso_z(now),
        "claims": {"global_replay_prevention_established": False},
    }
    reserve_once(state_dir, "authority-stage-reservations", recognition["recognition_sha256"] + ":" + stage, reservation)
    reserve_once(state_dir, "authority-envelope-nonces", nonce, reservation)
    envelope = {
        "artifact_type": "CHSPProgressiveAuthorityEnvelope",
        "artifact_version": "0.2",
        "envelope_id": "urn:uu-aap:chsp:authority-envelope:" + sha256_json({
            "recognition": recognition["recognition_sha256"], "stage": stage, "nonce": nonce, "at": iso_z(now)
        })[:24],
        "project_id": policy["project_id"],
        "candidate_id": recognition["candidate_id"],
        "recognition_sha256": recognition["recognition_sha256"],
        "stage": stage,
        "scopes": scopes,
        "authorized_by_human_id": authorizer_id,
        "authorization_evidence_sha256": authorization_evidence_sha256,
        "issued_at": iso_z(now),
        "expires_at": iso_z(expires),
        "predecessor_envelope_sha256": predecessor["envelope_sha256"] if predecessor else None,
        "predecessor_outcome_sha256": predecessor_outcome["outcome_sha256"] if predecessor_outcome else None,
        "nonce": nonce,
        "envelope_sha256": "0" * 64,
        "claims": envelope_claims(),
    }
    envelope["envelope_sha256"] = self_digest(envelope, "envelope_sha256")
    validate_envelope(envelope, recognition, policy, predecessor, predecessor_outcome)
    return envelope


def record_outcome(
    envelope: dict[str, Any], recognition: dict[str, Any], policy: dict[str, Any],
    result: str, recorder_id: str, evidence_sha256: str, at: str,
) -> dict[str, Any]:
    require(result in {"positive", "adverse", "indeterminate", "revoked"}, "invalid outcome result")
    require(HEX64_RE.fullmatch(evidence_sha256 or "") is not None, "invalid outcome evidence digest")
    outcome = {
        "artifact_type": "CHSPAuthorityOutcome",
        "artifact_version": "0.2",
        "outcome_id": "urn:uu-aap:chsp:authority-outcome:" + sha256_json({
            "envelope": envelope["envelope_sha256"], "result": result, "recorder": recorder_id, "at": at
        })[:24],
        "project_id": recognition["project_id"],
        "candidate_id": recognition["candidate_id"],
        "recognition_sha256": recognition["recognition_sha256"],
        "envelope_sha256": envelope["envelope_sha256"],
        "stage": envelope["stage"],
        "recorded_by_human_id": recorder_id,
        "recorded_at": iso_z(parse_time(at)),
        "result": result,
        "evidence_sha256": evidence_sha256,
        "outcome_sha256": "0" * 64,
        "claims": outcome_claims(),
    }
    outcome["outcome_sha256"] = self_digest(outcome, "outcome_sha256")
    validate_outcome(outcome, envelope, recognition, policy)
    return outcome


def load_many(paths: list[str] | None) -> list[dict[str, Any]]:
    return [load_json(Path(p)) for p in (paths or [])]


def main() -> int:
    parser = argparse.ArgumentParser(description="CHSP v0.2 local recognition/progressive-authority tooling")
    sub = parser.add_subparsers(dest="cmd", required=True)

    rec = sub.add_parser("recognize")
    rec.add_argument("--assessment", required=True)
    rec.add_argument("--policy", required=True)
    rec.add_argument("--recognizer-id", required=True)
    rec.add_argument("--recognizer-evidence-sha256", required=True)
    rec.add_argument("--nonce", required=True)
    rec.add_argument("--confirmation-token", required=True)
    rec.add_argument("--state-dir", required=True)
    rec.add_argument("--output", required=True)
    rec.add_argument("--at")

    ass = sub.add_parser("assess")
    ass.add_argument("--assessment", required=True)
    ass.add_argument("--recognition", required=True)
    ass.add_argument("--policy", required=True)
    ass.add_argument("--challenge", action="append")
    ass.add_argument("--envelope", action="append")
    ass.add_argument("--outcome", action="append")
    ass.add_argument("--at")

    env = sub.add_parser("issue-envelope")
    env.add_argument("--assessment", required=True)
    env.add_argument("--recognition", required=True)
    env.add_argument("--policy", required=True)
    env.add_argument("--challenge", action="append")
    env.add_argument("--envelope", action="append")
    env.add_argument("--outcome", action="append")
    env.add_argument("--stage", required=True)
    env.add_argument("--scope", action="append", required=True)
    env.add_argument("--authorizer-id", required=True)
    env.add_argument("--authorization-evidence-sha256", required=True)
    env.add_argument("--nonce", required=True)
    env.add_argument("--state-dir", required=True)
    env.add_argument("--at", required=True)
    env.add_argument("--expires-at", required=True)
    env.add_argument("--output", required=True)

    out = sub.add_parser("record-outcome")
    out.add_argument("--envelope", required=True)
    out.add_argument("--recognition", required=True)
    out.add_argument("--policy", required=True)
    out.add_argument("--result", required=True)
    out.add_argument("--recorder-id", required=True)
    out.add_argument("--evidence-sha256", required=True)
    out.add_argument("--at", required=True)
    out.add_argument("--output", required=True)

    args = parser.parse_args()
    try:
        if args.cmd == "recognize":
            value = issue_recognition(
                load_json(Path(args.assessment)), load_json(Path(args.policy)), args.recognizer_id,
                args.recognizer_evidence_sha256, args.nonce, args.confirmation_token,
                Path(args.state_dir), args.at,
            )
            write_json_fsync(Path(args.output), value)
            print(value["recognition_sha256"])
        elif args.cmd == "assess":
            value = assess_transition(
                load_json(Path(args.assessment)), load_json(Path(args.recognition)), load_json(Path(args.policy)),
                load_many(args.challenge), load_many(args.envelope), load_many(args.outcome), args.at,
            )
            print(json.dumps(value, indent=2, ensure_ascii=False))
        elif args.cmd == "issue-envelope":
            value = issue_envelope(
                load_json(Path(args.assessment)), load_json(Path(args.recognition)), load_json(Path(args.policy)),
                load_many(args.challenge), load_many(args.envelope), load_many(args.outcome),
                args.stage, args.scope, args.authorizer_id, args.authorization_evidence_sha256,
                args.nonce, Path(args.state_dir), args.at, args.expires_at,
            )
            write_json_fsync(Path(args.output), value)
            print(value["envelope_sha256"])
        else:
            value = record_outcome(
                load_json(Path(args.envelope)), load_json(Path(args.recognition)), load_json(Path(args.policy)),
                args.result, args.recorder_id, args.evidence_sha256, args.at,
            )
            write_json_fsync(Path(args.output), value)
            print(value["outcome_sha256"])
    except Exception as exc:
        print(f"CHSP v0.2 failed: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
