#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

import validate as V

HERE = Path(__file__).resolve().parent
SOURCE = json.loads((HERE / "source-observation.json").read_text(encoding="utf-8"))
AUDIT = json.loads((HERE / "audit.json").read_text(encoding="utf-8"))

passed = 0


def ok(name, fn):
    global passed
    fn()
    passed += 1
    print(f"PASS {name}")


def reject(name, fn):
    global passed
    threw = False
    try:
        fn()
    except ValueError:
        threw = True
    if not threw:
        raise AssertionError(f"expected rejection: {name}")
    passed += 1
    print(f"PASS reject {name}")


ok("accepted frozen source metadata", lambda: V.validate_source(copy.deepcopy(SOURCE), check_git=False))
ok("accepted audit verdict", lambda: V.validate_audit(copy.deepcopy(AUDIT)))


def source_mut(path, value):
    s = copy.deepcopy(SOURCE)
    target = s
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    return lambda: V.validate_source(s, check_git=False)


def audit_mut(path, value):
    a = copy.deepcopy(AUDIT)
    target = a
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    return lambda: V.validate_audit(a)


reject("open external issue promoted to C2PA adoption", source_mut(["c2pa_issue","proposal_observations","c2pa_spec_adoption_established"], True))
reject("unaffiliated comment promoted to maintainer endorsement", source_mut(["new_comment","observed_requirements","c2pa_maintainer_endorsement_established"], True))
reject("comment author association rewritten", source_mut(["new_comment","author_association"], "MEMBER"))
reject("external comment digest substituted", source_mut(["new_comment","body_sha256"], "0" * 64))
reject("reference repository mechanism treated as verified security property", source_mut(["reference_repository","readme_observations","mechanism_security_property_verified_by_this_audit"], True))
reject("#900 internal nonclaim rewritten", source_mut(["accepted_internal_boundary","required_invariant"], "Observed branch divergence proves global equivocation"))

reject("claim commitment layer promoted to executable evidence", lambda: V.validate_audit((lambda a: (a["evidence_layers"].__setitem__(1, {**a["evidence_layers"][1], "actual_executable_evidence_supplied": True}) or a))(copy.deepcopy(AUDIT))))
reject("log inclusion promoted to executable evidence", lambda: V.validate_audit((lambda a: (a["evidence_layers"].__setitem__(2, {**a["evidence_layers"][2], "actual_executable_evidence_supplied": True}) or a))(copy.deepcopy(AUDIT))))
reject("append-only consistency evidence requirement removed", audit_mut(["future_receipt_requirements","append_only_consistency_evidence_required"], False))
reject("checkpoint non-equivocation evidence requirement removed", audit_mut(["future_receipt_requirements","checkpoint_non_equivocation_evidence_required"], False))
reject("collision relation requirement removed", audit_mut(["future_receipt_requirements","collision_relation_must_be_explicit"], False))
reject("selective submission limit erased", audit_mut(["future_receipt_requirements","selective_submission_or_coverage_limit_must_remain_explicit"], False))
reject("global non-equivocation silently proven", audit_mut(["current_result","global_non_equivocation_proven"], True))
reject("complete history silently proven", audit_mut(["current_result","complete_history_proven"], True))
reject("all manifests submitted silently proven", audit_mut(["current_result","all_manifests_submitted_proven"], True))
reject("trusted time silently proven", audit_mut(["current_result","trusted_time_proven"], True))
reject("canonical branch selected", audit_mut(["current_result","canonical_branch_selected"], True))
reject("malicious behavior inferred", audit_mut(["current_result","malicious_behavior_proven"], True))
reject("authority created", audit_mut(["current_result","authority_created"], True))
reject("external anchor receipt admitted without proof", audit_mut(["current_result","external_anchor_receipt_admitted"], True))
reject("automatic remediation authorized", audit_mut(["current_result","automatic_remediation_authorized"], True))
reject("Stable Core admission invented", audit_mut(["current_result","stable_core_admission"], True))
reject("wrong next gate", audit_mut(["next_gate"], "DEPLOY_TRANSPARENCY_LOG"))


def score_injection():
    a = copy.deepcopy(AUDIT)
    a["current_result"]["trust_score"] = 1.0
    V.validate_audit(a)

reject("scalar trust score injection", score_injection)

print(f"EXTERNAL_ANCHOR_SUFFICIENCY_AUDIT_HOSTILE: {passed}/{passed} PASS")
