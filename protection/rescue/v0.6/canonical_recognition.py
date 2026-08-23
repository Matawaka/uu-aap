#!/usr/bin/env python3
"""Local-only Human Canonical Recognition Protocol v0.6.

Records a human recognition decision for one exact reviewable v0.5 proposal.
It performs no network I/O, Git mutation, canonical publication, ownership
transfer, or KONTUR activation.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HEX64 = re.compile(r"^[0-9a-f]{64}$")
OID = re.compile(r"^[0-9a-f]{40,64}$")
CONFIRM = "RECOGNIZE_FOR_CANONICAL_PUBLICATION_PREPARATION_ONLY"
SCOPE = "prepare_canonical_publication"
DECISION = "recognize_candidate_for_canonical_publication_preparation"


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
    require(path.exists() and path.is_file() and not path.is_symlink(), f"JSON input must be regular non-symlink file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "HumanCanonicalRecognitionPolicy", "HumanCanonicalRecognitionPolicy required")
    require(policy.get("artifact_version") == "0.6", "HumanCanonicalRecognitionPolicy v0.6 required")
    require(policy.get("confirmation_token") == CONFIRM, "recognition confirmation token mismatch")
    require(policy.get("allowed_scope") == SCOPE, "unsupported recognition scope")
    req = policy.get("requirements") or {}
    for key in [
        "reviewable_v05_assessment", "exact_proposal_binding", "actor_evidence_digest",
        "active_validity_window", "local_nonce_reservation", "local_proposal_reservation",
        "network_prohibited", "git_mutation_prohibited", "publication_prohibited",
        "kontur_activation_prohibited",
    ]:
        require(req.get(key) is True, f"unsafe or incomplete recognition policy requirement: {key}")
    claims = policy.get("claims") or {}
    for key in [
        "automatic_recognition_enabled", "automatic_publication_enabled",
        "canonical_origin_mutation_enabled", "ownership_transfer_enabled",
        "kontur_activation_enabled", "distributed_consensus_established",
    ]:
        require(claims.get(key) is False, f"unsafe recognition policy claim: {key}")


def validate_proposal(proposal: dict[str, Any]) -> None:
    require(proposal.get("artifact_type") == "CanonicalSuccessionProposal", "CanonicalSuccessionProposal required")
    require(proposal.get("artifact_version") == "0.5", "CanonicalSuccessionProposal v0.5 required")
    digest = proposal.get("proposal_sha256", "")
    require(HEX64.fullmatch(digest) is not None, "invalid proposal_sha256")
    require(self_digest(proposal, "proposal_sha256") == digest, "proposal self-digest mismatch")
    for key in ["predecessor_frontier_commit", "candidate_frontier_commit", "candidate_frontier_tree"]:
        require(OID.fullmatch(proposal.get(key, "")) is not None, f"invalid {key}")
    require(HEX64.fullmatch(proposal.get("candidate_ref_set_sha256", "")) is not None, "invalid candidate_ref_set_sha256")
    claims = proposal.get("claims") or {}
    require(claims.get("candidate_is_noncanonical") is True, "proposal candidate must still be non-canonical")
    require(claims.get("proposal_only") is True, "proposal must remain proposal-only")
    require(claims.get("human_recognition_required") is True, "proposal must require human recognition")
    for key in [
        "canonical_successor_established", "canonical_origin_mutated", "ownership_transferred",
        "kontur_activated", "distributed_consensus_established", "universal_canonicality_established",
        "legal_effect_established", "truth_certified",
    ]:
        require(claims.get(key) is False, f"unsafe proposal claim: {key}")


def validate_proposal_assessment(assessment: dict[str, Any], proposal: dict[str, Any]) -> None:
    require(assessment.get("artifact_type") == "CanonicalSuccessionProposalAssessment", "CanonicalSuccessionProposalAssessment required")
    require(assessment.get("artifact_version") == "0.5", "CanonicalSuccessionProposalAssessment v0.5 required")
    digest = assessment.get("assessment_sha256", "")
    require(HEX64.fullmatch(digest) is not None, "invalid proposal assessment SHA-256")
    require(self_digest(assessment, "assessment_sha256") == digest, "proposal assessment self-digest mismatch")
    require(assessment.get("state") == "proposal_reviewable", "proposal assessment is not reviewable")
    require(assessment.get("decision") == "human_canonical_recognition_may_be_requested", "proposal assessment does not permit recognition request")
    require(assessment.get("proposal_sha256") == proposal.get("proposal_sha256"), "proposal assessment binding mismatch")
    require(assessment.get("project_id") == proposal.get("project_id"), "proposal assessment project mismatch")
    claims = assessment.get("claims") or {}
    require(claims.get("proposal_reviewability_only") is True, "assessment must remain reviewability-only")
    require(claims.get("human_recognition_required") is True, "assessment must require human recognition")
    for key in [
        "canonical_successor_established", "canonical_origin_mutated", "ownership_transferred",
        "kontur_activated", "distributed_consensus_established", "legal_effect_established", "truth_certified",
    ]:
        require(claims.get(key) is False, f"unsafe proposal assessment claim: {key}")


def recognition_claims() -> dict[str, Any]:
    return {
        "human_decision_recorded": True,
        "candidate_recognized_for_publication_preparation": True,
        "repository_scoped_successor_intent_recorded": True,
        "canonical_successor_established": False,
        "canonical_origin_created": False,
        "canonical_origin_mutated": False,
        "publication_executed": False,
        "ownership_transferred": False,
        "kontur_activated": False,
        "distributed_consensus_established": False,
        "cryptographic_or_legal_identity_proven": False,
        "global_replay_prevention_established": False,
        "legal_effect_established": False,
        "truth_certified": False,
    }


def validate_recognition_claims(recognition: dict[str, Any]) -> None:
    claims = recognition.get("claims") or {}
    for key in ["human_decision_recorded", "candidate_recognized_for_publication_preparation", "repository_scoped_successor_intent_recorded"]:
        require(claims.get(key) is True, f"missing recognition claim: {key}")
    for key in [
        "canonical_successor_established", "canonical_origin_created", "canonical_origin_mutated",
        "publication_executed", "ownership_transferred", "kontur_activated",
        "distributed_consensus_established", "cryptographic_or_legal_identity_proven",
        "global_replay_prevention_established", "legal_effect_established", "truth_certified",
    ]:
        require(claims.get(key) is False, f"unsafe recognition claim: {key}")


def fsync_dir(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def reserve_once(directory: Path, filename: str, value: dict[str, Any]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / filename
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise ValueError(f"local recognition reservation already exists: {filename}") from exc
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())
    fsync_dir(directory)


def reserve_recognition(state_dir: Path, proposal_sha: str, nonce: str, actor_id: str, at: datetime) -> tuple[str, str]:
    require(state_dir.exists() or state_dir.parent.exists(), "state-dir parent must exist")
    state_dir.mkdir(parents=True, exist_ok=True)
    nonce_sha = hashlib.sha256(nonce.encode("utf-8")).hexdigest()
    common = {
        "artifact_type": "LocalCanonicalRecognitionReservation",
        "artifact_version": "0.6",
        "human_actor_id": actor_id,
        "proposal_sha256": proposal_sha,
        "nonce_sha256": nonce_sha,
        "reserved_at": iso_z(at),
        "replay_scope": "local_state_directory",
        "claims": {"global_replay_prevention_established": False},
    }
    # Fail closed: a partial reservation remains consumed if the second reservation fails.
    reserve_once(state_dir / "recognized-proposals", f"{proposal_sha}.json", common)
    reserve_once(state_dir / "used-recognition-nonces", f"{nonce_sha}.json", common)
    return proposal_sha, nonce_sha


def validate_inputs(policy: dict[str, Any], proposal: dict[str, Any], assessment: dict[str, Any]) -> None:
    validate_policy(policy)
    validate_proposal(proposal)
    validate_proposal_assessment(assessment, proposal)
    require(policy.get("project_id") == proposal.get("project_id"), "recognition policy/project mismatch")


def issue_recognition(
    policy: dict[str, Any], proposal: dict[str, Any], assessment: dict[str, Any], *,
    human_actor_id: str, actor_evidence_sha256: str, successor_origin_id: str,
    nonce: str, issued_at: str, expires_at: str, confirmation_token: str,
    state_dir: Path,
) -> dict[str, Any]:
    validate_inputs(policy, proposal, assessment)
    require(isinstance(human_actor_id, str) and human_actor_id, "human_actor_id is required")
    require(HEX64.fullmatch(actor_evidence_sha256 or "") is not None, "actor_evidence_sha256 must be SHA-256")
    require(isinstance(successor_origin_id, str) and successor_origin_id.startswith("urn:uu-aap:canonical-origin:"), "successor_origin_id must be a logical urn:uu-aap:canonical-origin:* identifier")
    require(isinstance(nonce, str) and len(nonce) >= 16, "recognition nonce must be at least 16 characters")
    require(confirmation_token == CONFIRM, "exact human confirmation token required")
    issued = parse_time(issued_at)
    expires = parse_time(expires_at)
    require(issued < expires, "recognition validity window is invalid")

    reserve_recognition(state_dir, proposal["proposal_sha256"], nonce, human_actor_id, issued)

    body = {
        "artifact_type": "HumanCanonicalRecognition",
        "artifact_version": "0.6",
        "recognition_id": "urn:uu-aap:human-canonical-recognition:" + sha256_json({
            "proposal": proposal["proposal_sha256"], "actor": human_actor_id,
            "successor": successor_origin_id, "nonce": hashlib.sha256(nonce.encode()).hexdigest(),
        })[:24],
        "project_id": proposal["project_id"],
        "human_actor_id": human_actor_id,
        "actor_evidence_sha256": actor_evidence_sha256,
        "proposal_sha256": proposal["proposal_sha256"],
        "proposal_assessment_sha256": assessment["assessment_sha256"],
        "predecessor_origin_id": proposal["predecessor_origin_id"],
        "predecessor_frontier_commit": proposal["predecessor_frontier_commit"],
        "candidate_frontier_commit": proposal["candidate_frontier_commit"],
        "candidate_frontier_tree": proposal["candidate_frontier_tree"],
        "candidate_ref_set_sha256": proposal["candidate_ref_set_sha256"],
        "successor_origin_id": successor_origin_id,
        "scope": SCOPE,
        "decision": DECISION,
        "issued_at": iso_z(issued),
        "expires_at": iso_z(expires),
        "nonce": nonce,
        "confirmation_token": CONFIRM,
        "recognition_sha256": "0" * 64,
        "claims": recognition_claims(),
    }
    body["recognition_sha256"] = self_digest(body, "recognition_sha256")
    return body


def assess_recognition(policy: dict[str, Any], proposal: dict[str, Any], proposal_assessment: dict[str, Any], recognition: dict[str, Any], evaluated_at: str | None = None) -> dict[str, Any]:
    checks = {
        "recognition_self_digest_match": False,
        "proposal_self_digest_match": False,
        "proposal_assessment_self_digest_match": False,
        "proposal_reviewable": False,
        "exact_proposal_binding": False,
        "project_binding_match": False,
        "candidate_binding_match": False,
        "confirmation_token_match": False,
        "recognition_window_valid": False,
        "actor_evidence_digest_valid": False,
        "authority_boundary_preserved": False,
    }
    reasons: list[str] = []
    now = parse_time(evaluated_at) if evaluated_at else datetime.now(timezone.utc)
    try:
        validate_policy(policy)
    except Exception as exc:
        reasons.append(str(exc))
    try:
        validate_proposal(proposal)
        checks["proposal_self_digest_match"] = True
    except Exception as exc:
        reasons.append(str(exc))
    try:
        validate_proposal_assessment(proposal_assessment, proposal)
        checks["proposal_assessment_self_digest_match"] = True
        checks["proposal_reviewable"] = True
    except Exception as exc:
        reasons.append(str(exc))

    if recognition.get("artifact_type") == "HumanCanonicalRecognition" and recognition.get("artifact_version") == "0.6":
        digest = recognition.get("recognition_sha256", "")
        if HEX64.fullmatch(digest or "") and self_digest(recognition, "recognition_sha256") == digest:
            checks["recognition_self_digest_match"] = True
        else:
            reasons.append("recognition self-digest mismatch")
    else:
        reasons.append("HumanCanonicalRecognition v0.6 required")

    checks["exact_proposal_binding"] = (
        recognition.get("proposal_sha256") == proposal.get("proposal_sha256")
        and recognition.get("proposal_assessment_sha256") == proposal_assessment.get("assessment_sha256")
    )
    checks["project_binding_match"] = (
        recognition.get("project_id") == proposal.get("project_id") == policy.get("project_id")
    )
    checks["candidate_binding_match"] = all([
        recognition.get("predecessor_origin_id") == proposal.get("predecessor_origin_id"),
        recognition.get("predecessor_frontier_commit") == proposal.get("predecessor_frontier_commit"),
        recognition.get("candidate_frontier_commit") == proposal.get("candidate_frontier_commit"),
        recognition.get("candidate_frontier_tree") == proposal.get("candidate_frontier_tree"),
        recognition.get("candidate_ref_set_sha256") == proposal.get("candidate_ref_set_sha256"),
    ])
    checks["confirmation_token_match"] = recognition.get("confirmation_token") == CONFIRM and recognition.get("decision") == DECISION and recognition.get("scope") == SCOPE
    checks["actor_evidence_digest_valid"] = HEX64.fullmatch(recognition.get("actor_evidence_sha256", "")) is not None
    try:
        issued = parse_time(recognition["issued_at"])
        expires = parse_time(recognition["expires_at"])
        checks["recognition_window_valid"] = issued <= now < expires
        if not checks["recognition_window_valid"]:
            reasons.append("recognition is outside its active validity window")
    except Exception as exc:
        reasons.append(f"invalid recognition time: {exc}")
    try:
        validate_recognition_claims(recognition)
        checks["authority_boundary_preserved"] = True
    except Exception as exc:
        reasons.append(str(exc))

    for key, ok in checks.items():
        if not ok and not any(key.replace("_", " ") in r for r in reasons):
            reasons.append(f"check failed: {key}")
    valid = all(checks.values())
    state = "recognition_valid" if valid else "rejected"
    decision = "canonical_publication_authorization_may_be_requested" if valid else "reject_recognition"
    body = {
        "artifact_type": "HumanCanonicalRecognitionAssessment",
        "artifact_version": "0.6",
        "assessment_id": "urn:uu-aap:human-canonical-recognition-assessment:" + sha256_json({
            "recognition": recognition.get("recognition_sha256"), "at": iso_z(now)
        })[:24],
        "evaluated_at": iso_z(now),
        "project_id": policy.get("project_id", ""),
        "recognition_sha256": recognition.get("recognition_sha256", "0" * 64),
        "proposal_sha256": proposal.get("proposal_sha256", "0" * 64),
        "proposal_assessment_sha256": proposal_assessment.get("assessment_sha256", "0" * 64),
        "policy_sha256": sha256_json(policy),
        "state": state,
        "decision": decision,
        "checks": checks,
        "reasons": reasons,
        "assessment_sha256": "0" * 64,
        "claims": {
            "human_recognition_validated": valid,
            "publication_authorization_only_may_be_requested": valid,
            "canonical_successor_established": False,
            "canonical_origin_created": False,
            "canonical_origin_mutated": False,
            "publication_executed": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "distributed_consensus_established": False,
            "legal_effect_established": False,
            "truth_certified": False,
        },
    }
    body["assessment_sha256"] = self_digest(body, "assessment_sha256")
    return body


def atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    require(not path.exists(), f"output already exists: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.parent / ("." + path.name + ".tmp")
    require(not temp.exists(), f"temporary output exists: {temp}")
    with temp.open("x", encoding="utf-8") as f:
        f.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, path)
    fsync_dir(path.parent)


def main() -> int:
    parser = argparse.ArgumentParser(description="UU-AAP Human Canonical Recognition Protocol v0.6")
    sub = parser.add_subparsers(dest="cmd", required=True)

    issue = sub.add_parser("issue")
    issue.add_argument("--policy", required=True)
    issue.add_argument("--proposal", required=True)
    issue.add_argument("--proposal-assessment", required=True)
    issue.add_argument("--human-actor-id", required=True)
    issue.add_argument("--actor-evidence-sha256", required=True)
    issue.add_argument("--successor-origin-id", required=True)
    issue.add_argument("--nonce", required=True)
    issue.add_argument("--issued-at", required=True)
    issue.add_argument("--expires-at", required=True)
    issue.add_argument("--confirm", required=True)
    issue.add_argument("--state-dir", required=True)
    issue.add_argument("--out", required=True)

    assess = sub.add_parser("assess")
    assess.add_argument("--policy", required=True)
    assess.add_argument("--proposal", required=True)
    assess.add_argument("--proposal-assessment", required=True)
    assess.add_argument("--recognition", required=True)
    assess.add_argument("--evaluated-at")
    assess.add_argument("--out")

    args = parser.parse_args()
    try:
        policy = load_json(Path(args.policy))
        proposal = load_json(Path(args.proposal))
        proposal_assessment = load_json(Path(args.proposal_assessment))
        if args.cmd == "issue":
            recognition = issue_recognition(
                policy, proposal, proposal_assessment,
                human_actor_id=args.human_actor_id,
                actor_evidence_sha256=args.actor_evidence_sha256,
                successor_origin_id=args.successor_origin_id,
                nonce=args.nonce,
                issued_at=args.issued_at,
                expires_at=args.expires_at,
                confirmation_token=args.confirm,
                state_dir=Path(args.state_dir),
            )
            atomic_write_json(Path(args.out), recognition)
            print(f"HUMAN CANONICAL RECOGNITION RECORDED {recognition['recognition_id']} {recognition['recognition_sha256']}")
        else:
            recognition = load_json(Path(args.recognition))
            assessment = assess_recognition(policy, proposal, proposal_assessment, recognition, args.evaluated_at)
            if args.out:
                atomic_write_json(Path(args.out), assessment)
            else:
                print(json.dumps(assessment, indent=2, ensure_ascii=False))
    except Exception as exc:
        print(f"canonical recognition failed: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
