#!/usr/bin/env python3
"""Deterministic conflict-scenario harness for UU Society v0.1.

Model conformance != social correctness.
The harness is intentionally fail-closed and does not use an LLM as an oracle.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    from jsonschema import Draft202012Validator, RefResolver
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "jsonschema is required. Install the pinned CI dependency: "
        "python -m pip install jsonschema==4.23.0"
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
STATE_SCHEMA_PATH = ROOT / "uu-society-state.schema.json"
TRANSITION_SCHEMA_PATH = ROOT / "uu-society-transition.schema.json"
SCENARIO_SCHEMA_PATH = ROOT / "scenario.schema.json"
RECEIPT_SCHEMA_PATH = ROOT / "scenario-test-receipt.schema.json"
MANIFEST_PATH = ROOT / "uu-society-model.manifest.json"
SCENARIOS_DIR = ROOT / "scenarios"

COLLECTION_BY_ENTITY_TYPE = {
    "GovernanceCell": "governance_cells",
    "Actor": "actors",
    "PersonalAnchor": "personal_anchors",
    "Intent": "intents",
    "Need": "needs",
    "Capability": "capabilities",
    "Resource": "resources",
    "EvidenceEvent": "evidence_events",
    "TrustState": "trust_states",
    "RiskHarmEnvelope": "risk_harm_envelopes",
    "Match": "matches",
    "Commitment": "commitments",
    "ARAEState": "arae_states",
    "ActionLease": "action_leases",
    "Action": "actions",
    "Outcome": "outcomes",
    "Receipt": "receipts",
    "Contribution": "contributions",
    "Repair": "repairs",
    "Dispute": "disputes",
    "FailurePattern": "failure_patterns",
    "Harm": "harms",
    "RuleViolation": "rule_violations",
}

ADVERSE_TRUST_STATES = {"mixed", "adverse"}
RESTRICTIVE_ARAE_STATES = {"narrowed", "suspended"}


class HarnessError(Exception):
    pass


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def current_commit() -> str:
    try:
        value = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        if len(value) == 40 and all(c in "0123456789abcdef" for c in value):
            return value
    except Exception:
        pass
    return "uncommitted"


def validator(schema: dict[str, Any], store: dict[str, Any] | None = None):
    resolver = RefResolver.from_schema(schema, store=store or {})
    return Draft202012Validator(schema, resolver=resolver)


def format_errors(errors) -> list[str]:
    out = []
    for error in sorted(errors, key=lambda e: list(e.absolute_path)):
        path = "/".join(str(x) for x in error.absolute_path) or "<root>"
        out.append(f"{path}: {error.message}")
    return out


def index_snapshot(snapshot: dict[str, Any]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for collection in COLLECTION_BY_ENTITY_TYPE.values():
        for entity in snapshot.get(collection, []):
            entity_id = entity["id"]
            if entity_id in index:
                raise HarnessError(f"duplicate entity id: {entity_id}")
            index[entity_id] = entity
    return index


def validate_references(snapshot: dict[str, Any]) -> list[str]:
    """Validate internal UU Society references.

    Provenance/source/regression references may intentionally point outside the
    current snapshot and are therefore not treated as state-graph edges.
    """
    index = index_snapshot(snapshot)
    exempt = {"provenance_refs", "source_refs", "regression_test_refs"}
    errors: list[str] = []

    def walk(value: Any, path: str = "") -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                child = f"{path}/{key}"
                if key in exempt:
                    continue
                if key.endswith("_ref") and isinstance(item, str):
                    if item.startswith("urn:uu-aap:uu-society:") and item not in index:
                        errors.append(f"{child}: dangling ref {item}")
                elif key.endswith("_refs") and isinstance(item, list):
                    for ref in item:
                        if (
                            isinstance(ref, str)
                            and ref.startswith("urn:uu-aap:uu-society:")
                            and ref not in index
                        ):
                            errors.append(f"{child}: dangling ref {ref}")
                else:
                    walk(item, child)
        elif isinstance(value, list):
            for pos, item in enumerate(value):
                walk(item, f"{path}/{pos}")

    walk(snapshot)
    return errors


def entity_for_event(snapshot: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    collection = COLLECTION_BY_ENTITY_TYPE.get(event["entity_type"])
    if collection is None:
        raise HarnessError(f"unknown entity type: {event['entity_type']}")
    for entity in snapshot[collection]:
        if entity["id"] == event["entity_ref"]:
            return entity
    raise HarnessError(
        f"entity not found for transition: {event['entity_ref']} "
        f"({event['entity_type']})"
    )


def is_transition_allowed(
    manifest: dict[str, Any], event: dict[str, Any]
) -> bool:
    pairs = manifest["transition_catalog"].get(event["entity_type"], [])
    return [event["from_state"], event["to_state"]] in pairs


def find_by_id(snapshot: dict[str, Any], entity_id: str) -> dict[str, Any] | None:
    return index_snapshot(snapshot).get(entity_id)


def active_arae_supports_action(
    snapshot: dict[str, Any], action: dict[str, Any]
) -> bool:
    for arae in snapshot["arae_states"]:
        if (
            arae["actor_ref"] == action["actor_ref"]
            and arae["state"] in {"active", "narrowed"}
            and action["action_type"] in arae["allowed_transition_types"]
            and action["action_type"] not in arae["forbidden_transition_types"]
        ):
            return True
    return False


def fresh_supporting_evidence(
    snapshot: dict[str, Any],
    evidence_refs: list[str],
    evaluation_time: str,
) -> bool:
    """Return true when at least one referenced evidence event is current enough
    and positively bound for an authority-expanding transition.
    """
    for ref in evidence_refs:
        evidence = find_by_id(snapshot, ref)
        if evidence is None or not ref.startswith(
            "urn:uu-aap:uu-society:evidence-event:"
        ):
            continue
        if evidence.get("state") not in {"attested", "cryptographically_bound"}:
            continue
        observed_at = evidence.get("observed_at")
        retention_until = evidence.get("retention_until")
        if not observed_at or observed_at > evaluation_time:
            continue
        if retention_until is not None and evaluation_time > retention_until:
            continue
        return True
    return False


def semantic_guard(
    snapshot: dict[str, Any],
    event: dict[str, Any],
    facts: set[str],
    evaluation_time: str,
) -> tuple[bool, list[str], str]:
    """Return (allowed, invariant_ids, reason).

    This is deliberately small and explicit. It does not infer intent from text.
    Facts are scenario evidence assumptions, not classifier outputs.
    """
    entity = entity_for_event(snapshot, event)
    violations: list[str] = []

    # I-002: dissent alone cannot degrade unrelated trust or narrow authority.
    if "dissent_only" in facts:
        if (
            event["entity_type"] == "TrustState"
            and event["to_state"] in ADVERSE_TRUST_STATES
        ) or (
            event["entity_type"] == "ARAEState"
            and event["to_state"] in RESTRICTIVE_ARAE_STATES
        ):
            violations.append("I-002")

    # I-003: legitimate need asymmetry alone cannot establish exploitation.
    if "legitimate_need_asymmetry" in facts:
        if (
            event["entity_type"] == "TrustState"
            and event["to_state"] in ADVERSE_TRUST_STATES
        ) or (
            event["entity_type"] == "ARAEState"
            and event["to_state"] in RESTRICTIVE_ARAE_STATES
        ):
            violations.append("I-003")

    # I-004: unresolved contradictory evidence cannot be collapsed into
    # an adverse verdict about the person.
    if "unresolved_conflicting_evidence" in facts:
        if (
            event["entity_type"] == "TrustState"
            and event["to_state"] == "adverse"
        ):
            violations.append("I-004")

    # I-013: one failed continuity challenge may narrow reachable consequences,
    # but it does not by itself establish an impostor or justify actor-level
    # exclusion.
    if "failed_continuity_challenge_only" in facts:
        if (
            event["entity_type"] == "Actor"
            and event["to_state"] in {"limited", "disputed", "withdrawn"}
        ):
            violations.append("I-013")

    # I-015: rule violation and harm are independent axes.
    if "harm_without_rule_violation" in facts:
        if (
            event["entity_type"] == "RuleViolation"
            and event["to_state"] in {"observed", "verified"}
        ):
            violations.append("I-015")

    if "rule_violation_without_harm" in facts:
        if (
            event["entity_type"] == "Harm"
            and event["to_state"] in {"observed", "verified"}
        ):
            violations.append("I-015")

    # I-008: completed repair and retained system learning must not be turned
    # into permanent person-level exclusion solely because the failure exists
    # in historical memory.
    if "historical_failure_repaired" in facts:
        if (
            event["entity_type"] == "Actor"
            and event["to_state"] in {"limited", "disputed", "withdrawn"}
        ):
            violations.append("I-008")
        if (
            event["entity_type"] == "TrustState"
            and event["to_state"] == "adverse"
        ):
            violations.append("I-008")

    # I-014: widening a previously narrowed/suspended ARAE requires fresh,
    # positively bound evidence at the current transition frontier.
    if (
        event["entity_type"] == "ARAEState"
        and event["from_state"] in {"narrowed", "suspended"}
        and event["to_state"] == "active"
        and not fresh_supporting_evidence(
            snapshot, event.get("evidence_refs", []), evaluation_time
        )
    ):
        violations.append("I-014")

    # I-014 + interaction rule R-002: action admission needs current lease.
    if event["entity_type"] == "Action" and event["to_state"] in {
        "admitted",
        "in_progress",
    }:
        lease = find_by_id(snapshot, entity["lease_ref"])
        if lease is None or lease["state"] != "active":
            violations.append("I-014")
        else:
            if not (lease["granted_at"] <= evaluation_time <= lease["expires_at"]):
                violations.append("I-014")
            if not lease.get("authority_refs"):
                violations.append("I-014")
        if not active_arae_supports_action(snapshot, entity):
            violations.append("I-006")

    # Fail closed if a scenario claims a malicious irreversible attempt but
    # tries to expand rather than contain consequences.
    if "malicious_irreversible_action_attempt" in facts:
        if event["entity_type"] == "ARAEState" and event["to_state"] == "active":
            if event["from_state"] in {"narrowed", "suspended"}:
                violations.append("I-006")
        if event["entity_type"] == "ActionLease" and event["to_state"] == "active":
            if event["from_state"] in {"revoked", "expired"}:
                violations.append("I-014")

    if violations:
        return False, sorted(set(violations)), (
            "semantic guard rejected transition under scenario facts"
        )
    return True, [], "allowed"


def apply_event(
    snapshot: dict[str, Any],
    event: dict[str, Any],
    manifest: dict[str, Any],
    facts: set[str],
    evaluation_time: str,
) -> tuple[bool, list[str], str]:
    entity = entity_for_event(snapshot, event)

    if entity["state"] != event["from_state"]:
        return False, [], (
            f"from_state mismatch: snapshot={entity['state']} "
            f"event={event['from_state']}"
        )

    if not is_transition_allowed(manifest, event):
        return False, [], (
            f"transition not in catalog: {event['entity_type']} "
            f"{event['from_state']} -> {event['to_state']}"
        )

    allowed, violations, reason = semantic_guard(
        snapshot, event, facts, evaluation_time
    )
    if not allowed:
        return False, violations, reason

    entity["state"] = event["to_state"]
    entity["updated_at"] = event["occurred_at"]
    return True, [], "applied"


def final_states(snapshot: dict[str, Any]) -> dict[str, str]:
    result = {}
    for collection in COLLECTION_BY_ENTITY_TYPE.values():
        for entity in snapshot[collection]:
            result[entity["id"]] = entity["state"]
    return result


def validate_expected(
    expected: dict[str, Any],
    actual_result: str,
    snapshot: dict[str, Any],
    violations: list[str],
) -> list[str]:
    errors = []
    if actual_result != expected["scenario_result"]:
        errors.append(
            f"scenario_result expected={expected['scenario_result']} "
            f"actual={actual_result}"
        )
    states = final_states(snapshot)
    for entity_id, expected_state in expected["expected_final_states"].items():
        if states.get(entity_id) != expected_state:
            errors.append(
                f"final state {entity_id}: expected={expected_state} "
                f"actual={states.get(entity_id)}"
            )

    if sorted(set(violations)) != sorted(expected["expected_violation_ids"]):
        errors.append(
            "violation ids expected="
            f"{sorted(expected['expected_violation_ids'])} "
            f"actual={sorted(set(violations))}"
        )
    return errors


def run_scenario(
    scenario_path: Path,
    state_schema: dict[str, Any],
    transition_schema: dict[str, Any],
    scenario_schema: dict[str, Any],
    receipt_schema: dict[str, Any],
    manifest: dict[str, Any],
    model_commit_sha: str,
) -> tuple[dict[str, Any], list[str]]:
    scenario = load_json(scenario_path)
    store = {
        transition_schema["$id"]: transition_schema,
        "./uu-society-transition.schema.json": transition_schema,
    }
    scenario_errors = format_errors(
        validator(scenario_schema, store).iter_errors(scenario)
    )
    if scenario_errors:
        return {}, [f"scenario schema: {x}" for x in scenario_errors]

    initial_path = scenario_path.parent / scenario["initial_snapshot"]
    initial = load_json(initial_path)
    state_errors = format_errors(validator(state_schema).iter_errors(initial))
    ref_errors = validate_references(initial)
    if state_errors or ref_errors:
        return {}, [
            *[f"initial state schema: {x}" for x in state_errors],
            *[f"initial refs: {x}" for x in ref_errors],
        ]

    current = copy.deepcopy(initial)
    facts = set(scenario["semantic_facts"])
    violations: list[str] = []
    applied = 0
    actual_result = "PASS"
    event_errors: list[str] = []

    for pos, event in enumerate(scenario["events"]):
        transition_errors = format_errors(
            validator(transition_schema).iter_errors(event)
        )
        if transition_errors:
            actual_result = "FAIL"
            event_errors.extend(
                f"event[{pos}] schema: {x}" for x in transition_errors
            )
            break

        try:
            ok, event_violations, reason = apply_event(
                current,
                event,
                manifest,
                facts,
                scenario["evaluation_time"],
            )
        except HarnessError as exc:
            ok = False
            event_violations = []
            reason = str(exc)

        if not ok:
            violations.extend(event_violations)
            if event_violations:
                actual_result = "EXPECTED_REJECTION"
            else:
                actual_result = "FAIL"
                event_errors.append(f"event[{pos}]: {reason}")
            break

        applied += 1
        post_schema_errors = format_errors(
            validator(state_schema).iter_errors(current)
        )
        post_ref_errors = validate_references(current)
        if post_schema_errors or post_ref_errors:
            actual_result = "FAIL"
            event_errors.extend(
                [f"post event[{pos}] schema: {x}" for x in post_schema_errors]
                + [f"post event[{pos}] refs: {x}" for x in post_ref_errors]
            )
            break

    expected_errors = validate_expected(
        scenario["expected"], actual_result, current, violations
    )

    receipt = {
        "receipt_version": "0.1",
        "run_id": (
            "urn:uu-aap:uu-society:test-run:"
            + scenario["scenario_id"].lower()
            + ":"
            + digest({"scenario": scenario, "commit": model_commit_sha})[:16]
        ),
        "scenario_id": scenario["scenario_id"],
        "scenario_version": scenario["scenario_version"],
        "model_version": manifest["schema_version"],
        "model_commit_sha": model_commit_sha,
        "evaluation_time": scenario["evaluation_time"],
        "result": actual_result if not expected_errors and not event_errors else "FAIL",
        "event_count": len(scenario["events"]),
        "applied_event_count": applied,
        "violation_ids": sorted(set(violations)),
        "digests": {
            "manifest_sha256": file_digest(MANIFEST_PATH),
            "state_schema_sha256": file_digest(STATE_SCHEMA_PATH),
            "transition_schema_sha256": file_digest(TRANSITION_SCHEMA_PATH),
            "scenario_sha256": digest(scenario),
            "initial_snapshot_sha256": digest(initial),
        },
        "final_snapshot_digest": digest(current),
    }

    receipt_errors = format_errors(
        validator(receipt_schema).iter_errors(receipt)
    )
    errors = [*event_errors, *expected_errors]
    errors.extend(f"receipt schema: {x}" for x in receipt_errors)
    return receipt, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scenario",
        action="append",
        help="Scenario ID to run; may be repeated. Defaults to all scenarios.",
    )
    parser.add_argument(
        "--write-receipts",
        action="store_true",
        help="Write deterministic receipts under harness/.artifacts/.",
    )
    args = parser.parse_args()

    state_schema = load_json(STATE_SCHEMA_PATH)
    transition_schema = load_json(TRANSITION_SCHEMA_PATH)
    scenario_schema = load_json(SCENARIO_SCHEMA_PATH)
    receipt_schema = load_json(RECEIPT_SCHEMA_PATH)
    manifest = load_json(MANIFEST_PATH)
    model_commit_sha = current_commit()

    scenario_paths = sorted(SCENARIOS_DIR.glob("S*/scenario.json"))
    if args.scenario:
        wanted = set(args.scenario)
        scenario_paths = [
            p for p in scenario_paths
            if load_json(p)["scenario_id"] in wanted
        ]
        missing = wanted - {load_json(p)["scenario_id"] for p in scenario_paths}
        if missing:
            print("missing scenarios:", ", ".join(sorted(missing)), file=sys.stderr)
            return 2

    if not scenario_paths:
        print("no scenarios found", file=sys.stderr)
        return 2

    all_errors: list[str] = []
    receipts = []
    for path in scenario_paths:
        receipt, errors = run_scenario(
            path,
            state_schema,
            transition_schema,
            scenario_schema,
            receipt_schema,
            manifest,
            model_commit_sha,
        )
        scenario_id = load_json(path)["scenario_id"]
        if errors:
            print(f"{scenario_id}: FAIL")
            for error in errors:
                print(f"  - {error}")
            all_errors.extend(f"{scenario_id}: {e}" for e in errors)
        else:
            print(f"{scenario_id}: {receipt['result']}")
            receipts.append(receipt)

    if args.write_receipts and receipts:
        out = ROOT / "harness" / ".artifacts"
        out.mkdir(parents=True, exist_ok=True)
        for receipt in receipts:
            target = out / f"{receipt['scenario_id']}.receipt.json"
            target.write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    passed = len(receipts)
    print(
        f"\nUU Society v0.1 conflict suite: "
        f"{passed}/{len(scenario_paths)} scenarios conform"
    )
    if all_errors:
        print(f"unexpected failures: {len(all_errors)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
