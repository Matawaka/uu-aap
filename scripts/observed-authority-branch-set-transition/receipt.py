#!/usr/bin/env python3
"""Deterministic temporal comparison of two accepted observed authority branch sets."""

from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:observed-authority-branch-set-transition-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:observed-authority-branch-set-transition-receipt:0.1"
TOP_LEVEL_KEYS = {"schema", "before_set", "after_set"}

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


class BranchSetTransitionInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise BranchSetTransitionInputError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


branch_set = _load_module(
    "observed_authority_branch_set_for_transition",
    SCRIPTS / "observed-authority-branch-set" / "receipt.py",
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


def _set_summary(receipt: dict[str, Any]) -> dict[str, Any]:
    return {
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


def _branch_counts(receipt: dict[str, Any]) -> dict[str, int]:
    return {
        item["branch_fingerprint_sha256"]: item["observation_count"]
        for item in receipt["distinct_branches"]
    }


def _root_groups(receipt: dict[str, Any]) -> dict[tuple[str, int], set[str]]:
    return {
        (item["root_id"], item["root_version"]): set(
            item["distinct_document_sha256"]
        )
        for item in receipt["observed_root_variant_groups"]
    }


def _pair_key(item: dict[str, Any]) -> str:
    left = item["left_branch_fingerprint_sha256"]
    right = item["right_branch_fingerprint_sha256"]
    if left >= right:
        _fail("pairwise matrix is not in canonical fingerprint order")
    return f"{left}:{right}"


def _pair_evidence(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "relation": item["relation"],
        "common_observed_prefix_length": item["common_observed_prefix_length"],
        "parallel_same_version_root_variants_observed": item[
            "parallel_same_version_root_variants_observed"
        ],
        "observed_reconvergence_present": item["observed_reconvergence_present"],
        "first_divergence_root": copy.deepcopy(item["first_divergence_root"]),
    }


def _pair_map(receipt: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in receipt["pairwise_matrix"]:
        key = _pair_key(item)
        if key in result:
            _fail("duplicate pairwise matrix key")
        result[key] = _pair_evidence(item)
    return result


def _branch_lifecycle(
    before_counts: dict[str, int], after_counts: dict[str, int]
) -> tuple[dict[str, Any], list[dict[str, Any]], bool, bool]:
    before_fps = set(before_counts)
    after_fps = set(after_counts)
    newly = sorted(after_fps - before_fps)
    absent_after = sorted(before_fps - after_fps)
    both = sorted(before_fps & after_fps)

    multiplicity = []
    for fp in sorted(before_fps | after_fps):
        before_count = before_counts.get(fp, 0)
        after_count = after_counts.get(fp, 0)
        multiplicity.append(
            {
                "branch_fingerprint_sha256": fp,
                "before_observation_count": before_count,
                "after_observation_count": after_count,
                "delta": after_count - before_count,
            }
        )

    membership_changed = bool(newly or absent_after)
    persisted_multiplicity_changed = any(
        before_counts[fp] != after_counts[fp] for fp in both
    )
    return (
        {
            "newly_observed_branch_fingerprints": newly,
            "not_observed_in_after_branch_fingerprints": absent_after,
            "observed_in_both_branch_fingerprints": both,
        },
        multiplicity,
        membership_changed,
        persisted_multiplicity_changed,
    )


def _root_lifecycle(
    before_groups: dict[tuple[str, int], set[str]],
    after_groups: dict[tuple[str, int], set[str]],
) -> list[dict[str, Any]]:
    result = []
    for root_id, root_version in sorted(set(before_groups) | set(after_groups)):
        before = before_groups.get((root_id, root_version), set())
        after = after_groups.get((root_id, root_version), set())
        result.append(
            {
                "root_id": root_id,
                "root_version": root_version,
                "newly_observed_digests": sorted(after - before),
                "not_observed_in_after_digests": sorted(before - after),
                "observed_in_both_digests": sorted(before & after),
            }
        )
    return result


def _pair_lifecycle(
    before_pairs: dict[str, dict[str, Any]],
    after_pairs: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    before_keys = set(before_pairs)
    after_keys = set(after_pairs)
    both = sorted(before_keys & after_keys)

    persistent_evidence = []
    for key in both:
        if before_pairs[key] != after_pairs[key]:
            _fail(f"persistent pairwise evidence changed for exact pair {key}")
        persistent_evidence.append(
            {
                "pair_key": key,
                "evidence": copy.deepcopy(before_pairs[key]),
            }
        )

    return {
        "newly_observed_pairs": sorted(after_keys - before_keys),
        "not_observed_in_after_pairs": sorted(before_keys - after_keys),
        "observed_in_both_pairs": both,
        "observed_in_both_pair_evidence": persistent_evidence,
    }


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, TOP_LEVEL_KEYS, "input")
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")

    before_input = data["before_set"]
    after_input = data["after_set"]

    try:
        before_receipt = branch_set.evaluate(before_input)
    except branch_set.BranchSetInputError as exc:
        _fail(f"before_set invalid: {exc}")
    try:
        after_receipt = branch_set.evaluate(after_input)
    except branch_set.BranchSetInputError as exc:
        _fail(f"after_set invalid: {exc}")

    # #902 validates each supplied set independently. The transition layer also
    # validates digest/signature-membership consistency across the union.
    try:
        branch_set._assert_digest_content_consistency(
            list(before_input["branches"]) + list(after_input["branches"])
        )
    except branch_set.BranchSetInputError as exc:
        _fail(f"cross-set digest/content inconsistency: {exc}")

    before_origin = before_receipt["common_origin_snapshot_fingerprint_sha256"]
    after_origin = after_receipt["common_origin_snapshot_fingerprint_sha256"]
    if before_origin != after_origin:
        _fail("OBSERVED_SET_ORIGIN_CHANGED: common origin fingerprints differ")

    before_counts = _branch_counts(before_receipt)
    after_counts = _branch_counts(after_receipt)
    (
        branch_lifecycle,
        multiplicity_lifecycle,
        membership_changed,
        persisted_multiplicity_changed,
    ) = _branch_lifecycle(before_counts, after_counts)

    any_observation_count_change = any(
        item["delta"] != 0 for item in multiplicity_lifecycle
    )

    if not membership_changed and not any_observation_count_change:
        relation = "IDENTICAL_OBSERVED_SET"
        if (
            before_receipt["branch_set_fingerprint_sha256"]
            != after_receipt["branch_set_fingerprint_sha256"]
        ):
            _fail("identical observed multiset produced different branch-set fingerprints")
    elif not membership_changed:
        relation = "OBSERVATION_MULTIPLICITY_ONLY_CHANGED"
    elif persisted_multiplicity_changed:
        relation = "OBSERVED_BRANCH_AND_MULTIPLICITY_CHANGED"
    else:
        relation = "OBSERVED_BRANCH_MEMBERSHIP_CHANGED"

    root_lifecycle = _root_lifecycle(
        _root_groups(before_receipt), _root_groups(after_receipt)
    )
    pair_lifecycle = _pair_lifecycle(
        _pair_map(before_receipt), _pair_map(after_receipt)
    )

    return {
        "schema": RECEIPT_SCHEMA,
        "before_set": _set_summary(before_receipt),
        "after_set": _set_summary(after_receipt),
        "common_origin_snapshot_fingerprint_sha256": before_origin,
        "relation": relation,
        "distinct_branch_observation_lifecycle": branch_lifecycle,
        "branch_observation_multiplicity_lifecycle": multiplicity_lifecycle,
        "observed_root_variant_lifecycle": root_lifecycle,
        "pairwise_observation_lifecycle": pair_lifecycle,
        "branch_membership_changed": membership_changed,
        "persisted_branch_multiplicity_changed": persisted_multiplicity_changed,
        "any_observation_count_change": any_observation_count_change,
        "semantic_guards": {
            "before_after_roles_prove_trusted_time": False,
            "newly_observed_proves_branch_creation": False,
            "not_observed_in_after_proves_branch_deletion": False,
            "observed_in_both_proves_continuous_existence": False,
            "root_digest_newly_observed_proves_issuance": False,
            "root_digest_absent_after_proves_revocation": False,
            "all_existing_branches_observed": False,
            "global_non_equivocation_proven": False,
            "global_equivocation_proven": False,
            "complete_history_proven": False,
            "complete_fork_topology_proven": False,
            "canonical_branch_selected": False,
            "preferred_branch_selected": False,
            "malicious_behavior_proven": False,
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
    except (OSError, json.JSONDecodeError, BranchSetTransitionInputError) as exc:
        print(f"observed authority branch-set transition: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
