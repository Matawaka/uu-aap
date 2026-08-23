#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


class CapabilityCeilingSemanticError(ValueError):
    pass


def classify_capability(payload: dict[str, Any]) -> tuple[str, str]:
    capability_set = payload["capability_set"]
    allowed = set(capability_set["allowed"])
    denied = set(capability_set["denied"])

    overlap = sorted(allowed & denied)
    if overlap:
        raise CapabilityCeilingSemanticError(
            "capability cannot be both allowed and denied: " + ", ".join(overlap)
        )

    requested = payload["assessment"]["requested_capability"]
    if requested in denied:
        return "denied", "no-action"
    if requested in allowed:
        return "within-ceiling", "prepare-only"
    return "requires-fresh-authorization", "no-action"


def validate_semantics(payload: dict[str, Any]) -> tuple[str, str]:
    expected_result, expected_effect = classify_capability(payload)
    assessment = payload["assessment"]
    actual = (assessment["result"], assessment["safe_effect"])
    expected = (expected_result, expected_effect)
    if actual != expected:
        raise CapabilityCeilingSemanticError(
            "assessment does not match declared capability ceiling: "
            f"expected result={expected_result!r}, safe_effect={expected_effect!r}; "
            f"got result={actual[0]!r}, safe_effect={actual[1]!r}"
        )
    return expected


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate semantic consistency of a Sustainability Capability Ceiling v0.1 artifact."
    )
    parser.add_argument("artifact", type=Path)
    args = parser.parse_args()

    payload = json.loads(args.artifact.read_text(encoding="utf-8"))
    result, safe_effect = validate_semantics(payload)
    print(json.dumps({"result": result, "safe_effect": safe_effect}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
