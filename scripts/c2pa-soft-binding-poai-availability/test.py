#!/usr/bin/env python3
"""Counterfactual and fail-closed tests for P0.8."""

from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate import assert_expected, evaluate  # noqa: E402

ROOT = Path(__file__).resolve().parent
BASE = json.loads((ROOT / "fixture.json").read_text(encoding="utf-8"))


def expect_reject(name, fn):
    try:
        fn()
    except (AssertionError, KeyError, ValueError) as exc:
        print(f"expected rejection: {name}: {exc}")
        return
    raise AssertionError(f"unsafe mutation accepted: {name}")


def resolution_event(doc, event_id):
    return next(event for event in doc["resolver_history"] if event["event_id"] == event_id)


baseline = evaluate(BASE)
assert_expected(BASE, baseline)
assert baseline["current_resolution"]["status"] == "SOFT_BINDING_RESOLVES_NOW"
assert baseline["historical_availability"]["status"] == "UNAVAILABLE_BEFORE_CUTOFF"
assert baseline["historical_availability"]["dimensions"] == {
    "temporal_fit": "unavailable",
    "delivery": "unavailable",
}
assert baseline["consideration"]["status"] == "NOT_USED"
assert baseline["repository"]["ingestion_before_cutoff"] is False
assert baseline["repository"]["proves_delivery"] is False
assert baseline["repository"]["proves_consideration"] is False
print("baseline: resolves now != available before cutoff: PASS")

# Counterfactual 1: pre-cutoff resolver can find the manifest, but nothing is delivered to the decision.
pre_resolved_not_delivered = deepcopy(BASE)
pre = resolution_event(pre_resolved_not_delivered, "resolver-pre-cutoff-1")
pre["status"] = "RESOLVED"
pre["manifest_ref"] = "urn:c2pa:manifest:p08:001"
pre["delivered_to_decision"] = False
r = evaluate(pre_resolved_not_delivered)
assert r["historical_availability"]["status"] == "UNAVAILABLE_BEFORE_CUTOFF"
assert r["historical_availability"]["dimensions"]["temporal_fit"] == "available"
assert r["historical_availability"]["dimensions"]["delivery"] == "unavailable"
print("counterfactual: pre-cutoff resolvable without delivery remains unavailable: PASS")

# Counterfactual 2: successful pre-cutoff resolution plus delivery changes historical availability.
pre_resolved_delivered = deepcopy(pre_resolved_not_delivered)
resolution_event(pre_resolved_delivered, "resolver-pre-cutoff-1")["delivered_to_decision"] = True
r = evaluate(pre_resolved_delivered)
assert r["historical_availability"]["status"] == "AVAILABLE_BEFORE_CUTOFF"
assert r["historical_availability"]["dimensions"] == {
    "temporal_fit": "available",
    "delivery": "available",
}
assert r["consideration"]["status"] == "NOT_USED", "availability must not imply consideration"
print("counterfactual: pre-cutoff resolution + delivery becomes available, not automatically considered: PASS")

# Counterfactual 3: current resolution can disappear without rewriting historical delivered availability.
currently_unresolved = deepcopy(pre_resolved_delivered)
current = resolution_event(currently_unresolved, "resolver-current-1")
current["status"] = "NOT_FOUND"
current["manifest_ref"] = None
r = evaluate(currently_unresolved)
assert r["current_resolution"]["status"] == "SOFT_BINDING_NOT_RESOLVED_NOW"
assert r["historical_availability"]["status"] == "AVAILABLE_BEFORE_CUTOFF"
print("counterfactual: current failure does not erase historical availability: PASS")

# Counterfactual 4: repository ingestion before cutoff alone is not delivery or consideration.
ingested_early = deepcopy(BASE)
ingestion = resolution_event if False else next(
    event for event in ingested_early["resolver_history"] if event["event_type"] == "repository_ingestion"
)
ingestion["observed_at"] = "2026-08-30T08:54:00Z"
r = evaluate(ingested_early)
assert r["repository"]["ingestion_before_cutoff"] is True
assert r["repository"]["proves_delivery"] is False
assert r["repository"]["proves_consideration"] is False
assert r["historical_availability"]["status"] == "UNAVAILABLE_BEFORE_CUTOFF"
assert r["consideration"]["status"] == "NOT_USED"
print("counterfactual: repository ingestion != delivery/consideration: PASS")

# Counterfactual 5: current success itself never becomes historical reliance.
assert baseline["current_resolution"]["status"] == "SOFT_BINDING_RESOLVES_NOW"
assert baseline["consideration"]["status"] == "NOT_USED"
assert baseline["non_effects"]["current_lookup_proves_historical_reliance"] is False
print("counterfactual: current lookup success != historical reliance: PASS")

expect_reject("aggregate score promotion", lambda: evaluate({
    **deepcopy(BASE),
    "non_effects": {**deepcopy(BASE["non_effects"]), "aggregate_score_created": True},
}))


def mismatched_algorithm():
    doc = deepcopy(BASE)
    doc["soft_binding_assertion"]["data"]["alg"] = "example.other"
    evaluate(doc)


expect_reject("soft-binding algorithm detached from pinned registry", mismatched_algorithm)


def resolved_without_manifest():
    doc = deepcopy(BASE)
    event = resolution_event(doc, "resolver-current-1")
    event["manifest_ref"] = None
    evaluate(doc)


expect_reject("resolved event without manifest reference", resolved_without_manifest)


def duplicate_event_id():
    doc = deepcopy(BASE)
    doc["resolver_history"][1]["event_id"] = doc["resolver_history"][0]["event_id"]
    evaluate(doc)


expect_reject("duplicate causal event id", duplicate_event_id)

print("PASS: P0.8 soft-binding × PoAI availability counterfactual suite")
