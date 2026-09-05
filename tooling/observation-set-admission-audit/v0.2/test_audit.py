#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_validator():
    path = HERE / "validate.py"
    spec = importlib.util.spec_from_file_location("observation_set_admission_audit_validator", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


validator = load_validator()
BASE = json.loads((HERE / "assessment.json").read_text(encoding="utf-8"))


def expect_reject(name, mutate):
    candidate = copy.deepcopy(BASE)
    mutate(candidate)
    try:
        validator.validate(candidate)
    except (ValueError, KeyError, TypeError):
        return
    raise AssertionError(f"unsafe mutation accepted: {name}")


def api(data, api_id):
    return next(item for item in data["api_assessments"] if item["id"] == api_id)


def main():
    validator.validate(copy.deepcopy(BASE))

    cases = [
        ("origin drift", lambda d: d.__setitem__("origin_main", "0" * 40)),
        ("issue drift", lambda d: d.__setitem__("tracking_issue", 999)),
        ("source byte substitution", lambda d: d["source_bindings"][0].__setitem__("blob_sha1", "0" * 40)),
        ("source id fabrication", lambda d: d["source_bindings"][0].__setitem__("id", "fabricated")),
        ("set consumer count lowered", lambda d: api(d, "ObservationSet").__setitem__("independent_direct_consumer_families", 1)),
        ("set existing interface fabricated", lambda d: api(d, "ObservationSet").__setitem__("adequate_existing_reusable_interface", True)),
        ("set registry scope widened", lambda d: api(d, "ObservationSet").__setitem__("registry_scope_if_later_admitted", "SET_TRANSITION_CHAIN")),
        ("set Stable Core escalation", lambda d: api(d, "ObservationSet").__setitem__("stable_core_admission", "ADMIT")),
        ("transition premature eligibility", lambda d: api(d, "ObservationSetTransition").__setitem__("decision", "ELIGIBLE_EXPERIMENTAL_INTERFACE_ADMISSION")),
        ("transition fabricated second consumer", lambda d: api(d, "ObservationSetTransition").__setitem__("independent_direct_consumer_families", 2)),
        ("chain premature eligibility", lambda d: api(d, "LocalObservationSetChain").__setitem__("decision", "ELIGIBLE_EXPERIMENTAL_INTERFACE_ADMISSION")),
        ("chain fabricated second consumer", lambda d: api(d, "LocalObservationSetChain").__setitem__("independent_direct_consumer_families", 2)),
        ("monolithic package admission", lambda d: d["package_assessment"].__setitem__("monolithic_registry_admission_eligible", True)),
        ("monolithic package decision promoted", lambda d: d["package_assessment"].__setitem__("decision", "ELIGIBLE_EXPERIMENTAL_INTERFACE_ADMISSION")),
        ("set-only eligibility erased", lambda d: d["package_assessment"].__setitem__("set_only_registry_admission_eligible", False)),
        ("overall full admission overclaim", lambda d: d.__setitem__("overall_result", "FULL_CALCULUS_ADMISSION")),
        ("automatic registry mutation", lambda d: d.__setitem__("human_or_successor_boundary", "REGISTRY_MUTATION_AUTHORIZED")),
        ("wrong next action", lambda d: d.__setitem__("next_safe_action", "REGISTER_MONOLITHIC_CALCULUS")),
        ("registry mutated effect", lambda d: d["non_effects"].__setitem__("interface_registry_mutated", True)),
        ("external effect overclaim", lambda d: d["non_effects"].__setitem__("external_effect_performed", True)),
    ]

    for name, mutation in cases:
        expect_reject(name, mutation)

    print(f"OBSERVATION_SET_ADMISSION_AUDIT_HOSTILE_PASS cases={len(cases)}")


if __name__ == "__main__":
    main()
