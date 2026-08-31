#!/usr/bin/env python3
import copy
import json
from pathlib import Path

from validate_registry import REGISTRY_PATH, IMPL_PATH, validate_data


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


BASE = load(REGISTRY_PATH)
IMPL = load(IMPL_PATH)


def expect_fail(label, mutate_registry=None, mutate_impl=None):
    registry = copy.deepcopy(BASE)
    impl = copy.deepcopy(IMPL)
    if mutate_registry:
        mutate_registry(registry)
    if mutate_impl:
        mutate_impl(impl)
    try:
        validate_data(registry, impl, verify_git=False)
    except (ValueError, KeyError):
        print(f"{label}: PASS")
        return
    raise AssertionError(f"{label}: mutation was accepted")


validate_data(copy.deepcopy(BASE), copy.deepcopy(IMPL), verify_git=False)
print("baseline: PASS")

expect_fail("unknown-classification", lambda r: r["entities"][0].__setitem__("classification", "READY"))
expect_fail("duplicate-id", lambda r: r["entities"][1].__setitem__("id", r["entities"][0]["id"]))
expect_fail("fixed-class-drift", lambda r: r["entities"][3].__setitem__("classification", "IMPLEMENTED"))
expect_fail("candidate-roadmap-authority", lambda r: r["entities"][3]["authority_effects"].__setitem__("roadmap_priority_created", True))
expect_fail("candidate-implementation-authority", lambda r: r["entities"][4]["authority_effects"].__setitem__("implementation_authority_created", True))
expect_fail("historical-697-semantic-authority", lambda r: r["historical_boundaries"].__setitem__("backlog_reconciliation_semantic_authority", True))
expect_fail("entity-uses-697", lambda r: r["entities"][0]["source_bindings"].append({"kind": "ISSUE", "role": "unsafe semantic authority", "issue_number": 697}))
expect_fail("reinterpret-422", lambda r: r["historical_boundaries"].__setitem__("external_review_reinterpreted", True))
expect_fail("new-422-disposition", lambda r: r["historical_boundaries"].__setitem__("new_external_review_disposition_created", True))
expect_fail("global-absence-claim", lambda r: r["audit_scope"].__setitem__("absence_inference_allowed", True))
expect_fail("bounded-phrase-drift", lambda r: r["entities"][3].__setitem__("exact_term_audit", "entity absent"))
expect_fail("implemented-binding-missing", lambda r: r["entities"][0].__setitem__("source_bindings", []))
expect_fail("invariant-evidence-missing", lambda r: r["entities"][1].__setitem__("source_bindings", []))
expect_fail("partial-covered-scope-missing", lambda r: r["entities"][2].__setitem__("covered_scope", []))
expect_fail("partial-uncovered-scope-missing", lambda r: r["entities"][2].__setitem__("uncovered_scope", []))
expect_fail("paused-source-missing", lambda r: r["entities"][-1].__setitem__("source_bindings", []))
expect_fail("core-effect-escalation", lambda r: r["non_effects"].__setitem__("stable_core_changed", True))
expect_fail("release-effect-escalation", lambda r: r["non_effects"].__setitem__("release_or_tag_created", True))
expect_fail("workbench-reactivation", lambda r: r["non_effects"].__setitem__("workbench_reactivated", True))
expect_fail("implementation-receipt-authority", mutate_impl=lambda i: i["registry_contract"].__setitem__("implementation_authority_created", True))
expect_fail("implementation-receipt-absence", mutate_impl=lambda i: i["registry_contract"].__setitem__("absence_claim_created", True))

print("BACKLOG_ENTITY_RECONCILIATION_V0_1_HOSTILE_21_PASS")
