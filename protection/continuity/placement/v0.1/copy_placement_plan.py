#!/usr/bin/env python3
"""Generate a deterministic, prepare-only continuity copy placement plan."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from typing import Any

HEX40 = re.compile(r"^[0-9a-f]{40}$")

POLICY = {
    "schema_id": "urn:uu-aap:continuity:policy:v0.1",
    "minimum_independent_copies": 3,
    "minimum_independent_custodians": 2,
    "offline_copy_required": True,
    "shared_credentials_allowed": False,
    "capture_cadence_days": 7,
    "verification_cadence_days": 30,
    "metadata_backup_required": True,
}

COPY_ROLES = [
    {
        "slot_id": "copy-a",
        "role": "active-local-copy",
        "custodian_role": "custodian-role-a",
        "offline_required": False,
        "unique_storage_domain_required": True,
        "unique_credential_domain_if_credentialed": True,
        "copy_claimed_present": False,
    },
    {
        "slot_id": "copy-b",
        "role": "sealed-offline-copy",
        "custodian_role": "custodian-role-b",
        "offline_required": True,
        "unique_storage_domain_required": True,
        "unique_credential_domain_if_credentialed": True,
        "copy_claimed_present": False,
    },
    {
        "slot_id": "copy-c",
        "role": "independent-secondary-copy",
        "custodian_role": "custodian-role-a-or-b",
        "offline_required": False,
        "unique_storage_domain_required": True,
        "unique_credential_domain_if_credentialed": True,
        "copy_claimed_present": False,
    },
]

PAIRWISE = [
    {"copy_a": "copy-a", "copy_b": "copy-b", "evidence_required": True, "independence_claimed_proven": False},
    {"copy_a": "copy-a", "copy_b": "copy-c", "evidence_required": True, "independence_claimed_proven": False},
    {"copy_a": "copy-b", "copy_b": "copy-c", "evidence_required": True, "independence_claimed_proven": False},
]

EVIDENCE_FIELDS = [
    "source_main_sha",
    "source_tree_sha",
    "capture_manifest_sha256",
    "verification_evidence_sha256",
    "captured_at_utc",
    "verified_at_utc",
    "metadata_backup_present",
    "storage_domain_id",
    "custodian_id",
    "credential_domain_id",
    "offline",
]

BOUNDARY = {
    "strongest_safe_effect": "prepare_operator_copy_placement_only",
    "human_completion_required": True,
    "copies_claimed_present": False,
    "provider_mutation_authorized": False,
    "external_execution_authorized": False,
    "authority_transferred": False,
    "rescue_authorized": False,
    "failover_authorized": False,
    "canonical_successor_claimed": False,
    "kontur_activation_authorized": False,
}


class PlanError(RuntimeError):
    pass


def validate_sha(name: str, value: str) -> str:
    if not HEX40.fullmatch(value):
        raise PlanError(f"{name} must be exactly 40 lowercase hexadecimal characters")
    return value


def canonical_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_digest(payload_without_digest: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_bytes(payload_without_digest)).hexdigest()


def build_plan(main_sha: str, tree_sha: str) -> dict[str, Any]:
    main_sha = validate_sha("main_sha", main_sha)
    tree_sha = validate_sha("tree_sha", tree_sha)
    plan: dict[str, Any] = {
        "document_type": "uu-aap.continuity-copy-placement-plan",
        "version": "0.1",
        "status": "prepare-only",
        "source_frontier": {
            "main_sha": main_sha,
            "tree_sha": tree_sha,
        },
        "policy_binding": POLICY,
        "copy_roles": COPY_ROLES,
        "pairwise_independence_checks": PAIRWISE,
        "operator_evidence_fields": EVIDENCE_FIELDS,
        "boundary": BOUNDARY,
    }
    plan["plan_digest_sha256"] = compute_digest(plan)
    return plan


def verify_plan(plan: dict[str, Any]) -> None:
    expected_digest = plan.get("plan_digest_sha256")
    if not isinstance(expected_digest, str):
        raise PlanError("plan_digest_sha256 missing")
    unsigned = dict(plan)
    unsigned.pop("plan_digest_sha256", None)
    actual_digest = compute_digest(unsigned)
    if actual_digest != expected_digest:
        raise PlanError("plan digest mismatch")
    if plan.get("policy_binding") != POLICY:
        raise PlanError("policy binding mismatch")
    if plan.get("copy_roles") != COPY_ROLES:
        raise PlanError("copy-role topology mismatch")
    if plan.get("pairwise_independence_checks") != PAIRWISE:
        raise PlanError("pairwise evidence topology mismatch")
    if plan.get("operator_evidence_fields") != EVIDENCE_FIELDS:
        raise PlanError("operator evidence field set mismatch")
    if plan.get("boundary") != BOUNDARY:
        raise PlanError("boundary mismatch")


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Generate a prepare-only continuity copy placement plan.")
    p.add_argument("--main-sha", required=True)
    p.add_argument("--tree-sha", required=True)
    return p


def main() -> int:
    try:
        args = parser().parse_args()
        plan = build_plan(args.main_sha, args.tree_sha)
        verify_plan(plan)
    except PlanError as exc:
        print(f"COPY PLACEMENT PLAN ERROR: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(plan, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
