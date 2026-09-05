#!/usr/bin/env python3
"""C2PA authority-observability adapter to the candidate observation-set calculus."""

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
SCRIPTS = REPO_ROOT / "scripts"

SET_ADAPTER_RECEIPT_SCHEMA = "urn:uu-aap:c2pa-observation-set-calculus-adapter-set-receipt:0.1"
TRANSITION_ADAPTER_RECEIPT_SCHEMA = "urn:uu-aap:c2pa-observation-set-calculus-adapter-transition-receipt:0.1"
CHAIN_ADAPTER_RECEIPT_SCHEMA = "urn:uu-aap:c2pa-observation-set-calculus-adapter-chain-receipt:0.1"


class C2PAObservationSetAdapterError(ValueError):
    pass


def _fail(message: str) -> None:
    raise C2PAObservationSetAdapterError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


profile = _load_module("observation_set_calculus_candidate_for_c2pa", PROFILE_PATH)
branch_set = _load_module(
    "observed_authority_branch_set_for_candidate_adapter",
    SCRIPTS / "observed-authority-branch-set" / "receipt.py",
)
set_transition = _load_module(
    "observed_authority_branch_set_transition_for_candidate_adapter",
    SCRIPTS / "observed-authority-branch-set-transition" / "receipt.py",
)
set_chain = _load_module(
    "observed_authority_branch_set_transition_chain_for_candidate_adapter",
    SCRIPTS / "observed-authority-branch-set-transition-chain" / "receipt.py",
)


def candidate_profile_sha256() -> str:
    return hashlib.sha256(PROFILE_PATH.read_bytes()).hexdigest()


def _project_validated_set(
    source_input: dict[str, Any], source_receipt: dict[str, Any]
) -> dict[str, Any]:
    observations = []
    projected_semantics = []
    for branch in source_input["branches"]:
        semantic, _ = branch_set._branch_fingerprint(branch)
        projected_semantics.append(semantic)
        observations.append(
            {
                "semantic_fingerprint_sha256": semantic,
                "source_binding_sha256": profile.canonical_sha256(branch),
            }
        )

    if sorted(projected_semantics) != source_receipt[
        "observed_branch_fingerprints_sha256"
    ]:
        _fail("#902 branch semantic projection mismatch")

    return {
        "schema": profile.SET_INPUT_SCHEMA,
        "scope_binding_sha256": source_receipt[
            "common_origin_snapshot_fingerprint_sha256"
        ],
        "observations": observations,
    }


def project_set(source_input: dict[str, Any]) -> dict[str, Any]:
    try:
        source_receipt = branch_set.evaluate(source_input)
    except branch_set.BranchSetInputError as exc:
        _fail(f"#902 source set invalid: {exc}")
    candidate_input = _project_validated_set(source_input, source_receipt)
    try:
        candidate_receipt = profile.evaluate_set(candidate_input)
    except profile.ObservationSetInputError as exc:
        _fail(f"candidate set rejected C2PA projection: {exc}")

    if candidate_receipt["observation_count"] != source_receipt["observation_count"]:
        _fail("set observation count parity mismatch")
    if candidate_receipt["distinct_observation_count"] != source_receipt[
        "distinct_branch_count"
    ]:
        _fail("set distinct-observation count parity mismatch")
    if candidate_receipt["observed_semantic_fingerprints_sha256"] != source_receipt[
        "observed_branch_fingerprints_sha256"
    ]:
        _fail("set semantic multiset parity mismatch")

    return {
        "schema": SET_ADAPTER_RECEIPT_SCHEMA,
        "domain": "C2PA_AUTHORITY_OBSERVABILITY",
        "candidate_profile_sha256": candidate_profile_sha256(),
        "source_schema": source_receipt["schema"],
        "source_scope_binding_sha256": source_receipt[
            "common_origin_snapshot_fingerprint_sha256"
        ],
        "candidate_input": candidate_input,
        "candidate_receipt": candidate_receipt,
        "parity": {
            "observation_count": True,
            "distinct_observation_count": True,
            "semantic_multiset": True,
        },
        "non_effects": {
            "c2pa_reclassified": False,
            "quorum_mutated": False,
            "authority_created": False,
            "stable_core_admitted": False,
            "interface_registry_admitted": False,
        },
    }


def _mapped_relation(source_relation: str) -> str:
    mapping = {
        "IDENTICAL_OBSERVED_SET": "IDENTICAL_OBSERVED_SET",
        "OBSERVATION_MULTIPLICITY_ONLY_CHANGED": "OBSERVATION_MULTIPLICITY_ONLY_CHANGED",
        "OBSERVED_BRANCH_MEMBERSHIP_CHANGED": "OBSERVED_MEMBERSHIP_CHANGED",
        "OBSERVED_BRANCH_AND_MULTIPLICITY_CHANGED": "OBSERVED_MEMBERSHIP_AND_MULTIPLICITY_CHANGED",
    }
    if source_relation not in mapping:
        _fail(f"unexpected #904 relation: {source_relation}")
    return mapping[source_relation]


