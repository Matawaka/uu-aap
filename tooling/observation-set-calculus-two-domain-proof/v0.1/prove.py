#!/usr/bin/env python3
"""Machine-readable proof that two independent adapters consume one candidate profile."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[3]
PROFILE_PATH = REPO_ROOT / "protocols/integration/observation-set-calculus-candidate/v0.1/profile.py"
C2PA_ADAPTER_PATH = REPO_ROOT / "interop/c2pa/observation-set-calculus-adapter/v0.1/adapter.py"
PUBLIC_REVIEW_ADAPTER_PATH = REPO_ROOT / "tooling/public-review-observation-set-adapter/v0.1/adapter.py"
C2PA_FIXTURE_PATH = REPO_ROOT / "scripts/observed-authority-branch-set/fixtures/three-branches.json"

RECEIPT_SCHEMA = "urn:uu-aap:observation-set-calculus-two-domain-reuse-proof:0.1"
ORIGIN_MAIN = "70346024ece165735c7ecb043d048448a18c7578"


class TwoDomainReuseProofError(ValueError):
    pass


def _fail(message: str) -> None:
    raise TwoDomainReuseProofError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


profile = _load_module("observation_set_candidate_for_two_domain_proof", PROFILE_PATH)
c2pa_adapter = _load_module("c2pa_candidate_adapter_for_two_domain_proof", C2PA_ADAPTER_PATH)
public_review_adapter = _load_module(
    "public_review_candidate_adapter_for_two_domain_proof",
    PUBLIC_REVIEW_ADAPTER_PATH,
)


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _c2pa_vectors() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    source = json.loads(C2PA_FIXTURE_PATH.read_text(encoding="utf-8"))
    branches = source["branches"]
    before = {
        "schema": c2pa_adapter.branch_set.INPUT_SCHEMA,
        "branches": branches[:2],
    }
    after = {
        "schema": c2pa_adapter.branch_set.INPUT_SCHEMA,
        "branches": branches,
    }
    transition = {
        "schema": c2pa_adapter.set_transition.INPUT_SCHEMA,
        "before_set": before,
        "after_set": after,
    }
    multiplicity = {
        "schema": c2pa_adapter.branch_set.INPUT_SCHEMA,
        "branches": [branches[0], branches[1], branches[1]],
    }
    chain = {
        "schema": c2pa_adapter.set_chain.INPUT_SCHEMA,
        "sets": [before, after, multiplicity],
    }
    return source, transition, chain


def build_proof() -> dict[str, Any]:
    expected_path = PROFILE_PATH.resolve()
    if c2pa_adapter.PROFILE_PATH.resolve() != expected_path:
        _fail("C2PA adapter does not load the canonical candidate profile path")
    if public_review_adapter.PROFILE_PATH.resolve() != expected_path:
        _fail("Public Review adapter does not load the canonical candidate profile path")

    profile_digest = _sha256_file(PROFILE_PATH)
    if c2pa_adapter.candidate_profile_sha256() != profile_digest:
        _fail("C2PA adapter candidate profile digest mismatch")
    if public_review_adapter.candidate_profile_sha256() != profile_digest:
        _fail("Public Review adapter candidate profile digest mismatch")

    c2pa_set_input, c2pa_transition_input, c2pa_chain_input = _c2pa_vectors()
    c2pa_set = c2pa_adapter.project_set(c2pa_set_input)
    c2pa_transition = c2pa_adapter.project_transition(c2pa_transition_input)
    c2pa_chain = c2pa_adapter.project_chain(c2pa_chain_input)
    public_review_set = public_review_adapter.project_checkpoint()

    candidate_set_schema = profile.SET_RECEIPT_SCHEMA
    if c2pa_set["candidate_receipt"]["schema"] != candidate_set_schema:
        _fail("C2PA adapter did not emit the shared candidate set receipt schema")
    if public_review_set["candidate_receipt"]["schema"] != candidate_set_schema:
        _fail("Public Review adapter did not emit the shared candidate set receipt schema")
    if c2pa_set["candidate_receipt"]["candidate_status"] != profile.CANDIDATE_STATUS:
        _fail("C2PA adapter candidate status mismatch")
    if public_review_set["candidate_receipt"]["candidate_status"] != profile.CANDIDATE_STATUS:
        _fail("Public Review adapter candidate status mismatch")
    if not all(c2pa_set["parity"].values()):
        _fail("C2PA set parity incomplete")
    if not all(c2pa_transition["parity"].values()):
        _fail("C2PA transition parity incomplete")
    if not all(c2pa_chain["parity"].values()):
        _fail("C2PA chain parity incomplete")
    if not all(public_review_set["parity"].values()):
        _fail("Public Review set parity incomplete")

    return {
        "schema": RECEIPT_SCHEMA,
        "origin_main": ORIGIN_MAIN,
        "tracking_issue": 909,
        "candidate": {
            "status": profile.CANDIDATE_STATUS,
            "profile_path": str(PROFILE_PATH.relative_to(REPO_ROOT)).replace("\\", "/"),
            "profile_sha256": profile_digest,
            "shared_set_receipt_schema": candidate_set_schema,
            "transition_receipt_schema": profile.TRANSITION_RECEIPT_SCHEMA,
            "chain_receipt_schema": profile.CHAIN_RECEIPT_SCHEMA,
        },
        "adapters": {
            "c2pa": {
                "domain": c2pa_set["domain"],
                "adapter_path": str(C2PA_ADAPTER_PATH.relative_to(REPO_ROOT)).replace("\\", "/"),
                "adapter_sha256": _sha256_file(C2PA_ADAPTER_PATH),
                "candidate_profile_sha256": c2pa_set["candidate_profile_sha256"],
                "set_reuse": True,
                "transition_reuse": True,
                "chain_reuse": True,
                "source_parity": {
                    "set": all(c2pa_set["parity"].values()),
                    "transition": all(c2pa_transition["parity"].values()),
                    "chain": all(c2pa_chain["parity"].values()),
                },
            },
            "public_review": {
                "domain": public_review_set["domain"],
                "adapter_path": str(PUBLIC_REVIEW_ADAPTER_PATH.relative_to(REPO_ROOT)).replace("\\", "/"),
                "adapter_sha256": _sha256_file(PUBLIC_REVIEW_ADAPTER_PATH),
                "candidate_profile_sha256": public_review_set["candidate_profile_sha256"],
                "set_reuse": True,
                "transition_reuse": False,
                "chain_reuse": False,
                "actual_projected_external_source_count": public_review_set["source_counts"][
                    "projected_external_sources"
                ],
                "accepted_checkpoint_validated": public_review_set["parity"][
                    "accepted_checkpoint_validated"
                ],
            },
        },
        "direct_reuse": {
            "independent_adapter_count": 2,
            "same_resolved_profile_path": True,
            "same_profile_bytes": True,
            "same_set_receipt_schema": True,
            "both_invoked_candidate_set_evaluator": True,
            "direct_shared_implementation_reuse_proven": True,
        },
        "scope_limits": {
            "cross_domain_semantic_equivalence_proven": False,
            "universal_applicability_proven": False,
            "generic_fork_topology_proven": False,
            "global_equivocation_proven": False,
            "complete_history_proven": False,
            "trusted_time_proven": False,
            "truth_proven": False,
            "authority_created": False,
        },
        "admission": {
            "stable_core_admission_performed": False,
            "interface_registry_admission_performed": False,
            "candidate_profile_registered": False,
            "next_safe_action": "RE_RUN_REUSABLE_COMPONENT_ADMISSION_AUDIT_AFTER_DIRECT_REUSE_PROOF",
        },
        "non_effects": {
            "c2pa_reclassified": False,
            "public_review_admission_or_disposition_made": False,
            "kontur_activated": False,
            "lsr_actuated": False,
            "action_permit_created": False,
            "workbench_reactivated": False,
            "release_or_tag_created": False,
            "external_effect_performed": False,
        },
    }


def main() -> None:
    try:
        proof = build_proof()
    except (OSError, json.JSONDecodeError, TwoDomainReuseProofError) as exc:
        print(f"two-domain observation-set reuse proof: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(proof, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
