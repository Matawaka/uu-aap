"""P1.11 deterministic integrity closure over historical P1.10 disposition results."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .federated_disposition import (
    FEDERATED_DISPOSITION_INPUT_SCHEMA,
    FEDERATED_DISPOSITION_RESULT_SCHEMA,
    build_federated_disposition_input,
    materialize_federated_disposition,
    validate_federated_disposition_result,
)
from .interactive import validate_interactive_input

DISPOSITION_INTEGRITY_INPUT_SCHEMA = "urn:uu-aap:federated-disposition-integrity-input:0.1"
DISPOSITION_INTEGRITY_RESULT_SCHEMA = "urn:uu-aap:federated-disposition-integrity-result:0.1"

P1_11_PREDECESSOR_MAIN = "b2cb224e84fb552461deb25de4460c696ebd6830"
P1_10_PYTHON_BLOB = "85fab33a16d59796b40675b53f017d365898933c"
P1_10_BROWSER_BLOB = "1cab33e0598fea1833ad25e5af45c0a2c39a4990"

_INPUT_FIELDS = {"schema", "federated_disposition_result"}
_RESULT_FIELDS = {
    "schema",
    "artifact",
    "source_result_schema",
    "source_bindings",
    "canonical_rematerialization_equal",
    "p1_3_materialized_input_valid",
    "does_not_establish",
    "aggregate_score_present",
    "aggregate_verdict_present",
}
_BINDING_FIELDS = {"predecessor_main", "p1_10_python_blob", "p1_10_browser_blob"}
_NON_EFFECTS = [
    "factual truth",
    "actor identity",
    "actor authority",
    "authorship",
    "responsibility acceptance",
    "publication authority",
    "action authority",
    "source priority",
    "source independence",
    "consensus",
    "negative reputation",
]


def validate_disposition_integrity_input(record: dict[str, Any]) -> None:
    assert isinstance(record, dict), "disposition integrity input must be an object"
    assert set(record) == _INPUT_FIELDS, f"disposition integrity input fields changed: {set(record)}"
    assert record["schema"] == DISPOSITION_INTEGRITY_INPUT_SCHEMA, "unsupported disposition integrity input schema"
    source = record["federated_disposition_result"]
    assert isinstance(source, dict), "federated_disposition_result must be an object"
    assert source.get("schema") == FEDERATED_DISPOSITION_RESULT_SCHEMA, "P1.11 consumes P1.10 result v0.1 only"


def build_disposition_integrity_input(federated_disposition_result: dict[str, Any]) -> dict[str, Any]:
    record = {
        "schema": DISPOSITION_INTEGRITY_INPUT_SCHEMA,
        "federated_disposition_result": deepcopy(federated_disposition_result),
    }
    validate_disposition_integrity_input(record)
    return record


def verify_disposition_integrity(record: dict[str, Any]) -> dict[str, Any]:
    """Fail closed unless supplied P1.10 result equals deterministic historical rematerialization."""
    validate_disposition_integrity_input(record)
    supplied = record["federated_disposition_result"]

    # Reuse the historical validators first; P1.11 does not define a second P1.10 contract.
    validate_federated_disposition_result(supplied)
    validate_interactive_input(supplied["materialized_interactive_input"])

    canonical_input = build_federated_disposition_input(
        supplied["federated_candidate_set"],
        supplied["disposition_event"],
    )
    assert canonical_input["schema"] == FEDERATED_DISPOSITION_INPUT_SCHEMA
    canonical = materialize_federated_disposition(canonical_input)
    assert supplied == canonical, "supplied P1.10 result differs from canonical historical rematerialization"

    result = {
        "schema": DISPOSITION_INTEGRITY_RESULT_SCHEMA,
        "artifact": deepcopy(supplied["artifact"]),
        "source_result_schema": FEDERATED_DISPOSITION_RESULT_SCHEMA,
        "source_bindings": {
            "predecessor_main": P1_11_PREDECESSOR_MAIN,
            "p1_10_python_blob": P1_10_PYTHON_BLOB,
            "p1_10_browser_blob": P1_10_BROWSER_BLOB,
        },
        "canonical_rematerialization_equal": True,
        "p1_3_materialized_input_valid": True,
        "does_not_establish": list(_NON_EFFECTS),
        "aggregate_score_present": False,
        "aggregate_verdict_present": False,
    }
    validate_disposition_integrity_result(result)
    return result


def validate_disposition_integrity_result(result: dict[str, Any]) -> None:
    assert isinstance(result, dict), "disposition integrity result must be an object"
    assert set(result) == _RESULT_FIELDS, f"disposition integrity result fields changed: {set(result)}"
    assert result["schema"] == DISPOSITION_INTEGRITY_RESULT_SCHEMA, "unsupported disposition integrity result schema"
    artifact = result["artifact"]
    assert isinstance(artifact, dict) and set(artifact) == {"id", "description"}, "artifact fields changed"
    assert all(isinstance(artifact[key], str) and artifact[key] for key in ("id", "description")), "artifact values invalid"
    assert result["source_result_schema"] == FEDERATED_DISPOSITION_RESULT_SCHEMA
    bindings = result["source_bindings"]
    assert isinstance(bindings, dict) and set(bindings) == _BINDING_FIELDS, "source bindings changed"
    assert bindings == {
        "predecessor_main": P1_11_PREDECESSOR_MAIN,
        "p1_10_python_blob": P1_10_PYTHON_BLOB,
        "p1_10_browser_blob": P1_10_BROWSER_BLOB,
    }, "historical P1.10 source bindings changed"
    assert result["canonical_rematerialization_equal"] is True
    assert result["p1_3_materialized_input_valid"] is True
    assert result["does_not_establish"] == _NON_EFFECTS, "integrity closure non-effects changed"
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
