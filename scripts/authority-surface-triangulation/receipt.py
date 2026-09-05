#!/usr/bin/env python3
"""Deterministic three-surface authority triangulation receipt."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:authority-surface-triangulation-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:authority-surface-triangulation-receipt:0.1"

TOP_LEVEL_KEYS = {"schema", "runtime_surface", "export_surface", "signed_root"}
RUNTIME_KEYS = {"id", "document_sha256", "configured_signers"}
EXPORT_KEYS = {"id", "document_sha256", "signers"}
ROOT_KEYS = {
    "id",
    "version",
    "document_sha256",
    "verification_status",
    "admitted_signers",
}


class TriangulationInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise TriangulationInputError(message)


def _exact_keys(value: Any, expected: set[str], name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(f"{name} must be an object")
    keys = set(value)
    missing = sorted(expected - keys)
    unknown = sorted(keys - expected)
    if missing or unknown:
        _fail(f"{name} keys mismatch: missing={missing}, unknown={unknown}")
    return value


def _nonempty_string(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value:
        _fail(f"{name} must be a non-empty string")
    return value


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


def _pairwise(left: set[str], right: set[str], left_name: str, right_name: str) -> dict[str, Any]:
    left_only = sorted(left - right)
    right_only = sorted(right - left)
    return {
        left_name: left_only,
        right_name: right_only,
        "delta_present": bool(left_only or right_only),
    }


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, TOP_LEVEL_KEYS, "input")
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")

    runtime = _exact_keys(data["runtime_surface"], RUNTIME_KEYS, "runtime_surface")
    runtime_id = _nonempty_string(runtime["id"], "runtime_surface.id")
    runtime_digest = _sha256(runtime["document_sha256"], "runtime_surface.document_sha256")
    configured_list = _unique_signers(
        runtime["configured_signers"], "runtime_surface.configured_signers"
    )
    configured = set(configured_list)

    export = _exact_keys(data["export_surface"], EXPORT_KEYS, "export_surface")
    export_id = _nonempty_string(export["id"], "export_surface.id")
    export_digest = _sha256(export["document_sha256"], "export_surface.document_sha256")
    exported_list = _unique_signers(export["signers"], "export_surface.signers")
    exported = set(exported_list)

    root = _exact_keys(data["signed_root"], ROOT_KEYS, "signed_root")
    root_id = _nonempty_string(root["id"], "signed_root.id")
    root_version = root["version"]
    if type(root_version) is not int or root_version < 1:
        _fail("signed_root.version must be a positive integer")
    root_digest = _sha256(root["document_sha256"], "signed_root.document_sha256")
    if root["verification_status"] != "VALID":
        _fail("signed_root.verification_status must be VALID")
    admitted_list = _unique_signers(root["admitted_signers"], "signed_root.admitted_signers")
    admitted = set(admitted_list)

    runtime_root = _pairwise(
        configured,
        admitted,
        "configured_but_unadmitted",
        "admitted_but_unconfigured",
    )
    export_root = _pairwise(
        exported,
        admitted,
        "exported_but_unadmitted",
        "admitted_but_unexported",
    )
    runtime_export = _pairwise(
        configured,
        exported,
        "configured_but_unexported",
        "exported_but_unconfigured",
    )

    any_delta = any(
        pair["delta_present"] for pair in (runtime_root, export_root, runtime_export)
    )

    return {
        "schema": RECEIPT_SCHEMA,
        "runtime_surface": {
            "id": runtime_id,
            "document_sha256": runtime_digest,
            "configured_signer_count": len(configured),
        },
        "export_surface": {
            "id": export_id,
            "document_sha256": export_digest,
            "exported_signer_count": len(exported),
        },
        "signed_root": {
            "id": root_id,
            "version": root_version,
            "document_sha256": root_digest,
            "verification_status": "VALID",
            "admitted_signer_count": len(admitted),
        },
        "comparisons": {
            "runtime_vs_signed_root": runtime_root,
            "export_vs_signed_root": export_root,
            "runtime_vs_export": runtime_export,
        },
        "any_delta_present": any_delta,
        "semantic_guards": {
            "any_delta_is_failure_verdict": False,
            "triangulation_is_authority_decision": False,
            "triangulation_mints_trust": False,
            "triangulation_calculates_or_mutates_quorum": False,
            "triangulation_admits_or_revokes_signer": False,
            "triangulation_triggers_alert_or_remediation": False,
            "successor_root_backfills_historical_receipt": False,
        },
    }


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: receipt.py <input.json>", file=sys.stderr)
        raise SystemExit(2)

    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        receipt = evaluate(data)
    except (OSError, json.JSONDecodeError, TriangulationInputError) as exc:
        print(f"authority surface triangulation: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)

    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
