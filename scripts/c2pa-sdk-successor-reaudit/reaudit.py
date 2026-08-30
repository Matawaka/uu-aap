#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

PER_SDK = {
    "UNCHANGED",
    "CHANGED_REAUDIT_REQUIRED",
    "RESOLVED_CANDIDATE_RETEST_REQUIRED",
    "UNAVAILABLE",
}
OVERALL = {
    "NO_RECLASSIFICATION_REQUIRED",
    "TARGETED_REAUDIT_REQUIRED",
    "OBSERVATION_INCOMPLETE",
}

NON_EFFECT_KEYS = [
    "historical_evidence_rewritten",
    "historical_contract_mutated",
    "core_modified",
    "c2pa_conformance_established",
    "current_lossless_preservation_established",
    "current_cross_sdk_compatibility_established",
    "authorship_established",
    "authority_established",
    "responsibility_established",
    "truth_certified",
    "trust_score_created",
]


def read_json(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def classify_swift(base: dict[str, Any], obs: dict[str, Any]) -> tuple[str, list[str]]:
    if not obs.get("available", False):
        return "UNAVAILABLE", ["swift upstream observation unavailable"]

    reasons: list[str] = []
    if obs.get("pr_state") != base["baseline_pr_state"]:
        reasons.append("PR #161 state changed")
    if obs.get("pr_head_sha") != base["baseline_pr_head_sha"]:
        reasons.append("PR #161 head changed")

    candidate = base["candidate_contract"]
    if obs.get("candidate_public_binary_release") != candidate["public_binary_release"]:
        reasons.append("candidate public C2PAC release changed")
    if obs.get("candidate_reader_crjson_present") != candidate["reader_crjson_present"]:
        reasons.append("candidate c2pa_reader_crjson contract changed")
    if obs.get("candidate_claim_generator_additional_fields_present") != candidate["claim_generator_additional_fields_present"]:
        reasons.append("candidate additionalFields contract changed")

    default = base["default_branch_observation_at_baseline"]
    main_interface_changed = (
        obs.get("main_public_binary_release") != default["public_binary_release"]
        or obs.get("main_claim_generator_additional_fields_present") != default["claim_generator_additional_fields_present"]
    )
    if main_interface_changed:
        reasons.append("default-branch preservation/packaging interface changed")

    if not reasons:
        return "UNCHANGED", ["relevant Swift candidate and public packaging contracts unchanged"]

    resolved_candidate = (
        obs.get("candidate_claim_generator_additional_fields_present") is True
        and obs.get("candidate_reader_crjson_present") is True
        and obs.get("candidate_public_binary_release") != candidate["public_binary_release"]
    ) or obs.get("main_claim_generator_additional_fields_present") is True

    if resolved_candidate:
        return "RESOLVED_CANDIDATE_RETEST_REQUIRED", reasons
    return "CHANGED_REAUDIT_REQUIRED", reasons


def classify_android(base: dict[str, Any], obs: dict[str, Any]) -> tuple[str, list[str]]:
    if not obs.get("available", False):
        return "UNAVAILABLE", ["android upstream observation unavailable"]

    reasons: list[str] = []
    if obs.get("main_sha") != base["baseline_main_sha"]:
        reasons.append("Android default-branch SHA changed")

    contract = base["interface_contract"]
    if obs.get("ignore_unknown_keys") != contract["ignore_unknown_keys"]:
        reasons.append("ignoreUnknownKeys contract changed")
    if obs.get("claim_generator_additional_fields_present") != contract["claim_generator_additional_fields_present"]:
        reasons.append("ClaimGeneratorInfo unknown-field preservation contract changed")
    if obs.get("assertion_definition_custom_present") != contract["assertion_definition_custom_present"]:
        reasons.append("AssertionDefinition.Custom contract changed")

    if not reasons:
        return "UNCHANGED", ["Android upstream SHA and relevant interface contracts unchanged"]

    if obs.get("claim_generator_additional_fields_present") is True:
        return "RESOLVED_CANDIDATE_RETEST_REQUIRED", reasons
    return "CHANGED_REAUDIT_REQUIRED", reasons


def build_receipt(baseline: dict[str, Any], observation: dict[str, Any]) -> dict[str, Any]:
    swift_status, swift_reasons = classify_swift(baseline["swift"], observation.get("swift", {}))
    android_status, android_reasons = classify_android(baseline["android"], observation.get("android", {}))

    if "UNAVAILABLE" in {swift_status, android_status}:
        overall = "OBSERVATION_INCOMPLETE"
    elif {swift_status, android_status} == {"UNCHANGED"}:
        overall = "NO_RECLASSIFICATION_REQUIRED"
    elif swift_status == "UNCHANGED" and android_status == "UNCHANGED":
        overall = "NO_RECLASSIFICATION_REQUIRED"
    else:
        overall = "TARGETED_REAUDIT_REQUIRED"

    receipt: dict[str, Any] = {
        "schema": "urn:uu-aap:c2pa-sdk-preservation-reaudit-receipt:0.2",
        "issue": baseline["issue"],
        "repository_predecessor_main": baseline["repository_predecessor_main"],
        "historical_contract": copy.deepcopy(baseline["historical_contract"]),
        "historical_evidence": {
            "swift": {
                "evidence_pr": baseline["swift"]["evidence_pr"],
                "evidence_head_sha": baseline["swift"]["evidence_head_sha"],
                "historical_surfaces": copy.deepcopy(baseline["swift"]["historical_surfaces"]),
            },
            "android": {
                "evidence_pr": baseline["android"]["evidence_pr"],
                "evidence_head_sha": baseline["android"]["evidence_head_sha"],
                "historical_surfaces": copy.deepcopy(baseline["android"]["historical_surfaces"]),
            },
        },
        "observation_source": observation.get("observation_source", "unknown"),
        "swift": {
            "classification": swift_status,
            "reasons": swift_reasons,
            "observation": copy.deepcopy(observation.get("swift", {})),
            "historical_blocked_result_reclassified": False,
        },
        "android": {
            "classification": android_status,
            "reasons": android_reasons,
            "observation": copy.deepcopy(observation.get("android", {})),
            "historical_incompatible_lossy_results_reclassified": False,
        },
        "overall": overall,
        "current_compatibility_established": False,
        "current_lossless_preservation_established": False,
        "next_gate": (
            "NO_TARGETED_REAUDIT_UNTIL_RELEVANT_UPSTREAM_CHANGE"
            if overall == "NO_RECLASSIFICATION_REQUIRED"
            else "TARGETED_EXECUTABLE_REAUDIT_REQUIRED"
            if overall == "TARGETED_REAUDIT_REQUIRED"
            else "RETRY_UPSTREAM_OBSERVATION"
        ),
        "non_effects": {key: False for key in NON_EFFECT_KEYS},
        "invariants": copy.deepcopy(baseline["invariants"]),
    }
    receipt["baseline_sha256"] = digest(baseline)
    receipt["observation_sha256"] = digest(observation)
    receipt["receipt_fingerprint_sha256"] = digest(receipt)
    validate_receipt(receipt)
    return receipt


def _walk_keys(value: Any):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from _walk_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_keys(child)


def validate_receipt(receipt: dict[str, Any]) -> None:
    if receipt.get("overall") not in OVERALL:
        raise ValueError("invalid overall classification")
    for sdk in ("swift", "android"):
        if receipt.get(sdk, {}).get("classification") not in PER_SDK:
            raise ValueError(f"invalid {sdk} classification")
    if any(value is not False for value in receipt.get("non_effects", {}).values()):
        raise ValueError("non-effects must remain false")
    forbidden_score_keys = {
        "score", "trust_score", "compatibility_score", "confidence", "probability", "rating", "percentage"
    }
    found = forbidden_score_keys.intersection(set(_walk_keys(receipt)))
    if found:
        raise ValueError(f"score-like fields forbidden: {sorted(found)}")
    if receipt.get("current_compatibility_established") is not False:
        raise ValueError("re-audit cannot establish current compatibility")
    if receipt.get("historical_contract", {}).get("status") != "INCOMPLETE":
        raise ValueError("historical #783 status must remain unchanged")


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(f"usage: {argv[0]} BASELINE.json OBSERVATION.json", file=sys.stderr)
        return 2
    baseline = read_json(argv[1])
    observation = read_json(argv[2])
    receipt = build_receipt(baseline, observation)
    print(json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
