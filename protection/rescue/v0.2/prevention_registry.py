#!/usr/bin/env python3
"""Deterministic, local Prevention Registry summarizer for Project Survival Plane v0.2."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ALLOWED_TYPES = {
    "alternate_canonical_read_path",
    "standby_human_or_collaborator_path",
    "provider_recovery_or_support_path",
    "known_good_frontier_verification",
    "local_git_bundle_or_mirror",
    "independent_second_remote",
    "metadata_snapshot",
    "kontur_readonly_ledger_replica",
}
ALLOWED_AVAILABILITY = {"available", "degraded", "unavailable", "unverified", "retired"}
ALLOWED_ATTEMPTS = {"not_attempted", "succeeded", "failed", "blocked", "not_applicable"}
RESOLVED_FAILURE_STATES = {"failed", "blocked", "not_applicable"}


def fail(message: str) -> None:
    raise ValueError(f"Prevention Registry v0.2: {message}")


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def load_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_registry(registry: dict[str, Any]) -> None:
    if registry.get("artifact_type") != "PreventionRegistry" or registry.get("artifact_version") != "0.2":
        fail("PreventionRegistry v0.2 required")
    preventers = registry.get("preventers")
    if not isinstance(preventers, list) or not preventers:
        fail("non-empty preventers array required")
    ids: set[str] = set()
    for item in preventers:
        pid = item.get("preventer_id")
        if not isinstance(pid, str) or not pid:
            fail("preventer_id required")
        if pid in ids:
            fail(f"duplicate preventer_id {pid}")
        ids.add(pid)
        if item.get("preventer_type") not in ALLOWED_TYPES:
            fail(f"unknown preventer_type for {pid}")
        if item.get("availability_state") not in ALLOWED_AVAILABILITY:
            fail(f"invalid availability_state for {pid}")
        attempt_state = item.get("attempt_state")
        if attempt_state not in ALLOWED_ATTEMPTS:
            fail(f"invalid attempt_state for {pid}")
        if item.get("can_mutate_canonical_state") is not False:
            fail(f"canonical mutation capability prohibited for {pid}")
        claims = item.get("claims") or {}
        for key in ("canonical_authority_held", "canonical_successor_established", "ownership_transferred", "automatic_failover_enabled"):
            if claims.get(key) is not False:
                fail(f"prohibited claim {key} for {pid}")
        attempts = item.get("attempts", [])
        if not isinstance(attempts, list):
            fail(f"attempts must be an array for {pid}")
        if attempt_state == "not_attempted":
            if attempts:
                fail(f"attempt history present while state is not_attempted for {pid}")
        else:
            if not attempts:
                fail(f"evidence-bearing attempt required for {pid}")
            latest = attempts[-1]
            if latest.get("result") != attempt_state:
                fail(f"latest attempt result/state mismatch for {pid}")
            evidence = latest.get("evidence_sha256")
            if not isinstance(evidence, str) or len(evidence) != 64 or any(c not in "0123456789abcdef" for c in evidence):
                fail(f"valid attempt evidence_sha256 required for {pid}")
        verified_at = item.get("last_verified_at")
        verification_sha = item.get("verification_sha256")
        if (verified_at is None) != (verification_sha is None):
            fail(f"last_verified_at and verification_sha256 must appear together for {pid}")
    top_claims = registry.get("claims") or {}
    if top_claims.get("registry_descriptive_only") is not True:
        fail("registry_descriptive_only must be true")
    if top_claims.get("execution_authority_granted") is not False or top_claims.get("canonical_successor_established") is not False:
        fail("registry cannot grant authority or canonical succession")


def summarize(registry: dict[str, Any]) -> dict[str, Any]:
    validate_registry(registry)
    mandatory = [p for p in registry["preventers"] if p.get("mandatory_before_rescue") is True]
    if not mandatory:
        fail("at least one mandatory preventer required")

    succeeded = [p["preventer_id"] for p in mandatory if p["attempt_state"] == "succeeded"]
    unresolved = [p["preventer_id"] for p in mandatory if p["attempt_state"] == "not_attempted"]
    exhausted = [p["preventer_id"] for p in mandatory if p["attempt_state"] in RESOLVED_FAILURE_STATES]

    if succeeded:
        preventer_result = "continuity_restored"
        rescue_gate = "blocked_by_successful_preventer"
    elif len(exhausted) == len(mandatory):
        preventer_result = "exhausted"
        rescue_gate = "preventer_gate_satisfied"
    else:
        preventer_result = "incomplete"
        rescue_gate = "blocked_by_unresolved_preventer"

    body = {
        "artifact_type": "PreventionRegistryAssessment",
        "artifact_version": "0.2",
        "registry_id": registry["registry_id"],
        "registry_sha256": sha256_json(registry),
        "preventer_result": preventer_result,
        "rescue_gate": rescue_gate,
        "metrics": {
            "preventer_count": len(registry["preventers"]),
            "mandatory_count": len(mandatory),
            "mandatory_succeeded": sorted(succeeded),
            "mandatory_exhausted_or_blocked": sorted(exhausted),
            "mandatory_unresolved": sorted(unresolved),
            "distinct_failure_domains": len({p["failure_domain_id"] for p in registry["preventers"]}),
            "distinct_custodian_domains": len({p["custodian_domain_id"] for p in registry["preventers"]}),
        },
        "claims": {
            "preventer_state_assessed": True,
            "loss_confirmed": False,
            "rescue_eligible": False,
            "execution_authority_granted": False,
            "canonical_successor_established": False,
        },
    }
    body["assessment_sha256"] = sha256_json(body)
    return body


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("summarize")
    p.add_argument("--registry", required=True)
    p.add_argument("--out")
    args = parser.parse_args()
    if args.command == "summarize":
        result = summarize(load_json(args.registry))
        text = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        if args.out:
            Path(args.out).write_text(text, encoding="utf-8")
        else:
            print(text, end="")


if __name__ == "__main__":
    main()
