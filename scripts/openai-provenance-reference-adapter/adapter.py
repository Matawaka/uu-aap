#!/usr/bin/env python3
"""Reference adapter for OpenAI Content Provenance API responses.

This is an application-level interoperability adapter. It does not call the
OpenAI API and does not establish UU-AAP/PoAI authority, intent, responsibility,
truth, or decision-time availability.
"""

from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ADAPTER_ID = "urn:uu-aap:interop:openai-content-provenance-reference-adapter:v0.1"
SOURCE_ENDPOINT = "POST /v1/content_provenance_checks"
RECEIPT_TYPE = "OpenAIProvenanceEvidenceReceipt"
RECEIPT_VERSION = "0.1"

NON_EFFECT_KEYS = (
    "creator_identity_established",
    "human_authorship_established",
    "intent_established",
    "purpose_established",
    "authority_established",
    "publication_authority_established",
    "responsibility_established",
    "truth_certified",
    "accuracy_established",
    "unedited_content_proven",
    "legal_ownership_established",
    "correct_context_established",
    "complete_history_established",
    "decision_time_availability_established",
    "consideration_established",
    "causality_established",
    "liability_established",
    "action_permit_created",
    "external_effect_authorized",
)

FORBIDDEN_SCALAR_KEYS = {
    "trust_score",
    "truth_score",
    "confidence_score",
    "provenance_score",
    "authorship_score",
    "responsibility_score",
    "probability",
    "likelihood",
}

KNOWN_RESULT_FIELDS = {
    "c2pa": {"type", "outcome", "validation_state", "issuer", "model", "generated_at"},
    "synthid": {"type", "outcome", "model", "generated_at"},
}


class AdapterError(ValueError):
    pass


def _canonical_json_bytes(value: Any) -> bytes:
    """Deterministic adapter-local JSON encoding; not claimed as RFC 8785/JCS."""
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _walk_keys(value: Any):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from _walk_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_keys(child)


def _reject_forbidden_scalars(value: Any) -> None:
    found = sorted({key for key in _walk_keys(value) if key in FORBIDDEN_SCALAR_KEYS})
    if found:
        raise AdapterError(f"forbidden scalar/trust fields present: {', '.join(found)}")


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AdapterError(message)


def validate_source_response(response: dict[str, Any]) -> None:
    _require(isinstance(response, dict), "response must be an object")
    _reject_forbidden_scalars(response)
    _require(response.get("object") == "content_provenance_check",
             "unexpected response object")
    _require(isinstance(response.get("created_at"), int) and response["created_at"] >= 0,
             "created_at must be a non-negative integer")
    results = response.get("results")
    _require(isinstance(results, list) and results, "results must be a non-empty list")

    seen: set[str] = set()
    for index, result in enumerate(results):
        _require(isinstance(result, dict), f"results[{index}] must be an object")
        result_type = result.get("type")
        _require(isinstance(result_type, str) and result_type,
                 f"results[{index}].type must be a non-empty string")
        _require(result_type not in seen, f"duplicate result type: {result_type}")
        seen.add(result_type)

        # Unknown future signal types are retained in the source hash and surfaced as
        # uninterpreted extensions rather than silently translated.
        if result_type not in KNOWN_RESULT_FIELDS:
            continue

        outcome = result.get("outcome")
        _require(outcome in {"detected", "not_detected"},
                 f"{result_type}.outcome must be detected or not_detected")

        if result_type == "c2pa":
            state = result.get("validation_state")
            _require(state in {"trusted", "valid", "invalid", "not_present"},
                     "c2pa.validation_state is unsupported")
            if outcome == "detected":
                _require(state in {"trusted", "valid"},
                         "c2pa detected requires trusted or valid validation_state")


