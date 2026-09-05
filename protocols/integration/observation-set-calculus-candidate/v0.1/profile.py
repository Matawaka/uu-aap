#!/usr/bin/env python3
"""Provider-neutral candidate observation-set calculus.

Candidate-only reusable seam extracted after #908. This module does not create
truth, authority, admission, disposition, ActionPermit, trusted time, or a
complete-history claim.
"""

from __future__ import annotations

import copy
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

SET_INPUT_SCHEMA = "urn:uu-aap:observation-set-calculus-candidate-set-input:0.1"
TRANSITION_INPUT_SCHEMA = "urn:uu-aap:observation-set-calculus-candidate-transition-input:0.1"
CHAIN_INPUT_SCHEMA = "urn:uu-aap:observation-set-calculus-candidate-chain-input:0.1"
SET_RECEIPT_SCHEMA = "urn:uu-aap:observation-set-calculus-candidate-set-receipt:0.1"
TRANSITION_RECEIPT_SCHEMA = "urn:uu-aap:observation-set-calculus-candidate-transition-receipt:0.1"
CHAIN_RECEIPT_SCHEMA = "urn:uu-aap:observation-set-calculus-candidate-chain-receipt:0.1"
CANDIDATE_STATUS = "IMPLEMENTED_CANDIDATE_NOT_REGISTERED"

SET_KEYS = {"schema", "scope_binding_sha256", "observations"}
OBSERVATION_KEYS = {"semantic_fingerprint_sha256", "source_binding_sha256"}
TRANSITION_KEYS = {"schema", "before_set", "after_set"}
CHAIN_KEYS = {"schema", "sets"}

RELATIONS = (
    "IDENTICAL_OBSERVED_SET",
    "OBSERVATION_MULTIPLICITY_ONLY_CHANGED",
    "OBSERVED_MEMBERSHIP_CHANGED",
    "OBSERVED_MEMBERSHIP_AND_MULTIPLICITY_CHANGED",
)


class ObservationSetInputError(ValueError):
    pass


def _fail(message: str) -> None:
    raise ObservationSetInputError(message)


