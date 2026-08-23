#!/usr/bin/env python3
"""Deterministic fail-closed rescue eligibility assessor for Project Rescue Protocol v0.1."""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any

NEGATIVE_RESULTS = {"unavailable", "inconsistent"}
DESTRUCTIVE_INDICATORS = {"object_missing", "frontier_replaced", "provider_confirmed_deleted", "integrity_mismatch"}
READ_CLASSES = {"canonical_read_path"}
CONTROL_CLASSES = {"canonical_control_path", "independent_human_custodian"}
ANCHOR_CLASSES = {"external_content_anchor", "independent_replica_path"}


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def parse_time(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware")
    return parsed.astimezone(dt.timezone.utc)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "ProjectRescuePolicy", "ProjectRescuePolicy required")
    require(policy.get("artifact_version") == "0.1", "ProjectRescuePolicy v0.1 required")
    claims = policy.get("claims") or {}
    for key in ["automatic_failover_enabled", "automatic_authority_transfer_enabled", "canonical_succession_established", "distributed_consensus_established"]:
        require(claims.get(key) is False, f"policy overclaim/unsafe setting: {key}")
    t = policy.get("thresholds") or {}
    for key in ["min_negative_observations", "min_evidence_classes", "min_observer_domains", "min_failure_domains", "min_confirmation_span_seconds", "prolonged_unavailability_seconds", "min_verified_recovery_sources"]:
        require(isinstance(t.get(key), int) and t[key] >= 0, f"invalid threshold {key}")


def validate_case(case: dict[str, Any], policy: dict[str, Any]) -> None:
    require(case.get("artifact_type") == "ProjectRescueCase", "ProjectRescueCase required")
    require(case.get("artifact_version") == "0.1", "ProjectRescueCase v0.1 required")
    require(case.get("project_id") == policy.get("project_id"), "project_id mismatch")
    claims = case.get("claims") or {}
    require(claims.get("human_authorization_present") is False, "assessment input cannot claim human authorization")
    require(claims.get("canonical_successor_established") is False, "assessment input cannot claim canonical successor")
    require(claims.get("automatic_recovery_executed") is False, "assessment input cannot claim automatic recovery")
    seen = set()
    for obs in case.get("observations", []):
        oid = obs.get("observation_id")
        require(isinstance(oid, str) and oid and oid not in seen, "duplicate/invalid observation_id")
        seen.add(oid)
        parse_time(obs["observed_at"])
        require(obs.get("claims", {}).get("establishes_loss_alone") is False, "single observation cannot establish loss alone")
        require(obs.get("claims", {}).get("contains_credentials") is False, "credential-bearing evidence prohibited")
        require(isinstance(obs.get("evidence_sha256"), str) and len(obs["evidence_sha256"]) == 64, "invalid observation digest")
    for source in case.get("recovery_sources", []):
        require(source.get("claims", {}).get("canonical") is False, "recovery source cannot claim canonicality")
        require(source.get("claims", {}).get("authority_transfer") is False, "recovery source cannot transfer authority")


