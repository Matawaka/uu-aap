from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

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

SHA40 = re.compile(r"^[0-9a-f]{40}$")


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def assess(
    manifest: Dict[str, Any],
    repo_root: Path,
    git_facts: Optional[Dict[str, Any]] = None,
) -> List[str]:
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

    predecessor = manifest.get("canonical_predecessor_sha")
    if not git_facts:
        errors.append("canonical predecessor verification context required")
    else:
        observed_predecessor = git_facts.get("observed_predecessor_sha")
        assessed_revision = git_facts.get("assessed_revision_sha")
        if not isinstance(observed_predecessor, str) or not SHA40.fullmatch(observed_predecessor):
            errors.append("observed predecessor SHA must be exact 40-hex")
        if not isinstance(assessed_revision, str) or not SHA40.fullmatch(assessed_revision):
            errors.append("assessed revision SHA must be exact 40-hex")
        if observed_predecessor != predecessor:
            errors.append("declared predecessor differs from observed Git predecessor")
        if git_facts.get("predecessor_object_exists") is not True:
            errors.append("declared predecessor commit object not verified")
        if git_facts.get("predecessor_is_ancestor") is not True:
            errors.append("declared predecessor ancestry not verified")

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


def _as_bool(value: Optional[str]) -> Optional[bool]:
    if value is None:
        return None
    return value == "true"


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("manifest")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--observed-predecessor-sha")
    parser.add_argument("--assessed-revision-sha")
    parser.add_argument("--predecessor-object-exists", choices=["true", "false"])
    parser.add_argument("--predecessor-is-ancestor", choices=["true", "false"])
    args = parser.parse_args()

    supplied = [
        args.observed_predecessor_sha,
        args.assessed_revision_sha,
        args.predecessor_object_exists,
        args.predecessor_is_ancestor,
    ]
    git_facts = None
    if any(value is not None for value in supplied):
        git_facts = {
            "observed_predecessor_sha": args.observed_predecessor_sha,
            "assessed_revision_sha": args.assessed_revision_sha,
            "predecessor_object_exists": _as_bool(args.predecessor_object_exists),
            "predecessor_is_ancestor": _as_bool(args.predecessor_is_ancestor),
        }

    errors = assess(load_json(Path(args.manifest)), Path(args.repo_root), git_facts)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("Architecture convergence readiness v0.1: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
