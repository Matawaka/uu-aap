#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[4]
SCHEMA_PATH = ROOT / "schemas/sustainability/v0.1/kernel-conformance-closure.schema.json"
EXAMPLE_PATH = ROOT / "schemas/sustainability/v0.1/examples/kernel-conformance-closure.example.json"
ASSESSOR_PATH = ROOT / "schemas/sustainability/v0.1/kernel_conformance_assessor.py"

schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
spec = importlib.util.spec_from_file_location("kernel_conformance_assessor", ASSESSOR_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def expect_schema_fail(doc):
    try:
        jsonschema.Draft202012Validator(schema).validate(doc)
    except jsonschema.ValidationError:
        return
    raise AssertionError("expected JSON Schema validation failure")


def expect_assessor_fail(doc, contains=None):
    try:
        mod.assess(doc, ROOT)
    except ValueError as exc:
        if contains is not None:
            assert contains in str(exc), (contains, str(exc))
        return
    raise AssertionError("expected semantic assessor failure")


# Positive reference vector.
jsonschema.Draft202012Validator(schema).validate(example)
result = mod.assess(example, ROOT)
assert result["valid"] is True
assert result["result"] == "kernel-v0.1-operationally-covered"
assert result["covered_invariants"] == ["K1", "K10", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "K9"]

# Exactly five known components are required.
doc = copy.deepcopy(example)
doc["components"].pop()
expect_schema_fail(doc)

doc = copy.deepcopy(example)
doc["components"][4] = copy.deepcopy(doc["components"][0])
expect_assessor_fail(doc, "duplicate component id")

# Exact path binding is causal, not descriptive decoration.
doc = copy.deepcopy(example)
doc["components"][0]["document_path"] = "docs/README.md"
expect_assessor_fail(doc, "path binding mismatch")

# Every K1-K10 invariant must be operationally covered.
doc = copy.deepcopy(example)
for component in doc["components"]:
    component["invariants"] = [x for x in component["invariants"] if x != "K8"]
expect_assessor_fail(doc, "K1-K10 coverage mismatch")

# Coverage map cannot silently omit or deny an invariant.
doc = copy.deepcopy(example)
doc["coverage"]["K7"] = False
expect_schema_fail(doc)

doc = copy.deepcopy(example)
del doc["coverage"]["K10"]
expect_schema_fail(doc)

# Closure may not create execution, authority, canonicality, KONTUR, or capability expansion.
for key in (
    "external_execution_authorized",
    "capability_expansion_authorized",
    "canonical_authority_established",
    "kontur_activation_authorized",
    "universal_completeness_claimed",
):
    doc = copy.deepcopy(example)
    doc["claims"][key] = True
    expect_schema_fail(doc)

# Closure cannot freeze future evolution or relax fresh authorization for new capability.
doc = copy.deepcopy(example)
doc["claims"]["future_evolution_allowed"] = False
expect_schema_fail(doc)

doc = copy.deepcopy(example)
doc["claims"]["new_capability_requires_new_attributable_authorization"] = False
expect_schema_fail(doc)

# Result and project scope are exact.
doc = copy.deepcopy(example)
doc["result"] = "architecture-universally-complete"
expect_schema_fail(doc)

doc = copy.deepcopy(example)
doc["project_id"] = "other/project"
expect_schema_fail(doc)

print("Sustainability Kernel Conformance / Closure v0.1 tests: PASS")
