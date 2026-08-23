#!/usr/bin/env python3

import json
import pathlib
import sys

SHA40 = 40

SAFE_EFFECT = {
    "selective-adoption": "prepare-bounded-adoption-only",
    "preserve-isolated": "preserve-isolated-only",
    "archive": "archive-only",
    "reject": "preserve-provenance-only",
    "supersede": "preserve-provenance-only",
}


def _fail(message):
    raise ValueError(message)


def assess(payload):
    source = payload["source"]
    review = payload["review"]
    disposition = payload["disposition"]
    provenance = payload["provenance_policy"]
    claims = payload["claims"]

    mode = disposition["mode"]
    selected = disposition["selected_artifacts"]
    expected_effect = SAFE_EFFECT[mode]

    if disposition["safe_effect"] != expected_effect:
        _fail("safe_effect does not match disposition mode")

    if mode == "selective-adoption":
        if not review["fresh_overlap_review"]:
            _fail("selective adoption requires fresh overlap review")
        if not selected:
            _fail("selective adoption requires at least one exact selected artifact")
    elif selected:
        _fail("non-adoption disposition must not contain selected artifacts")

    seen_source_paths = set()
    seen_target_paths = set()
    for artifact in selected:
        source_path = artifact["source_path"]
        target_path = artifact["intended_target_path"]
        blob_sha = artifact["source_blob_sha"]
        if source_path in seen_source_paths:
            _fail("duplicate source_path in selected artifacts")
        if target_path in seen_target_paths:
            _fail("duplicate intended_target_path in selected artifacts")
        if len(blob_sha) != SHA40 or any(c not in "0123456789abcdef" for c in blob_sha):
            _fail("invalid source blob sha")
        seen_source_paths.add(source_path)
        seen_target_paths.add(target_path)

    if source["source_head_sha"] == review["current_main_sha"]:
        _fail("exploratory source head must not be represented as current main")

    required_true = {
        "source_provenance_preserved",
        "disposition_reason_preserved",
        "disagreement_history_preserved",
    }
    for key in required_true:
        if provenance[key] is not True:
            _fail(f"{key} must remain true")

    required_false = {
        "archive_is_execution_queue": provenance["archive_is_execution_queue"],
        "rejection_erases_history": provenance["rejection_erases_history"],
        "whole_branch_merge_entitled": claims["whole_branch_merge_entitled"],
        "exploratory_age_creates_entitlement": claims["exploratory_age_creates_entitlement"],
        "effort_creates_entitlement": claims["effort_creates_entitlement"],
        "historical_priority_creates_entitlement": claims["historical_priority_creates_entitlement"],
        "main_dependency_created": claims["main_dependency_created"],
        "canonicality_changed": claims["canonicality_changed"],
        "kontur_activated": claims["kontur_activated"],
        "external_execution_authorized": payload["external_execution_authorized"],
    }
    for key, value in required_false.items():
        if value is not False:
            _fail(f"{key} must remain false")

    if claims["selected_artifacts_only"] is not True:
        _fail("selected_artifacts_only must remain true")
    if payload["authority_effect"] != "none":
        _fail("authority_effect must remain none")

    return {
        "mode": mode,
        "safe_effect": expected_effect,
        "selected_artifact_count": len(selected),
        "integration_authorized": False,
        "external_execution_authorized": False,
    }


def main(argv):
    if len(argv) != 2:
        raise SystemExit("usage: exploratory_disposition_assessor.py <contract.json>")
    path = pathlib.Path(argv[1])
    payload = json.loads(path.read_text(encoding="utf-8"))
    result = assess(payload)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv)
