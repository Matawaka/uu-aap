#!/usr/bin/env python3
"""P1.11 deterministic receipt/result binding and browser-parity tests."""
from __future__ import annotations

import json
import subprocess
import sys
from copy import deepcopy
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
P1_10_DIR = REPO_ROOT / "scripts" / "verifier-federated-disposition"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))
if str(P1_10_DIR) not in sys.path:
    sys.path.insert(0, str(P1_10_DIR))

import build_disposition_site as p1_10_builder  # noqa:E402
from uuaap_verifier_presentation import (  # noqa:E402
    DISPOSITION_INTEGRITY_INPUT_SCHEMA,
    DISPOSITION_INTEGRITY_RESULT_SCHEMA,
    P1_10_BROWSER_BLOB,
    P1_10_PYTHON_BLOB,
    P1_11_PREDECESSOR_MAIN,
    build_disposition_integrity_input,
    materialize_federated_disposition,
    validate_disposition_integrity_input,
    validate_disposition_integrity_result,
    validate_federated_disposition_result,
    verify_disposition_integrity,
)

APP = HERE / "app.js"
BROWSER = HERE / "test-browser.js"
P1_10_APP = P1_10_DIR / "app.js"
CANDIDATE_APP = REPO_ROOT / "scripts" / "verifier-candidate-federation" / "app.js"
ADAPTER_APP = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "app.js"
ATTESTATION_APP = REPO_ROOT / "scripts" / "verifier-scoped-attestations" / "app.js"
INTERACTIVE_APP = REPO_ROOT / "scripts" / "verifier-interactive-surface" / "app.js"
BINDINGS = HERE / "source-bindings.json"


def expect_reject(callable_obj, label: str) -> None:
    try:
        callable_obj()
    except (AssertionError, KeyError, TypeError, ValueError):
        return
    raise AssertionError(f"mutation unexpectedly accepted: {label}")


def expect_p1_10_accepts_but_p1_11_rejects(record: dict, mutate, label: str) -> None:
    hostile = deepcopy(record)
    source = hostile["federated_disposition_result"]
    mutate(source)
    validate_federated_disposition_result(source)
    expect_reject(lambda: verify_disposition_integrity(hostile), label)


def expect_p1_11_rejects(record: dict, mutate, label: str) -> None:
    hostile = deepcopy(record)
    mutate(hostile["federated_disposition_result"])
    expect_reject(lambda: verify_disposition_integrity(hostile), label)


def browser_result(record: dict) -> dict:
    completed = subprocess.run(
        [
            "node",
            str(BROWSER),
            str(APP),
            str(P1_10_APP),
            str(CANDIDATE_APP),
            str(ADAPTER_APP),
            str(ATTESTATION_APP),
            str(INTERACTIVE_APP),
        ],
        cwd=REPO_ROOT,
        input=json.dumps(record, ensure_ascii=False),
        text=True,
        check=True,
        capture_output=True,
    )
    return json.loads(completed.stdout)


