#!/usr/bin/env python3
"""Prepare and assess non-authoritative continuity custodian handoff artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")
ROLE = re.compile(r"^[A-Za-z0-9._-]{1,80}$")
COPY_SLOTS = {"active-local-copy", "sealed-offline-copy", "independent-secondary-copy"}

ENVELOPE_BOUNDARY = {
    "strongest_safe_effect": "prepare_human_custody_handoff_only",
    "handoff_executed": False,
    "custodian_is_successor": False,
    "repository_authority_transferred": False,
    "canonical_successor_claimed": False,
    "rescue_authorized": False,
    "failover_authorized": False,
    "external_execution_authorized": False,
    "kontur_activation_authorized": False,
}

RECEIPT_BOUNDARY_FALSE = (
    "physical_possession_proven",
    "custodian_is_successor",
    "repository_authority_transferred",
    "canonical_successor_claimed",
    "rescue_authorized",
    "failover_authorized",
    "external_execution_authorized",
    "kontur_activation_authorized",
)


class HandoffError(RuntimeError):
    pass


def canonical_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def digest_payload(payload: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_bytes(payload)).hexdigest()


def require_hex(name: str, value: str, pattern: re.Pattern[str]) -> str:
    if not pattern.fullmatch(value):
        raise HandoffError(f"{name} has invalid hexadecimal shape")
    return value


def require_role(value: str) -> str:
    if not ROLE.fullmatch(value):
        raise HandoffError("custodian_role_id has invalid shape")
    return value


def build_envelope(
    *,
    main_sha: str,
    tree_sha: str,
    copy_slot: str,
    custodian_role_id: str,
    bundle_sha256: str,
    capture_manifest_sha256: str,
    metadata_manifest_sha256: str,
    verification_evidence_sha256: str,
) -> dict[str, Any]:
    require_hex("main_sha", main_sha, HEX40)
    require_hex("tree_sha", tree_sha, HEX40)
    if copy_slot not in COPY_SLOTS:
        raise HandoffError("unknown copy slot")
    require_role(custodian_role_id)
    for name, value in (
        ("bundle_sha256", bundle_sha256),
        ("capture_manifest_sha256", capture_manifest_sha256),
        ("metadata_manifest_sha256", metadata_manifest_sha256),
        ("verification_evidence_sha256", verification_evidence_sha256),
    ):
        require_hex(name, value, HEX64)

    envelope: dict[str, Any] = {
        "document_type": "uu-aap.continuity-custodian-handoff-envelope",
        "version": "0.1",
        "status": "handoff-preparation-only",
        "source_frontier": {"main_sha": main_sha, "tree_sha": tree_sha},
        "copy_slot": copy_slot,
        "custodian_role_id": custodian_role_id,
        "artifacts": {
            "bundle_sha256": bundle_sha256,
            "capture_manifest_sha256": capture_manifest_sha256,
            "metadata_manifest_sha256": metadata_manifest_sha256,
            "verification_evidence_sha256": verification_evidence_sha256,
        },
        "storage_requirements": {
            "encrypted_storage_required": True,
            "offline_required": copy_slot == "sealed-offline-copy",
            "distinct_storage_domain_required": True,
            "credential_material_included": False,
            "encryption_key_included": False,
            "account_access_included": False,
        },
        "boundary": dict(ENVELOPE_BOUNDARY),
    }
    envelope["envelope_digest_sha256"] = digest_payload(envelope)
    return envelope


def verify_envelope(envelope: dict[str, Any]) -> None:
    if envelope.get("document_type") != "uu-aap.continuity-custodian-handoff-envelope":
        raise HandoffError("unexpected envelope document_type")
    if envelope.get("version") != "0.1" or envelope.get("status") != "handoff-preparation-only":
        raise HandoffError("unexpected envelope version/status")
    copy_slot = envelope.get("copy_slot")
    if copy_slot not in COPY_SLOTS:
        raise HandoffError("unknown envelope copy slot")
    require_role(envelope.get("custodian_role_id", ""))
    frontier = envelope.get("source_frontier", {})
    require_hex("main_sha", frontier.get("main_sha", ""), HEX40)
    require_hex("tree_sha", frontier.get("tree_sha", ""), HEX40)
    artifacts = envelope.get("artifacts", {})
    for name in (
        "bundle_sha256",
        "capture_manifest_sha256",
        "metadata_manifest_sha256",
        "verification_evidence_sha256",
    ):
        require_hex(name, artifacts.get(name, ""), HEX64)
    expected_storage = {
        "encrypted_storage_required": True,
        "offline_required": copy_slot == "sealed-offline-copy",
        "distinct_storage_domain_required": True,
        "credential_material_included": False,
        "encryption_key_included": False,
        "account_access_included": False,
    }
    if envelope.get("storage_requirements") != expected_storage:
        raise HandoffError("storage requirements mismatch")
    if envelope.get("boundary") != ENVELOPE_BOUNDARY:
        raise HandoffError("envelope boundary mismatch")
    expected_digest = envelope.get("envelope_digest_sha256")
    require_hex("envelope_digest_sha256", expected_digest or "", HEX64)
    unsigned = dict(envelope)
    unsigned.pop("envelope_digest_sha256", None)
    if digest_payload(unsigned) != expected_digest:
        raise HandoffError("envelope digest mismatch")


def assess_receipt(envelope: dict[str, Any], receipt: dict[str, Any]) -> dict[str, Any]:
    verify_envelope(envelope)
    if receipt.get("document_type") != "uu-aap.continuity-human-custody-receipt":
        raise HandoffError("unexpected receipt document_type")
    if receipt.get("version") != "0.1" or receipt.get("status") != "human-custody-attestation":
        raise HandoffError("unexpected receipt version/status")
    boundary = receipt.get("boundary", {})
    for field in RECEIPT_BOUNDARY_FALSE:
        if boundary.get(field) is not False:
            raise HandoffError(f"receipt boundary overclaim: {field}")
    require_hex("custody_evidence_sha256", receipt.get("custody_evidence_sha256", ""), HEX64)
    require_role(receipt.get("custodian_role_id", ""))

    reasons: list[str] = []
    if receipt.get("envelope_digest_sha256") != envelope["envelope_digest_sha256"]:
        reasons.append("envelope_digest_mismatch")
    if receipt.get("copy_slot") != envelope["copy_slot"]:
        reasons.append("copy_slot_mismatch")
    if receipt.get("custodian_role_id") != envelope["custodian_role_id"]:
        reasons.append("custodian_role_mismatch")
    if receipt.get("copy_bytes_verified") is not True:
        reasons.append("copy_bytes_not_verified")
    if receipt.get("human_attestation_required") is not True:
        reasons.append("human_attestation_missing")
    if envelope["storage_requirements"]["offline_required"] and receipt.get("offline_confirmed") is not True:
        reasons.append("offline_custody_not_confirmed")
    if not ROLE.fullmatch(receipt.get("storage_domain_id", "")):
        reasons.append("storage_domain_invalid")

    eligible = not reasons
    return {
        "document_type": "uu-aap.continuity-custody-receipt-assessment",
        "version": "0.1",
        "state": "custody_receipt_review_eligible" if eligible else "custody_receipt_insufficient",
        "envelope_digest_sha256": envelope["envelope_digest_sha256"],
        "copy_slot": envelope["copy_slot"],
        "custodian_role_id": envelope["custodian_role_id"],
        "reasons": reasons,
        "claims": {
            "human_custody_attestation_bound": eligible,
            "human_continuity_review_may_be_requested": eligible,
            "physical_possession_proven": False,
            "custodian_is_successor": False,
            "repository_authority_transferred": False,
            "canonical_successor_claimed": False,
            "rescue_authorized": False,
            "failover_authorized": False,
            "external_execution_authorized": False,
            "kontur_activation_authorized": False,
        },
    }


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Prepare and assess local continuity custody artifacts.")
    sub = p.add_subparsers(dest="command", required=True)

    e = sub.add_parser("envelope")
    e.add_argument("--main-sha", required=True)
    e.add_argument("--tree-sha", required=True)
    e.add_argument("--copy-slot", required=True, choices=sorted(COPY_SLOTS))
    e.add_argument("--custodian-role", required=True)
    e.add_argument("--bundle-sha256", required=True)
    e.add_argument("--capture-manifest-sha256", required=True)
    e.add_argument("--metadata-manifest-sha256", required=True)
    e.add_argument("--verification-evidence-sha256", required=True)

    a = sub.add_parser("assess-receipt")
    a.add_argument("--envelope", required=True)
    a.add_argument("--receipt", required=True)
    return p


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "envelope":
            result = build_envelope(
                main_sha=args.main_sha,
                tree_sha=args.tree_sha,
                copy_slot=args.copy_slot,
                custodian_role_id=args.custodian_role,
                bundle_sha256=args.bundle_sha256,
                capture_manifest_sha256=args.capture_manifest_sha256,
                metadata_manifest_sha256=args.metadata_manifest_sha256,
                verification_evidence_sha256=args.verification_evidence_sha256,
            )
            verify_envelope(result)
            print(json.dumps(result, indent=2, sort_keys=True))
            return 0
        envelope = json.loads(Path(args.envelope).read_text(encoding="utf-8"))
        receipt = json.loads(Path(args.receipt).read_text(encoding="utf-8"))
        result = assess_receipt(envelope, receipt)
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
        return 0 if result["state"] == "custody_receipt_review_eligible" else 1
    except (OSError, json.JSONDecodeError, HandoffError, KeyError, TypeError) as exc:
        print(f"CUSTODIAN HANDOFF ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
