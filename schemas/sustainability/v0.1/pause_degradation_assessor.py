#!/usr/bin/env python3

import json
import pathlib
import sys


EXPECTED = {
    "human_pause": ("paused", "preserve-only"),
    "provider_degradation": ("degraded", "observe-and-preserve-only"),
    "context_loss": ("recovery-required", "invoke-recovery-contract-only"),
    "unknown": ("recovery-required", "invoke-recovery-contract-only"),
}


class SemanticError(ValueError):
    pass


def assess(payload):
    kind = payload["interruption"]["kind"]
    declared_result = payload["classification"]["result"]
    declared_effect = payload["classification"]["safe_effect"]
    expected_result, expected_effect = EXPECTED[kind]

    if (declared_result, declared_effect) != (expected_result, expected_effect):
        raise SemanticError(
            f"classification mismatch for {kind}: expected "
            f"{expected_result}/{expected_effect}, got "
            f"{declared_result}/{declared_effect}"
        )

    if not payload["classification"]["recovery_resume_required_before_later_preparation"]:
        raise SemanticError("recovery/resume must be required before later preparation")

    invariants = payload["invariants"]
    required_false = [
        "mutable_authorization_preserved",
        "pause_is_abandonment",
        "pause_is_authority_waiver",
        "inactivity_is_consent",
        "degradation_authorizes_failover",
        "degradation_authorizes_bypass",
        "context_loss_authorizes_rescue",
        "automatic_resume",
        "external_execution_authorized",
    ]
    if not invariants["history_preserved"]:
        raise SemanticError("history must remain preserved")
    for key in required_false:
        if invariants[key]:
            raise SemanticError(f"unsafe invariant must remain false: {key}")

    if payload["authority_effect"] != "none":
        raise SemanticError("pause/degradation classification must have no authority effect")
    if payload["external_execution_authorized"]:
        raise SemanticError("pause/degradation classification cannot authorize execution")
    if payload["interruption"]["continuous_monitoring_used"]:
        raise SemanticError("continuous monitoring is outside the contract")

    return {"result": expected_result, "safe_effect": expected_effect}


def main(argv):
    if len(argv) != 2:
        raise SystemExit("usage: pause_degradation_assessor.py <contract.json>")
    path = pathlib.Path(argv[1])
    payload = json.loads(path.read_text(encoding="utf-8"))
    print(json.dumps(assess(payload), sort_keys=True))


if __name__ == "__main__":
    main(sys.argv)
