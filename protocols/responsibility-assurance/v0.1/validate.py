#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
PROFILE_SCHEMA_PATH = HERE / "profile.schema.json"
PROFILE_FIXTURE_PATH = HERE / "ra1.fixture.json"
FULL_BINDING_PATH = HERE / "full-attributable-binding.fixture.json"
RECEIPT_PATH = HERE / "implementation-receipt.json"
STAGE_B_DIR = REPO_ROOT / "protocols/responsibility-status-provenance/v0.1"
STAGE_B_SCHEMA_PATH = STAGE_B_DIR / "binding.schema.json"
STAGE_B_VALIDATOR_PATH = STAGE_B_DIR / "validate.py"
STAGE_B_DECLARATION_PATH = STAGE_B_DIR / "declaration-only.fixture.json"
BASE_MANIFEST_SCHEMA_PATH = REPO_ROOT / "schema/uu-aap-manifest.schema.json"
TARGET_MANIFEST_PATH = REPO_ROOT / "pilots/core-pilot-002/run-001/result/v0.1/counterexample.manifest.json"

EXPECTED_TARGET_SHA256 = "d173cf888cfea1e343411162aaf87a890874e0aaf02fee7cd6c1fd0fcc3cf83f"
EXPECTED_FULL_BINDING_SHA256 = "828e6dfec882fdfd7bd327047eb4521a13082b2428206d09d13d1dca82a192aa"
EXPECTED_STAGE_B_DECLARATION_SHA256 = "ba9143ab48d2ba6912286a116f63bc4689d5de091a66059885eee808fa29f6ae"
EXPECTED_BLOBS = {
    "stage_b_readme": ("protocols/responsibility-status-provenance/v0.1/README.md", "4abf1266cc9d6c0529eb00bb466c8545b7b270ac"),
    "stage_b_schema": ("protocols/responsibility-status-provenance/v0.1/binding.schema.json", "0fb44e2d91efcdc4f7c5034e01100fd37489b376"),
    "stage_b_receipt": ("protocols/responsibility-status-provenance/v0.1/implementation-receipt.json", "3ecba920eb366c15c1c7555cb54dc8574e05a73b"),
    "stage_b_validator": ("protocols/responsibility-status-provenance/v0.1/validate.py", "51ecb60bd94a854e4764aec2e4c698cd5d9b88bd"),
    "run_001_result": ("pilots/core-pilot-002/run-001/result/v0.1/result.json", "edc9a7e4f26492d16875727e17188c5e2a486ced"),
    "manifest_schema_v0_1": ("schema/uu-aap-manifest.schema.json", "c0579b34f6c456c462cea1aa80ec67b78fce7582"),
    "spec": ("SPEC.md", "44b91e0e48dee9d928c843bbb304a5c246582da7"),
    "responsibility_policy": ("RESPONSIBILITY.md", "f71dd1920157d4137f1e3a1ab270bcdfc873e61f"),
    "counterexample_manifest": ("pilots/core-pilot-002/run-001/result/v0.1/counterexample.manifest.json", "350ca00629f354bdd7cc01785d448590c6be87b4"),
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_blob_sha1(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def safe_repo_file(relative: str) -> Path:
    if not isinstance(relative, str) or not relative:
        raise ValueError("path must be a non-empty string")
    candidate = (REPO_ROOT / relative).resolve()
    root = REPO_ROOT.resolve()
    if not candidate.is_relative_to(root):
        raise ValueError("path escapes repository")
    if not candidate.is_file():
        raise ValueError("path is not a file")
    return candidate


def load_stage_b_module():
    spec = importlib.util.spec_from_file_location("accepted_stage_b_validator", STAGE_B_VALIDATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load accepted Stage B validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_json_schema(doc, validator, label):
    errors = sorted(validator.iter_errors(doc), key=lambda e: list(e.absolute_path))
    if errors:
        raise ValueError(f"{label} schema validation failed: {errors[0].message}")


def validate_ra1_semantics(profile, target, stage_b_doc):
    if profile["profile"] != {"id": "UU-AAP/RA1", "version": "0.1", "kind": "responsibility_assurance_overlay"}:
        raise ValueError("RA1 profile identity drift")
    if profile["coverage"] != {"mode": "ALL_ACCEPTED_OR_SHARED_RESPONSIBILITIES"}:
        raise ValueError("RA1 coverage mode drift")
    if profile["result_claim"] != "ATTRIBUTABLE_ACCEPTANCE_EVIDENCE_PRESENT_FOR_ALL_ACCEPTED_OR_SHARED_RESPONSIBILITY_ENTRIES":
        raise ValueError("RA1 claim drift")
    if stage_b_doc["target_manifest"] != profile["target_manifest"]:
        raise ValueError("RA1 target and Stage B target differ")

    responsibility = target.get("responsibility")
    if not isinstance(responsibility, list):
        raise ValueError("target responsibility is not an array")
    accepted_indices = {i for i, entry in enumerate(responsibility) if entry.get("status") in {"accepted", "shared"}}
    if not accepted_indices:
        raise ValueError("RA1 requires at least one accepted/shared responsibility entry")
    attributable_indices = {
        binding["responsibility_index"]
        for binding in stage_b_doc["bindings"]
        if binding["binding_state"] == "ATTRIBUTABLE_ACCEPTANCE_EVIDENCE_BOUND"
    }
    if attributable_indices != accepted_indices:
        raise ValueError(f"RA1 coverage mismatch: expected={sorted(accepted_indices)} attributable={sorted(attributable_indices)}")
    if any(value is not False for value in profile["non_effects"].values()):
        raise ValueError("RA1 non-effect escalated")


def validate_files(profile, profile_validator, stage_b_validator, stage_b_module, base_validator):
    validate_json_schema(profile, profile_validator, "RA1")
    target_path = safe_repo_file(profile["target_manifest"]["path"])
    if sha256_path(target_path) != profile["target_manifest"]["sha256"]:
        raise ValueError("RA1 target manifest SHA-256 mismatch")
    binding_path = safe_repo_file(profile["stage_b_binding"]["path"])
    if sha256_path(binding_path) != profile["stage_b_binding"]["sha256"]:
        raise ValueError("RA1 Stage B sidecar SHA-256 mismatch")

    target = load(target_path)
    stage_b_doc = load(binding_path)
    validate_json_schema(target, base_validator, "base v0.1 manifest")
    validate_json_schema(stage_b_doc, stage_b_validator, "Stage B")
    stage_b_module.semantic_validate(stage_b_doc)
    validate_ra1_semantics(profile, target, stage_b_doc)
    return target, stage_b_doc


def must_fail(callable_, label):
    try:
        callable_()
    except (ValueError, KeyError, TypeError, IndexError):
        return
    raise AssertionError(f"negative mutation unexpectedly passed: {label}")


def validate_receipt():
    receipt = load(RECEIPT_PATH)
    if receipt["schema"] != "urn:uu-aap:responsibility-assurance-profile-implementation:0.1":
        raise ValueError("RA1 implementation receipt schema drift")
    if receipt["origin_frontier"] != "5201cb686bcef52053e055595c2315c36aa1ec56":
        raise ValueError("RA1 implementation origin drift")
    gate = receipt["human_design_gate"]
    if gate["issue"] != 852 or gate["decision_comment_id"] != 5474573197 or gate["decision"] != "PHASED_B_PLUS_C" or gate["stage"] != "C_STRONGER_RESPONSIBILITY_ASSURANCE_PROFILE":
        raise ValueError("RA1 human design gate drift")
    if gate["decision_comment_body_sha256"] != "d1137cb69f2445cbd9b5bba0d275898597275daa04fe66ba75be70533c3ff881":
        raise ValueError("RA1 human decision digest drift")
    if gate["decision_actor_identity_status"] != "NOT_ESTABLISHED_BY_REPOSITORY_RECORD":
        raise ValueError("RA1 decision identity boundary drift")

    for key, (relative, expected_blob) in EXPECTED_BLOBS.items():
        observed = git_blob_sha1(REPO_ROOT / relative)
        if observed != expected_blob:
            raise ValueError(f"historical source blob drift: {key}")

    stage_b = receipt["accepted_stage_b"]
    if stage_b != {
        "merge_frontier": "5201cb686bcef52053e055595c2315c36aa1ec56",
        "readme_blob": "4abf1266cc9d6c0529eb00bb466c8545b7b270ac",
        "binding_schema_blob": "0fb44e2d91efcdc4f7c5034e01100fd37489b376",
        "implementation_receipt_blob": "3ecba920eb366c15c1c7555cb54dc8574e05a73b",
        "validator_blob": "51ecb60bd94a854e4764aec2e4c698cd5d9b88bd",
    }:
        raise ValueError("accepted Stage B receipt drift")
    if receipt["historical_bindings"]["counterexample_manifest_sha256"] != EXPECTED_TARGET_SHA256:
        raise ValueError("historical target SHA drift")
    stage_c = receipt["stage_c_contract"]
    if stage_c != {
        "overlay_id": "UU-AAP/RA1",
        "base_profile_enum_changed": False,
        "base_manifest_validity_changed": False,
        "all_accepted_or_shared_entries_require_stage_b_attributable_binding": True,
        "limited_declined_unknown_require_acceptance_binding": False,
        "stage_b_reused_without_parallel_identity_authority_path": True,
        "missing_ra1_is_baseline_manifest_failure": False,
        "ra1_failure_is_sanction_or_negative_reputation": False,
    }:
        raise ValueError("Stage C contract receipt drift")
    if any(value is not False for value in receipt["non_effects"].values()):
        raise ValueError("RA1 implementation non-effect escalated")


def main():
    profile_schema = load(PROFILE_SCHEMA_PATH)
    stage_b_schema = load(STAGE_B_SCHEMA_PATH)
    base_schema = load(BASE_MANIFEST_SCHEMA_PATH)
    Draft202012Validator.check_schema(profile_schema)
    Draft202012Validator.check_schema(stage_b_schema)
    Draft202012Validator.check_schema(base_schema)
    profile_validator = Draft202012Validator(profile_schema)
    stage_b_validator = Draft202012Validator(stage_b_schema)
    base_validator = Draft202012Validator(base_schema)
    stage_b_module = load_stage_b_module()

    profile = load(PROFILE_FIXTURE_PATH)
    target, full_binding = validate_files(profile, profile_validator, stage_b_validator, stage_b_module, base_validator)

    if sha256_path(TARGET_MANIFEST_PATH) != EXPECTED_TARGET_SHA256:
        raise ValueError("target fixture SHA-256 drift")
    if sha256_path(FULL_BINDING_PATH) != EXPECTED_FULL_BINDING_SHA256:
        raise ValueError("full Stage B fixture SHA-256 drift")
    if sha256_path(STAGE_B_DECLARATION_PATH) != EXPECTED_STAGE_B_DECLARATION_SHA256:
        raise ValueError("accepted Stage B declaration fixture SHA-256 drift")

    # Baseline remains valid independently of RA1.
    validate_json_schema(target, base_validator, "baseline target manifest")

    bad_profile = copy.deepcopy(profile)
    bad_profile["trust_score"] = 1.0
    must_fail(lambda: validate_json_schema(bad_profile, profile_validator, "scalar score"), "scalar score field")

    bad_profile = copy.deepcopy(profile)
    bad_profile["target_manifest"]["sha256"] = "0" * 64
    must_fail(lambda: validate_files(bad_profile, profile_validator, stage_b_validator, stage_b_module, base_validator), "target SHA drift")

    bad_profile = copy.deepcopy(profile)
    bad_profile["stage_b_binding"]["sha256"] = "0" * 64
    must_fail(lambda: validate_files(bad_profile, profile_validator, stage_b_validator, stage_b_module, base_validator), "Stage B SHA drift")

    declaration_only = load(STAGE_B_DECLARATION_PATH)
    validate_json_schema(declaration_only, stage_b_validator, "accepted Stage B declaration-only")
    stage_b_module.semantic_validate(declaration_only)
    must_fail(lambda: validate_ra1_semantics(profile, target, declaration_only), "declaration-only cannot satisfy RA1")

    missing_one = copy.deepcopy(full_binding)
    missing_one["bindings"] = missing_one["bindings"][:1]
    validate_json_schema(missing_one, stage_b_validator, "missing-one Stage B candidate")
    stage_b_module.semantic_validate(missing_one)
    must_fail(lambda: validate_ra1_semantics(profile, target, missing_one), "missing accepted/shared binding")

    downgraded = copy.deepcopy(full_binding)
    downgraded["bindings"][1]["binding_state"] = "DECLARATION_ONLY"
    downgraded["bindings"][1]["attributable_acceptance_event_reference"] = None
    downgraded["bindings"][1]["acceptance_evidence_refs"] = []
    validate_json_schema(downgraded, stage_b_validator, "downgraded Stage B candidate")
    stage_b_module.semantic_validate(downgraded)
    must_fail(lambda: validate_ra1_semantics(profile, target, downgraded), "accepted/shared declaration-only under RA1")

    for field in ["verified_identity_created", "authority_created", "truth_created", "legal_liability_created", "certification_created", "release_or_tag_authorized", "publication_authorized", "action_permit_created"]:
        mutated = copy.deepcopy(profile)
        mutated["non_effects"][field] = True
        must_fail(lambda m=mutated: validate_json_schema(m, profile_validator, field), f"non-effect escalation {field}")

    validate_receipt()
    print("RESPONSIBILITY_ASSURANCE_RA1_V0_1_PASS")
    print("profile=UU-AAP/RA1 coverage=ALL_ACCEPTED_OR_SHARED_RESPONSIBILITIES baseline_manifest_remains_valid=true")


if __name__ == "__main__":
    main()
