#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
MODULE_PATH = ROOT / "schemas/ip/v0.1/ip_registration_validator.py"
EXAMPLE_PATH = ROOT / "schemas/ip/v0.1/examples/uu-aap-core-registration-plan.json"

spec = importlib.util.spec_from_file_location("ip_registration_validator", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


def base_record() -> dict:
    return json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))


def make_ready_to_file(record: dict) -> dict:
    r = copy.deepcopy(record)
    r["state"] = "READY_TO_FILE"
    r["evidence_anchor"]["package_digest"] = "a" * 64
    r["rights_review"] = {
        "status": "CLEARED",
        "authors": [
            {
                "name": "private-party:test-author-1",
                "basis": "AUTHOR_OWNED",
                "contribution_scope": "Selected deposited source",
                "evidence_ref": "private-rights-evidence:author-1"
            }
        ],
        "right_holders": [
            {
                "name": "private-party:test-author-1",
                "basis": "AUTHOR_OWNED",
                "contribution_scope": "Selected deposited source",
                "evidence_ref": "private-rights-evidence:right-holder-1"
            }
        ],
        "third_party_status": "EXCLUDED",
        "unresolved_items": []
    }
    r["patentability"] = {
        "status": "NOT_PATENT_CANDIDATE",
        "reviewed_at": "2026-08-25T00:00:00Z",
        "reviewer_or_authority": "recorded-review",
        "notes": "Software-registration scope only."
    }
    return r


def test_current_patent_screen_example_is_valid() -> None:
    record = base_record()
    assert record["state"] == "PATENT_SCREEN"
    assert record["rights_review"]["status"] == "CLEARED"
    assert record["patentability"]["status"] == "SEPARATE_PATENT_TRACK"
    assert record["evidence_anchor"]["package_digest"].startswith("sha256:")
    assert module.validate_record(EXAMPLE_PATH) == []


def test_ready_to_file_fails_closed_if_rights_are_reopened() -> None:
    record = base_record()
    record["state"] = "READY_TO_FILE"
    record["rights_review"]["status"] = "IN_REVIEW"
    record["rights_review"]["third_party_status"] = "UNKNOWN"
    record["rights_review"]["authors"] = [
        {
            "name": "TO_BE_REVERIFIED",
            "basis": "UNKNOWN",
            "contribution_scope": "Reopened test state",
            "evidence_ref": "test"
        }
    ]
    record["rights_review"]["right_holders"] = [
        {
            "name": "TO_BE_REVERIFIED",
            "basis": "UNKNOWN",
            "contribution_scope": "Reopened test state",
            "evidence_ref": "test"
        }
    ]
    errors = module.semantic_errors(record)
    assert errors
    assert any("rights_review.status=CLEARED" in error for error in errors)
    assert any("third-party material CLEARED or EXCLUDED" in error for error in errors)
    assert any("unresolved author/right-holder identity or basis" in error for error in errors)


def test_ready_to_file_still_requires_patent_screen_and_frozen_digest() -> None:
    record = base_record()
    record["state"] = "READY_TO_FILE"
    record["patentability"]["status"] = "ALREADY_PUBLIC_DISCLOSURE_REVIEW_REQUIRED"
    record["evidence_anchor"]["package_digest"] = "TO_BE_FROZEN"
    errors = module.semantic_errors(record)
    assert any("patentability/public-disclosure review" in error for error in errors)
    assert any("frozen package digest" in error for error in errors)


def test_ready_to_file_accepts_resolved_evidence() -> None:
    record = make_ready_to_file(base_record())
    assert module.semantic_errors(record) == []


def test_separate_patent_track_is_resolved_for_software_filing_gate() -> None:
    record = base_record()
    record["state"] = "READY_TO_FILE"
    record["patentability"]["status"] = "SEPARATE_PATENT_TRACK"
    assert module.semantic_errors(record) == []


def test_licensed_only_holder_cannot_be_claimed_as_exclusive_holder() -> None:
    record = make_ready_to_file(base_record())
    record["rights_review"]["right_holders"][0]["basis"] = "LICENSED_ONLY"
    errors = module.semantic_errors(record)
    assert any("LICENSED_ONLY" in error for error in errors)


def test_filed_requires_external_receipt() -> None:
    record = make_ready_to_file(base_record())
    record["state"] = "FILED"
    record["registration_intent"]["decision"] = "FILED"
    record["filing"] = {
        "application_number": "2026999999",
        "filing_date": "2026-08-25",
        "fee_rub": 5000,
        "package_digest": "a" * 64,
        "external_receipt_ref": None
    }
    errors = module.semantic_errors(record)
    assert any("external_receipt_ref" in error for error in errors)


def test_registered_requires_registration_outcome() -> None:
    record = make_ready_to_file(base_record())
    record["state"] = "REGISTERED"
    record["registration_intent"]["decision"] = "FILED"
    record["filing"] = {
        "application_number": "2026999999",
        "filing_date": "2026-08-25",
        "fee_rub": 5000,
        "package_digest": "a" * 64,
        "external_receipt_ref": "private-filing-receipt:2026999999"
    }
    record["outcome"] = {
        "registration_number": None,
        "decision_date": None,
        "status": "PENDING",
        "successor_record_id": None
    }
    errors = module.semantic_errors(record)
    assert any("outcome.status=REGISTERED" in error for error in errors)


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
