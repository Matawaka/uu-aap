from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve()
V01 = HERE.parent.parent
REPO_ROOT = HERE.parents[4]
sys.path.insert(0, str(V01))

from architecture_convergence_assessor import assess  # noqa: E402

SCHEMA = json.loads((V01 / "architecture-convergence-readiness.schema.json").read_text(encoding="utf-8"))
EXAMPLE = json.loads((V01 / "examples" / "architecture-convergence-readiness.example.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA)


def schema_errors(doc):
    return list(VALIDATOR.iter_errors(doc))


def semantic_errors(doc):
    return assess(doc, REPO_ROOT)


def expect_invalid(doc):
    assert schema_errors(doc) or semantic_errors(doc)


def main():
    assert not schema_errors(EXAMPLE)
    assert not semantic_errors(EXAMPLE)

    d = copy.deepcopy(EXAMPLE)
    d["planes"].pop()
    expect_invalid(d)

    d = copy.deepcopy(EXAMPLE)
    d["planes"][1]["plane_id"] = "coordination"
    expect_invalid(d)

    d = copy.deepcopy(EXAMPLE)
    d["planes"][0]["required_paths"] = ["protocols/ccrp"]
    expect_invalid(d)

    d = copy.deepcopy(EXAMPLE)
    d["planes"][0]["required_paths"][0] = "protocols/does-not-exist"
    expect_invalid(d)

    d = copy.deepcopy(EXAMPLE)
    d["planes"][2]["present"] = False
    expect_invalid(d)

    for key in [
        "external_execution_authorized",
        "kontur_activation_authorized",
        "kontur_activated",
        "current_kontur_activation_frontier_verified",
        "repository_ownership_transferred",
        "canonical_origin_mutated",
        "legal_authority_established",
        "distributed_consensus_established",
        "universal_architecture_completeness_proven",
    ]:
        d = copy.deepcopy(EXAMPLE)
        d["claims"][key] = True
        expect_invalid(d)

    d = copy.deepcopy(EXAMPLE)
    d["claims"]["future_evolution_allowed"] = False
    expect_invalid(d)

    d = copy.deepcopy(EXAMPLE)
    d["assessment"]["state"] = "incomplete"
    expect_invalid(d)

    d = copy.deepcopy(EXAMPLE)
    d["assessment"]["safe_effect"] = "no-action"
    expect_invalid(d)

    d = copy.deepcopy(EXAMPLE)
    d["canonical_predecessor_sha"] = "not-a-sha"
    expect_invalid(d)

    print("Architecture convergence readiness v0.1 tests: PASS")


if __name__ == "__main__":
    main()
