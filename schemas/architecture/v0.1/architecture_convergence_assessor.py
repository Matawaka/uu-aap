from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

EXPECTED_PATHS = {
    "coordination": [
        "protocols/ccrp",
        ".github/workflows/ccrp-validation.yml",
    ],
    "authority-governance": [
        "GOVERNANCE.md",
        "FILE_HASHES.md",
    ],
    "survival-rescue": [
        "protection/rescue/v0.6/README.md",
        "protection/rescue/v0.6/test_canonical_recognition.py",
    ],
    "human-succession": [
        "protocols/chsp/v1.1/README.md",
        "protocols/chsp/v1.1/test_chsp_v11.py",
    ],
    "sustainability": [
        "docs/SUSTAINABILITY-KERNEL-CONFORMANCE-v0.1.md",
        "schemas/sustainability/v0.1/tests/test_kernel_conformance_closure_v01.py",
    ],
    "kontur": [
        "server/kontur/v0.1/READINESS_AGGREGATOR.md",
        "server/kontur/v0.1/ACTIVATION_BOUNDARY.md",
        "server/kontur/v0.1/RESPONSIBILITY_LEDGER.md",
    ],
}


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def assess(manifest: Dict[str, Any], repo_root: Path) -> List[str]:
    errors: List[str] = []

    planes = manifest.get("planes", [])
    ids = [p.get("plane_id") for p in planes]
    if len(ids) != len(set(ids)):
        errors.append("duplicate plane_id")
    if set(ids) != set(EXPECTED_PATHS):
        errors.append("required plane set mismatch")

    by_id = {p.get("plane_id"): p for p in planes if p.get("plane_id")}
    for plane_id, expected_paths in EXPECTED_PATHS.items():
        plane = by_id.get(plane_id)
        if not plane:
            continue
        if sorted(plane.get("required_paths", [])) != sorted(expected_paths):
            errors.append(f"{plane_id}: required_paths mismatch")
            continue
        if plane.get("present") is not True:
            errors.append(f"{plane_id}: present must be true")
        for rel in expected_paths:
            if not (repo_root / rel).exists():
                errors.append(f"{plane_id}: missing repository path {rel}")

    claims = manifest.get("claims", {})
    forbidden_true = [
        "external_execution_authorized",
        "kontur_activation_authorized",
        "kontur_activated",
        "current_kontur_activation_frontier_verified",
        "repository_ownership_transferred",
        "canonical_origin_mutated",
        "legal_authority_established",
        "distributed_consensus_established",
        "universal_architecture_completeness_proven",
    ]
    for key in forbidden_true:
        if claims.get(key) is not False:
            errors.append(f"unsafe claim: {key} must be false")

    if claims.get("all_declared_planes_present") is not True:
        errors.append("all_declared_planes_present must be true")
    if claims.get("cross_plane_separation_preserved") is not True:
        errors.append("cross_plane_separation_preserved must be true")
    if claims.get("future_evolution_allowed") is not True:
        errors.append("future_evolution_allowed must be true")

    assessment = manifest.get("assessment", {})
    complete = not errors
    expected_state = "cross-plane-integration-review-eligible" if complete else "incomplete"
    expected_effect = "integration-review-only" if complete else "no-action"
    if assessment.get("state") != expected_state:
        errors.append("assessment.state inconsistent with evidence")
    if assessment.get("safe_effect") != expected_effect:
        errors.append("assessment.safe_effect inconsistent with evidence")

    return errors


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("manifest")
    parser.add_argument("--repo-root", default=".")
    args = parser.parse_args()

    errors = assess(load_json(Path(args.manifest)), Path(args.repo_root))
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("Architecture convergence readiness v0.1: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
