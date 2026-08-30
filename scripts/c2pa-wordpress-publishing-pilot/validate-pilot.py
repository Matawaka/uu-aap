#!/usr/bin/env python3
import base64
import hashlib
import json
import sys
from pathlib import Path

ALLOWED_SCORE_KEYS = {"aggregate_trust_score_permitted"}


def reject_score_fields(value, path="$"):
    if isinstance(value, dict):
        for key, child in value.items():
            if "score" in key.lower() and key not in ALLOWED_SCORE_KEYS:
                raise AssertionError(f"aggregate/score-like field prohibited at {path}.{key}")
            reject_score_fields(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_score_fields(child, f"{path}[{index}]")


def by_label(assertions):
    return {assertion["label"]: assertion for assertion in assertions}


def validate(pilot, record, request, record_bytes):
    assert pilot["schema"] == "urn:uu-aap:c2pa-wordpress-publishing-pilot:0.1"
    assert pilot["roadmap_issue"] == 778
    assert pilot["roadmap_surface"] == "P0.6"
    assert pilot["status"] == "INTERFACE_ACCEPTANCE"
    assert pilot["p0_6_semantic_acceptance_complete"] is True
    assert pilot["live_certificate_backed_deployment_claimed"] is False
    assert pilot["c2pa_conformance_claimed_by_this_pilot"] is False

    upstream = pilot["upstream"]
    assert upstream["repository"] == "contentauth/wp-plugin"
    assert upstream["sha"] == "4126f1c4b57d56862b1ca4667549e99ddd9de3fe"
    assert upstream["version"] == "0.1.0"
    assert upstream["blobs"] == {
        "README.md": "1647fa4fbc7ce5296333a4d05a7eb3c917c6d143",
        "signing-service/src/server.js": "dec734c629fb157f1bfafc591c51c2f30a9cb50b",
        "signing-service/src/signer.js": "c5b85c1c78a6e17eda3141904ebaca04a3a92859",
        "signing-service/src/cawg.js": "179c1ce49fec3e042300d9d2dc43afd9e49fee4d",
        "signing-service/src/reader.js": "bb9b49d477b393a9f94abf54a2429c3737451990",
    }
    interface = upstream["observed_interface"]
    assert interface["sign_endpoint"] == "POST /v1/sign"
    assert interface["read_endpoint"] == "POST /v1/read"
    assert interface["signature_type"] == "both"
    assert interface["supports_extra_assertions_parameter"] is True
    assert interface["built_in_action"] == "c2pa.published"
    assert interface["built_in_cawg_assertion"] == "cawg.identity"
    assert interface["product_signature_supported"] is True
    assert interface["cawg_organizational_identity_supported"] is True

    assert record["schema"] == "urn:uu-aap:publishing-governance-record:0.1"
    publisher = record["publisher_identity"]
    authorship = record["authorship"]
    authority = record["publication_authority"]
    responsibility = record["scoped_responsibility"]
    ai_participation = record["ai_participation"]

    assert publisher["actor_id"] != authorship["actor_id"]
    assert publisher["actor_id"] != authority["actor_id"]
    assert ai_participation["actor_id"] != authority["actor_id"]
    assert publisher["does_not_by_itself_establish_publication_authority"] is True
    assert publisher["does_not_by_itself_establish_scoped_responsibility"] is True

    assert authorship["actor_type"] == "human"
    assert authorship["status"] == "declared"
    assert authorship["not_derived_from_claim_generator"] is True
    assert authorship["not_derived_from_cawg_identity"] is True

    assert authority["actor_type"] == "human"
    assert authority["status"] == "accepted"
    assert "approve_publication" in authority["scopes"]
    assert authority["institutional_context"] == publisher["actor_id"]
    assert authority["not_derived_from_signer_identity"] is True
    assert authority["not_derived_from_cawg_identity"] is True
    assert authority["not_derived_from_ai_disclosure"] is True
    assert authority["not_derived_from_c2pa_published_action"] is True

    assert responsibility["actor_id"] == authority["actor_id"]
    assert responsibility["scope"] == "publication_decision"
    assert responsibility["status"] == "accepted"
    assert responsibility["does_not_establish_factual_truth"] is True

    assert ai_participation["human_oversight_level"] == "human_validated"
    assert set(ai_participation["authority_scopes"]) <= {"recommend"}
    assert ai_participation["does_not_establish_authorship"] is True
    assert ai_participation["does_not_establish_publication_authority"] is True
    assert ai_participation["does_not_establish_scoped_responsibility"] is True

    assert record["factual_truth"]["status"] == "not_established"
    assert record["contestability"]["available"] is True
    assert record["contestability"]["successor_record_supported"] is True
    assert record["privacy"]["private_prompts_embedded"] is False
    assert record["privacy"]["private_deliberation_embedded"] is False
    assert record["privacy"]["minimum_public_binding_only"] is True

    composition = pilot["publication_composition"]
    assert request["signature_type"] == "both"
    assert request["mime_type"] == composition["artifact_mime_type"]
    assert request["creator_name"] == composition["cms_pipeline_label"]
    assert request["creator_name"] != authorship["name"]
    assert request["org_name"] == publisher["name"] == composition["publisher_org"]["name"]
    assert request["org_url"] == publisher["canonical_url"] == composition["publisher_org"]["url"]
    assert request["org_name"] != authorship["name"]
    assert base64.b64decode(request["content"], validate=True)

    assertions = by_label(request["extra_assertions"])
    assert set(assertions) == {"c2pa.ai-disclosure", "c2pa.external-reference"}

    ai = assertions["c2pa.ai-disclosure"]
    assert ai["created"] is True
    assert ai["data"]["modelType"] == pilot["c2pa_2_4_assertions"]["ai_disclosure"]["modelType"]
    assert ai["data"]["contentProfile"]["humanOversightLevel"] == "human_validated"
    assert ai["data"]["contentProfile"]["humanOversightLevel"] == ai_participation["human_oversight_level"]

    ext = assertions["c2pa.external-reference"]
    expected_ext = pilot["c2pa_2_4_assertions"]["external_reference"]
    assert ext["created"] is False
    assert ext["kind"] == "Cbor"
    location = ext["data"]["location"]
    digest = hashlib.sha256(record_bytes).digest()
    assert location["url"] == expected_ext["target"]
    assert location["alg"] == "sha256"
    assert location["hash"] == list(digest)
    assert location["dc:format"] == "application/json"
    assert location["size"] == len(record_bytes)

    safe = pilot["expected_safe_view"]
    assert safe["c2pa_product_surface"] == "SOFTWARE_PRODUCT_PROVENANCE"
    assert safe["cawg_identity_surface"] == "PUBLISHER_ORG_IDENTITY"
    assert safe["c2pa_ai_disclosure_surface"] == "HUMAN_VALIDATED_AI_PARTICIPATION"
    assert safe["c2pa_action_surface"] == "PUBLISHED_OPERATION_PROVENANCE"
    assert safe["external_governance_binding"] == "DIGEST_MATCH_REQUIRED"
    assert safe["authorship"] == authorship["actor_id"]
    assert safe["publication_authority"] == authority["actor_id"]
    assert safe["scoped_responsibility"] == f"{responsibility['actor_id']}:{responsibility['scope']}"
    assert safe["ai_authority"] == "RECOMMEND_ONLY"
    assert safe["factual_truth"] == "NOT_ESTABLISHED"
    assert safe["contestability"] == "AVAILABLE"
    assert safe["aggregate_trust_score_permitted"] is False
    assert safe["semantic_promotion_permitted"] is False

    reject_score_fields(pilot)
    reject_score_fields(record)
    reject_score_fields(request)


def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage: validate-pilot.py PILOT.json GOVERNANCE.json REQUEST.json")
    pilot_path = Path(sys.argv[1])
    record_path = Path(sys.argv[2])
    request_path = Path(sys.argv[3])
    pilot = json.loads(pilot_path.read_text(encoding="utf-8"))
    record_bytes = record_path.read_bytes()
    record = json.loads(record_bytes)
    request = json.loads(request_path.read_text(encoding="utf-8"))
    validate(pilot, record, request, record_bytes)
    print("P0.6 WordPress publishing semantic/interface acceptance: PASS")


if __name__ == "__main__":
    main()
