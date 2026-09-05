#!/usr/bin/env python3
"""Deterministic observed branch-set receipt over accepted authority chains."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import sys
from itertools import combinations
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:observed-authority-branch-set-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:observed-authority-branch-set-receipt:0.1"
TOP_LEVEL_KEYS = {"schema", "branches"}

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


class BranchSetInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise BranchSetInputError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


chain = _load_module(
    "authority_surface_continuity_chain_for_branch_set",
    SCRIPTS / "authority-surface-continuity-chain" / "receipt.py",
)
divergence = _load_module(
    "observed_authority_branch_divergence_for_branch_set",
    SCRIPTS / "observed-authority-branch-divergence" / "receipt.py",
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
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _branch_fingerprint(branch_input: dict[str, Any]) -> tuple[str, list[str]]:
    snapshot_fps = [chain._canonical_fingerprint(s) for s in branch_input["snapshots"]]
    return divergence._branch_fingerprint(snapshot_fps), snapshot_fps


def _branch_set_fingerprint(observed_branch_fps: list[str]) -> str:
    return _sha256_text(_canonical_json(sorted(observed_branch_fps)))


def _chain_summary(receipt: dict[str, Any]) -> dict[str, Any]:
    return {
        "snapshot_count": receipt["snapshot_count"],
        "edge_count": receipt["edge_count"],
        "root_relation_sequence": list(receipt["root_relation_sequence"]),
        "endpoints": copy.deepcopy(receipt["endpoints"]),
        "local_adjacency_continuous": receipt["local_adjacency_continuous"],
    }


def _semantic_signer_set(surface_name: str, surface: dict[str, Any]) -> tuple[str, ...]:
    """Match #896 same-digest consistency semantics: compare signer membership, not aliases."""
    if surface_name == "runtime_surface":
        values = surface["configured_signers"]
    elif surface_name == "export_surface":
        values = surface["signers"]
    elif surface_name == "signed_root":
        values = surface["admitted_signers"]
    else:  # pragma: no cover - internal programming guard
        raise RuntimeError(f"unsupported surface: {surface_name}")
    return tuple(sorted(values))


def _assert_digest_content_consistency(branches: list[dict[str, Any]]) -> None:
    """Reject one exact document digest mapping to different normalized signer content."""
    seen: dict[tuple[str, str], tuple[str, ...]] = {}
    for branch_index, branch in enumerate(branches):
        for snapshot_index, snapshot in enumerate(branch["snapshots"]):
            for surface_name in ("runtime_surface", "export_surface", "signed_root"):
                surface = snapshot[surface_name]
                digest = surface["document_sha256"]
                semantic_content = _semantic_signer_set(surface_name, surface)
                key = (surface_name, digest)
                previous = seen.get(key)
                if previous is None:
                    seen[key] = semantic_content
                elif previous != semantic_content:
                    _fail(
                        f"{surface_name} document_sha256 maps to different signer content "
                        f"at branches[{branch_index}].snapshots[{snapshot_index}]"
                    )


def _pairwise_summary(receipt: dict[str, Any]) -> dict[str, Any]:
    divergence_data = receipt["divergence"]
    first_divergence_root = None
    parallel_variants = False
    if divergence_data is not None:
        first_divergence_root = {
            "left_signed_root": copy.deepcopy(divergence_data["left_signed_root"]),
            "right_signed_root": copy.deepcopy(divergence_data["right_signed_root"]),
        }
        parallel_variants = divergence_data["parallel_same_version_root_variants_observed"]
    return {
        "left_branch_fingerprint_sha256": receipt["left_branch"]["branch_fingerprint_sha256"],
        "right_branch_fingerprint_sha256": receipt["right_branch"]["branch_fingerprint_sha256"],
        "relation": receipt["relation"],
        "common_observed_prefix_length": receipt["common_observed_prefix_length"],
        "parallel_same_version_root_variants_observed": parallel_variants,
        "observed_reconvergence_present": receipt["reconvergence"]["observed_reconvergence_present"],
        "first_divergence_root": first_divergence_root,
    }