def evaluate(policy: dict[str, Any], case: dict[str, Any], evaluated_at: str | None = None) -> dict[str, Any]:
    validate_policy(policy)
    validate_case(case, policy)
    thresholds = policy["thresholds"]
    observations = list(case.get("observations", []))
    negative = [o for o in observations if o.get("result") in NEGATIVE_RESULTS]
    positive_canonical = [o for o in observations if o.get("result") == "available" and o.get("evidence_class") in (READ_CLASSES | CONTROL_CLASSES)]

    negative_classes = {o["evidence_class"] for o in negative}
    observer_domains = {o["observer_domain_id"] for o in negative}
    failure_domains = {o["failure_domain_id"] for o in negative}
    destructive = [o for o in negative if o.get("indicator") in DESTRUCTIVE_INDICATORS]
    has_read = any(o.get("evidence_class") in READ_CLASSES for o in negative)
    has_control = any(o.get("evidence_class") in CONTROL_CLASSES for o in negative)
    has_anchor_obs = any(o.get("evidence_class") in ANCHOR_CLASSES and o.get("result") in {"available", "inconsistent"} for o in observations)
    has_frontier = case.get("last_known_good_frontier") is not None

    if negative:
        times = sorted(parse_time(o["observed_at"]) for o in negative)
        span_seconds = int((times[-1] - times[0]).total_seconds())
    else:
        span_seconds = 0

    base_quorum = (
        len(negative) >= thresholds["min_negative_observations"]
        and len(negative_classes) >= thresholds["min_evidence_classes"]
        and len(observer_domains) >= thresholds["min_observer_domains"]
        and len(failure_domains) >= thresholds["min_failure_domains"]
        and (has_read or not thresholds["require_read_path_signal"])
        and (has_control or not thresholds["require_control_or_custodian_signal"])
        and ((has_frontier or has_anchor_obs) or not thresholds["require_frontier_or_external_anchor"])
    )
    confirmation_span_met = span_seconds >= thresholds["min_confirmation_span_seconds"]
    prolonged_met = span_seconds >= thresholds["prolonged_unavailability_seconds"]
    destructive_confirmed = bool(destructive) and base_quorum and confirmation_span_met
    prolonged_confirmed = base_quorum and prolonged_met
    loss_confirmed = destructive_confirmed or prolonged_confirmed

    if positive_canonical and not destructive_confirmed:
        loss_confirmed = False

    preventers_by_id = {p["preventer_id"]: p for p in case.get("preventers", [])}
    mandatory = list(policy.get("mandatory_preventers", []))
    allowed_na = set(policy.get("allowed_not_applicable_preventers", []))
    preventer_incomplete = []
    continuity_restored = []
    for pid in mandatory:
        item = preventers_by_id.get(pid)
        if not item:
            preventer_incomplete.append(f"missing:{pid}")
            continue
        status = item.get("status")
        if status == "succeeded":
            continuity_restored.append(pid)
        elif status in {"exhausted", "blocked"}:
            pass
        elif status == "not_applicable" and pid in allowed_na:
            pass
        else:
            preventer_incomplete.append(f"{pid}:{status}")

    if continuity_restored:
        preventer_result = "continuity_restored"
    elif preventer_incomplete:
        preventer_result = "incomplete"
    else:
        preventer_result = "exhausted"

    verified_sources = [s for s in case.get("recovery_sources", []) if s.get("verified") is True]
    recovery_ok = len(verified_sources) >= thresholds["min_verified_recovery_sources"]
    recovery_result = "verified_source_available" if recovery_ok else "no_verified_source"

    reasons: list[str] = []
    if not negative:
        state = "healthy"
        loss_classification = "none"
        decision = "no_rescue"
        reasons.append("no negative observations")
    elif len(negative) < thresholds["min_negative_observations"] or len(negative_classes) < thresholds["min_evidence_classes"]:
        state = "degraded"
        loss_classification = "transient_or_unknown"
        decision = "continue_observation"
        reasons.append("negative evidence has not reached independent quorum")
    elif not base_quorum:
        state = "loss_suspected"
        loss_classification = "transient_or_unknown"
        decision = "continue_observation"
        reasons.append("evidence independence/required signal classes are insufficient")
    elif not loss_confirmed:
        state = "loss_confirmation_pending"
        loss_classification = "transient_or_unknown"
        decision = "continue_observation"
        reasons.append("independent quorum exists but destructive/persistence confirmation is not satisfied")
    else:
        if destructive:
            indicators = {o["indicator"] for o in destructive}
            if "frontier_replaced" in indicators or "integrity_mismatch" in indicators:
                loss_classification = "integrity_loss"
            elif "object_missing" in indicators or "provider_confirmed_deleted" in indicators:
                loss_classification = "destructive_loss"
            else:
                loss_classification = "availability_loss"
        elif has_control and has_read:
            loss_classification = "availability_loss"
        elif has_control:
            loss_classification = "authority_loss"
        else:
            loss_classification = "availability_loss"
        if preventer_result == "exhausted" and recovery_ok:
            state = "rescue_eligible"
            decision = "human_rescue_authorization_may_be_requested"
            reasons.append("loss confirmed, mandatory preventers exhausted, verified recovery source available")
        else:
            state = "loss_confirmed"
            decision = "loss_confirmed_not_rescue_eligible"
            if preventer_result == "continuity_restored":
                reasons.append("a mandatory preventer restored continuity; rescue is blocked")
            elif preventer_result == "incomplete":
                reasons.append("mandatory preventer evaluation is incomplete")
            if not recovery_ok:
                reasons.append("no verified recovery source is available")

    metrics = {
        "negative_observations": len(negative),
        "negative_evidence_classes": sorted(negative_classes),
        "observer_domains": sorted(observer_domains),
        "failure_domains": sorted(failure_domains),
        "confirmation_span_seconds": span_seconds,
        "destructive_indicators": sorted({o["indicator"] for o in destructive}),
        "read_path_negative_present": has_read,
        "control_or_custodian_negative_present": has_control,
        "frontier_or_anchor_present": has_frontier or has_anchor_obs,
        "base_independence_quorum_met": base_quorum,
        "confirmation_span_met": confirmation_span_met,
        "prolonged_unavailability_met": prolonged_met,
        "verified_recovery_source_ids": sorted(s["source_id"] for s in verified_sources),
        "preventer_incomplete": sorted(preventer_incomplete),
        "preventer_succeeded": sorted(continuity_restored)
    }

    now = evaluated_at or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    body = {
        "artifact_type": "ProjectRescueAssessment",
        "artifact_version": "0.1",
        "assessment_id": f"urn:uu-aap:project-rescue-assessment:{sha256_json({'case': case.get('case_id'), 'at': now})[:24]}",
        "case_id": case["case_id"],
        "evaluated_at": now,
        "state": state,
        "loss_classification": loss_classification,
        "metrics": metrics,
        "preventer_result": preventer_result,
        "recovery_result": recovery_result,
        "decision": decision,
        "reasons": reasons,
        "case_sha256": sha256_json(case),
        "policy_sha256": sha256_json(policy),
        "claims": {
            "loss_confirmed": loss_confirmed,
            "rescue_eligible": state == "rescue_eligible",
            "execution_authority_granted": False,
            "canonical_successor_established": False,
            "automatic_failover_executed": False,
            "legal_effect_established": False,
            "truth_certified": False
        }
    }
    with_digest = copy.deepcopy(body)
    with_digest["assessment_sha256"] = "0" * 64
    digest = sha256_json(with_digest)
    body["assessment_sha256"] = digest
    return body


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    ev = sub.add_parser("evaluate")
    ev.add_argument("--policy", required=True)
    ev.add_argument("--case", required=True)
    ev.add_argument("--out")
    ev.add_argument("--evaluated-at")
    args = parser.parse_args()

    if args.command == "evaluate":
        policy = json.loads(Path(args.policy).read_text(encoding="utf-8"))
        case = json.loads(Path(args.case).read_text(encoding="utf-8"))
        result = evaluate(policy, case, args.evaluated_at)
        text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
        if args.out:
            Path(args.out).write_text(text, encoding="utf-8")
        else:
            print(text, end="")


if __name__ == "__main__":
    main()
