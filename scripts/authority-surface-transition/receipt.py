#!/usr/bin/env python3
"""Deterministic transition receipt over two accepted triangulation snapshots."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

INPUT_SCHEMA = "urn:uu-aap:authority-surface-transition-input:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:authority-surface-transition-receipt:0.1"
TOP_LEVEL_KEYS = {"schema", "before", "after"}
DIRECTIONS = (
    "configured_but_unadmitted",
    "admitted_but_unconfigured",
    "exported_but_unadmitted",
    "admitted_but_unexported",
    "configured_but_unexported",
    "exported_but_unconfigured",
)

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


class TransitionInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise TransitionInputError(message)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


tri = _load_module(
    "authority_surface_triangulation_receipt",
    SCRIPTS / "authority-surface-triangulation" / "receipt.py",
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


def _membership(before: set[str], after: set[str]) -> dict[str, list[str]]:
    return {
        "added": sorted(after - before),
        "removed": sorted(before - after),
        "persisted": sorted(before & after),
    }


def _lifecycle(before: set[str], after: set[str]) -> dict[str, list[str]]:
    return {
        "introduced": sorted(after - before),
        "resolved": sorted(before - after),
        "persisted": sorted(before & after),
    }


def _surface_sets(snapshot: dict[str, Any]) -> tuple[set[str], set[str], set[str]]:
    return (
        set(snapshot["runtime_surface"]["configured_signers"]),
        set(snapshot["export_surface"]["signers"]),
        set(snapshot["signed_root"]["admitted_signers"]),
    )


def _direction_sets(receipt: dict[str, Any]) -> dict[str, set[str]]:
    comparisons = receipt["comparisons"]
    return {
        "configured_but_unadmitted": set(
            comparisons["runtime_vs_signed_root"]["configured_but_unadmitted"]
        ),
        "admitted_but_unconfigured": set(
            comparisons["runtime_vs_signed_root"]["admitted_but_unconfigured"]
        ),
        "exported_but_unadmitted": set(
            comparisons["export_vs_signed_root"]["exported_but_unadmitted"]
        ),
        "admitted_but_unexported": set(
            comparisons["export_vs_signed_root"]["admitted_but_unexported"]
        ),
        "configured_but_unexported": set(
            comparisons["runtime_vs_export"]["configured_but_unexported"]
        ),
        "exported_but_unconfigured": set(
            comparisons["runtime_vs_export"]["exported_but_unconfigured"]
        ),
    }


def _snapshot_summary(receipt: dict[str, Any]) -> dict[str, Any]:
    return {
        "runtime_surface": dict(receipt["runtime_surface"]),
        "export_surface": dict(receipt["export_surface"]),
        "signed_root": dict(receipt["signed_root"]),
        "any_delta_present": receipt["any_delta_present"],
    }


def _assert_same_digest_same_set(
    before_digest: str,
    after_digest: str,
    before_set: set[str],
    after_set: set[str],
    name: str,
) -> None:
    if before_digest == after_digest and before_set != after_set:
        _fail(f"{name} signer set changed while document_sha256 stayed identical")


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, TOP_LEVEL_KEYS, "input")
    if data.get("schema") != INPUT_SCHEMA:
        _fail("unexpected input schema")

    before = data["before"]
    after = data["after"]

    try:
        before_receipt = tri.evaluate(before)
        after_receipt = tri.evaluate(after)
    except tri.TriangulationInputError as exc:
        _fail(f"triangulation snapshot invalid: {exc}")

    before_runtime, before_export, before_root_set = _surface_sets(before)
    after_runtime, after_export, after_root_set = _surface_sets(after)

    before_runtime_digest = before_receipt["runtime_surface"]["document_sha256"]
    after_runtime_digest = after_receipt["runtime_surface"]["document_sha256"]
    before_export_digest = before_receipt["export_surface"]["document_sha256"]
    after_export_digest = after_receipt["export_surface"]["document_sha256"]
    before_root_digest = before_receipt["signed_root"]["document_sha256"]
    after_root_digest = after_receipt["signed_root"]["document_sha256"]

    _assert_same_digest_same_set(
        before_runtime_digest,
        after_runtime_digest,
        before_runtime,
        after_runtime,
        "runtime surface",
    )
    _assert_same_digest_same_set(
        before_export_digest,
        after_export_digest,
        before_export,
        after_export,
        "export surface",
    )
    _assert_same_digest_same_set(
        before_root_digest,
        after_root_digest,
        before_root_set,
        after_root_set,
        "signed root",
    )

    before_root = before_receipt["signed_root"]
    after_root = after_receipt["signed_root"]
    if before_root["id"] != after_root["id"]:
        _fail("before/after signed_root.id must match")

    before_version = before_root["version"]
    after_version = after_root["version"]
    if after_version < before_version:
        _fail("signed-root version rollback is forbidden")
    if after_version == before_version:
        if after_root_digest != before_root_digest:
            _fail("same-version signed-root digest replacement is ambiguous")
        root_relation = "SAME_ROOT"
    else:
        if after_root_digest == before_root_digest:
            _fail("successor root version must not reuse identical root digest")
        root_relation = "SUCCESSOR_ROOT"

    runtime_membership = _membership(before_runtime, after_runtime)
    export_membership = _membership(before_export, after_export)
    root_membership = _membership(before_root_set, after_root_set)

    before_directions = _direction_sets(before_receipt)
    after_directions = _direction_sets(after_receipt)
    lifecycle = {
        direction: _lifecycle(before_directions[direction], after_directions[direction])
        for direction in DIRECTIONS
    }

    any_membership_change = any(
        item["added"] or item["removed"]
        for item in (runtime_membership, export_membership, root_membership)
    )
    any_delta_lifecycle_change = any(
        item["introduced"] or item["resolved"] for item in lifecycle.values()
    )

    return {
        "schema": RECEIPT_SCHEMA,
        "before_snapshot": _snapshot_summary(before_receipt),
        "after_snapshot": _snapshot_summary(after_receipt),
        "root_relation": root_relation,
        "surface_transitions": {
            "runtime": {
                **runtime_membership,
                "document_sha256_changed": before_runtime_digest != after_runtime_digest,
            },
            "export": {
                **export_membership,
                "document_sha256_changed": before_export_digest != after_export_digest,
            },
            "root_admission": {
                **root_membership,
                "document_sha256_changed": before_root_digest != after_root_digest,
            },
        },
        "directional_delta_lifecycle": lifecycle,
        "any_membership_change": bool(any_membership_change),
        "any_delta_lifecycle_change": bool(any_delta_lifecycle_change),
        "semantic_guards": {
            "before_after_roles_prove_trusted_time": False,
            "transition_proves_causality": False,
            "introduced_delta_is_failure_verdict": False,
            "resolved_delta_proves_safety": False,
            "persisted_delta_proves_maliciousness": False,
            "transition_mints_or_mutates_authority": False,
            "transition_calculates_or_mutates_quorum": False,
            "transition_triggers_alert_or_remediation": False,
            "latest_root_substitution_performed": False,
            "successor_state_backfills_historical_snapshot": False,
        },
    }


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: receipt.py <input.json>", file=sys.stderr)
        raise SystemExit(2)

    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        receipt = evaluate(data)
    except (OSError, json.JSONDecodeError, TransitionInputError) as exc:
        print(f"authority surface transition: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)

    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