def _root_variant_groups(branches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, int], set[str]] = {}
    for branch in branches:
        for snapshot in branch["snapshots"]:
            root = snapshot["signed_root"]
            grouped.setdefault((root["id"], root["version"]), set()).add(root["document_sha256"])
    result = []
    for (root_id, version), digests in sorted(grouped.items(), key=lambda item: item[0]):
        ordered = sorted(digests)
        result.append(
            {
                "root_id": root_id,
                "root_version": version,
                "distinct_document_sha256": ordered,
                "distinct_digest_count": len(ordered),
                "multiple_root_digests_observed": len(ordered) > 1,
            }
        )
    return result


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, TOP_LEVEL_KEYS, "input")
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")
    branches = data.get("branches")
    if not isinstance(branches, list):
        _fail("branches must be an array")
    if len(branches) < 2:
        _fail("branches must contain at least two observations")

    branch_fps: list[str] = []
    snapshot_fps_by_observation: list[list[str]] = []
    canonical_branch_by_fp: dict[str, str] = {}
    representative_by_fp: dict[str, dict[str, Any]] = {}
    receipt_by_fp: dict[str, dict[str, Any]] = {}

    for index, branch_input in enumerate(branches):
        try:
            chain_receipt = chain.evaluate(branch_input)
        except chain.ChainInputError as exc:
            _fail(f"branches[{index}] invalid: {exc}")
        branch_fp, snapshot_fps = _branch_fingerprint(branch_input)
        canonical = _canonical_json(branch_input)
        previous = canonical_branch_by_fp.get(branch_fp)
        if previous is not None and previous != canonical:
            _fail("branch fingerprint collision or canonical branch mismatch")
        canonical_branch_by_fp.setdefault(branch_fp, canonical)
        representative_by_fp.setdefault(branch_fp, branch_input)
        receipt_by_fp.setdefault(branch_fp, chain_receipt)
        branch_fps.append(branch_fp)
        snapshot_fps_by_observation.append(snapshot_fps)

    common_origin = snapshot_fps_by_observation[0][0]
    if any(fps[0] != common_origin for fps in snapshot_fps_by_observation[1:]):
        _fail("NO_COMMON_OBSERVED_ORIGIN: first snapshot fingerprints differ")

    _assert_digest_content_consistency(branches)

    observation_counts: dict[str, int] = {}
    for branch_fp in branch_fps:
        observation_counts[branch_fp] = observation_counts.get(branch_fp, 0) + 1
    distinct_fps = sorted(observation_counts)

    distinct_branches = []
    for branch_fp in distinct_fps:
        representative = representative_by_fp[branch_fp]
        _, snapshot_fps = _branch_fingerprint(representative)
        distinct_branches.append(
            {
                "branch_fingerprint_sha256": branch_fp,
                "observation_count": observation_counts[branch_fp],
                "snapshot_fingerprints_sha256": snapshot_fps,
                "chain": _chain_summary(receipt_by_fp[branch_fp]),
            }
        )

    duplicate_groups = [
        {"branch_fingerprint_sha256": fp, "observation_count": count}
        for fp, count in sorted(observation_counts.items())
        if count > 1
    ]

    pairwise_matrix = []
    for left_fp, right_fp in combinations(distinct_fps, 2):
        pair_input = {
            "schema": divergence.INPUT_SCHEMA,
            "left_chain": representative_by_fp[left_fp],
            "right_chain": representative_by_fp[right_fp],
        }
        try:
            pair_receipt = divergence.evaluate(pair_input)
        except divergence.DivergenceInputError as exc:
            _fail(f"pairwise comparison failed for {left_fp}/{right_fp}: {exc}")
        summary = _pairwise_summary(pair_receipt)
        if summary["left_branch_fingerprint_sha256"] != left_fp:
            _fail("pairwise left branch fingerprint mismatch")
        if summary["right_branch_fingerprint_sha256"] != right_fp:
            _fail("pairwise right branch fingerprint mismatch")
        pairwise_matrix.append(summary)

    root_groups = _root_variant_groups(branches)
    expected_pairs = len(distinct_fps) * (len(distinct_fps) - 1) // 2
    if len(pairwise_matrix) != expected_pairs:
        _fail("pairwise matrix is incomplete")

    return {
        "schema": RECEIPT_SCHEMA,
        "observation_count": len(branches),
        "distinct_branch_count": len(distinct_fps),
        "pairwise_entry_count": len(pairwise_matrix),
        "common_origin_snapshot_fingerprint_sha256": common_origin,
        "branch_set_fingerprint_sha256": _branch_set_fingerprint(branch_fps),
        "observed_branch_fingerprints_sha256": sorted(branch_fps),
        "distinct_branches": distinct_branches,
        "duplicate_observations": duplicate_groups,
        "pairwise_matrix": pairwise_matrix,
        "observed_root_variant_groups": root_groups,
        "any_multiple_root_digests_observed": any(
            item["multiple_root_digests_observed"] for item in root_groups
        ),
        "semantic_guards": {
            "all_existing_branches_observed": False,
            "global_non_equivocation_proven": False,
            "global_equivocation_proven": False,
            "complete_history_proven": False,
            "no_omitted_states_proven": False,
            "complete_fork_topology_proven": False,
            "trusted_time_proven": False,
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
    except (OSError, json.JSONDecodeError, BranchSetInputError) as exc:
        print(f"observed authority branch set: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
