#!/usr/bin/env python3
"""Validate UU-AAP IP registration records and fail closed on legal-readiness claims."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


SCHEMA_PATH = Path(__file__).with_name("ip-rights-registration-record.schema.json")

RIGHTS_CLEARED_STATES = {
    "RIGHTS_CLEARED",
    "PATENT_SCREEN",
    "READY_TO_FILE",
    "FILED",
    "OFFICE_ACTION",
    "REGISTERED",
    "REFUSED",
    "WITHDRAWN",
}

FILING_READY_STATES = {
    "READY_TO_FILE",
    "FILED",
    "OFFICE_ACTION",
    "REGISTERED",
    "REFUSED",
    "WITHDRAWN",
}

FILED_STATES = {
    "FILED",
    "OFFICE_ACTION",
    "REGISTERED",
    "REFUSED",
    "WITHDRAWN",
}

UNRESOLVED_PATENT_STATES = {
    "PATENT_CANDIDATE_REVIEW_REQUIRED",
    "ALREADY_PUBLIC_DISCLOSURE_REVIEW_REQUIRED",
}

INVALID_RIGHT_HOLDER_BASES_FOR_EXCLUSIVE_FILING = {
    "LICENSED_ONLY",
    "PUBLIC_DOMAIN_OR_NO_COPYRIGHT",
    "THIRD_PARTY",
    "UNKNOWN",
}

READY_FEE_STATES = {"PAYMENT_READY", "PAID", "EXEMPT"}


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def filing_readiness_errors(readiness: dict | None) -> list[str]:
    if not readiness:
        return ["READY_TO_FILE or filing-lifecycle state requires filing_readiness evidence"]

    errors: list[str] = []
    if readiness.get("status") != "COMPLETE":
        errors.append("READY_TO_FILE or filing-lifecycle state requires filing_readiness.status=COMPLETE")
    if not readiness.get("private_packet_digest"):
        errors.append("READY_TO_FILE or filing-lifecycle state requires a private filing packet digest")

    required_true = {
        "official_form_finalized": "official form must be finalized",
        "personal_data_consent_complete": "personal-data consent must be complete",
        "author_consent_resolved": "author consent/mention choice must be resolved",
        "representative_authority_resolved": "representative/authority state must be resolved",
        "route_selected": "filing route must be selected",
        "signature_method_confirmed": "signature method must be confirmed",
        "consistency_verified": "title/abstract/deposit/right-holder/author consistency must be verified",
    }
    for field, message in required_true.items():
        if readiness.get(field) is not True:
            errors.append(f"READY_TO_FILE or filing-lifecycle state requires {message}")

    if readiness.get("fee_status") not in READY_FEE_STATES:
        errors.append("READY_TO_FILE or filing-lifecycle state requires fee status PAYMENT_READY, PAID, or EXEMPT")
    return errors


def semantic_errors(record: dict) -> list[str]:
    errors: list[str] = []
    state = record["state"]
    rights = record["rights_review"]
    patent = record["patentability"]
    anchor = record["evidence_anchor"]

    if state in RIGHTS_CLEARED_STATES:
        if rights["status"] != "CLEARED":
            errors.append("RIGHTS_CLEARED or filing-lifecycle state requires rights_review.status=CLEARED")
        if rights["third_party_status"] not in {"CLEARED", "EXCLUDED"}:
            errors.append("RIGHTS_CLEARED or filing-lifecycle state requires third-party material CLEARED or EXCLUDED")
        if not rights["authors"]:
            errors.append("RIGHTS_CLEARED or filing-lifecycle state requires at least one verified author record")
        if not rights["right_holders"]:
            errors.append("RIGHTS_CLEARED or filing-lifecycle state requires at least one verified right-holder record")
        for party in rights["authors"] + rights["right_holders"]:
            if party["basis"] == "UNKNOWN" or party["name"].startswith("TO_BE_"):
                errors.append("RIGHTS_CLEARED or filing-lifecycle state cannot contain unresolved author/right-holder identity or basis")
                break

    if state in FILING_READY_STATES:
        if patent["status"] in UNRESOLVED_PATENT_STATES:
            errors.append("READY_TO_FILE or filing-lifecycle state requires the patentability/public-disclosure review to be resolved")
        if str(anchor["package_digest"]).startswith("TO_BE_"):
            errors.append("READY_TO_FILE or filing-lifecycle state requires a frozen package digest")
        for holder in rights["right_holders"]:
            if holder["basis"] in INVALID_RIGHT_HOLDER_BASES_FOR_EXCLUSIVE_FILING:
                errors.append(
                    "READY_TO_FILE or filing-lifecycle state cannot present LICENSED_ONLY, PUBLIC_DOMAIN, THIRD_PARTY, or UNKNOWN basis as an exclusive right holder"
                )
                break
        if record["registration_intent"]["decision"] not in {"PLANNED", "FILED"}:
            errors.append("READY_TO_FILE or filing-lifecycle state requires an active filing decision")
        errors.extend(filing_readiness_errors(record.get("filing_readiness")))

    if state in FILED_STATES:
        filing = record.get("filing")
        if not filing:
            errors.append("FILED/OFFICE_ACTION/terminal filing state requires a filing receipt")
        else:
            if not filing.get("application_number"):
                errors.append("filed state requires filing.application_number")
            if not filing.get("filing_date"):
                errors.append("filed state requires filing.filing_date")
            if not filing.get("external_receipt_ref"):
                errors.append("filed state requires filing.external_receipt_ref")

    if state == "REGISTERED":
        outcome = record.get("outcome")
        if not outcome or outcome.get("status") != "REGISTERED":
            errors.append("REGISTERED requires outcome.status=REGISTERED")
        elif not outcome.get("registration_number") or not outcome.get("decision_date"):
            errors.append("REGISTERED requires registration number and decision date")

    return errors


def validate_record(path: Path) -> list[str]:
    schema = _load_json(SCHEMA_PATH)
    record = _load_json(path)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = [f"schema: {err.message}" for err in sorted(validator.iter_errors(record), key=lambda e: list(e.path))]
    if not errors:
        errors.extend(f"semantic: {err}" for err in semantic_errors(record))
    return errors


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: ip_registration_validator.py RECORD.json [RECORD.json ...]", file=sys.stderr)
        return 2

    failed = False
    for raw in argv[1:]:
        path = Path(raw)
        errors = validate_record(path)
        if errors:
            failed = True
            print(f"FAIL {path}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"PASS {path}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