def _exact_keys(value: Any, expected: set[str], name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(f"{name} must be an object")
    keys = set(value)
    missing = sorted(expected - keys)
    unknown = sorted(keys - expected)
    if missing or unknown:
        _fail(f"{name} keys mismatch: missing={missing}, unknown={unknown}")
    return value


def _sha256(value: Any, name: str) -> str:
    if not isinstance(value, str):
        _fail(f"{name} must be a lowercase SHA-256 hex string")
    if len(value) != 64 or any(ch not in "0123456789abcdef" for ch in value):
        _fail(f"{name} must be a lowercase SHA-256 hex string")
    return value


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _validate_observations(observations: Any, name: str) -> list[dict[str, str]]:
    if not isinstance(observations, list):
        _fail(f"{name} must be an array")
    result: list[dict[str, str]] = []
    seen_source_semantics: dict[str, str] = {}
    for index, raw in enumerate(observations):
        item = _exact_keys(raw, OBSERVATION_KEYS, f"{name}[{index}]")
        semantic = _sha256(
            item["semantic_fingerprint_sha256"],
            f"{name}[{index}].semantic_fingerprint_sha256",
        )
        source = _sha256(
            item["source_binding_sha256"],
            f"{name}[{index}].source_binding_sha256",
        )
        previous = seen_source_semantics.get(source)
        if previous is None:
            seen_source_semantics[source] = semantic
        elif previous != semantic:
            _fail(
                "same source_binding_sha256 maps to different semantic observation "
                f"at {name}[{index}]"
            )
        result.append(
            {
                "semantic_fingerprint_sha256": semantic,
                "source_binding_sha256": source,
            }
        )
    return result


def _assert_cross_set_source_consistency(sets: list[dict[str, Any]]) -> None:
    seen: dict[str, str] = {}
    for set_index, set_input in enumerate(sets):
        observations = _validate_observations(
            set_input["observations"], f"sets[{set_index}].observations"
        )
        for obs_index, item in enumerate(observations):
            source = item["source_binding_sha256"]
            semantic = item["semantic_fingerprint_sha256"]
            previous = seen.get(source)
            if previous is None:
                seen[source] = semantic
            elif previous != semantic:
                _fail(
                    "cross-set source binding maps to different semantic observation "
                    f"at sets[{set_index}].observations[{obs_index}]"
                )


def _set_counts(receipt: dict[str, Any]) -> dict[str, int]:
    return {
        item["semantic_fingerprint_sha256"]: item["observation_count"]
        for item in receipt["distinct_observations"]
    }


def evaluate_set(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, SET_KEYS, "set input")
    if data.get("schema") != SET_INPUT_SCHEMA:
        _fail("unexpected set input schema")
    scope = _sha256(data["scope_binding_sha256"], "scope_binding_sha256")
    observations = _validate_observations(data["observations"], "observations")

    counts: Counter[str] = Counter(
        item["semantic_fingerprint_sha256"] for item in observations
    )
    sources_by_semantic: dict[str, set[str]] = {}
    for item in observations:
        sources_by_semantic.setdefault(item["semantic_fingerprint_sha256"], set()).add(
            item["source_binding_sha256"]
        )

    distinct = [
        {
            "semantic_fingerprint_sha256": semantic,
            "observation_count": counts[semantic],
            "distinct_source_binding_sha256": sorted(sources_by_semantic[semantic]),
        }
        for semantic in sorted(counts)
    ]
    duplicates = [
        {
            "semantic_fingerprint_sha256": semantic,
            "observation_count": counts[semantic],
        }
        for semantic in sorted(counts)
        if counts[semantic] > 1
    ]
    semantic_multiset = sorted(
        item["semantic_fingerprint_sha256"] for item in observations
    )
    semantic_set_fingerprint = canonical_sha256(
        {
            "scope_binding_sha256": scope,
            "observed_semantic_fingerprints_sha256": semantic_multiset,
        }
    )

    return {
        "schema": SET_RECEIPT_SCHEMA,
        "candidate_status": CANDIDATE_STATUS,
        "scope_binding_sha256": scope,
        "exact_input_fingerprint_sha256": canonical_sha256(data),
        "semantic_set_fingerprint_sha256": semantic_set_fingerprint,
        "observation_count": len(observations),
        "distinct_observation_count": len(counts),
        "observed_semantic_fingerprints_sha256": semantic_multiset,
        "distinct_observations": distinct,
        "duplicate_observations": duplicates,
        "semantic_guards": {
            "complete_world_state_proven": False,
            "all_existing_observations_observed": False,
            "truth_proven": False,
            "authority_created": False,
            "admission_decision_made": False,
            "disposition_decision_made": False,
            "action_permit_created": False,
            "remediation_triggered": False,
        },
    }


def _transition_relation(
    before_counts: dict[str, int], after_counts: dict[str, int]
) -> tuple[str, list[str], list[str], list[str], bool, bool]:
    before_keys = set(before_counts)
    after_keys = set(after_counts)
    newly = sorted(after_keys - before_keys)
    absent_after = sorted(before_keys - after_keys)
    both = sorted(before_keys & after_keys)
    membership_changed = bool(newly or absent_after)
    persisted_multiplicity_changed = any(
        before_counts[key] != after_counts[key] for key in both
    )
    any_count_changed = any(
        before_counts.get(key, 0) != after_counts.get(key, 0)
        for key in before_keys | after_keys
    )

    if not membership_changed and not any_count_changed:
        relation = "IDENTICAL_OBSERVED_SET"
    elif not membership_changed:
        relation = "OBSERVATION_MULTIPLICITY_ONLY_CHANGED"
    elif persisted_multiplicity_changed:
        relation = "OBSERVED_MEMBERSHIP_AND_MULTIPLICITY_CHANGED"
    else:
        relation = "OBSERVED_MEMBERSHIP_CHANGED"
    return (
        relation,
        newly,
        absent_after,
        both,
        membership_changed,
        persisted_multiplicity_changed,
    )


def evaluate_transition(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, TRANSITION_KEYS, "transition input")
    if data.get("schema") != TRANSITION_INPUT_SCHEMA:
        _fail("unexpected transition input schema")
    before_input = data["before_set"]
    after_input = data["after_set"]
    before = evaluate_set(before_input)
    after = evaluate_set(after_input)
    if before["scope_binding_sha256"] != after["scope_binding_sha256"]:
        _fail("OBSERVATION_SCOPE_CHANGED: scope bindings differ")
    _assert_cross_set_source_consistency([before_input, after_input])

    before_counts = _set_counts(before)
    after_counts = _set_counts(after)
    (
        relation,
        newly,
        absent_after,
        both,
        membership_changed,
        persisted_multiplicity_changed,
    ) = _transition_relation(before_counts, after_counts)

    lifecycle = []
    for semantic in sorted(set(before_counts) | set(after_counts)):
        before_count = before_counts.get(semantic, 0)
        after_count = after_counts.get(semantic, 0)
        lifecycle.append(
            {
                "semantic_fingerprint_sha256": semantic,
                "before_observation_count": before_count,
                "after_observation_count": after_count,
                "delta": after_count - before_count,
            }
        )

    return {
        "schema": TRANSITION_RECEIPT_SCHEMA,
        "candidate_status": CANDIDATE_STATUS,
        "scope_binding_sha256": before["scope_binding_sha256"],
        "exact_input_fingerprint_sha256": canonical_sha256(data),
        "before_set_fingerprint_sha256": before["semantic_set_fingerprint_sha256"],
        "after_set_fingerprint_sha256": after["semantic_set_fingerprint_sha256"],
        "relation": relation,
        "newly_observed_semantic_fingerprints_sha256": newly,
        "not_observed_in_after_semantic_fingerprints_sha256": absent_after,
        "observed_in_both_semantic_fingerprints_sha256": both,
        "observation_multiplicity_lifecycle": lifecycle,
        "membership_changed": membership_changed,
        "persisted_multiplicity_changed": persisted_multiplicity_changed,
        "semantic_guards": {
            "before_after_roles_prove_trusted_time": False,
            "newly_observed_proves_creation": False,
            "not_observed_in_after_proves_deletion": False,
            "observed_in_both_proves_continuous_existence": False,
            "complete_history_proven": False,
            "truth_proven": False,
            "authority_created": False,
            "admission_decision_made": False,
            "disposition_decision_made": False,
            "action_permit_created": False,
            "remediation_triggered": False,
        },
    }


def _set_summary(receipt: dict[str, Any]) -> dict[str, Any]:
    return {
        "exact_input_fingerprint_sha256": receipt["exact_input_fingerprint_sha256"],
        "semantic_set_fingerprint_sha256": receipt["semantic_set_fingerprint_sha256"],
        "observation_count": receipt["observation_count"],
        "distinct_observation_count": receipt["distinct_observation_count"],
    }


def evaluate_chain(data: dict[str, Any]) -> dict[str, Any]:
    data = _exact_keys(data, CHAIN_KEYS, "chain input")
    if data.get("schema") != CHAIN_INPUT_SCHEMA:
        _fail("unexpected chain input schema")
    sets = data.get("sets")
    if not isinstance(sets, list) or len(sets) < 2:
        _fail("sets must contain at least two observation sets")

    set_receipts = [evaluate_set(item) for item in sets]
    scope = set_receipts[0]["scope_binding_sha256"]
    if any(item["scope_binding_sha256"] != scope for item in set_receipts[1:]):
        _fail("OBSERVATION_SCOPE_CHANGED: chain set scopes differ")
    _assert_cross_set_source_consistency(sets)

    edges = []
    relation_sequence: list[str] = []
    relation_counts = {relation: 0 for relation in RELATIONS}
    for index in range(len(sets) - 1):
        transition_input = {
            "schema": TRANSITION_INPUT_SCHEMA,
            "before_set": sets[index],
            "after_set": sets[index + 1],
        }
        receipt = evaluate_transition(transition_input)
        if (
            receipt["before_set_fingerprint_sha256"]
            != set_receipts[index]["semantic_set_fingerprint_sha256"]
        ):
            _fail(f"edge[{index}] before-set semantic binding mismatch")
        if (
            receipt["after_set_fingerprint_sha256"]
            != set_receipts[index + 1]["semantic_set_fingerprint_sha256"]
        ):
            _fail(f"edge[{index}] after-set semantic binding mismatch")
        relation = receipt["relation"]
        relation_sequence.append(relation)
        relation_counts[relation] += 1
        edges.append(
            {
                "edge_index": index,
                "before_set_fingerprint_sha256": receipt[
                    "before_set_fingerprint_sha256"
                ],
                "after_set_fingerprint_sha256": receipt[
                    "after_set_fingerprint_sha256"
                ],
                "relation": relation,
                "newly_observed_semantic_fingerprints_sha256": copy.deepcopy(
                    receipt["newly_observed_semantic_fingerprints_sha256"]
                ),
                "not_observed_in_after_semantic_fingerprints_sha256": copy.deepcopy(
                    receipt["not_observed_in_after_semantic_fingerprints_sha256"]
                ),
            }
        )

    return {
        "schema": CHAIN_RECEIPT_SCHEMA,
        "candidate_status": CANDIDATE_STATUS,
        "scope_binding_sha256": scope,
        "exact_input_fingerprint_sha256": canonical_sha256(data),
        "set_count": len(sets),
        "edge_count": len(edges),
        "sets": [_set_summary(item) for item in set_receipts],
        "edges": edges,
        "relation_sequence": relation_sequence,
        "relation_counts": relation_counts,
        "local_observation_set_adjacency": True,
        "semantic_guards": {
            "complete_observation_history_proven": False,
            "no_omitted_observation_sets_proven": False,
            "trusted_time_proven": False,
            "set_sequence_proves_chronology": False,
            "newly_observed_proves_creation": False,
            "not_observed_in_next_proves_deletion": False,
            "repeated_observation_proves_continuous_existence": False,
            "truth_proven": False,
            "authority_created": False,
            "admission_decision_made": False,
            "disposition_decision_made": False,
            "action_permit_created": False,
            "remediation_triggered": False,
        },
    }


def evaluate(data: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict):
        _fail("input must be an object")
    schema = data.get("schema")
    if schema == SET_INPUT_SCHEMA:
        return evaluate_set(data)
    if schema == TRANSITION_INPUT_SCHEMA:
        return evaluate_transition(data)
    if schema == CHAIN_INPUT_SCHEMA:
        return evaluate_chain(data)
    _fail("unsupported candidate input schema")


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: profile.py <input.json>", file=sys.stderr)
        raise SystemExit(2)
    try:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        receipt = evaluate(data)
    except (OSError, json.JSONDecodeError, ObservationSetInputError) as exc:
        print(f"observation set calculus candidate: FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