def _normalize_known_result(result: dict[str, Any]) -> dict[str, Any]:
    result_type = result["type"]
    outcome = result["outcome"]

    if result_type == "c2pa":
        state = result["validation_state"]
        positive = outcome == "detected" and state in {"trusted", "valid"}
        normalized = {
            "type": "c2pa",
            "outcome": outcome,
            "validation_state": state,
            "issuer": result.get("issuer"),
            "model": result.get("model"),
            "generated_at": result.get("generated_at"),
            "supported_signal_detected": positive,
            "admissible_provenance_evidence": positive,
        }
    elif result_type == "synthid":
        positive = outcome == "detected"
        normalized = {
            "type": "synthid",
            "outcome": outcome,
            "model": result.get("model"),
            "generated_at": result.get("generated_at"),
            "supported_signal_detected": positive,
            "admissible_provenance_evidence": positive,
        }
    else:
        raise AssertionError("known-result normalizer called for unknown type")

    unknown_fields = sorted(set(result) - KNOWN_RESULT_FIELDS[result_type])
    normalized["unmapped_source_fields"] = unknown_fields
    normalized["unmapped_fields_semantically_interpreted"] = False
    return normalized


def build_receipt(response: dict[str, Any], source_bytes: bytes) -> dict[str, Any]:
    validate_source_response(response)
    _require(bool(source_bytes), "source response bytes must be non-empty")

    normalized_signals: list[dict[str, Any]] = []
    unsupported_types: list[str] = []

    for result in response["results"]:
        result_type = result["type"]
        if result_type in KNOWN_RESULT_FIELDS:
            normalized_signals.append(_normalize_known_result(result))
        else:
            unsupported_types.append(result_type)

    c2pa = next((s for s in normalized_signals if s["type"] == "c2pa"), None)
    synthid = next((s for s in normalized_signals if s["type"] == "synthid"), None)

    c2pa_positive = bool(c2pa and c2pa["supported_signal_detected"])
    synthid_positive = bool(synthid and synthid["supported_signal_detected"])
    detected_count = int(c2pa_positive) + int(synthid_positive)
    known_channel_count = int(c2pa is not None) + int(synthid is not None)

    if c2pa_positive and synthid_positive:
        classification = "MULTIPLE_OPENAI_SIGNAL_CHANNELS_DETECTED"
    elif c2pa_positive:
        classification = "OPENAI_C2PA_SIGNAL_DETECTED"
    elif synthid_positive:
        classification = "OPENAI_SYNTHID_SIGNAL_DETECTED"
    else:
        classification = "NO_SUPPORTED_OPENAI_SIGNAL_DETECTED"

    mixed_signal_state = (
        known_channel_count >= 2
        and detected_count > 0
        and detected_count < known_channel_count
    )

    body = {
        "receipt_type": RECEIPT_TYPE,
        "receipt_version": RECEIPT_VERSION,
        "adapter_id": ADAPTER_ID,
        "source": {
            "provider": "openai",
            "endpoint": SOURCE_ENDPOINT,
            "response_object": response["object"],
            "check_created_at": response["created_at"],
            "source_response_sha256": _sha256(source_bytes),
            "live_api_observation_established": False,
        },
        "compatibility": {
            "known_signal_types": ["c2pa", "synthid"],
            "unsupported_result_types": sorted(unsupported_types),
            "unknown_result_types_semantically_interpreted": False,
            "source_bytes_preserved_by_hash": True,
        },
        "signals": normalized_signals,
        "classification": classification,
        "assertions": {
            "openai_supported_signal_detected": detected_count > 0,
            "c2pa_openai_generation_signal_detected": c2pa_positive,
            "synthid_supported_watermark_detected": synthid_positive,
            "no_supported_signal_detected": detected_count == 0,
            "mixed_signal_state": mixed_signal_state,
            "plural_signal_channels": known_channel_count >= 2,
            "plural_detected_signal_channels": detected_count >= 2,
            "independent_corroboration_established": False,
        },
        "non_effects": {key: False for key in NON_EFFECT_KEYS},
    }

    body["fingerprint_profile"] = "sorted-json-sha256-adapter-local-v0.1-not-jcs"
    body["fingerprint_sha256"] = _sha256(_canonical_json_bytes(body))
    validate_receipt(body)
    return body


