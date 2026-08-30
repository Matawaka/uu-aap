#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("reaudit", ROOT / "reaudit.py")
assert SPEC and SPEC.loader
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)

baseline = mod.read_json(ROOT / "baseline.json")
current = mod.read_json(ROOT / "fixtures" / "current-unchanged.json")

receipt = mod.build_receipt(baseline, current)
assert receipt["swift"]["classification"] == "UNCHANGED"
assert receipt["android"]["classification"] == "UNCHANGED"
assert receipt["overall"] == "NO_RECLASSIFICATION_REQUIRED"
assert receipt["next_gate"] == "NO_TARGETED_REAUDIT_UNTIL_RELEVANT_UPSTREAM_CHANGE"
assert receipt["historical_contract"]["status"] == "INCOMPLETE"
assert receipt["historical_evidence"]["swift"]["historical_surfaces"]["external_swiftpm_consumer_roundtrip"] == "BLOCKED"
assert receipt["historical_evidence"]["android"]["historical_surfaces"]["external_reference_generic_roundtrip"] == "INCOMPATIBLE"
assert receipt["historical_evidence"]["android"]["historical_surfaces"]["claim_generator_unknown_nested_extension"] == "LOSSY"
assert all(value is False for value in receipt["non_effects"].values())

cases = []

swift_head = copy.deepcopy(current)
swift_head["swift"]["pr_head_sha"] = "1" * 40
cases.append(("swift head moved", swift_head, "TARGETED_REAUDIT_REQUIRED"))

swift_binary = copy.deepcopy(current)
swift_binary["swift"]["candidate_public_binary_release"] = "v0.0.13"
cases.append(("swift package moved", swift_binary, "TARGETED_REAUDIT_REQUIRED"))

swift_merged = copy.deepcopy(current)
swift_merged["swift"]["pr_state"] = "closed"
swift_merged["swift"]["main_claim_generator_additional_fields_present"] = True
cases.append(("swift preservation reached main", swift_merged, "TARGETED_REAUDIT_REQUIRED"))

android_head = copy.deepcopy(current)
android_head["android"]["main_sha"] = "2" * 40
cases.append(("android main moved", android_head, "TARGETED_REAUDIT_REQUIRED"))

android_preserve = copy.deepcopy(current)
android_preserve["android"]["main_sha"] = "3" * 40
android_preserve["android"]["claim_generator_additional_fields_present"] = True
cases.append(("android preservation candidate", android_preserve, "TARGETED_REAUDIT_REQUIRED"))

unavailable = copy.deepcopy(current)
unavailable["swift"]["available"] = False
cases.append(("swift unavailable", unavailable, "OBSERVATION_INCOMPLETE"))

for name, observation, expected in cases:
    candidate = mod.build_receipt(baseline, observation)
    assert candidate["overall"] == expected, (name, candidate["overall"])
    assert candidate["historical_contract"]["status"] == "INCOMPLETE"
    assert candidate["swift"]["historical_blocked_result_reclassified"] is False
    assert candidate["android"]["historical_incompatible_lossy_results_reclassified"] is False
    assert candidate["current_compatibility_established"] is False
    print(f"expected successor classification: {name} -> {expected}")

hostile = mod.build_receipt(baseline, current)
hostile["historical_contract"]["status"] = "PASS"
try:
    mod.validate_receipt(hostile)
except ValueError:
    print("expected rejection: historical #783 rewrite")
else:
    raise SystemExit("ERROR: historical #783 rewrite accepted")

hostile = mod.build_receipt(baseline, current)
hostile["current_compatibility_established"] = True
try:
    mod.validate_receipt(hostile)
except ValueError:
    print("expected rejection: re-audit promoted to compatibility proof")
else:
    raise SystemExit("ERROR: compatibility promotion accepted")

hostile = mod.build_receipt(baseline, current)
hostile["compatibility_score"] = 0.9
try:
    mod.validate_receipt(hostile)
except ValueError:
    print("expected rejection: compatibility score")
else:
    raise SystemExit("ERROR: score accepted")

print("PASS: C2PA SDK preservation successor re-audit v0.2")
