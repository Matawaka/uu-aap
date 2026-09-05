#!/usr/bin/env python3
"""Deterministic local continuity chain over accepted authority snapshots."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:authority-surface-continuity-chain-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:authority-surface-continuity-chain-receipt:0.1"
TOP_LEVEL_KEYS = {"schema", "snapshots"}

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


class ChainInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise ChainInputError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


tri = _load_module(
    "authority_surface_triangulation_receipt_for_chain",
    SCRIPTS / "authority-surface-triangulation" / "receipt.py",
)
transition = _load_module(
    "authority_surface_transition_receipt_for_chain",
    SCRIPTS / "authority-surface-transition" / "receipt.py",
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


def _canonical_fingerprint(value: Any) -> str:
    encoded = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _snapshot_source_summary(index: int, snapshot: dict[str, Any], receipt: dict[str, Any]) -> dict[str, Any]:
    return {
        "index": index,
        "snapshot_fingerprint_sha256": _canonical_fingerprint(snapshot),
        "runtime_surface": dict(receipt["runtime_surface"]),
        "export_surface": dict(receipt["export_surface"]),
        "signed_root": dict(receipt["signed_root"]),
        "any_delta_present": receipt["any_delta_present"],
    }


def _transition_summary(
    index: int,
    before_snapshot: dict[str, Any],
    after_snapshot: dict[str, Any],
    receipt: dict[str, Any],
) -> dict[str, Any]:
    return {
        "index": index,
        "before_snapshot_fingerprint_sha256": _canonical_fingerprint(before_snapshot),
        "after_snapshot_fingerprint_sha256": _canonical_fingerprint(after_snapshot),
        "root_relation": receipt["root_relation"],
        "surface_transitions": copy.deepcopy(receipt["surface_transitions"]),
        "directional_delta_lifecycle": copy.deepcopy(
            receipt["directional_delta_lifecycle"]
        ),
        "any_membership_change": receipt["any_membership_change"],
        "any_delta_lifecycle_change": receipt["any_delta_lifecycle_change"],
    }


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, TOP_LEVEL_KEYS, "input")
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")

    snapshots = data.get("snapshots")
    if not isinstance(snapshots, list):
        _fail("snapshots must be an array")
    if len(snapshots) < 2:
        _fail("snapshots must contain at least two snapshots")

    snapshot_receipts: list[dict[str, Any]] = []
    snapshot_summaries: list[dict[str, Any]] = []
    for index, snapshot in enumerate(snapshots):
        try:
            receipt = tri.evaluate(snapshot)
        except tri.TriangulationInputError as exc:
            _fail(f"snapshots[{index}] invalid: {exc}")
        snapshot_receipts.append(receipt)
        snapshot_summaries.append(_snapshot_source_summary(index, snapshot, receipt))

    edge_summaries: list[dict[str, Any]] = []
    root_relations: list[str] = []
    for index in range(len(snapshots) - 1):
        edge_input = {
            "schema": transition.INPUT_SCHEMA,
            "before": snapshots[index],
            "after": snapshots[index + 1],
        }
        try:
            edge_receipt = transition.evaluate(edge_input)
        except transition.TransitionInputError as exc:
            _fail(f"edge[{index}] invalid: {exc}")

        summary = _transition_summary(
            index,
            snapshots[index],
            snapshots[index + 1],
            edge_receipt,
        )
        expected_before = snapshot_summaries[index]["snapshot_fingerprint_sha256"]
        expected_after = snapshot_summaries[index + 1]["snapshot_fingerprint_sha256"]
        if summary["before_snapshot_fingerprint_sha256"] != expected_before:
            _fail(f"edge[{index}] before endpoint fingerprint mismatch")
        if summary["after_snapshot_fingerprint_sha256"] != expected_after:
            _fail(f"edge[{index}] after endpoint fingerprint mismatch")

        edge_summaries.append(summary)
        root_relations.append(edge_receipt["root_relation"])

    same_root_count = sum(item == "SAME_ROOT" for item in root_relations)
    successor_root_count = sum(item == "SUCCESSOR_ROOT" for item in root_relations)

    first = snapshot_summaries[0]
    last = snapshot_summaries[-1]

    return {
        "schema": RECEIPT_SCHEMA,
        "snapshot_count": len(snapshot_summaries),
        "edge_count": len(edge_summaries),
        "snapshots": snapshot_summaries,
        "edges": edge_summaries,
        "root_relation_sequence": root_relations,
        "root_relation_counts": {
            "same_root": same_root_count,
            "successor_root": successor_root_count,
        },
        "endpoints": {
            "first_snapshot_fingerprint_sha256": first[
                "snapshot_fingerprint_sha256"
            ],
            "last_snapshot_fingerprint_sha256": last[
                "snapshot_fingerprint_sha256"
            ],
            "first_signed_root": dict(first["signed_root"]),
            "last_signed_root": dict(last["signed_root"]),
        },
        "local_adjacency_continuous": True,
        "semantic_guards": {
            "history_complete": False,
            "no_omitted_states_proven": False,
            "global_non_equivocation_proven": False,
            "no_parallel_fork_proven": False,
            "append_only_log_proven": False,
            "trusted_time_proven": False,
            "chain_order_proves_chronology": False,
            "chain_proves_causality": False,
            "chain_mints_or_mutates_authority": False,
            "chain_calculates_or_mutates_quorum": False,
            "chain_triggers_alert_or_remediation": False,
        },
    }


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: receipt.py <input.json>", file=sys.stderr)
        raise SystemExit(2)

    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        receipt = evaluate(data)
    except (OSError, json.JSONDecodeError, ChainInputError) as exc:
        print(f"authority surface continuity chain: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)

    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