def validate_receipt(receipt: dict[str, Any]) -> None:
    _require(isinstance(receipt, dict), "receipt must be an object")
    _reject_forbidden_scalars(receipt)
    _require(receipt.get("receipt_type") == RECEIPT_TYPE, "wrong receipt_type")
    _require(receipt.get("receipt_version") == RECEIPT_VERSION, "wrong receipt_version")
    _require(receipt.get("adapter_id") == ADAPTER_ID, "wrong adapter_id")

    assertions = receipt.get("assertions")
    _require(isinstance(assertions, dict), "assertions missing")
    expected_assertion_keys = {
        "openai_supported_signal_detected",
        "c2pa_openai_generation_signal_detected",
        "synthid_supported_watermark_detected",
        "no_supported_signal_detected",
        "mixed_signal_state",
        "plural_signal_channels",
        "plural_detected_signal_channels",
        "independent_corroboration_established",
    }
    _require(set(assertions) == expected_assertion_keys, "assertion key set mismatch")
    _require(assertions["independent_corroboration_established"] is False,
             "provider signal plurality must not establish independent corroboration")

    for key, value in assertions.items():
        _require(isinstance(value, bool), f"assertion {key} must be boolean")

    non_effects = receipt.get("non_effects")
    _require(isinstance(non_effects, dict), "non_effects missing")
    _require(set(non_effects) == set(NON_EFFECT_KEYS), "non-effect key set mismatch")
    for key in NON_EFFECT_KEYS:
        _require(non_effects[key] is False, f"non-effect escalated: {key}")

    signals = receipt.get("signals")
    _require(isinstance(signals, list), "signals must be a list")
    c2pa = next((s for s in signals if s.get("type") == "c2pa"), None)
    synthid = next((s for s in signals if s.get("type") == "synthid"), None)

    c2pa_positive = bool(c2pa and c2pa.get("supported_signal_detected") is True)
    synthid_positive = bool(synthid and synthid.get("supported_signal_detected") is True)
    detected_count = int(c2pa_positive) + int(synthid_positive)
    channel_count = int(c2pa is not None) + int(synthid is not None)

    _require(assertions["openai_supported_signal_detected"] == (detected_count > 0),
             "openai_supported_signal_detected inconsistent")
    _require(assertions["c2pa_openai_generation_signal_detected"] == c2pa_positive,
             "c2pa assertion inconsistent")
    _require(assertions["synthid_supported_watermark_detected"] == synthid_positive,
             "synthid assertion inconsistent")
    _require(assertions["no_supported_signal_detected"] == (detected_count == 0),
             "no-supported-signal assertion inconsistent")
    _require(assertions["plural_signal_channels"] == (channel_count >= 2),
             "plural_signal_channels inconsistent")
    _require(assertions["plural_detected_signal_channels"] == (detected_count >= 2),
             "plural_detected_signal_channels inconsistent")

    mixed = channel_count >= 2 and detected_count > 0 and detected_count < channel_count
    _require(assertions["mixed_signal_state"] == mixed,
             "mixed_signal_state inconsistent")

    classification = receipt.get("classification")
    if c2pa_positive and synthid_positive:
        expected_classification = "MULTIPLE_OPENAI_SIGNAL_CHANNELS_DETECTED"
    elif c2pa_positive:
        expected_classification = "OPENAI_C2PA_SIGNAL_DETECTED"
    elif synthid_positive:
        expected_classification = "OPENAI_SYNTHID_SIGNAL_DETECTED"
    else:
        expected_classification = "NO_SUPPORTED_OPENAI_SIGNAL_DETECTED"
    _require(classification == expected_classification, "classification inconsistent")

    fingerprint = receipt.get("fingerprint_sha256")
    _require(isinstance(fingerprint, str) and len(fingerprint) == 64,
             "fingerprint_sha256 missing or malformed")
    candidate = copy.deepcopy(receipt)
    candidate.pop("fingerprint_sha256", None)
    expected = _sha256(_canonical_json_bytes(candidate))
    _require(fingerprint == expected, "fingerprint_sha256 mismatch")


def adapt_file(path: Path) -> dict[str, Any]:
    source_bytes = path.read_bytes()
    try:
        response = json.loads(source_bytes)
    except json.JSONDecodeError as exc:
        raise AdapterError(f"invalid JSON: {exc}") from exc
    return build_receipt(response, source_bytes)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {Path(argv[0]).name} <content-provenance-response.json>", file=sys.stderr)
        return 2
    try:
        receipt = adapt_file(Path(argv[1]))
    except (OSError, AdapterError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