def main() -> None:
    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == P1_11_PREDECESSOR_MAIN == "b2cb224e84fb552461deb25de4460c696ebd6830"
    assert bindings["p1_10_python"]["blob"] == P1_10_PYTHON_BLOB == "85fab33a16d59796b40675b53f017d365898933c"
    assert bindings["p1_10_browser"]["blob"] == P1_10_BROWSER_BLOB == "1cab33e0598fea1833ad25e5af45c0a2c39a4990"

    p1_10_input = p1_10_builder.build_example_input()
    p1_10_result = materialize_federated_disposition(p1_10_input)
    validate_federated_disposition_result(p1_10_result)

    record = build_disposition_integrity_input(p1_10_result)
    assert record["schema"] == DISPOSITION_INTEGRITY_INPUT_SCHEMA
    validate_disposition_integrity_input(record)
    result = verify_disposition_integrity(record)
    assert result["schema"] == DISPOSITION_INTEGRITY_RESULT_SCHEMA
    validate_disposition_integrity_result(result)
    assert result["canonical_rematerialization_equal"] is True
    assert result["p1_3_materialized_input_valid"] is True
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
    assert browser_result(record) == result, "Python/browser P1.11 integrity result diverged"

    # These mutations remain structurally acceptable to historical P1.10 result validation,
    # but are not equal to historical deterministic rematerialization and therefore fail P1.11.
    expect_p1_10_accepts_but_p1_11_rejects(
        record,
        lambda source: source["materialized_interactive_input"]["evidence_items"][-1]["payload"].__setitem__(
            "actor_ref", "urn:uu-aap:actor:hostile-payload-only"
        ),
        "receipt evidence payload actor_ref drift",
    )
    expect_p1_10_accepts_but_p1_11_rejects(
        record,
        lambda source: source["materialized_interactive_input"]["evidence_items"][-1]["payload"].__setitem__(
            "scope", "publication_authority"
        ),
        "receipt evidence payload scope drift",
    )
    expect_p1_10_accepts_but_p1_11_rejects(
        record,
        lambda source: source["materialized_interactive_input"]["evidence_items"][-1].__setitem__(
            "kind", "hostile_receipt_kind"
        ),
        "disposition evidence kind drift",
    )
    expect_p1_10_accepts_but_p1_11_rejects(
        record,
        lambda source: source["materialized_interactive_input"]["related_observations"][
            "federated_candidate_disposition"
        ].__setitem__("accepted_candidate_ids", []),
        "related accepted ids drift",
    )
    expect_p1_10_accepts_but_p1_11_rejects(
        record,
        lambda source: source["materialized_interactive_input"]["related_observations"][
            "federated_candidate_disposition"
        ]["disposition_receipts"][0].__setitem__("rationale", "hostile embedded rationale"),
        "related disposition receipt drift",
    )

    def add_warning(source: dict) -> None:
        source["materialized_interactive_input"]["warnings"].append(
            {"code": "HOSTILE_EXTRA_WARNING", "message": "synthetic mutation"}
        )

    expect_p1_10_accepts_but_p1_11_rejects(record, add_warning, "materialized warning drift")

    def mutate_not_evaluated(source: dict) -> None:
        claims = source["materialized_interactive_input"]["dimension_claims"]
        dimension = next(name for name, claim in claims.items() if claim["value"] == "NOT_EVALUATED")
        claims[dimension]["explanation"] = "hostile NOT_EVALUATED metadata mutation"

    expect_p1_10_accepts_but_p1_11_rejects(record, mutate_not_evaluated, "NOT_EVALUATED metadata drift")

    # Mutations already rejected by P1.10 must remain rejected by the successor closure too.
    def reorder_source_evidence(source: dict) -> None:
        items = source["materialized_interactive_input"]["evidence_items"]
        assert len(items) >= 3
        items[0], items[1] = items[1], items[0]

    expect_p1_11_rejects(record, reorder_source_evidence, "source evidence order drift")

    def reorder_accepted_refs(source: dict) -> None:
        claims = source["materialized_interactive_input"]["dimension_claims"]
        claim = next(item for item in claims.values() if len(item["evidence_refs"]) >= 2)
        claim["evidence_refs"] = list(reversed(claim["evidence_refs"]))

    expect_p1_11_rejects(record, reorder_accepted_refs, "accepted evidence ref order drift")

    extra = deepcopy(record)
    extra["federated_disposition_result"]["trust_score"] = 0.99
    expect_reject(lambda: verify_disposition_integrity(extra), "top-level semantic score injection")

    wrong_schema = deepcopy(record)
    wrong_schema["schema"] = "urn:uu-aap:federated-disposition-integrity-input:9.9"
    expect_reject(lambda: verify_disposition_integrity(wrong_schema), "P1.11 input version drift")

    print("P1.10 generated result -> P1.11 canonical closure: PASS")
    print("P1.10-accepted redundant-field tampering -> P1.11 reject: PASS")
    print("historical P1.3/P1.10 validators reused: PASS")
    print("Python == browser integrity receipt: PASS")
    print("integrity closure != truth/identity/authority/publication: PASS")


if __name__ == "__main__":
    main()
