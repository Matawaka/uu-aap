#!/usr/bin/env python3
"""Deterministic meta-resilience checks for UU Society v0.1.

This suite inspects populations and timelines rather than individual state
transitions. It does not infer guilt, identity truth or moral worth.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from run_scenarios import (
    current_commit,
    digest,
    file_digest,
    format_errors,
    index_snapshot,
    load_json,
    validate_references,
    validator,
)

ROOT = Path(__file__).resolve().parents[1]
STATE_SCHEMA_PATH = ROOT / "uu-society-state.schema.json"
MANIFEST_PATH = ROOT / "uu-society-model.manifest.json"
META_SCHEMA_PATH = ROOT / "meta-scenario.schema.json"
META_RECEIPT_SCHEMA_PATH = ROOT / "meta-test-receipt.schema.json"
META_DIR = ROOT / "meta_scenarios"


def evidence_by_id(snapshot: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {e["id"]: e for e in snapshot.get("evidence_events", [])}


def group_members(meta: dict[str, Any], role: str) -> list[set[str]]:
    return [
        set(group["member_refs"])
        for group in meta.get("groups", [])
        if group["role"] == role
    ]


def check_sybil_current_control_reuse(
    snapshots: list[dict[str, Any]], meta: dict[str, Any]
) -> tuple[set[str], dict[str, Any]]:
    reused = []
    for snapshot in snapshots:
        actors = {a["id"]: a for a in snapshot["actors"]}
        owners: dict[str, set[str]] = defaultdict(set)
        for anchor in snapshot["personal_anchors"]:
            actor = actors.get(anchor["actor_ref"])
            if actor is None or actor.get("actor_type") != "PERSON":
                continue
            if anchor.get("state") == "dormant":
                continue
            for ref in anchor.get("current_control_evidence_refs", []):
                owners[ref].add(anchor["actor_ref"])
        for ref, actor_refs in owners.items():
            if len(actor_refs) > 1:
                reused.append({"evidence_ref": ref, "actor_refs": sorted(actor_refs)})
    return ({"I-019"} if reused else set(), {"reused_current_control_evidence": reused})


def check_coalition_rotation_evidence_erasure(
    snapshots: list[dict[str, Any]], meta: dict[str, Any]
) -> tuple[set[str], dict[str, Any]]:
    threshold = meta.get("parameters", {}).get("coalition_breach_threshold", 3)
    findings = []
    groups = group_members(meta, "coalition_candidate")
    if not groups:
        return set(), {"coalition_findings": findings}

    commitments: dict[str, dict[str, Any]] = {}
    evidence_events: dict[str, dict[str, Any]] = {}
    for snapshot in snapshots:
        for commitment in snapshot["commitments"]:
            if commitment["state"] == "breached":
                commitments[commitment["id"]] = commitment
        for event in snapshot["evidence_events"]:
            evidence_events[event["id"]] = event

    for members in groups:
        group_breaches = [
            c for c in commitments.values()
            if set(c.get("participant_refs", [])) & members
        ]
        represented = set()
        for commitment in group_breaches:
            represented |= set(commitment.get("participant_refs", [])) & members

        pattern_evidence = [
            e for e in evidence_events.values()
            if e.get("event_type") in {
                "coordinated_extraction_pattern",
                "coalition_pattern",
                "cross_actor_recurrence_pattern",
            }
            and len(set(e.get("subject_refs", [])) & members) >= 2
        ]

        if (
            len(group_breaches) >= threshold
            and len(represented) >= 2
            and not pattern_evidence
        ):
            findings.append({
                "member_refs": sorted(members),
                "breached_commitment_refs": sorted(c["id"] for c in group_breaches),
                "pattern_evidence_refs": [],
            })

    return ({"I-020"} if findings else set(), {"coalition_findings": findings})


def check_governance_self_ratification(
    snapshots: list[dict[str, Any]], meta: dict[str, Any]
) -> tuple[set[str], dict[str, Any]]:
    findings = []
    capture_groups = group_members(meta, "governance_capture_candidate")
    if not capture_groups:
        return set(), {"self_ratifying_rules": findings}

    for snapshot in snapshots:
        idx = index_snapshot(snapshot)
        for rule in snapshot["governance_rules"]:
            if rule["state"] != "active":
                continue
            cell = idx.get(rule["governance_cell_ref"])
            if cell is None or cell.get("appeal_route_refs"):
                continue
            basis_subjects = set()
            basis_count = 0
            for ref in rule.get("authority_basis_refs", []):
                item = idx.get(ref)
                if item and ref.startswith("urn:uu-aap:uu-society:evidence-event:"):
                    basis_count += 1
                    basis_subjects |= set(item.get("subject_refs", []))
            if not basis_count or not basis_subjects:
                continue
            for members in capture_groups:
                if basis_subjects.issubset(members):
                    findings.append({
                        "rule_ref": rule["id"],
                        "governance_cell_ref": cell["id"],
                        "basis_subject_refs": sorted(basis_subjects),
                        "capture_group_refs": sorted(members),
                    })
                    break
    return ({"I-021"} if findings else set(), {"self_ratifying_rules": findings})


def check_restriction_inertia(
    snapshots: list[dict[str, Any]], meta: dict[str, Any]
) -> tuple[set[str], dict[str, Any]]:
    minimum = meta.get("parameters", {}).get(
        "restriction_persistence_snapshots", 3
    )
    findings = []
    if len(snapshots) < minimum:
        return set(), {"persistent_restrictions": findings}

    ordered = sorted(snapshots, key=lambda s: s["observed_at"])
    actor_sets = []
    for snapshot in ordered:
        actor_sets.append({
            arae["actor_ref"]
            for arae in snapshot["arae_states"]
            if arae["state"] in {"narrowed", "suspended"}
        })
    persistent = set.intersection(*actor_sets) if actor_sets else set()

    first_time = ordered[0]["observed_at"]
    for actor_ref in sorted(persistent):
        fresh_adverse = False
        recovery_path = False
        for snapshot in ordered[1:]:
            for event in snapshot["evidence_events"]:
                if (
                    actor_ref in event.get("subject_refs", [])
                    and event.get("observed_at", "") > first_time
                    and event.get("state") in {"attested", "cryptographically_bound"}
                    and event.get("event_type") in {
                        "adverse_current_evidence",
                        "current_risk_evidence",
                        "current_breach_evidence",
                    }
                ):
                    fresh_adverse = True
            for dispute in snapshot["disputes"]:
                if (
                    dispute.get("challenger_ref") == actor_ref
                    and dispute["state"] in {"opened", "under_review", "escalated"}
                ):
                    recovery_path = True
            for repair in snapshot["repairs"]:
                if (
                    actor_ref in repair.get("responsible_actor_refs", [])
                    and repair["state"] in {"proposed", "accepted", "in_progress"}
                ):
                    recovery_path = True
        if not fresh_adverse and not recovery_path:
            findings.append({
                "actor_ref": actor_ref,
                "snapshot_count": len(ordered),
                "fresh_adverse_evidence": False,
                "recovery_path": False,
            })
    return ({"I-022"} if findings else set(), {"persistent_restrictions": findings})


def check_universal_person_ranking(
    snapshots: list[dict[str, Any]], meta: dict[str, Any]
) -> tuple[set[str], dict[str, Any]]:
    rankings = meta.get("proposed_actor_rankings", [])
    if not rankings:
        return set(), {"proposed_actor_rankings": []}
    return {"I-005", "I-023"}, {"proposed_actor_rankings": rankings}


CHECKS = {
    "sybil_current_control_reuse": check_sybil_current_control_reuse,
    "coalition_rotation_evidence_erasure": check_coalition_rotation_evidence_erasure,
    "governance_self_ratification": check_governance_self_ratification,
    "restriction_inertia": check_restriction_inertia,
    "universal_person_ranking": check_universal_person_ranking,
}


def run_meta(meta_path: Path) -> tuple[dict[str, Any], list[str]]:
    state_schema = load_json(STATE_SCHEMA_PATH)
    manifest = load_json(MANIFEST_PATH)
    meta_schema = load_json(META_SCHEMA_PATH)
    receipt_schema = load_json(META_RECEIPT_SCHEMA_PATH)
    meta = load_json(meta_path)

    errors = format_errors(validator(meta_schema).iter_errors(meta))
    if errors:
        return {}, [f"meta schema: {e}" for e in errors]

    snapshots = []
    snapshot_digests = []
    for filename in meta["snapshot_files"]:
        path = meta_path.parent / filename
        snapshot = load_json(path)
        schema_errors = format_errors(validator(state_schema).iter_errors(snapshot))
        ref_errors = validate_references(snapshot)
        if schema_errors or ref_errors:
            return {}, [
                *[f"{filename} schema: {e}" for e in schema_errors],
                *[f"{filename} refs: {e}" for e in ref_errors],
            ]
        snapshots.append(snapshot)
        snapshot_digests.append(digest(snapshot))

    violations: set[str] = set()
    observations: dict[str, Any] = {}
    for check_id in meta["checks"]:
        check_violations, check_observations = CHECKS[check_id](snapshots, meta)
        violations |= check_violations
        observations[check_id] = check_observations

    expected = set(meta["expected"]["expected_violation_ids"])
    actual_result = "EXPECTED_DETECTION" if violations else "PASS"
    expected_errors = []
    if actual_result != meta["expected"]["result"]:
        expected_errors.append(
            f"result expected={meta['expected']['result']} actual={actual_result}"
        )
    if violations != expected:
        expected_errors.append(
            f"violations expected={sorted(expected)} actual={sorted(violations)}"
        )

    receipt = {
        "receipt_version": "0.1",
        "run_id": (
            "urn:uu-aap:uu-society:meta-test-run:"
            + meta["meta_scenario_id"].lower()
            + ":"
            + digest({"meta": meta, "commit": current_commit()})[:16]
        ),
        "meta_scenario_id": meta["meta_scenario_id"],
        "scenario_version": meta["scenario_version"],
        "model_version": manifest["schema_version"],
        "model_commit_sha": current_commit(),
        "result": actual_result if not expected_errors else "FAIL",
        "snapshot_count": len(snapshots),
        "violation_ids": sorted(violations),
        "observations": observations,
        "digests": {
            "manifest_sha256": file_digest(MANIFEST_PATH),
            "state_schema_sha256": file_digest(STATE_SCHEMA_PATH),
            "meta_scenario_sha256": digest(meta),
            "snapshot_sha256": snapshot_digests,
        },
    }
    receipt_errors = format_errors(validator(receipt_schema).iter_errors(receipt))
    return receipt, [*expected_errors, *[f"receipt schema: {e}" for e in receipt_errors]]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--meta-scenario", action="append")
    parser.add_argument("--write-receipts", action="store_true")
    args = parser.parse_args()

    paths = sorted(META_DIR.glob("M*/meta-scenario.json"))
    if args.meta_scenario:
        wanted = set(args.meta_scenario)
        paths = [p for p in paths if load_json(p)["meta_scenario_id"] in wanted]

    if not paths:
        print("no meta scenarios found", file=sys.stderr)
        return 2

    receipts = []
    failures = []
    for path in paths:
        receipt, errors = run_meta(path)
        scenario_id = load_json(path)["meta_scenario_id"]
        if errors:
            print(f"{scenario_id}: FAIL")
            for error in errors:
                print(f"  - {error}")
            failures.extend(f"{scenario_id}: {e}" for e in errors)
        else:
            print(f"{scenario_id}: {receipt['result']}")
            receipts.append(receipt)

    if args.write_receipts and receipts:
        out = ROOT / "harness" / ".artifacts" / "meta"
        out.mkdir(parents=True, exist_ok=True)
        for receipt in receipts:
            (out / f"{receipt['meta_scenario_id']}.receipt.json").write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    print(
        f"\nUU Society v0.1 meta-resilience suite: "
        f"{len(receipts)}/{len(paths)} scenarios conform"
    )
    if failures:
        print(f"unexpected failures: {len(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
