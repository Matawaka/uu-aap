#!/usr/bin/env python3
import copy
import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
SCHEMA_PATH = HERE / "binding.schema.json"
DECLARATION_FIXTURE = HERE / "declaration-only.fixture.json"
ATTRIBUTABLE_FIXTURE = HERE / "attributable.fixture.json"
RECEIPT_PATH = HERE / "implementation-receipt.json"

EXPECTED = {
    "run_001_result_blob": ("pilots/core-pilot-002/run-001/result/v0.1/result.json", "edc9a7e4f26492d16875727e17188c5e2a486ced"),
    "manifest_schema_v0_1_blob": ("schema/uu-aap-manifest.schema.json", "c0579b34f6c456c462cea1aa80ec67b78fce7582"),
    "spec_blob": ("SPEC.md", "44b91e0e48dee9d928c843bbb304a5c246582da7"),
    "responsibility_policy_blob": ("RESPONSIBILITY.md", "f71dd1920157d4137f1e3a1ab270bcdfc873e61f"),
    "counterexample_manifest_blob": ("pilots/core-pilot-002/run-001/result/v0.1/counterexample.manifest.json", "350ca00629f354bdd7cc01785d448590c6be87b4"),
}
EXPECTED_TARGET_SHA256 = "d173cf888cfea1e343411162aaf87a890874e0aaf02fee7cd6c1fd0fcc3cf83f"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha1(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def resolve_target(relative_path: str) -> Path:
    if not isinstance(relative_path, str) or not relative_path:
        raise ValueError("target manifest path must be a non-empty string")
    candidate = (REPO_ROOT / relative_path).resolve()
    root = REPO_ROOT.resolve()
    if not candidate.is_relative_to(root):
        raise ValueError("target manifest path escapes repository")
    if not candidate.is_file():
        raise ValueError("target manifest path is not a file")
    return candidate


def semantic_validate(sidecar):
    if set(sidecar) != {"schema", "target_manifest", "bindings", "non_effects"}:
        raise ValueError("unexpected top-level field set")
    if sidecar["schema"] != "urn:uu-aap:responsibility-status-provenance-binding:0.1":
        raise ValueError("wrong schema id")

    target_meta = sidecar["target_manifest"]
    target_path = resolve_target(target_meta["path"])
    target_bytes = target_path.read_bytes()
    observed_sha = sha256_bytes(target_bytes)
    if observed_sha != target_meta["sha256"]:
        raise ValueError("target manifest SHA-256 mismatch")
    target = json.loads(target_bytes.decode("utf-8"))
    responsibility = target.get("responsibility")
    if not isinstance(responsibility, list):
        raise ValueError("target manifest responsibility is not an array")

    seen = set()
    for binding in sidecar["bindings"]:
        index = binding["responsibility_index"]
        if index in seen:
            raise ValueError("duplicate responsibility index binding")
        seen.add(index)
        if index < 0 or index >= len(responsibility):
            raise ValueError("responsibility index out of range")
        if binding["responsibility_entry"] != responsibility[index]:
            raise ValueError("copied responsibility entry does not equal target entry")

        state = binding["binding_state"]
        event_ref = binding["attributable_acceptance_event_reference"]
        evidence_refs = binding["acceptance_evidence_refs"]
        if state == "DECLARATION_ONLY":
            if event_ref is not None or evidence_refs != []:
                raise ValueError("declaration-only binding cannot claim acceptance event/evidence")
        elif state == "ATTRIBUTABLE_ACCEPTANCE_EVIDENCE_BOUND":
            if binding["responsibility_entry"]["status"] not in {"accepted", "shared"}:
                raise ValueError("attributable acceptance binding requires accepted/shared status")
            if not isinstance(event_ref, str) or not event_ref:
                raise ValueError("attributable acceptance event reference required")
            if not isinstance(evidence_refs, list) or not evidence_refs or any(not isinstance(x, str) or not x for x in evidence_refs):
                raise ValueError("one or more acceptance evidence references required")
            if len(set(evidence_refs)) != len(evidence_refs):
                raise ValueError("duplicate acceptance evidence reference")
        else:
            raise ValueError("unknown binding state")

    if not sidecar["bindings"]:
        raise ValueError("at least one binding required")
    if any(value is not False for value in sidecar["non_effects"].values()):
        raise ValueError("non-effect escalated")


def schema_and_semantic_validate(sidecar, validator):
    errors = sorted(validator.iter_errors(sidecar), key=lambda e: list(e.absolute_path))
    if errors:
        raise ValueError("schema validation failed: " + errors[0].message)
    semantic_validate(sidecar)


def must_fail(base, mutate, validator, label):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        schema_and_semantic_validate(candidate, validator)
    except (ValueError, KeyError, TypeError, IndexError, json.JSONDecodeError):
        return
    raise AssertionError(f"negative mutation unexpectedly passed: {label}")


def validate_receipt():
    receipt = load(RECEIPT_PATH)
    if receipt["schema"] != "urn:uu-aap:responsibility-status-provenance-binding-implementation:0.1":
        raise ValueError("implementation receipt schema mismatch")
    if receipt["origin_frontier"] != "dbdace4548fb6701675a993276da6854c4324bda":
        raise ValueError("implementation receipt origin mismatch")
    gate = receipt["human_design_gate"]
    if gate != {
        "issue": 852,
        "decision_comment_id": 5474573197,
        "decision": "PHASED_B_PLUS_C",
        "stage": "B_OPTIONAL_MACHINE_NATIVE_PROVENANCE_BINDING",
        "repository_owner_decision_recorded": True,
        "decision_actor_identity_status": "NOT_ESTABLISHED_BY_REPOSITORY_RECORD",
    }:
        raise ValueError("human design gate receipt drift")

    historical = receipt["historical_bindings"]
    for key, (relative, expected_blob) in EXPECTED.items():
        path = REPO_ROOT / relative
        observed = git_blob_sha1(path)
        if observed != expected_blob or historical[key] != expected_blob:
            raise ValueError(f"historical blob mismatch: {key}")
    target_path = REPO_ROOT / EXPECTED["counterexample_manifest_blob"][0]
    target_sha = sha256_bytes(target_path.read_bytes())
    if target_sha != EXPECTED_TARGET_SHA256 or historical["counterexample_manifest_sha256"] != EXPECTED_TARGET_SHA256:
        raise ValueError("historical counterexample SHA-256 mismatch")

    stage = receipt["stage_b_contract"]
    expected_stage = {
        "base_manifest_schema_changed": False,
        "historical_manifest_semantics_reinterpreted": False,
        "sidecar_optional": True,
        "exact_manifest_sha256_required": True,
        "exact_responsibility_index_required": True,
        "exact_responsibility_entry_copy_required": True,
        "declaration_only_supported": True,
        "attributable_acceptance_evidence_binding_supported": True,
        "missing_stronger_evidence_is_failure": False,
    }
    if stage != expected_stage:
        raise ValueError("Stage B contract receipt drift")
    next_gate = receipt["next_gate"]
    if next_gate != {
        "stage_c_may_consume_attributable_binding": True,
        "stage_c_implemented_here": False,
        "stage_c_requires_separate_successor": True,
    }:
        raise ValueError("Stage C gate receipt drift")
    if any(value is not False for value in receipt["non_effects"].values()):
        raise ValueError("implementation receipt non-effect escalated")


def main():
    schema = load(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)

    declaration = load(DECLARATION_FIXTURE)
    attributable = load(ATTRIBUTABLE_FIXTURE)
    schema_and_semantic_validate(declaration, validator)
    schema_and_semantic_validate(attributable, validator)

    tests = [
        (lambda x: x.update({"extra": True}), "top-level extra"),
        (lambda x: x["target_manifest"].__setitem__("sha256", "0" * 64), "target SHA drift"),
        (lambda x: x["target_manifest"].__setitem__("path", "../../outside.json"), "path traversal"),
        (lambda x: x["bindings"][0].__setitem__("responsibility_index", 999), "index drift"),
        (lambda x: x["bindings"][0]["responsibility_entry"].__setitem__("actor_id", "actor:bob"), "actor drift"),
        (lambda x: x["bindings"][0]["responsibility_entry"].__setitem__("scope", "publication_authorization"), "scope drift"),
        (lambda x: x["bindings"][0]["responsibility_entry"].__setitem__("status", "shared"), "status drift"),
        (lambda x: x["bindings"][0]["responsibility_entry"].__setitem__("limitations", "changed"), "limitations drift"),
        (lambda x: x["bindings"].append(copy.deepcopy(x["bindings"][0])), "duplicate index"),
        (lambda x: x["bindings"][0].__setitem__("unexpected", True), "binding extra"),
        (lambda x: x["bindings"][0].__setitem__("attributable_acceptance_event_reference", "urn:unexpected:event"), "declaration event escalation"),
        (lambda x: x["bindings"][0].__setitem__("acceptance_evidence_refs", ["urn:unexpected:evidence"]), "declaration evidence escalation"),
        (lambda x: x["non_effects"].__setitem__("authority_created", True), "authority escalation"),
    ]
    for mutate, label in tests:
        must_fail(declaration, mutate, validator, label)

    attributable_tests = [
        (lambda x: x["bindings"][0].__setitem__("attributable_acceptance_event_reference", None), "missing attributable event"),
        (lambda x: x["bindings"][0].__setitem__("acceptance_evidence_refs", []), "missing acceptance evidence"),
        (lambda x: x["bindings"][0]["responsibility_entry"].__setitem__("status", "limited"), "non-acceptance status"),
        (lambda x: x["bindings"][0].__setitem__("acceptance_evidence_refs", ["urn:x", "urn:x"]), "duplicate evidence"),
        (lambda x: x["non_effects"].__setitem__("truth_created", True), "truth escalation"),
        (lambda x: x["non_effects"].__setitem__("legal_liability_created", True), "liability escalation"),
    ]
    for mutate, label in attributable_tests:
        must_fail(attributable, mutate, validator, label)

    validate_receipt()
    print(f"RESPONSIBILITY_STATUS_PROVENANCE_BINDING_V0_1_PASS negative_mutations={len(tests) + len(attributable_tests)}")


if __name__ == "__main__":
    main()
