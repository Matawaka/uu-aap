#!/usr/bin/env python3
"""Assess declared continuity copy-set evidence without network or mutation."""
from __future__ import annotations

import itertools
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

EXPECTED_POLICY = {
    "schema_id": "urn:uu-aap:continuity:policy:v0.1",
    "minimum_independent_copies": 3,
    "minimum_independent_custodians": 2,
    "offline_copy_required": True,
    "shared_credentials_allowed": False,
    "capture_cadence_days": 7,
    "verification_cadence_days": 30,
    "metadata_backup_required": True,
}

BOUNDARY_FALSE = (
    "physical_independence_proven",
    "continuity_guaranteed",
    "canonical_successor_claimed",
    "authority_transferred",
    "rescue_authorized",
    "failover_authorized",
    "external_execution_authorized",
    "kontur_activation_authorized",
)


class AssessmentError(RuntimeError):
    pass


def parse_time(value: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise AssessmentError(f"invalid date-time: {value}") from exc
    if dt.tzinfo is None:
        raise AssessmentError(f"date-time lacks timezone: {value}")
    return dt.astimezone(timezone.utc)


def age_days(as_of: datetime, observed: datetime) -> float:
    return (as_of - observed).total_seconds() / 86400.0


def pair_key(a: str, b: str) -> tuple[str, str]:
    if a == b:
        raise AssessmentError("independence attestation cannot compare a copy with itself")
    return tuple(sorted((a, b)))


def validate_static(payload: dict[str, Any]) -> None:
    if payload.get("document_type") != "uu-aap.continuity-copy-set-attestation":
        raise AssessmentError("unexpected document_type")
    if payload.get("version") != "0.1":
        raise AssessmentError("unexpected version")
    if payload.get("status") != "experimental-evidence":
        raise AssessmentError("unexpected status")
    if payload.get("policy_binding") != EXPECTED_POLICY:
        raise AssessmentError("policy binding differs from Continuity v0.1 reference thresholds")
    boundary = payload.get("boundary", {})
    for field in BOUNDARY_FALSE:
        if boundary.get(field) is not False:
            raise AssessmentError(f"boundary overclaim: {field} must be false")


def assess(payload: dict[str, Any]) -> dict[str, Any]:
    validate_static(payload)
    as_of = parse_time(payload["as_of_utc"])
    frontier = payload["source_frontier"]
    copies = payload.get("copies", [])
    if not copies:
        raise AssessmentError("copies must not be empty")

    by_id: dict[str, dict[str, Any]] = {}
    disqualified: dict[str, list[str]] = {}
    qualifying: list[dict[str, Any]] = []

    for copy in copies:
        cid = copy["copy_id"]
        if cid in by_id:
            raise AssessmentError(f"duplicate copy_id: {cid}")
        by_id[cid] = copy
        reasons: list[str] = []
        captured = parse_time(copy["captured_at_utc"])
        verified = parse_time(copy["verified_at_utc"])
        if captured > verified:
            reasons.append("captured_after_verified")
        if verified > as_of or captured > as_of:
            reasons.append("future_timestamp")
        capture_age = age_days(as_of, captured)
        verify_age = age_days(as_of, verified)
        if capture_age < 0 or capture_age > EXPECTED_POLICY["capture_cadence_days"]:
            reasons.append("capture_stale")
        if verify_age < 0 or verify_age > EXPECTED_POLICY["verification_cadence_days"]:
            reasons.append("verification_stale")
        if copy["source_main_sha"] != frontier["main_sha"]:
            reasons.append("main_frontier_mismatch")
        if copy["source_tree_sha"] != frontier["tree_sha"]:
            reasons.append("tree_frontier_mismatch")
        if copy["metadata_backup_present"] is not True:
            reasons.append("metadata_backup_missing")
        if copy["shared_credentials_declared"] is not False:
            reasons.append("shared_credentials_declared")
        if copy["offline"] and copy["access_mode"] != "offline":
            reasons.append("offline_mode_inconsistent")
        if copy["access_mode"] == "offline" and copy["offline"] is not True:
            reasons.append("offline_flag_inconsistent")
        if reasons:
            disqualified[cid] = sorted(set(reasons))
        else:
            qualifying.append(copy)

    support: set[tuple[str, str]] = set()
    contradict: set[tuple[str, str]] = set()
    stale_attestations = 0
    for att in payload.get("independence_attestations", []):
        if att["copy_a"] not in by_id or att["copy_b"] not in by_id:
            raise AssessmentError("independence attestation references unknown copy")
        key = pair_key(att["copy_a"], att["copy_b"])
        observed = parse_time(att["observed_at_utc"])
        att_age = age_days(as_of, observed)
        if att_age < 0:
            raise AssessmentError("independence attestation is from the future")
        if att_age > EXPECTED_POLICY["verification_cadence_days"]:
            stale_attestations += 1
            continue
        if att["result"] == "support":
            support.add(key)
        elif att["result"] == "contradict":
            contradict.add(key)

    min_copies = EXPECTED_POLICY["minimum_independent_copies"]
    min_custodians = EXPECTED_POLICY["minimum_independent_custodians"]
    eligible_subset: list[str] | None = None

    for size in range(min_copies, len(qualifying) + 1):
        for combo in itertools.combinations(qualifying, size):
            ids = [c["copy_id"] for c in combo]
            storage_domains = {c["storage_domain_id"] for c in combo}
            if len(storage_domains) != len(combo):
                continue
            if len({c["custodian_id"] for c in combo}) < min_custodians:
                continue
            if EXPECTED_POLICY["offline_copy_required"] and not any(c["offline"] for c in combo):
                continue
            credential_ids = [c["credential_domain_id"] for c in combo if c["credential_domain_id"] is not None]
            if len(credential_ids) != len(set(credential_ids)):
                continue
            pairs = {pair_key(a, b) for a, b in itertools.combinations(ids, 2)}
            if pairs & contradict:
                continue
            if not pairs.issubset(support):
                continue
            eligible_subset = sorted(ids)
            break
        if eligible_subset is not None:
            break

    state = "copy_set_review_eligible" if eligible_subset else "copy_set_insufficient"
    reasons: list[str] = []
    if len(qualifying) < min_copies:
        reasons.append("too_few_fresh_frontier_bound_copies")
    if eligible_subset is None and len(qualifying) >= min_copies:
        reasons.append("no_subset_satisfies_distribution_and_pairwise_evidence")

    return {
        "document_type": "uu-aap.continuity-copy-set-assessment",
        "version": "0.1",
        "as_of_utc": payload["as_of_utc"],
        "source_frontier": frontier,
        "state": state,
        "eligible_copy_ids": eligible_subset or [],
        "qualifying_copy_count": len(qualifying),
        "disqualified_copies": disqualified,
        "fresh_support_pair_count": len(support),
        "fresh_contradict_pair_count": len(contradict),
        "stale_independence_attestation_count": stale_attestations,
        "reasons": reasons,
        "claims": {
            "policy_thresholds_met_by_declared_evidence": eligible_subset is not None,
            "human_continuity_review_may_be_requested": eligible_subset is not None,
            "physical_independence_proven": False,
            "continuity_guaranteed": False,
            "canonical_successor_claimed": False,
            "authority_transferred": False,
            "rescue_authorized": False,
            "failover_authorized": False,
            "external_execution_authorized": False,
            "kontur_activation_authorized": False,
        },
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: copy_set_assessor.py <attestation.json>", file=sys.stderr)
        return 2
    try:
        payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        result = assess(payload)
    except (OSError, json.JSONDecodeError, KeyError, TypeError, AssessmentError) as exc:
        print(f"COPY SET ASSESSMENT ERROR: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0 if result["state"] == "copy_set_review_eligible" else 1


if __name__ == "__main__":
    raise SystemExit(main())
