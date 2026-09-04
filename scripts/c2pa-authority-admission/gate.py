#!/usr/bin/env python3
"""Fail-closed post-crypto authority-admission quorum gate."""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:c2pa-authority-admission-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:c2pa-authority-admission-receipt:0.1"
ALLOWED_CRYPTO_STATES = {"VALID", "INVALID", "UNVERIFIED"}


class GateInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise GateInputError(message)


def _unique_string_list(value: Any, name: str, *, allow_empty: bool = True) -> list[str]:
    if not isinstance(value, list):
        _fail(f"{name} must be an array")
    if not allow_empty and not value:
        _fail(f"{name} must not be empty")
    if any(not isinstance(item, str) or not item for item in value):
        _fail(f"{name} must contain only non-empty strings")
    if len(set(value)) != len(value):
        _fail(f"{name} must not contain duplicates")
    return value


def _sha256(value: Any, name: str) -> str:
    if not isinstance(value, str):
        _fail(f"{name} must be a lowercase SHA-256 hex string")
    if len(value) != 64 or any(ch not in "0123456789abcdef" for ch in value):
        _fail(f"{name} must be a lowercase SHA-256 hex string")
    return value


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict):
        _fail("input must be a JSON object")
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")

    trust_root = data.get("trust_root")
    if not isinstance(trust_root, dict):
        _fail("trust_root must be an object")

    root_id = trust_root.get("id")
    if not isinstance(root_id, str) or not root_id:
        _fail("trust_root.id must be a non-empty string")

    root_version = trust_root.get("version")
    if type(root_version) is not int or root_version < 1:
        _fail("trust_root.version must be a positive integer")

    root_digest = _sha256(
        trust_root.get("document_sha256"),
        "trust_root.document_sha256",
    )
    if trust_root.get("verification_status") != "VALID":
        _fail("trust_root.verification_status must be VALID before admission evaluation")

    admitted_list = _unique_string_list(
        trust_root.get("admitted_signers"),
        "trust_root.admitted_signers",
        allow_empty=False,
    )
    admitted = set(admitted_list)

    quorum = trust_root.get("quorum_required")
    if type(quorum) is not int or quorum < 1:
        _fail("trust_root.quorum_required must be a positive integer")
    if quorum > len(admitted):
        _fail("trust_root.quorum_required cannot exceed admitted signer count")

    configured_list = _unique_string_list(
        data.get("configured_signers"),
        "configured_signers",
        allow_empty=True,
    )
    configured = set(configured_list)

    signatures = data.get("signatures")
    if not isinstance(signatures, list):
        _fail("signatures must be an array")

    observations: dict[str, list[str]] = defaultdict(list)
    for index, item in enumerate(signatures):
        if not isinstance(item, dict):
            _fail(f"signatures[{index}] must be an object")
        signer = item.get("signer")
        status = item.get("crypto_status")
        if not isinstance(signer, str) or not signer:
            _fail(f"signatures[{index}].signer must be a non-empty string")
        if status not in ALLOWED_CRYPTO_STATES:
            _fail(
                f"signatures[{index}].crypto_status must be one of "
                f"{sorted(ALLOWED_CRYPTO_STATES)}"
            )
        observations[signer].append(status)

    configured_only = sorted(configured - admitted)
    admitted_only = sorted(admitted - configured)
    if configured_only and admitted_only:
        drift_status = "BIDIRECTIONAL_DRIFT"
    elif configured_only:
        drift_status = "CONFIGURED_UNADMITTED_PRESENT"
    elif admitted_only:
        drift_status = "SIGNED_ROOT_NOT_CONFIGURED"
    else:
        drift_status = "ALIGNED"

    evaluations: list[dict[str, Any]] = []
    cryptographically_valid = 0
    eligible = 0

    for signer in sorted(observations):
        statuses = set(observations[signer])
        duplicate_observations = len(observations[signer])

        if len(statuses) != 1:
            state = "CONFLICTING_CRYPTO_OBSERVATIONS"
            reason = "CONFLICTING_CRYPTO_OBSERVATIONS"
            is_eligible = False
        else:
            status = next(iter(statuses))
            if status == "VALID":
                cryptographically_valid += 1
                if signer in admitted:
                    state = "ELIGIBLE"
                    reason = None
                    is_eligible = True
                    eligible += 1
                else:
                    state = "CRYPTOGRAPHICALLY_VALID_BUT_UNADMITTED"
                    reason = "VALID_BUT_NOT_ADMITTED_BY_SIGNED_ROOT"
                    is_eligible = False
            elif status == "INVALID":
                state = "CRYPTOGRAPHICALLY_INVALID"
                reason = "CRYPTOGRAPHICALLY_INVALID"
                is_eligible = False
            else:
                state = "CRYPTOGRAPHICALLY_UNVERIFIED"
                reason = "CRYPTOGRAPHICALLY_UNVERIFIED"
                is_eligible = False

        evaluations.append(
            {
                "signer": signer,
                "observation_count": duplicate_observations,
                "configured": signer in configured,
                "admitted_by_signed_root": signer in admitted,
                "state": state,
                "quorum_eligible": is_eligible,
                "excluded_reason": reason,
            }
        )

    quorum_result = "QUORUM_MET" if eligible >= quorum else "QUORUM_NOT_MET"

    return {
        "schema": RECEIPT_SCHEMA,
        "trust_root": {
            "id": root_id,
            "version": root_version,
            "document_sha256": root_digest,
            "verification_status": "VALID",
            "admitted_signer_count": len(admitted),
            "quorum_required": quorum,
        },
        "configuration": {
            "configured_signer_count": len(configured),
            "authority_admission_status": drift_status,
            "configured_but_unadmitted": configured_only,
            "admitted_but_unconfigured": admitted_only,
        },
        "signatures": {
            "observation_count": len(signatures),
            "distinct_signer_count": len(observations),
            "cryptographically_valid_distinct_signer_count": cryptographically_valid,
            "eligible_distinct_signer_count": eligible,
            "evaluations": evaluations,
        },
        "quorum_result": quorum_result,
        "semantic_guards": {
            "configuration_mints_quorum_eligibility": False,
            "signature_validity_mints_quorum_eligibility": False,
            "unverified_root_mints_quorum_eligibility": False,
            "successor_root_backfills_historical_eligibility": False,
            "quorum_eligibility_mints_broader_authority_or_truth": False,
        },
    }


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: gate.py <input.json>", file=sys.stderr)
        raise SystemExit(2)

    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        receipt = evaluate(data)
    except (OSError, json.JSONDecodeError, GateInputError) as exc:
        print(f"authority-admission gate: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)

    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
