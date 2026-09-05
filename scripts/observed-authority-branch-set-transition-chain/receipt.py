#!/usr/bin/env python3
"""Deterministic local chain over accepted observed authority branch sets."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:observed-authority-branch-set-transition-chain-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:observed-authority-branch-set-transition-chain-receipt:0.1"
TOP_LEVEL_KEYS = {"schema", "sets"}
ALLOWED_RELATIONS = (
    "IDENTICAL_OBSERVED_SET",
    "OBSERVATION_MULTIPLICITY_ONLY_CHANGED",
    "OBSERVED_BRANCH_MEMBERSHIP_CHANGED",
    "OBSERVED_BRANCH_AND_MULTIPLICITY_CHANGED",
)

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


class BranchSetTransitionChainInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise BranchSetTransitionChainInputError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


branch_set = _load_module(
    "observed_authority_branch_set_for_transition_chain",
    SCRIPTS / "observed-authority-branch-set" / "receipt.py",
)
set_transition = _load_module(
    "observed_authority_branch_set_transition_for_chain",
    SCRIPTS / "observed-authority-branch-set-transition" / "receipt.py",
)


def _exact_keys(value: Any, expected: set[str], name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(f"{name} must be an object")
    keys = set(value)
    missing = sorted(expected - keys)
    unknown = sorted(keys - expected)
    if missing or unknown:
        _fail(f"{name} keys mismatch: missing={missing}, unknown={unknown}")
    return value


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def _input_fingerprint(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _set_summary(
    index: int, set_input: dict[str, Any], receipt: dict[str, Any]
) -> dict[str, Any]:
    return {
        "index": index,
        "set_input_fingerprint_sha256": _input_fingerprint(set_input),
        "branch_set_fingerprint_sha256": receipt["branch_set_fingerprint_sha256"],
        "common_origin_snapshot_fingerprint_sha256": receipt[
            "common_origin_snapshot_fingerprint_sha256"
        ],
        "observation_count": receipt["observation_count"],
        "distinct_branch_count": receipt["distinct_branch_count"],
        "pairwise_entry_count": receipt["pairwise_entry_count"],
        "any_multiple_root_digests_observed": receipt[
            "any_multiple_root_digests_observed"
        ],
    }


def _edge_summary(index: int, receipt: dict[str, Any]) -> dict[str, Any]:
    return {
        "index": index,
        "before_set_fingerprint_sha256": receipt["before_set"][
            "branch_set_fingerprint_sha256"
        ],
        "after_set_fingerprint_sha256": receipt["after_set"][
            "branch_set_fingerprint_sha256"
        ],
        "common_origin_snapshot_fingerprint_sha256": receipt[
            "common_origin_snapshot_fingerprint_sha256"
        ],
        "relation": receipt["relation"],
        "distinct_branch_observation_lifecycle": copy.deepcopy(
            receipt["distinct_branch_observation_lifecycle"]
        ),
        "branch_observation_multiplicity_lifecycle": copy.deepcopy(
            receipt["branch_observation_multiplicity_lifecycle"]
        ),
        "observed_root_variant_lifecycle": copy.deepcopy(
            receipt["observed_root_variant_lifecycle"]
        ),
        "pairwise_observation_lifecycle": copy.deepcopy(
            receipt["pairwise_observation_lifecycle"]
        ),
        "branch_membership_changed": receipt["branch_membership_changed"],
        "persisted_branch_multiplicity_changed": receipt[
            "persisted_branch_multiplicity_changed"
        ],
        "any_observation_count_change": receipt["any_observation_count_change"],
    }


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, TOP_LEVEL_KEYS, "input")
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")

    sets = data.get("sets")
    if not isinstance(sets, list):
        _fail("sets must be an array")
    if len(sets) < 2:
        _fail("sets must contain at least two observed branch sets")

    set_receipts: list[dict[str, Any]] = []
    set_summaries: list[dict[str, Any]] = []
    for index, set_input in enumerate(sets):
        try:
            receipt = branch_set.evaluate(set_input)
        except branch_set.BranchSetInputError as exc:
            _fail(f"sets[{index}] invalid: {exc}")
        set_receipts.append(receipt)
        set_summaries.append(_set_summary(index, set_input, receipt))

    # Pairwise-adjacent #904 transitions cannot detect a contradiction that is
    # absent from an intermediate set. Reuse #902 normalization over the union
    # of every supplied observation to close that non-adjacent gap.
    all_branches: list[dict[str, Any]] = []
    for set_input in sets:
        all_branches.extend(set_input["branches"])
    try:
        branch_set._assert_digest_content_consistency(all_branches)
    except branch_set.BranchSetInputError as exc:
        _fail(f"chain-wide digest/content inconsistency: {exc}")

    common_origin = set_summaries[0]["common_origin_snapshot_fingerprint_sha256"]
    for index, summary in enumerate(set_summaries[1:], start=1):
        if summary["common_origin_snapshot_fingerprint_sha256"] != common_origin:
            _fail(
                f"OBSERVED_SET_ORIGIN_CHANGED: sets[{index}] common origin differs"
            )

    edges: list[dict[str, Any]] = []
    relation_sequence: list[str] = []
    for index in range(len(sets) - 1):
        transition_input = {
            "schema": set_transition.INPUT_SCHEMA,
            "before_set": sets[index],
            "after_set": sets[index + 1],
        }
        try:
            transition_receipt = set_transition.evaluate(transition_input)
        except set_transition.BranchSetTransitionInputError as exc:
            _fail(f"edge[{index}] invalid: {exc}")

        summary = _edge_summary(index, transition_receipt)
        expected_before = set_summaries[index]["branch_set_fingerprint_sha256"]
        expected_after = set_summaries[index + 1]["branch_set_fingerprint_sha256"]
        if summary["before_set_fingerprint_sha256"] != expected_before:
            _fail(f"edge[{index}] before semantic set fingerprint mismatch")
        if summary["after_set_fingerprint_sha256"] != expected_after:
            _fail(f"edge[{index}] after semantic set fingerprint mismatch")
        if summary["common_origin_snapshot_fingerprint_sha256"] != common_origin:
            _fail(f"edge[{index}] common origin mismatch")
        if summary["relation"] not in ALLOWED_RELATIONS:
            _fail(f"edge[{index}] unexpected relation {summary['relation']!r}")

        edges.append(summary)
        relation_sequence.append(summary["relation"])

    relation_counts = {
        relation: relation_sequence.count(relation) for relation in ALLOWED_RELATIONS
    }

    return {
        "schema": RECEIPT_SCHEMA,
        "set_count": len(set_summaries),
        "edge_count": len(edges),
        "common_origin_snapshot_fingerprint_sha256": common_origin,
        "sets": set_summaries,
        "edges": edges,
        "transition_relation_sequence": relation_sequence,
        "transition_relation_counts": relation_counts,
        "local_observation_set_adjacency": True,
        "semantic_guards": {
            "complete_observation_history_proven": False,
            "no_omitted_observation_sets_proven": False,
            "trusted_time_proven": False,
            "set_sequence_proves_chronology": False,
            "newly_observed_proves_branch_creation": False,
            "not_observed_in_next_proves_branch_deletion": False,
            "repeated_observation_proves_continuous_existence": False,
            "complete_fork_topology_proven": False,
            "global_non_equivocation_proven": False,
            "global_equivocation_proven": False,
            "append_only_log_proven": False,
            "canonical_branch_selected": False,
            "preferred_branch_selected": False,
            "authority_mutated": False,
            "quorum_mutated": False,
            "remediation_triggered": False,
        },
    }


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: receipt.py <input.json>", file=sys.stderr)
        raise SystemExit(2)
    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        receipt = evaluate(data)
    except (OSError, json.JSONDecodeError, BranchSetTransitionChainInputError) as exc:
        print(
            f"observed authority branch-set transition chain: FAIL_CLOSED: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
