#!/usr/bin/env python3
from __future__ import annotations
import copy, importlib.util, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("rerc_maturity_validate", HERE / "validate.py")
mod = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(mod)
BASE = json.loads((HERE / "assessment.json").read_text(encoding="utf-8"))


def ok(name, mutate):
    x = copy.deepcopy(BASE); mutate(x)
    try:
        mod.validate_assessment(x, False)
    except ValueError:
        print(f"expected rejection: {name}")
        return
    raise AssertionError(f"mutation unexpectedly accepted: {name}")

mod.validate_assessment(copy.deepcopy(BASE), False)

cases = [
    ("consumer count inflation", lambda x: x["consumer_census"].__setitem__("independent_direct_consumer_count", 2)),
    ("second direct reuse invented", lambda x: x["consumer_census"].__setitem__("second_independent_direct_reuse_proven", True)),
    ("second materialization invented", lambda x: x["consumer_census"].__setitem__("bounded_exact_materialization_of_second_consumer_found", True)),
    ("RSIC promoted to independent", lambda x: x["consumer_census"]["excluded_consumers"][2].__setitem__("classification", "DIRECT_INDEPENDENT_DOMAIN_REUSE")),
    ("self validation promoted", lambda x: x["consumer_census"]["excluded_consumers"][0].__setitem__("classification", "DIRECT_INDEPENDENT_DOMAIN_REUSE")),
    ("registry metadata promoted", lambda x: x["consumer_census"]["excluded_consumers"][1].__setitem__("classification", "DIRECT_INDEPENDENT_DOMAIN_REUSE")),
    ("verdict promoted", lambda x: x["maturity"].__setitem__("verdict", "PROMOTE")),
    ("threshold promoted", lambda x: x["maturity"].__setitem__("promotion_threshold_satisfied", True)),
    ("registry status promoted", lambda x: x["interface"].__setitem__("registry_status", "stable")),
    ("registry mutation claimed", lambda x: x["non_effects"].__setitem__("registry_status_promotion_performed", True)),
    ("stable core mutation claimed", lambda x: x["non_effects"].__setitem__("stable_core_promotion_performed", True)),
    ("RERC semantics mutation claimed", lambda x: x["non_effects"].__setitem__("rerc_semantics_mutated", True)),
    ("RSIC admission triggered", lambda x: x["non_effects"].__setitem__("rsic_admission_triggered", True)),
    ("ERD dependency triggered", lambda x: x["non_effects"].__setitem__("erd_dependency_triggered", True)),
    ("authority created", lambda x: x["non_effects"].__setitem__("authority_created", True)),
    ("truth certified", lambda x: x["non_effects"].__setitem__("truth_certified", True)),
    ("score introduced", lambda x: x["maturity"].__setitem__("maturity_score", 0.8)),
    ("confidence introduced", lambda x: x["consumer_census"].__setitem__("confidence", 0.9)),
    ("direct adapter reimplementation claim", lambda x: x["consumer_census"]["independent_direct_consumers"][0].__setitem__("compress_restore_semantics_reimplemented", True)),
    ("unknown top-level field", lambda x: x.__setitem__("promotion", {})),
]
for name, mutate in cases: ok(name, mutate)
print(f"RERC maturity audit hostile tests: {len(cases)} / {len(cases)} PASS")
