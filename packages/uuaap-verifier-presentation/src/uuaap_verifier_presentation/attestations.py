"""P1.8 bounded CAWG/W3C attestation bridge.

Consumes external validation receipts only. It does not perform credential cryptography,
network resolution, trust-registry queries, or verifier-dimension materialization.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .core import assert_no_aggregate_semantic_collapse, validate_dimension

ATTESTATION_INPUT_SCHEMA = "urn:uu-aap:scoped-attestation-bridge-input:0.1"
ATTESTATION_RESULT_SCHEMA = "urn:uu-aap:scoped-attestation-bridge-result:0.1"
CAWG_IDENTITY_VERSION = "1.3"
W3C_VCDM_VERSION = "2.0"
CAWG_STATUSES = {"TRUSTED", "WELL_FORMED", "REVOKED", "INVALID", "NETWORK_REQUIRED"}
VC_STATUSES = {"VALID", "INVALID", "UNKNOWN"}

_INPUT_FIELDS = {"schema", "artifact", "evidence_items", "observations"}
_ARTIFACT_FIELDS = {"id", "description"}
_EVIDENCE_FIELDS = {"id", "kind", "source_layer", "summary", "payload"}
_OBSERVATION_FIELDS = {"id", "kind", "evidence_refs", "payload"}
_RESULT_FIELDS = {
    "schema", "artifact", "evidence_items", "identity_candidates", "role_attestations",
    "review_attestations", "bridge_receipts", "warnings", "bridge_policy",
    "aggregate_score_present", "aggregate_verdict_present",
}


def _semantic_projection(value: dict[str, Any]) -> dict[str, Any]:
    projected = deepcopy(value)
    for item in projected.get("evidence_items", []):
        if isinstance(item, dict) and "payload" in item:
            item["payload"] = {}
    for item in projected.get("observations", []):
        payload = item.get("payload") if isinstance(item, dict) else None
        if isinstance(payload, dict) and "validator_details" in payload:
            payload["validator_details"] = {}
        if isinstance(payload, dict) and "verifier_details" in payload:
            payload["verifier_details"] = {}
    return projected


def _validate_artifact(value: Any) -> None:
    assert isinstance(value, dict) and set(value) == _ARTIFACT_FIELDS, "artifact fields changed"
    assert all(isinstance(value[key], str) and value[key] for key in _ARTIFACT_FIELDS), "artifact values required"


def _validate_evidence(items: Any) -> set[str]:
    assert isinstance(items, list), "evidence_items must be an array"
    seen: set[str] = set()
    for index, item in enumerate(items):
        assert isinstance(item, dict) and set(item) == _EVIDENCE_FIELDS, f"evidence_items[{index}] fields"
        for field in ("id", "kind", "source_layer", "summary"):
            assert isinstance(item[field], str) and item[field], f"evidence_items[{index}].{field}"
        assert isinstance(item["payload"], dict), f"evidence_items[{index}].payload"
        assert item["id"] not in seen, f"duplicate evidence id: {item['id']}"
        seen.add(item["id"])
    return seen


def _nonempty_strings(value: Any, label: str) -> None:
    assert isinstance(value, list), f"{label} must be an array"
    assert all(isinstance(item, str) and item for item in value), f"{label} item"


def _validate_cawg(payload: Any, label: str) -> None:
    fields = {
        "assertion_version", "validation_status", "named_actor_ref", "named_actor_label",
        "roles", "credential_type", "referenced_assertions", "validated_at", "validator_details",
    }
    assert isinstance(payload, dict) and set(payload) == fields, f"{label} CAWG payload fields changed"
    assert payload["assertion_version"] == CAWG_IDENTITY_VERSION, f"{label}: CAWG version must be 1.3"
    assert payload["validation_status"] in CAWG_STATUSES, f"{label}: invalid CAWG status"
    for field in ("named_actor_ref", "named_actor_label", "credential_type"):
        assert isinstance(payload[field], str) and payload[field], f"{label}.{field}"
    _nonempty_strings(payload["roles"], f"{label}.roles")
    _nonempty_strings(payload["referenced_assertions"], f"{label}.referenced_assertions")
    assert isinstance(payload["validated_at"], str), f"{label}.validated_at"
    assert isinstance(payload["validator_details"], dict), f"{label}.validator_details"


def _validate_review_vc(payload: Any, label: str) -> None:
    fields = {
        "vcdm_version", "verification_status", "issuer_ref", "credential_subject_refs",
        "review_scope", "limitations", "review_date", "verifier_details",
    }
    assert isinstance(payload, dict) and set(payload) == fields, f"{label} VC payload fields changed"
    assert payload["vcdm_version"] == W3C_VCDM_VERSION, f"{label}: VCDM basis must remain 2.0"
    assert payload["verification_status"] in VC_STATUSES, f"{label}: invalid VC status"
    assert isinstance(payload["issuer_ref"], str) and payload["issuer_ref"], f"{label}.issuer_ref"
    _nonempty_strings(payload["credential_subject_refs"], f"{label}.credential_subject_refs")
    assert isinstance(payload["review_scope"], str) and payload["review_scope"], f"{label}.review_scope"
    _nonempty_strings(payload["limitations"], f"{label}.limitations")
    assert isinstance(payload["review_date"], str), f"{label}.review_date"
    assert isinstance(payload["verifier_details"], dict), f"{label}.verifier_details"


def validate_attestation_input(record: dict[str, Any]) -> None:
    assert isinstance(record, dict) and set(record) == _INPUT_FIELDS, "attestation input fields changed"
    assert record["schema"] == ATTESTATION_INPUT_SCHEMA, "unsupported attestation input schema"
    _validate_artifact(record["artifact"])
    evidence_ids = _validate_evidence(record["evidence_items"])
    assert isinstance(record["observations"], list), "observations must be an array"
    seen: set[str] = set()
    for index, item in enumerate(record["observations"]):
        label = f"observations[{index}]"
        assert isinstance(item, dict) and set(item) == _OBSERVATION_FIELDS, f"{label} fields changed"
        assert isinstance(item["id"], str) and item["id"], f"{label}.id"
        assert item["id"] not in seen, f"duplicate observation id: {item['id']}"
        seen.add(item["id"])
        _nonempty_strings(item["evidence_refs"], f"{label}.evidence_refs")
        assert all(ref in evidence_ids for ref in item["evidence_refs"]), f"{label}: undeclared evidence ref"
        if item["kind"] == "CAWG_IDENTITY_VALIDATION":
            _validate_cawg(item["payload"], label)
        elif item["kind"] == "W3C_VC_REVIEW_ATTESTATION":
            _validate_review_vc(item["payload"], label)
        else:
            raise AssertionError(f"{label}: unsupported attestation kind {item['kind']}")
    assert_no_aggregate_semantic_collapse(_semantic_projection(record))


def _identity_claim(item: dict[str, Any]) -> dict[str, Any] | None:
    payload = item["payload"]
    status = payload["validation_status"]
    mapping = {
        "TRUSTED": ("CAWG_IDENTITY_TRUSTED", "SUPPORTED"),
        "WELL_FORMED": ("CAWG_IDENTITY_WELL_FORMED", "UNKNOWN"),
        "REVOKED": ("CAWG_IDENTITY_REVOKED", "NOT_SUPPORTED"),
    }
    if status not in mapping:
        return None
    value, evaluation = mapping[status]
    claim = {
        "value": value,
        "evaluation": evaluation,
        "source_layer": "CAWG/IdentityAssertion/1.3",
        "evidence_refs": deepcopy(item["evidence_refs"]),
        "explanation": (
            f"External CAWG Identity Assertion 1.3 validation receipt reports {status} for named actor "
            f"{payload['named_actor_ref']}."
        ),
        "does_not_establish": [
            "authorship", "UU-AAP decision authority", "UU-AAP responsibility acceptance",
            "factual truth", "legal identity beyond the external credential scope",
            "that a CAWG role maps to UU-AAP authority", "decision-time availability or consideration",
        ],
    }
    validate_dimension("identity_candidate", claim)
    return claim


def bridge_attestations(record: dict[str, Any]) -> dict[str, Any]:
    validate_attestation_input(record)
    candidates: list[dict[str, Any]] = []
    roles: list[dict[str, Any]] = []
    reviews: list[dict[str, Any]] = []
    receipts: list[dict[str, Any]] = []
    warnings: list[dict[str, str]] = []

    for item in record["observations"]:
        if item["kind"] == "CAWG_IDENTITY_VALIDATION":
            payload = item["payload"]
            claim = _identity_claim(item)
            if claim is not None:
                candidates.append({
                    "candidate_id": f"identity-candidate:{item['id']}",
                    "observation_id": item["id"],
                    "named_actor_ref": payload["named_actor_ref"],
                    "claim": claim,
                })
            else:
                code = "CAWG_IDENTITY_INVALID" if payload["validation_status"] == "INVALID" else "CAWG_IDENTITY_NETWORK_REQUIRED"
                warnings.append({
                    "code": code,
                    "message": f"{item['id']}: {payload['validation_status']} produced no identity candidate; evidence is preserved.",
                })
            for role in payload["roles"]:
                roles.append({
                    "observation_id": item["id"],
                    "named_actor_ref": payload["named_actor_ref"],
                    "role": role,
                    "validation_status": payload["validation_status"],
                    "evidence_refs": deepcopy(item["evidence_refs"]),
                    "does_not_establish": [
                        "UU-AAP decision authority", "UU-AAP responsibility acceptance",
                        "authorship as a legal conclusion", "factual truth",
                    ],
                })
            receipts.append({
                "observation_id": item["id"],
                "kind": item["kind"],
                "external_status": payload["validation_status"],
                "identity_candidate_emitted": claim is not None,
                "auxiliary_records_emitted": len(payload["roles"]),
            })
        else:
            payload = item["payload"]
            reviews.append({
                "observation_id": item["id"],
                "verification_status": payload["verification_status"],
                "issuer_ref": payload["issuer_ref"],
                "credential_subject_refs": deepcopy(payload["credential_subject_refs"]),
                "review_scope": payload["review_scope"],
                "limitations": deepcopy(payload["limitations"]),
                "review_date": payload["review_date"],
                "evidence_refs": deepcopy(item["evidence_refs"]),
                "does_not_establish": [
                    "factual truth", "UU-AAP decision authority", "UU-AAP responsibility acceptance",
                    "reviewer identity beyond the credential subject claims", "that reviewed claims are correct",
                ],
            })
            if payload["verification_status"] != "VALID":
                warnings.append({
                    "code": "VC_REVIEW_ATTESTATION_NOT_VALIDATED",
                    "message": f"{item['id']}: review credential status is {payload['verification_status']}; no semantic promotion is permitted.",
                })
            receipts.append({
                "observation_id": item["id"],
                "kind": item["kind"],
                "external_status": payload["verification_status"],
                "identity_candidate_emitted": False,
                "auxiliary_records_emitted": 1,
            })

    result = {
        "schema": ATTESTATION_RESULT_SCHEMA,
        "artifact": deepcopy(record["artifact"]),
        "evidence_items": deepcopy(record["evidence_items"]),
        "identity_candidates": candidates,
        "role_attestations": roles,
        "review_attestations": reviews,
        "bridge_receipts": receipts,
        "warnings": warnings,
        "bridge_policy": {
            "identity_candidates_require_explicit_future_acceptance": True,
            "auto_materialization_permitted": False,
            "role_to_authority_promotion_permitted": False,
            "role_to_responsibility_promotion_permitted": False,
            "review_to_truth_promotion_permitted": False,
            "review_to_responsibility_promotion_permitted": False,
            "issuer_trust_to_truth_promotion_permitted": False,
            "aggregate_score_permitted": False,
            "aggregate_verdict_permitted": False,
        },
        "aggregate_score_present": False,
        "aggregate_verdict_present": False,
    }
    validate_attestation_result(result)
    return result


def validate_attestation_result(result: dict[str, Any]) -> None:
    assert isinstance(result, dict) and set(result) == _RESULT_FIELDS, "attestation result fields changed"
    assert result["schema"] == ATTESTATION_RESULT_SCHEMA, "unsupported attestation result schema"
    _validate_artifact(result["artifact"])
    evidence_ids = _validate_evidence(result["evidence_items"])
    candidate_ids: set[str] = set()
    for item in result["identity_candidates"]:
        assert set(item) == {"candidate_id", "observation_id", "named_actor_ref", "claim"}, "identity candidate fields"
        assert item["candidate_id"] not in candidate_ids, "duplicate identity candidate"
        candidate_ids.add(item["candidate_id"])
        validate_dimension("identity_candidate", item["claim"])
        assert all(ref in evidence_ids for ref in item["claim"]["evidence_refs"]), "identity candidate evidence ref"
        assert item["claim"]["value"] in {"CAWG_IDENTITY_TRUSTED", "CAWG_IDENTITY_WELL_FORMED", "CAWG_IDENTITY_REVOKED"}
    for item in result["role_attestations"]:
        assert set(item) == {"observation_id", "named_actor_ref", "role", "validation_status", "evidence_refs", "does_not_establish"}
        assert item["validation_status"] in CAWG_STATUSES
        assert all(ref in evidence_ids for ref in item["evidence_refs"])
        assert "UU-AAP decision authority" in item["does_not_establish"]
    for item in result["review_attestations"]:
        assert set(item) == {"observation_id", "verification_status", "issuer_ref", "credential_subject_refs", "review_scope", "limitations", "review_date", "evidence_refs", "does_not_establish"}
        assert item["verification_status"] in VC_STATUSES
        assert all(ref in evidence_ids for ref in item["evidence_refs"])
        assert "factual truth" in item["does_not_establish"]
    assert isinstance(result["bridge_receipts"], list)
    assert isinstance(result["warnings"], list)
    policy = result["bridge_policy"]
    assert policy["identity_candidates_require_explicit_future_acceptance"] is True
    assert all(value is False for key, value in policy.items() if key != "identity_candidates_require_explicit_future_acceptance")
    assert result["aggregate_score_present"] is False
    assert result["aggregate_verdict_present"] is False
    assert_no_aggregate_semantic_collapse(_semantic_projection(result))
