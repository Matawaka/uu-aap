#!/usr/bin/env python3
"""PoAI Genesis semantic validator.

Dependency-free semantic checks are always performed.
If --schema is supplied, jsonschema>=4.22 is used for Draft 2020-12 validation.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

FORBIDDEN_SCALAR_KEYS = {"intelligence_score", "trust_score"}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def walk(value: Any, path: str = "$") -> Iterable[tuple[str, str, Any]]:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            yield child_path, key, child
            yield from walk(child, child_path)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            yield from walk(child, f"{path}[{i}]")


def parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    text = value.strip()
    try:
        if len(text) == 10:
            return datetime.fromisoformat(text + "T00:00:00")
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def semantic_errors(doc: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    if doc.get("protocol") != "PoAI":
        errors.append("protocol must equal 'PoAI'")

    for path, key, _value in walk(doc):
        if key in FORBIDDEN_SCALAR_KEYS:
            errors.append(
                f"{path}: protocol-defined scalar '{key}' is forbidden; "
                "PoAI keeps dimensions separate"
            )

    subject = doc.get("subject") or {}
    subject_id = subject.get("id")

    actors = doc.get("actors") or []
    actor_ids = [a.get("actor_id") for a in actors if isinstance(a, dict)]
    resource_ids = [
        r.get("resource_id")
        for r in (doc.get("intelligence_resources") or [])
        if isinstance(r, dict)
    ]
    evidence_ids = [
        e.get("evidence_id")
        for e in (doc.get("evidence") or [])
        if isinstance(e, dict)
    ]

    def check_unique(values: list[Any], label: str) -> None:
        clean = [v for v in values if isinstance(v, str)]
        if len(clean) != len(set(clean)):
            errors.append(f"duplicate {label} identifiers are not allowed")

    check_unique(actor_ids, "actor")
    check_unique(resource_ids, "resource")
    check_unique(evidence_ids, "evidence")

    actor_set = set(actor_ids)
    resource_set = set(resource_ids)
    evidence_set = set(evidence_ids)

    for i, resource in enumerate(doc.get("intelligence_resources") or []):
        for actor_ref in resource.get("actor_refs") or []:
            if actor_ref not in actor_set:
                errors.append(
                    f"intelligence_resources[{i}].actor_refs: "
                    f"unknown actor reference '{actor_ref}'"
                )

    for i, item in enumerate(doc.get("availability") or []):
        rid = item.get("resource_id")
        if rid not in resource_set:
            errors.append(
                f"availability[{i}].resource_id references unknown resource '{rid}'"
            )
        sid = item.get("subject_id")
        if subject_id and sid != subject_id:
            errors.append(
                f"availability[{i}].subject_id '{sid}' does not match subject.id "
                f"'{subject_id}'"
            )
        for evidence_ref in item.get("evidence_refs") or []:
            if evidence_ref not in evidence_set:
                errors.append(
                    f"availability[{i}].evidence_refs contains unknown evidence "
                    f"'{evidence_ref}'"
                )

    for i, item in enumerate(doc.get("consideration") or []):
        rid = item.get("resource_id")
        if rid not in resource_set:
            errors.append(
                f"consideration[{i}].resource_id references unknown resource '{rid}'"
            )
        for evidence_ref in item.get("evidence_refs") or []:
            if evidence_ref not in evidence_set:
                errors.append(
                    f"consideration[{i}].evidence_refs contains unknown evidence "
                    f"'{evidence_ref}'"
                )

    for i, item in enumerate(doc.get("alternatives") or []):
        for evidence_ref in item.get("evidence_refs") or []:
            if evidence_ref not in evidence_set:
                errors.append(
                    f"alternatives[{i}].evidence_refs contains unknown evidence "
                    f"'{evidence_ref}'"
                )

    for i, item in enumerate(doc.get("authority") or []):
        actor_id = item.get("actor_id")
        if actor_id not in actor_set:
            errors.append(
                f"authority[{i}].actor_id references unknown actor '{actor_id}'"
            )

    boundary = doc.get("decision_boundary") or {}
    cutoff = parse_time(boundary.get("knowledge_cutoff"))
    closed = parse_time(boundary.get("closed_at"))
    if cutoff is not None and closed is not None:
        try:
            if cutoff > closed:
                errors.append(
                    "decision_boundary.knowledge_cutoff must not be later than "
                    "decision_boundary.closed_at"
                )
        except TypeError:
            errors.append(
                "decision boundary timestamps use incompatible timezone precision"
            )

    outcome = doc.get("outcome") or {}
    if (
        outcome.get("status") == "not_realized_after_intervention"
        and not outcome.get("intervention")
    ):
        errors.append(
            "outcome.status is 'not_realized_after_intervention' but no "
            "intervention is identified"
        )

    profile = doc.get("profile")
    if profile in {"T", "V", "R"}:
        if not doc.get("availability"):
            errors.append(f"profile {profile} requires at least one availability claim")
        if not doc.get("consideration"):
            errors.append(f"profile {profile} requires at least one consideration record")
        if not doc.get("evidence"):
            errors.append(f"profile {profile} requires at least one evidence record")
        contestability = doc.get("contestability") or {}
        if not contestability.get("channel_available"):
            errors.append(f"profile {profile} requires a contestability channel")

    if profile in {"V", "R"}:
        binding = doc.get("artifact_binding") or {}
        if binding.get("status") == "not_bound":
            errors.append(f"profile {profile} cannot use artifact_binding.status='not_bound'")

    return errors


def schema_errors(doc: dict[str, Any], schema_path: Path) -> list[str]:
    try:
        import jsonschema
    except ImportError:
        return [
            "JSON Schema validation requested but the 'jsonschema' package is not "
            "installed. Install with: python -m pip install 'jsonschema>=4.22,<5'"
        ]

    schema = load_json(schema_path)
    validator_cls = jsonschema.validators.validator_for(schema)
    validator_cls.check_schema(schema)
    validator = validator_cls(schema)

    output: list[str] = []
    for err in sorted(validator.iter_errors(doc), key=lambda e: list(e.absolute_path)):
        loc = "$"
        for part in err.absolute_path:
            loc += f"[{part}]" if isinstance(part, int) else f".{part}"
        output.append(f"{loc}: {err.message}")
    return output


def validate_file(path: Path, schema_path: Path | None) -> list[str]:
    try:
        doc = load_json(path)
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot load JSON: {exc}"]

    if not isinstance(doc, dict):
        return ["top-level JSON value must be an object"]

    errors: list[str] = []
    if schema_path is not None:
        errors.extend(schema_errors(doc, schema_path))
    errors.extend(semantic_errors(doc))
    return errors


def run_vectors(root: Path, schema_path: Path | None) -> int:
    expected_valid = sorted((root / "valid").glob("*.json"))
    expected_invalid = sorted((root / "invalid").glob("*.json"))

    failures = 0
    for path in expected_valid:
        errors = validate_file(path, schema_path)
        if errors:
            failures += 1
            print(f"FAIL expected valid: {path}")
            for err in errors:
                print(f"  - {err}")
        else:
            print(f"PASS valid: {path}")

    for path in expected_invalid:
        errors = validate_file(path, schema_path)
        if errors:
            print(f"PASS invalid rejected: {path}")
        else:
            failures += 1
            print(f"FAIL expected invalid but accepted: {path}")

    if not expected_valid or not expected_invalid:
        failures += 1
        print("FAIL test-vector directory must contain both valid/ and invalid/ JSON files")

    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate PoAI Genesis records.")
    parser.add_argument("files", nargs="*", type=Path)
    parser.add_argument("--schema", type=Path, help="Optional PoAI JSON Schema path")
    parser.add_argument(
        "--test-vectors",
        type=Path,
        help="Run every JSON file under <dir>/valid and <dir>/invalid",
    )
    args = parser.parse_args()

    if args.test_vectors:
        return run_vectors(args.test_vectors, args.schema)

    if not args.files:
        parser.error("provide at least one JSON file or --test-vectors")

    failed = False
    for path in args.files:
        errors = validate_file(path, args.schema)
        if errors:
            failed = True
            print(f"INVALID {path}")
            for err in errors:
                print(f"  - {err}")
        else:
            print(f"VALID {path}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
