#!/usr/bin/env python3
"""Public Review checkpoint adapter to the candidate observation-set calculus."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[3]
PROFILE_PATH = (
    REPO_ROOT
    / "protocols/integration/observation-set-calculus-candidate/v0.1/profile.py"
)
CHECKPOINT_DIR = REPO_ROOT / "tooling/public-review-observation-checkpoint/v0.1"
CHECKPOINT_PATH = CHECKPOINT_DIR / "checkpoint.json"
ISSUE_RECEIPT_PATH = CHECKPOINT_DIR / "repository-issues-live-receipt.json"
DISCUSSION_RECEIPT_PATH = CHECKPOINT_DIR / "declared-discussions-live-receipt.json"
CHECKPOINT_VALIDATOR_PATH = CHECKPOINT_DIR / "validate_checkpoint.py"

ADAPTER_RECEIPT_SCHEMA = "urn:uu-aap:public-review-observation-set-calculus-adapter-receipt:0.1"


class PublicReviewObservationSetAdapterError(ValueError):
    pass


def _fail(message: str) -> None:
    raise PublicReviewObservationSetAdapterError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


profile = _load_module("observation_set_calculus_candidate_for_public_review", PROFILE_PATH)
checkpoint_validator = _load_module(
    "public_review_checkpoint_validator_for_observation_set_adapter",
    CHECKPOINT_VALIDATOR_PATH,
)


def candidate_profile_sha256() -> str:
    return hashlib.sha256(PROFILE_PATH.read_bytes()).hexdigest()


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _issue_source_semantic_identity(repository: str, source: dict[str, Any]) -> dict[str, Any]:
    required = ("source_kind", "issue_number", "source_id", "url", "body_sha256")
    missing = [key for key in required if key not in source]
    if missing:
        _fail(f"Public Review issue source missing semantic identity fields: {missing}")
    return {
        "repository": repository,
        "source_kind": source["source_kind"],
        "issue_number": source["issue_number"],
        "source_id": source["source_id"],
        "url": source["url"],
        "body_sha256": source["body_sha256"],
    }


def _project_issue_source(repository: str, source: dict[str, Any]) -> dict[str, str]:
    return {
        "semantic_fingerprint_sha256": profile.canonical_sha256(
            _issue_source_semantic_identity(repository, source)
        ),
        "source_binding_sha256": profile.canonical_sha256(source),
    }


def project_checkpoint(
    checkpoint_path: Path = CHECKPOINT_PATH,
    issue_receipt_path: Path = ISSUE_RECEIPT_PATH,
    discussion_receipt_path: Path = DISCUSSION_RECEIPT_PATH,
) -> dict[str, Any]:
    checkpoint_path = Path(checkpoint_path)
    issue_receipt_path = Path(issue_receipt_path)
    discussion_receipt_path = Path(discussion_receipt_path)

    try:
        checkpoint_validator.validate_files(
            checkpoint_path,
            issue_receipt_path,
            discussion_receipt_path,
        )
    except Exception as exc:  # accepted validator owns its typed failures
        _fail(f"accepted Public Review checkpoint validation failed: {exc}")

    checkpoint = _load_json(checkpoint_path)
    issue_receipt = _load_json(issue_receipt_path)
    discussion_receipt = _load_json(discussion_receipt_path)

    repository = checkpoint["repository"]
    if issue_receipt.get("repository") != repository:
        _fail("repository Issue receipt repository mismatch")
    if discussion_receipt.get("repository") != repository:
        _fail("Discussion receipt repository mismatch")

    # v0.1 is intentionally bound to the accepted checkpoint evidence shape.
    # There are no external Discussion sources in that accepted checkpoint.
    # A future non-empty Discussion source shape requires a successor adapter,
    # not silent guessing about its semantic identity fields.
    discussion_sources = discussion_receipt.get("external_account_sources")
    if discussion_sources != []:
        _fail("non-empty external Discussion source set requires successor adapter semantics")

    known = issue_receipt["known_historical_external_sources"]
    new = issue_receipt["new_external_account_sources"]
    issue_sources = list(known) + list(new)
    observations = [_project_issue_source(repository, source) for source in issue_sources]

    scope_descriptor = {
        "repository": repository,
        "covered_surfaces": checkpoint["covered_surfaces"],
    }
    candidate_input = {
        "schema": profile.SET_INPUT_SCHEMA,
        "scope_binding_sha256": profile.canonical_sha256(scope_descriptor),
        "observations": observations,
    }
    try:
        candidate_receipt = profile.evaluate_set(candidate_input)
    except profile.ObservationSetInputError as exc:
        _fail(f"candidate set rejected Public Review projection: {exc}")

    expected_count = len(issue_sources) + len(discussion_sources)
    if candidate_receipt["observation_count"] != expected_count:
        _fail("Public Review external-source observation count parity mismatch")
    if expected_count != issue_receipt["counts"]["external_account_sources"]:
        _fail("accepted Public Review external-source count mismatch")
    if len(known) != issue_receipt["counts"]["known_historical_external_sources"]:
        _fail("known historical Public Review source count mismatch")
    if len(new) != issue_receipt["counts"]["new_external_account_sources"]:
        _fail("new Public Review source count mismatch")

    return {
        "schema": ADAPTER_RECEIPT_SCHEMA,
        "domain": "PUBLIC_REVIEW_EXTERNAL_SOURCE_OBSERVATION",
        "candidate_profile_sha256": candidate_profile_sha256(),
        "accepted_checkpoint_binding": {
            "checkpoint_sha256": hashlib.sha256(checkpoint_path.read_bytes()).hexdigest(),
            "repository_issue_receipt_sha256": hashlib.sha256(
                issue_receipt_path.read_bytes()
            ).hexdigest(),
            "discussion_receipt_sha256": hashlib.sha256(
                discussion_receipt_path.read_bytes()
            ).hexdigest(),
        },
        "scope_descriptor_sha256": candidate_input["scope_binding_sha256"],
        "source_counts": {
            "known_historical_external_sources": len(known),
            "new_external_account_sources": len(new),
            "external_discussion_sources": len(discussion_sources),
            "projected_external_sources": expected_count,
        },
        "candidate_input": candidate_input,
        "candidate_receipt": candidate_receipt,
        "parity": {
            "accepted_checkpoint_validated": True,
            "external_source_count": True,
            "coverage_bound_into_scope": True,
        },
        "non_effects": {
            "verified_human_identity_established": False,
            "independence_established": False,
            "claim_relevance_established": False,
            "claim_truth_established": False,
            "external_validation_established": False,
            "admission_decision_made": False,
            "disposition_decision_made": False,
            "normative_change_made": False,
            "action_permit_created": False,
            "stable_core_admitted": False,
            "interface_registry_admitted": False,
        },
    }


def main() -> None:
    if len(sys.argv) not in {1, 4}:
        print(
            "usage: adapter.py [checkpoint.json repository-issues.json discussions.json]",
            file=sys.stderr,
        )
        raise SystemExit(2)
    try:
        if len(sys.argv) == 1:
            receipt = project_checkpoint()
        else:
            receipt = project_checkpoint(
                Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
            )
    except (OSError, json.JSONDecodeError, PublicReviewObservationSetAdapterError) as exc:
        print(f"Public Review observation-set calculus adapter: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
