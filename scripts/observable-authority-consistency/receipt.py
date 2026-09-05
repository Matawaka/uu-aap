#!/usr/bin/env python3
"""Deterministic observable authority consistency receipt."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:observable-authority-consistency-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:observable-authority-consistency-receipt:0.1"
FORBIDDEN_KEYS = {
    "aggregate_score",
    "trust_score",
    "severity",
    "severity_score",
    "rank",
    "remediation",
    "remediation_command",
    "quorum_override",
    "quorum_mutation",
    "admit",
    "revoke",
}


class ReceiptInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise ReceiptInputError(message)


def _sha256(value: Any, name: str) -> str:
    if not isinstance(value, str) or len(value) != 64:
        _fail(f"{name} must be a lowercase SHA-256 hex string")
    if any(ch not in "0123456789abcdef" for ch in value):
        _fail(f"{name} must be a lowercase SHA-256 hex string")
    return value


def _unique_signers(value: Any, name: str) -> list[str]:
    if not isinstance(value, list):
        _fail(f"{name} must be an array")
    if any(not isinstance(item, str) or not item for item in value):
        _fail(f"{name} must contain only non-empty strings")
    if len(set(value)) != len(value):
        _fail(f"{name} must not contain duplicates")
    return value


def _scan_forbidden(value: Any, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key.lower() in FORBIDDEN_KEYS:
                _fail(f"forbidden authority/score field at {child_path}")
            _scan_forbidden(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _scan_forbidden(child, f"{path}[{index}]")


def _require_exact_keys(value: dict[str, Any], allowed: set[str], name: str) -> None:
    actual = set(value)
    if actual != allowed:
        missing = sorted(allowed - actual)
        extra = sorted(actual - allowed)
        _fail(f"{name} fields must be exact; missing={missing}, extra={extra}")


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict):
        _fail("input must be a JSON object")

    _scan_forbidden(data)
    _require_exact_keys(
        data,
        {"schema", "export_surface", "signed_root"},
        "input",
    )
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")

    export = data.get("export_surface")
    if not isinstance(export, dict):
        _fail("export_surface must be an object")
    _require_exact_keys(
        export,
        {"id", "document_sha256", "signers"},
        "export_surface",
    )
    export_id = export.get("id")
    if not isinstance(export_id, str) or not export_id:
        _fail("export_surface.id must be a non-empty string")
    export_digest = _sha256(
        export.get("document_sha256"),
        "export_surface.document_sha256",
    )
    exported_list = _unique_signers(export.get("signers"), "export_surface.signers")
    exported = set(exported_list)

    root = data.get("signed_root")
    if not isinstance(root, dict):
        _fail("signed_root must be an object")
    _require_exact_keys(
        root,
        {
            "id",
            "version",
            "document_sha256",
            "verification_status",
            "admitted_signers",
        },
        "signed_root",
    )
    root_id = root.get("id")
    if not isinstance(root_id, str) or not root_id:
        _fail("signed_root.id must be a non-empty string")
    root_version = root.get("version")
    if type(root_version) is not int or root_version < 1:
        _fail("signed_root.version must be a positive integer")
    root_digest = _sha256(
        root.get("document_sha256"),
        "signed_root.document_sha256",
    )
    if root.get("verification_status") != "VALID":
        _fail("signed_root.verification_status must be VALID")
    admitted_list = _unique_signers(
        root.get("admitted_signers"),
        "signed_root.admitted_signers",
    )
    admitted = set(admitted_list)

    exported_only = sorted(exported - admitted)
    admitted_only = sorted(admitted - exported)

    if exported_only and admitted_only:
        state = "BIDIRECTIONAL_DELTA"
    elif exported_only:
        state = "EXPORTED_UNADMITTED_PRESENT"
    elif admitted_only:
        state = "ADMITTED_UNEXPORTED_PRESENT"
    else:
        state = "ALIGNED"

    return {
        "schema": RECEIPT_SCHEMA,
        "export_surface": {
            "id": export_id,
            "document_sha256": export_digest,
            "signer_count": len(exported),
        },
        "signed_root": {
            "id": root_id,
            "version": root_version,
            "document_sha256": root_digest,
            "verification_status": "VALID",
            "admitted_signer_count": len(admitted),
        },
        "consistency": {
            "state": state,
            "delta_present": bool(exported_only or admitted_only),
            "exported_but_unadmitted": exported_only,
            "admitted_but_unexported": admitted_only,
        },
        "semantic_guards": {
            "delta_is_authority_decision": False,
            "delta_is_failure_verdict": False,
            "receipt_mints_quorum_authority": False,
            "receipt_mutates_quorum": False,
            "receipt_admits_or_revokes_signer": False,
            "receipt_triggers_remediation": False,
            "successor_root_backfills_historical_receipt": False,
            "alert_policy_required_for_observability": False,
        },
    }


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: receipt.py <input.json>", file=sys.stderr)
        raise SystemExit(2)

    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        receipt = evaluate(data)
    except (OSError, json.JSONDecodeError, ReceiptInputError) as exc:
        print(f"observable authority consistency receipt: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)

    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