def project_transition(source_input: dict[str, Any]) -> dict[str, Any]:
    try:
        source_receipt = set_transition.evaluate(source_input)
    except set_transition.BranchSetTransitionInputError as exc:
        _fail(f"#904 source transition invalid: {exc}")

    before = project_set(source_input["before_set"])
    after = project_set(source_input["after_set"])
    candidate_input = {
        "schema": profile.TRANSITION_INPUT_SCHEMA,
        "before_set": before["candidate_input"],
        "after_set": after["candidate_input"],
    }
    try:
        candidate_receipt = profile.evaluate_transition(candidate_input)
    except profile.ObservationSetInputError as exc:
        _fail(f"candidate transition rejected C2PA projection: {exc}")

    expected_relation = _mapped_relation(source_receipt["relation"])
    if candidate_receipt["relation"] != expected_relation:
        _fail("transition relation parity mismatch")

    lifecycle = source_receipt["distinct_branch_observation_lifecycle"]
    parity_pairs = (
        (
            candidate_receipt["newly_observed_semantic_fingerprints_sha256"],
            lifecycle["newly_observed_branch_fingerprints"],
            "newly observed",
        ),
        (
            candidate_receipt["not_observed_in_after_semantic_fingerprints_sha256"],
            lifecycle["not_observed_in_after_branch_fingerprints"],
            "not observed after",
        ),
        (
            candidate_receipt["observed_in_both_semantic_fingerprints_sha256"],
            lifecycle["observed_in_both_branch_fingerprints"],
            "observed in both",
        ),
    )
    for candidate_value, source_value, name in parity_pairs:
        if candidate_value != source_value:
            _fail(f"transition {name} parity mismatch")

    source_multiplicity = [
        {
            "semantic_fingerprint_sha256": item["branch_fingerprint_sha256"],
            "before_observation_count": item["before_observation_count"],
            "after_observation_count": item["after_observation_count"],
            "delta": item["delta"],
        }
        for item in source_receipt["branch_observation_multiplicity_lifecycle"]
    ]
    if candidate_receipt["observation_multiplicity_lifecycle"] != source_multiplicity:
        _fail("transition multiplicity lifecycle parity mismatch")

    return {
        "schema": TRANSITION_ADAPTER_RECEIPT_SCHEMA,
        "domain": "C2PA_AUTHORITY_OBSERVABILITY",
        "candidate_profile_sha256": candidate_profile_sha256(),
        "source_schema": source_receipt["schema"],
        "candidate_receipt": candidate_receipt,
        "parity": {
            "relation": True,
            "membership_lifecycle": True,
            "multiplicity_lifecycle": True,
        },
        "non_effects": {
            "branch_creation_proven": False,
            "branch_deletion_proven": False,
            "trusted_time_proven": False,
            "c2pa_reclassified": False,
            "authority_created": False,
        },
    }


def project_chain(source_input: dict[str, Any]) -> dict[str, Any]:
    try:
        source_receipt = set_chain.evaluate(source_input)
    except set_chain.BranchSetTransitionChainInputError as exc:
        _fail(f"#906 source chain invalid: {exc}")

    projected_sets = [project_set(item)["candidate_input"] for item in source_input["sets"]]
    candidate_input = {"schema": profile.CHAIN_INPUT_SCHEMA, "sets": projected_sets}
    try:
        candidate_receipt = profile.evaluate_chain(candidate_input)
    except profile.ObservationSetInputError as exc:
        _fail(f"candidate chain rejected C2PA projection: {exc}")

    expected_sequence = [
        _mapped_relation(item) for item in source_receipt["transition_relation_sequence"]
    ]
    if candidate_receipt["relation_sequence"] != expected_sequence:
        _fail("chain relation-sequence parity mismatch")
    if candidate_receipt["set_count"] != source_receipt["set_count"]:
        _fail("chain set-count parity mismatch")
    if candidate_receipt["edge_count"] != source_receipt["edge_count"]:
        _fail("chain edge-count parity mismatch")
    if (
        candidate_receipt["local_observation_set_adjacency"]
        != source_receipt["local_observation_set_adjacency"]
    ):
        _fail("chain local-adjacency parity mismatch")

    for index, source_edge in enumerate(source_receipt["edges"]):
        candidate_edge = candidate_receipt["edges"][index]
        source_lifecycle = source_edge["distinct_branch_observation_lifecycle"]
        if candidate_edge["newly_observed_semantic_fingerprints_sha256"] != source_lifecycle[
            "newly_observed_branch_fingerprints"
        ]:
            _fail(f"chain edge[{index}] newly-observed parity mismatch")
        if candidate_edge[
            "not_observed_in_after_semantic_fingerprints_sha256"
        ] != source_lifecycle["not_observed_in_after_branch_fingerprints"]:
            _fail(f"chain edge[{index}] absent-after parity mismatch")

    return {
        "schema": CHAIN_ADAPTER_RECEIPT_SCHEMA,
        "domain": "C2PA_AUTHORITY_OBSERVABILITY",
        "candidate_profile_sha256": candidate_profile_sha256(),
        "source_schema": source_receipt["schema"],
        "candidate_receipt": candidate_receipt,
        "parity": {
            "set_count": True,
            "edge_count": True,
            "relation_sequence": True,
            "membership_lifecycle": True,
            "local_adjacency": True,
        },
        "non_effects": {
            "complete_history_proven": False,
            "global_equivocation_proven": False,
            "c2pa_reclassified": False,
            "authority_created": False,
            "stable_core_admitted": False,
        },
    }


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] not in {"set", "transition", "chain"}:
        print("usage: adapter.py <set|transition|chain> <input.json>", file=sys.stderr)
        raise SystemExit(2)
    data = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    try:
        if sys.argv[1] == "set":
            receipt = project_set(data)
        elif sys.argv[1] == "transition":
            receipt = project_transition(data)
        else:
            receipt = project_chain(data)
    except (OSError, json.JSONDecodeError, C2PAObservationSetAdapterError) as exc:
        print(f"C2PA observation-set calculus adapter: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
