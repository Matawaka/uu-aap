#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE_PATH = HERE / "source-observation.json"
AUDIT_PATH = HERE / "audit.json"
RECEIPT_PATH = HERE / "implementation-receipt.json"

EXPECTED_INTERNAL_PATH = "scripts/observed-authority-branch-divergence/README.md"
EXPECTED_INTERNAL_BLOB = "7d00b02b500e98d349d84a11262f50fb8bc00d29"
EXPECTED_VERDICT = "DESIGN_REQUIREMENTS_CLARIFIED_EXECUTABLE_EXTERNAL_ANCHOR_EVIDENCE_NOT_ADMITTED"
EXPECTED_NEXT = "EXECUTABLE_EXTERNAL_ANCHOR_PILOT_WITH_REAL_INCLUSION_AND_CHECKPOINT_ANTI_EQUIVOCATION_EVIDENCE"
EXPECTED_LAYER_IDS = [
    "SIGNED_CLAIM",
    "CLAIM_COMMITMENT",
    "LOG_INCLUSION",
    "LOG_APPEND_ONLY_CONSISTENCY",
    "CHECKPOINT_NON_EQUIVOCATION",
    "EXISTENCE_TIME_EVIDENCE",
]


def fail(message: str) -> None:
    raise ValueError(message)


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def git_blob(path: str) -> str:
    proc = subprocess.run(
        ["git", "rev-parse", f"HEAD:{path}"], cwd=ROOT, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if proc.returncode != 0:
        fail(f"cannot bind {path}: {proc.stderr.strip()}")
    return proc.stdout.strip()


def exact_keys(obj: dict[str, Any], allowed: set[str], label: str) -> None:
    if set(obj) != allowed:
        fail(f"{label} keys drift: {sorted(set(obj) ^ allowed)}")


def require_bool_map(obj: dict[str, Any], expected: dict[str, bool], label: str) -> None:
    exact_keys(obj, set(expected), label)
    for key, value in expected.items():
        if obj[key] is not value:
            fail(f"{label}.{key} must be {value}")


def validate_source(source: dict[str, Any], *, check_git: bool = True) -> None:
    exact_keys(source, {"artifact_type","version","tracking_issue","repository_predecessor_main","c2pa_issue","new_comment","reference_repository","accepted_internal_boundary"}, "source")
    if source["artifact_type"] != "ExternalAnchorSufficiencySourceObservation" or source["version"] != "0.1" or source["tracking_issue"] != 927:
        fail("source identity drift")
    if source["repository_predecessor_main"] != "e14cbbfb024d57912388468268bce42848f6effd":
        fail("predecessor drift")

    issue = source["c2pa_issue"]
    exact_keys(issue, {"repository","issue_number","url","state","comment_count","author","author_association","updated_at","body_sha256","proposal_observations"}, "c2pa_issue")
    expected_issue = {
        "repository":"c2pa-org/specifications", "issue_number":122,
        "url":"https://github.com/c2pa-org/specifications/issues/122", "state":"open",
        "comment_count":18, "author":"MarkovianProtocol", "author_association":"NONE",
        "updated_at":"2026-09-05T08:06:04Z",
        "body_sha256":"4396801c27cc7814c34775e12407ac3c0ed8b682a0074cf39badd47f9416e9ad",
    }
    for k, v in expected_issue.items():
        if issue[k] != v:
            fail(f"c2pa_issue.{k} drift")
    require_bool_map(issue["proposal_observations"], {
        "external_claim_hash_commitment_proposed": True,
        "inclusion_proof_as_assertion_proposed": True,
        "signature_and_tsa_described_as_point_assertions": True,
        "c2pa_spec_adoption_established": False,
    }, "proposal_observations")

    comment = source["new_comment"]
    exact_keys(comment, {"comment_id","url","author","author_association","created_at","body_sha256","observed_requirements"}, "new_comment")
    expected_comment = {
        "comment_id":5550475914,
        "url":"https://github.com/c2pa-org/specifications/issues/122#issuecomment-5550475914",
        "author":"blev8824-ai", "author_association":"NONE",
        "created_at":"2026-09-05T08:06:04Z",
        "body_sha256":"129f1678134512eb64811582abec9d60cc38588a95e3c529be26ebb0ea5f320d",
    }
    for k, v in expected_comment.items():
        if comment[k] != v:
            fail(f"new_comment.{k} drift")
    require_bool_map(comment["observed_requirements"], {
        "existence_keyed_commitment_separated_from_publication_time": True,
        "log_can_fork_or_split_view_if_checkpoint_not_independently_bound": True,
        "checkpoint_tree_head_needs_its_own_non_equivocation_boundary": True,
        "merkle_recomputation_alone_is_not_log_non_equivocation_proof": True,
        "c2pa_maintainer_endorsement_established": False,
    }, "observed_requirements")

    ref = source["reference_repository"]
    exact_keys(ref, {"repository","main_sha","license","readme_observations"}, "reference_repository")
    if ref["repository"] != "MarkovianProtocol/audit-anchor" or ref["main_sha"] != "ff6a0000810157f10b6a89ac09d1599eaf29f2bf" or ref["license"] != "MIT":
        fail("reference repository observation drift")
    require_bool_map(ref["readme_observations"], {
        "local_chain_recomputation_described": True,
        "external_ledger_anchor_described": True,
        "bitcoin_opentimestamps_tier_described": True,
        "mechanism_security_property_verified_by_this_audit": False,
    }, "readme_observations")

    internal = source["accepted_internal_boundary"]
    exact_keys(internal, {"path","blob","merged_pr","required_invariant"}, "accepted_internal_boundary")
    if internal != {
        "path": EXPECTED_INTERNAL_PATH,
        "blob": EXPECTED_INTERNAL_BLOB,
        "merged_pr": 900,
        "required_invariant": "Observed branch divergence != proven global equivocation",
    }:
        fail("accepted internal boundary drift")
    if check_git and git_blob(EXPECTED_INTERNAL_PATH) != EXPECTED_INTERNAL_BLOB:
        fail("accepted #900 README blob drift")

    forbidden = {"body", "comment_body", "issue_body", "raw_body", "full_text"}
    if forbidden.intersection(source):
        fail("long external source text must not be copied into frozen observation")


def validate_audit(audit: dict[str, Any]) -> None:
    exact_keys(audit, {"artifact_type","version","tracking_issue","source_observation_path","evidence_layers","future_receipt_requirements","current_result","next_gate"}, "audit")
    if audit["artifact_type"] != "ExternalAnchorSufficiencyAudit" or audit["version"] != "0.1" or audit["tracking_issue"] != 927:
        fail("audit identity drift")
    if audit["source_observation_path"] != "research/external-anchor-sufficiency-audit/v0.1/source-observation.json":
        fail("source path drift")

    layers = audit["evidence_layers"]
    if not isinstance(layers, list) or [x.get("id") for x in layers] != EXPECTED_LAYER_IDS:
        fail("evidence layer order/set drift")
    allowed_states = {"SOURCE_DESCRIBED","PROPOSED_REQUIREMENT","REQUIREMENT_IDENTIFIED","PROPERTY_DESCRIBED_NOT_VERIFIED"}
    for layer in layers:
        exact_keys(layer, {"id","meaning","current_state","actual_executable_evidence_supplied"}, f"layer:{layer.get('id')}")
        if not isinstance(layer["meaning"], str) or not layer["meaning"]:
            fail("layer meaning required")
        if layer["current_state"] not in allowed_states or layer["actual_executable_evidence_supplied"] is not False:
            fail(f"layer overclaim {layer['id']}")

    req = audit["future_receipt_requirements"]
    expected_req = {
        "asset_or_subject_binding_required": True,
        "producer_or_signing_key_binding_required": True,
        "claim_profile_and_version_binding_required": True,
        "canonical_claim_digest_required": True,
        "checkpoint_and_log_identity_required": True,
        "collision_relation_must_be_explicit": True,
        "inclusion_proof_required": True,
        "append_only_consistency_evidence_required": True,
        "checkpoint_non_equivocation_evidence_required": True,
        "selective_submission_or_coverage_limit_must_remain_explicit": True,
        "time_evidence_semantics_must_be_explicit": True,
    }
    require_bool_map(req, expected_req, "future_receipt_requirements")

    result = audit["current_result"]
    expected_true = {
        "claim_commitment_concept_identified",
        "inclusion_proof_concept_identified",
        "log_level_non_equivocation_requirement_identified",
        "existence_time_property_separated",
    }
    expected_false = {
        "actual_c2pa_spec_adoption_established","external_anchor_receipt_admitted","global_non_equivocation_proven",
        "complete_history_proven","all_manifests_submitted_proven","selective_submission_absent_proven",
        "trusted_time_proven","canonical_branch_selected","malicious_behavior_proven","authority_created",
        "truth_certified","automatic_remediation_authorized","stable_core_admission","interface_registry_mutated",
    }
    if result.get("verdict") != EXPECTED_VERDICT:
        fail("verdict drift")
    exact_keys(result, {"verdict"} | expected_true | expected_false, "current_result")
    for k in expected_true:
        if result[k] is not True: fail(f"{k} must be true")
    for k in expected_false:
        if result[k] is not False: fail(f"{k} must be false")
    if audit["next_gate"] != EXPECTED_NEXT:
        fail("next gate drift")

    serialized = json.dumps(audit, sort_keys=True).lower()
    for forbidden in ["trust_score", "security_score", "non_equivocation_score", "confidence_score", "fraud_score"]:
        if forbidden in serialized:
            fail(f"scalar score surface forbidden: {forbidden}")


def validate_implementation_receipt(receipt: dict[str, Any]) -> None:
    exact_keys(receipt, {"artifact_type","version","tracking_issue","repository_predecessor_main","implementation_files","workflow","proof","non_effects"}, "implementation_receipt")
    if receipt["artifact_type"] != "ExternalAnchorSufficiencyAuditImplementationReceipt" or receipt["version"] != "0.1" or receipt["tracking_issue"] != 927:
        fail("implementation receipt identity drift")
    if receipt["repository_predecessor_main"] != "e14cbbfb024d57912388468268bce42848f6effd":
        fail("implementation predecessor drift")
    for name, blob in receipt["implementation_files"].items():
        rel = f"research/external-anchor-sufficiency-audit/v0.1/{name}"
        if git_blob(rel) != blob:
            fail(f"implementation blob drift {name}")
    wf = receipt["workflow"]
    if git_blob(wf["path"]) != wf["blob"]:
        fail("workflow blob drift")
    require_bool_map(receipt["proof"], {
        "external_source_metadata_frozen_without_long_body_copy": True,
        "six_evidence_layers_separated": True,
        "internal_branch_divergence_nonclaim_preserved": True,
        "actual_external_anchor_evidence_not_admitted": True,
        "future_collision_binding_required": True,
        "future_checkpoint_non_equivocation_evidence_required": True,
    }, "proof")
    require_bool_map(receipt["non_effects"], {
        "external_comment_posted": False,
        "transparency_log_deployed": False,
        "bitcoin_transaction_created": False,
        "c2pa_spec_adoption_established": False,
        "global_non_equivocation_proven": False,
        "trusted_time_proven": False,
        "stable_core_modified": False,
        "interface_registry_modified": False,
        "external_effect_performed": False,
    }, "implementation_non_effects")


def main() -> int:
    source = load(SOURCE_PATH)
    audit = load(AUDIT_PATH)
    validate_source(source, check_git=True)
    validate_audit(audit)
    if RECEIPT_PATH.exists():
        validate_implementation_receipt(load(RECEIPT_PATH))
    print(f"EXTERNAL_ANCHOR_SUFFICIENCY_AUDIT_V0_1_PASS: {EXPECTED_VERDICT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
