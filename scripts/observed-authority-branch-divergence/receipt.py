#!/usr/bin/env python3
"""Deterministic comparison of two locally valid observed authority chains."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:observed-authority-branch-divergence-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:observed-authority-branch-divergence-receipt:0.1"
TOP_LEVEL_KEYS = {"schema", "left_chain", "right_chain"}

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


class DivergenceInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise DivergenceInputError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


chain = _load_module(
    "authority_surface_continuity_chain_for_divergence",
    SCRIPTS / "authority-surface-continuity-chain" / "receipt.py",
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


def _branch_fingerprint(snapshot_fingerprints: list[str]) -> str:
    encoded = json.dumps(
        snapshot_fingerprints,
        sort_keys=False,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _chain_summary(receipt: dict[str, Any]) -> dict[str, Any]:
    return {
        "snapshot_count": receipt["snapshot_count"],
        "edge_count": receipt["edge_count"],
        "root_relation_sequence": list(receipt["root_relation_sequence"]),
        "endpoints": copy.deepcopy(receipt["endpoints"]),
        "local_adjacency_continuous": receipt["local_adjacency_continuous"],
    }


def _surface_exact_equal(left: dict[str, Any], right: dict[str, Any]) -> bool:
    return left == right


def _first_reconvergence(
    left_fps: list[str], right_fps: list[str], divergence_index: int
) -> tuple[str | None, int | None, int | None]:
    right_positions: dict[str, int] = {}
    for index in range(divergence_index, len(right_fps)):
        right_positions.setdefault(right_fps[index], index)
    for left_index in range(divergence_index, len(left_fps)):
        fp = left_fps[left_index]
        if fp in right_positions:
            return fp, left_index, right_positions[fp]
    return None, None, None


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, TOP_LEVEL_KEYS, "input")
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")

    left_input = data["left_chain"]
    right_input = data["right_chain"]
    try:
        left_receipt = chain.evaluate(left_input)
    except chain.ChainInputError as exc:
        _fail(f"left_chain invalid: {exc}")
    try:
        right_receipt = chain.evaluate(right_input)
    except chain.ChainInputError as exc:
        _fail(f"right_chain invalid: {exc}")

    left_snapshots = left_input["snapshots"]
    right_snapshots = right_input["snapshots"]
    left_fps = [chain._canonical_fingerprint(item) for item in left_snapshots]
    right_fps = [chain._canonical_fingerprint(item) for item in right_snapshots]

    if left_fps[0] != right_fps[0]:
        _fail("NO_COMMON_OBSERVED_ORIGIN: first snapshot fingerprints differ")

    lcp = 0
    for left_fp, right_fp in zip(left_fps, right_fps):
        if left_fp != right_fp:
            break
        lcp += 1

    if left_fps == right_fps:
        relation = "IDENTICAL_OBSERVED_BRANCHES"
    elif lcp == len(left_fps):
        relation = "LEFT_IS_OBSERVED_PREFIX"
    elif lcp == len(right_fps):
        relation = "RIGHT_IS_OBSERVED_PREFIX"
    else:
        relation = "DIVERGENT_OBSERVED_PATHS"

    divergence = None
    reconvergence = {
        "observed_reconvergence_present": False,
        "first_common_post_divergence_fingerprint_sha256": None,
        "left_index": None,
        "right_index": None,
    }

    if relation == "DIVERGENT_OBSERVED_PATHS":
        left_snapshot = left_snapshots[lcp]
        right_snapshot = right_snapshots[lcp]
        left_root = left_snapshot["signed_root"]
        right_root = right_snapshot["signed_root"]

        same_root_id = left_root["id"] == right_root["id"]
        same_root_version = left_root["version"] == right_root["version"]
        same_root_digest = (
            left_root["document_sha256"] == right_root["document_sha256"]
        )
        parallel_same_version_root_variants = (
            same_root_id and same_root_version and not same_root_digest
        )

        divergence = {
            "divergence_index": lcp,
            "shared_pivot_fingerprint_sha256": left_fps[lcp - 1],
            "left_first_divergent_fingerprint_sha256": left_fps[lcp],
            "right_first_divergent_fingerprint_sha256": right_fps[lcp],
            "runtime_surface_exact_equal": _surface_exact_equal(
                left_snapshot["runtime_surface"], right_snapshot["runtime_surface"]
            ),
            "export_surface_exact_equal": _surface_exact_equal(
                left_snapshot["export_surface"], right_snapshot["export_surface"]
            ),
            "signed_root_exact_equal": _surface_exact_equal(left_root, right_root),
            "left_signed_root": {
                "id": left_root["id"],
                "version": left_root["version"],
                "document_sha256": left_root["document_sha256"],
                "verification_status": left_root["verification_status"],
            },
            "right_signed_root": {
                "id": right_root["id"],
                "version": right_root["version"],
                "document_sha256": right_root["document_sha256"],
                "verification_status": right_root["verification_status"],
            },
            "parallel_same_version_root_variants_observed": parallel_same_version_root_variants,
        }

        common_fp, left_index, right_index = _first_reconvergence(
            left_fps, right_fps, lcp + 1
        )
        if common_fp is not None:
            reconvergence = {
                "observed_reconvergence_present": True,
                "first_common_post_divergence_fingerprint_sha256": common_fp,
                "left_index": left_index,
                "right_index": right_index,
            }

    return {
        "schema": RECEIPT_SCHEMA,
        "left_branch": {
            "branch_fingerprint_sha256": _branch_fingerprint(left_fps),
            "snapshot_fingerprints_sha256": left_fps,
            "chain": _chain_summary(left_receipt),
        },
        "right_branch": {
            "branch_fingerprint_sha256": _branch_fingerprint(right_fps),
            "snapshot_fingerprints_sha256": right_fps,
            "chain": _chain_summary(right_receipt),
        },
        "relation": relation,
        "common_observed_prefix_length": lcp,
        "divergence": divergence,
        "reconvergence": reconvergence,
        "semantic_guards": {
            "global_equivocation_proven": False,
            "malicious_behavior_proven": False,
            "complete_history_proven": False,
            "no_omitted_states_proven": False,
            "all_parallel_branches_observed": False,
            "trusted_time_proven": False,
            "immediate_causal_fork_point_proven": False,
            "canonical_branch_selected": False,
            "branch_ordering_or_preference_established": False,
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
    except (OSError, json.JSONDecodeError, DivergenceInputError) as exc:
        print(f"observed authority branch divergence: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
