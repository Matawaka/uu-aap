#!/usr/bin/env python3
"""Canonical Human Succession Protocol (CHSP) v0.1 reference assessor.

Local-only evidence assessment. No network, Git, account, publication, KONTUR,
or authority mutation capability is present in this module.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HEX64 = re.compile(r"^[0-9a-f]{64}$")
EVIDENCE_CLASSES = {
    "protocol_comprehension",
    "boundary_respect",
    "conflict_of_interest_disclosure",
    "challenged_decision_response",
    "uncertainty_handling",
    "reversibility_preservation",
    "appeal_preservation",
    "operational_stewardship",
}
DELEGATION_LEVELS = {"advisory", "reversible_limited", "supervised_stewardship"}
ALLOWED_SCOPES = {
    "advisory_review",
    "propose_change",
    "review_change",
    "prepare_artifact",
    "supervised_maintenance",
    "document_rationale",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def self_digest(value: dict[str, Any], field: str) -> str:
    work = copy.deepcopy(value)
    work[field] = "0" * 64
    return sha256_json(work)


def parse_time(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(dt.tzinfo is not None, "timestamp must include timezone")
    return dt.astimezone(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    require(path.is_file() and not path.is_symlink(), f"regular non-symlink JSON required: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    require(not path.exists(), f"output already exists: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPPolicy", "CHSPPolicy required")
    require(policy.get("artifact_version") == "0.1", "CHSPPolicy v0.1 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    for key in [
        "minimum_immersion_days", "maximum_evidence_age_days", "minimum_evidence_events",
        "minimum_observer_domains", "minimum_challenge_events", "minimum_completed_successful_delegations",
    ]:
        require(isinstance(policy.get(key), int) and policy[key] >= 1, f"invalid policy threshold: {key}")
    required = policy.get("required_evidence_classes")
    require(isinstance(required, list) and required, "required evidence classes missing")
    require(set(required).issubset(EVIDENCE_CLASSES), "unknown required evidence class")
    levels = policy.get("countable_delegation_levels")
    require(isinstance(levels, list) and levels, "countable delegation levels missing")
    require(set(levels).issubset(DELEGATION_LEVELS), "unknown delegation level")

    req = policy.get("requirements") or {}
    require(req.get("self_attestation_counts_as_independent_evidence") is False, "self-attestation must not count")
    for key in [
        "unresolved_adverse_evidence_blocks", "candidate_must_not_be_sole_appeal_contour",
        "delegation_must_be_reversible", "delegation_must_expire", "completed_delegation_outcome_required",
    ]:
        require(req.get(key) is True, f"required CHSP safety property missing: {key}")
    require(req.get("automatic_authority_progression") is False, "automatic authority progression prohibited")
    require(req.get("automatic_canonical_recognition") is False, "automatic canonical recognition prohibited")

    safeguards = policy.get("transition_safeguards") or {}
    for key in [
        "historical_anchors_preserved", "appeal_path_preserved", "recovery_path_preserved",
        "temporary_authority_reversible", "irreversible_canon_rewrite_prohibited",
        "hidden_centralization_prohibited", "canonical_origin_mutation_prohibited",
        "ownership_transfer_prohibited", "kontur_activation_prohibited", "automatic_failover_prohibited",
    ]:
        require(safeguards.get(key) is True, f"transition safeguard missing: {key}")

    claims = policy.get("claims") or {}
    require(claims.get("descriptive_policy_only") is True, "policy must be descriptive only")
    for key in [
        "psychological_fitness_certified", "legal_identity_certified", "canonical_successor_established",
        "ownership_transferred", "kontur_activated", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe policy claim: {key}")


def candidate_claims() -> dict[str, Any]:
    return {
        "nomination_recorded": True,
        "trust_established": False,
        "authority_granted": False,
        "canonical_successor_established": False,
        "legal_identity_certified": False,
        "psychological_fitness_certified": False,
    }


def build_candidate(project_id: str, subject_id: str, nominated_by_id: str, appeal_contour_id: str, nominated_at: str) -> dict[str, Any]:
    require(all(isinstance(x, str) and x for x in [project_id, subject_id, nominated_by_id, appeal_contour_id]), "candidate identifiers required")
    parse_time(nominated_at)
    require(appeal_contour_id != subject_id, "candidate cannot be the sole appeal contour")
    body = {
        "artifact_type": "CHSPCandidate",
        "artifact_version": "0.1",
        "candidate_id": "urn:uu-aap:chsp:candidate:" + sha256_json({"project": project_id, "subject": subject_id, "at": nominated_at})[:24],
        "project_id": project_id,
        "subject_id": subject_id,
        "nominated_by_id": nominated_by_id,
        "nominated_at": nominated_at,
        "appeal_contour_id": appeal_contour_id,
        "candidate_sha256": "0" * 64,
        "claims": candidate_claims(),
    }
    body["candidate_sha256"] = self_digest(body, "candidate_sha256")
    return body


def validate_candidate(candidate: dict[str, Any], policy: dict[str, Any]) -> None:
    require(candidate.get("artifact_type") == "CHSPCandidate", "CHSPCandidate required")
    require(candidate.get("artifact_version") == "0.1", "CHSPCandidate v0.1 required")
    require(candidate.get("project_id") == policy.get("project_id"), "candidate/policy project mismatch")
    for key in ["candidate_id", "subject_id", "nominated_by_id", "appeal_contour_id"]:
        require(isinstance(candidate.get(key), str) and candidate[key], f"invalid candidate field: {key}")
    parse_time(candidate["nominated_at"])
    require(candidate["appeal_contour_id"] != candidate["subject_id"], "candidate cannot be sole appeal contour")
    digest = candidate.get("candidate_sha256", "")
    require(HEX64.fullmatch(digest) is not None, "invalid candidate digest")
    require(self_digest(candidate, "candidate_sha256") == digest, "candidate self-digest mismatch")
    claims = candidate.get("claims") or {}
    require(claims == candidate_claims(), "unsafe candidate claims")


def validate_evidence(event: dict[str, Any], candidate: dict[str, Any]) -> datetime:
    require(event.get("artifact_type") == "CHSPEvidenceEvent", "CHSPEvidenceEvent required")
    require(event.get("artifact_version") == "0.1", "CHSPEvidenceEvent v0.1 required")
    require(event.get("project_id") == candidate["project_id"], "evidence project mismatch")
    require(event.get("candidate_id") == candidate["candidate_id"], "evidence candidate mismatch")
    require(event.get("observer_is_candidate") is False, "self-attestation cannot count")
    require(event.get("observer_id") != candidate["subject_id"], "candidate cannot be own observer")
    require(isinstance(event.get("observer_domain_id"), str) and event["observer_domain_id"], "observer domain required")
    require(event.get("evidence_class") in EVIDENCE_CLASSES, "unknown evidence class")
    require(event.get("finding") in {"supportive", "adverse", "indeterminate"}, "invalid evidence finding")
    require(event.get("resolution") in {"unresolved", "resolved_upheld", "resolved_remediated", "not_applicable"}, "invalid evidence resolution")
    require(isinstance(event.get("scenario_id"), str) and event["scenario_id"], "scenario_id required")
    require(HEX64.fullmatch(event.get("evidence_payload_sha256", "")) is not None, "invalid evidence payload digest")
    digest = event.get("event_sha256", "")
    require(HEX64.fullmatch(digest) is not None, "invalid event digest")
    require(self_digest(event, "event_sha256") == digest, "evidence event self-digest mismatch")
    claims = event.get("claims") or {}
    require(claims.get("observable_event_recorded") is True, "observable evidence claim required")
    require(claims.get("independent_domain_declared") is True, "observer domain declaration required")
    for key in ["domain_independence_proven", "trust_established", "authority_granted", "truth_certified"]:
        require(claims.get(key) is False, f"unsafe evidence claim: {key}")
    return parse_time(event["observed_at"])


def validate_delegation(delegation: dict[str, Any], candidate: dict[str, Any]) -> None:
    require(delegation.get("artifact_type") == "CHSPDelegation", "CHSPDelegation required")
    require(delegation.get("artifact_version") == "0.1", "CHSPDelegation v0.1 required")
    require(delegation.get("project_id") == candidate["project_id"], "delegation project mismatch")
    require(delegation.get("candidate_id") == candidate["candidate_id"], "delegation candidate mismatch")
    require(delegation.get("delegation_level") in DELEGATION_LEVELS, "invalid delegation level")
    scopes = delegation.get("scopes")
    require(isinstance(scopes, list) and scopes and set(scopes).issubset(ALLOWED_SCOPES), "unsafe or unknown delegation scope")
    require(delegation.get("reversible") is True, "delegation must be reversible")
    granted = parse_time(delegation["granted_at"])
    starts = parse_time(delegation["starts_at"])
    expires = parse_time(delegation["expires_at"])
    require(granted <= starts < expires, "invalid delegation validity window")
    require(delegation.get("status") in {"active", "completed", "revoked", "expired"}, "invalid delegation status")
    require(delegation.get("outcome") in {"pending", "successful", "adverse", "not_evaluated"}, "invalid delegation outcome")
    if delegation["status"] == "completed":
        require(delegation["outcome"] in {"successful", "adverse"}, "completed delegation requires evaluated outcome")
        require(HEX64.fullmatch(delegation.get("completion_evidence_sha256") or "") is not None, "completed delegation requires completion evidence digest")
    digest = delegation.get("delegation_sha256", "")
    require(HEX64.fullmatch(digest) is not None, "invalid delegation digest")
    require(self_digest(delegation, "delegation_sha256") == digest, "delegation self-digest mismatch")
    claims = delegation.get("claims") or {}
    require(claims.get("bounded_delegation_recorded") is True, "bounded delegation claim required")
    for key in ["canonical_authority_granted", "canonical_successor_established", "ownership_transferred", "kontur_activated", "appeal_path_removed"]:
        require(claims.get(key) is False, f"unsafe delegation claim: {key}")


def set_digest(items: list[dict[str, Any]], digest_field: str) -> str:
    digests = sorted(item[digest_field] for item in items)
    return sha256_json(digests)


def assessment_claims() -> dict[str, Any]:
    return {
        "policy_sufficiency_only": True,
        "observable_evidence_assessed": True,
        "automatic_authority_progression": False,
        "canonical_successor_established": False,
        "ownership_transferred": False,
        "kontur_activated": False,
        "legal_identity_certified": False,
        "psychological_fitness_certified": False,
        "universal_trust_established": False,
    }


def assess(policy: dict[str, Any], candidate: dict[str, Any], evidence: list[dict[str, Any]], delegations: list[dict[str, Any]], at: str | None = None) -> dict[str, Any]:
    validate_policy(policy)
    validate_candidate(candidate, policy)
    now = parse_time(at) if at else datetime.now(timezone.utc)
    nomination = parse_time(candidate["nominated_at"])
    require(now >= nomination, "assessment predates nomination")

    valid_events: list[dict[str, Any]] = []
    supportive: list[tuple[dict[str, Any], datetime]] = []
    blocking_adverse: list[dict[str, Any]] = []
    reasons: list[str] = []

    for event in evidence:
        observed = validate_evidence(event, candidate)
        require(observed <= now, "evidence event is in the future")
        valid_events.append(event)
        if event["finding"] == "adverse" and event["resolution"] in {"unresolved", "resolved_upheld"}:
            blocking_adverse.append(event)
        age_days = (now - observed).days
        if age_days <= policy["maximum_evidence_age_days"] and event["finding"] == "supportive":
            supportive.append((event, observed))

    for delegation in delegations:
        validate_delegation(delegation, candidate)

    supportive_events = [item[0] for item in supportive]
    supportive_times = [item[1] for item in supportive]
    immersion_days = 0
    if len(supportive_times) >= 2:
        immersion_days = (max(supportive_times) - min(supportive_times)).days

    observer_domains = {event["observer_domain_id"] for event in supportive_events}
    evidence_classes = {event["evidence_class"] for event in supportive_events}
    challenge_events = sum(1 for event in supportive_events if event["evidence_class"] == "challenged_decision_response")
    successful_delegations = [
        d for d in delegations
        if d["status"] == "completed"
        and d["outcome"] == "successful"
        and d["delegation_level"] in set(policy["countable_delegation_levels"])
    ]
    adverse_delegations = [d for d in delegations if d["outcome"] == "adverse"]

    evidence_ready = True
    checks = [
        (immersion_days >= policy["minimum_immersion_days"], f"immersion span {immersion_days}d below minimum {policy['minimum_immersion_days']}d"),
        (len(supportive_events) >= policy["minimum_evidence_events"], "insufficient supportive evidence events"),
        (len(observer_domains) >= policy["minimum_observer_domains"], "insufficient distinct observer domains"),
        (set(policy["required_evidence_classes"]).issubset(evidence_classes), "required evidence classes incomplete"),
        (challenge_events >= policy["minimum_challenge_events"], "insufficient challenged-decision evidence"),
    ]
    for ok, reason in checks:
        if not ok:
            evidence_ready = False
            reasons.append(reason)

    if blocking_adverse:
        evidence_ready = False
        reasons.append("blocking adverse evidence remains unresolved or upheld")
    if adverse_delegations:
        evidence_ready = False
        reasons.append("adverse delegation outcome blocks succession readiness")

    if not evidence_ready:
        state = "observation_required"
        decision = "continue_observation"
    elif len(successful_delegations) < policy["minimum_completed_successful_delegations"]:
        state = "delegation_eligible"
        decision = "bounded_delegation_may_be_considered"
        reasons.append("evidence thresholds met; completed successful reversible delegations still insufficient")
    else:
        state = "succession_eligible"
        decision = "human_successor_recognition_may_be_requested"
        reasons.append("configured CHSP evidence and reversible-delegation thresholds satisfied")

    metrics = {
        "immersion_days": immersion_days,
        "valid_supportive_events": len(supportive_events),
        "observer_domains": len(observer_domains),
        "challenge_events": challenge_events,
        "required_classes_satisfied": len(set(policy["required_evidence_classes"]) & evidence_classes),
        "successful_delegations": len(successful_delegations),
        "blocking_adverse_events": len(blocking_adverse) + len(adverse_delegations),
    }
    assessment = {
        "artifact_type": "CHSPAssessment",
        "artifact_version": "0.1",
        "assessment_id": "urn:uu-aap:chsp:assessment:" + sha256_json({
            "candidate": candidate["candidate_sha256"],
            "policy": sha256_json(policy),
            "evidence": set_digest(valid_events, "event_sha256"),
            "delegations": set_digest(delegations, "delegation_sha256") if delegations else sha256_json([]),
            "at": iso_z(now),
        })[:24],
        "evaluated_at": iso_z(now),
        "project_id": candidate["project_id"],
        "candidate_id": candidate["candidate_id"],
        "candidate_sha256": candidate["candidate_sha256"],
        "policy_sha256": sha256_json(policy),
        "evidence_set_sha256": set_digest(valid_events, "event_sha256") if valid_events else sha256_json([]),
        "delegation_set_sha256": set_digest(delegations, "delegation_sha256") if delegations else sha256_json([]),
        "state": state,
        "decision": decision,
        "metrics": metrics,
        "reasons": reasons,
        "assessment_sha256": "0" * 64,
        "claims": assessment_claims(),
    }
    assessment["assessment_sha256"] = self_digest(assessment, "assessment_sha256")
    return assessment


def load_dir(path: Path, artifact_type: str) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    require(path.is_dir() and not path.is_symlink(), f"directory required: {path}")
    out = []
    for item in sorted(path.glob("*.json")):
        value = load_json(item)
        require(value.get("artifact_type") == artifact_type, f"unexpected artifact in {path}: {item.name}")
        out.append(value)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="UU-AAP Canonical Human Succession Protocol v0.1")
    sub = parser.add_subparsers(dest="cmd", required=True)

    candidate_cmd = sub.add_parser("candidate")
    candidate_cmd.add_argument("--project", required=True)
    candidate_cmd.add_argument("--subject", required=True)
    candidate_cmd.add_argument("--nominated-by", required=True)
    candidate_cmd.add_argument("--appeal-contour", required=True)
    candidate_cmd.add_argument("--nominated-at", required=True)
    candidate_cmd.add_argument("--out", required=True)

    assess_cmd = sub.add_parser("assess")
    assess_cmd.add_argument("--policy", required=True)
    assess_cmd.add_argument("--candidate", required=True)
    assess_cmd.add_argument("--evidence-dir", required=True)
    assess_cmd.add_argument("--delegation-dir", required=True)
    assess_cmd.add_argument("--at")
    assess_cmd.add_argument("--out", required=True)

    args = parser.parse_args()
    try:
        if args.cmd == "candidate":
            value = build_candidate(args.project, args.subject, args.nominated_by, args.appeal_contour, args.nominated_at)
            write_json(Path(args.out), value)
        else:
            policy = load_json(Path(args.policy))
            candidate = load_json(Path(args.candidate))
            evidence = load_dir(Path(args.evidence_dir), "CHSPEvidenceEvent")
            delegations = load_dir(Path(args.delegation_dir), "CHSPDelegation")
            value = assess(policy, candidate, evidence, delegations, args.at)
            write_json(Path(args.out), value)
        return 0
    except Exception as exc:
        print(f"CHSP v0.1 failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
