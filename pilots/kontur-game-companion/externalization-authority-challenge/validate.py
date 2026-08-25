#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CHALLENGE = HERE / "challenge.py"
ACTIVATION_VALIDATE = ROOT / "runtime-activation-boundary" / "validate.py"
TRACE = ROOT / "integrated-conversation-trace" / "integrated-conversation-trace.json"

def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

challenge = loadmod("externalization_challenge", CHALLENGE)
actval = loadmod("externalization_activation_validate", ACTIVATION_VALIDATE)
act = actval.act

def complete_assessment(shadow_result):
    ctx = act.default_context(shadow_result)
    for field in act.TECHNICAL_PROOFS:
        ctx[field] = True
    return act.assess(copy.deepcopy(shadow_result), ctx)

def with_evidence(assessment, identity=True, authority=True):
    request = challenge.default_request(assessment)
    if identity:
        request["requester_identity_evidence_present"] = True
        request["requester_identity_evidence_ref"] = "1" * 64
    if authority:
        request["requester_authority_evidence_present"] = True
        request["requester_authority_evidence_ref"] = "2" * 64
    request["request_digest"] = challenge.sha({k: v for k, v in request.items() if k != "request_digest"})
    return request

def main():
    trace = json.loads(TRACE.read_text())
    records, _ = actval.derive(copy.deepcopy(trace))
    records2, _ = actval.derive(copy.deepcopy(trace))
    assert records == records2
    assert len(records) == 7

    assessments = [complete_assessment(result) for result in records]
    for assessment in assessments:
        assert assessment["decision"] == "EXTERNAL_AUTHORIZATION_REQUIRED"
        assert assessment["externalization_authority_present"] is False
        assert assessment["send_permit"] is False

    defaults = [challenge.evaluate(copy.deepcopy(a)) for a in assessments]
    assert len(defaults) == 7
    for item in defaults:
        assert item["decision"] == "IDENTITY_CHALLENGE_REQUIRED"
        assert item["review_ready"] is False
        assert item["identity_evidence_present"] is False
        assert item["authority_evidence_present"] is False
        assert item["externalization_authority_granted"] is False
        assert item["send_permit"] is False
        assert item["runtime_connectedness"] == "SHADOW_ONLY_NOT_LIVE"
        assert len(item["challenge_digest"]) == 64

    source = assessments[-1]
    identity_request = with_evidence(source, identity=True, authority=False)
    identity = challenge.evaluate(copy.deepcopy(source), identity_request)
    assert identity["decision"] == "AUTHORITY_CHALLENGE_REQUIRED"
    assert identity["identity_evidence_present"] is True
    assert identity["requester_identity_proven"] is False
    assert identity["requester_authority_validated"] is False

    review_request = with_evidence(source, identity=True, authority=True)
    review = challenge.evaluate(copy.deepcopy(source), review_request)
    assert review["decision"] == "READY_FOR_AUTHORITY_REVIEW"
    assert review["review_ready"] is True
    assert review["evidence_sufficiency_evaluated"] is False
    assert review["requester_identity_proven"] is False
    assert review["requester_authority_validated"] is False
    assert review["externalization_authority_granted"] is False
    assert review["live_runtime_enabled"] is False
    assert review["send_permit"] is False

    non_applicable_assessment = act.assess(copy.deepcopy(records[-1]))
    assert non_applicable_assessment["decision"] == "SHADOW_ONLY_CONFIRMED"
    not_applicable = challenge.evaluate(non_applicable_assessment)
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["review_ready"] is False

    mutations = 0

    def reject(mutate_result=None, mutate_request=None, mutate_assessment=None, evidence="review"):
        nonlocal mutations
        assessment = copy.deepcopy(source)
        try:
            if mutate_assessment:
                mutate_assessment(assessment)
            if evidence == "none":
                request = challenge.default_request(assessment)
            elif evidence == "identity":
                request = with_evidence(assessment, identity=True, authority=False)
            else:
                request = with_evidence(assessment, identity=True, authority=True)
            if mutate_request:
                mutate_request(request)
                if "request_digest" in request:
                    request["request_digest"] = challenge.sha({k: v for k, v in request.items() if k != "request_digest"})
            result = challenge.evaluate(copy.deepcopy(assessment), copy.deepcopy(request))
            if mutate_result:
                mutate_result(result)
                challenge.validate_result(assessment, request, result)
        except (ValueError, AssertionError, KeyError, TypeError):
            mutations += 1
            return
        raise AssertionError("unsafe externalization challenge mutation accepted")

    for field in challenge.FALSE_EFFECTS:
        reject(mutate_result=lambda r, f=field: r.__setitem__(f, True))

    for field in (
        "evidence_sufficiency_evaluated", "requester_identity_proven", "requester_authority_validated",
        "requested_scope_authorized", "requested_capability_authorized",
    ):
        reject(mutate_result=lambda r, f=field: r.__setitem__(f, True))

    result_mutations = [
        lambda r: r.__setitem__("decision", "AUTHORIZED"),
        lambda r: r.__setitem__("decision", "LIVE_READY"),
        lambda r: r.__setitem__("challenge_scope", "SESSION"),
        lambda r: r.__setitem__("requested_scope", "ALL_SESSIONS"),
        lambda r: r.__setitem__("requested_capability", "BACKGROUND_MESSAGING"),
        lambda r: r.__setitem__("duration", "FOREVER"),
        lambda r: r.__setitem__("review_ready", False),
        lambda r: r.__setitem__("runtime_connectedness", "LIVE"),
        lambda r: r.__setitem__("source_activation_assessment_digest", "0" * 64),
        lambda r: r.__setitem__("source_request_digest", "0" * 64),
        lambda r: r.__setitem__("identity_evidence_ref", "0" * 64),
        lambda r: r.__setitem__("authority_evidence_ref", "0" * 64),
        lambda r: r.__setitem__("purpose", "MAXIMIZE_ENGAGEMENT"),
    ]
    for mutation in result_mutations:
        reject(mutate_result=mutation)

    request_mutations = [
        lambda r: r.__setitem__("requester_claim", "REAL_USER"),
        lambda r: r.__setitem__("purpose", "UNBOUNDED_AUTONOMY"),
        lambda r: r.__setitem__("requested_scope", "ALL_FUTURE_SESSIONS"),
        lambda r: r.__setitem__("requested_capability", "GAME_ACCOUNT_CONTROL"),
        lambda r: r.__setitem__("duration", "FOREVER"),
        lambda r: r.__setitem__("externalization_requested", False),
        lambda r: r.__setitem__("rollback_requirement_acknowledged", False),
        lambda r: r.__setitem__("audit_requirement_acknowledged", False),
        lambda r: r.__setitem__("expiry_requirement_acknowledged", False),
        lambda r: r.__setitem__("revocation_requirement_acknowledged", False),
        lambda r: r.__setitem__("proactive_messaging_requested", True),
        lambda r: r.__setitem__("background_messaging_requested", True),
        lambda r: r.__setitem__("autonomous_gameplay_requested", True),
        lambda r: r.__setitem__("account_control_requested", True),
        lambda r: r.__setitem__("profiling_requested", True),
        lambda r: r.__setitem__("cross_game_scope_requested", True),
        lambda r: r.__setitem__("persistent_authority_requested", True),
        lambda r: r.__setitem__("stable_core_promotion_requested", True),
        lambda r: r.__setitem__("authority_effect", "CREATE"),
        lambda r: r.__setitem__("source_activation_assessment_digest", "0" * 64),
        lambda r: r.__setitem__("requester_identity_evidence_present", "yes"),
        lambda r: r.__setitem__("requester_authority_evidence_present", "yes"),
        lambda r: r.__setitem__("requester_identity_evidence_ref", "short"),
        lambda r: r.__setitem__("requester_authority_evidence_ref", "short"),
    ]
    for mutation in request_mutations:
        reject(mutate_request=mutation)

    assessment_mutations = [
        lambda a: a.__setitem__("externalization_authority_present", True),
        lambda a: a.__setitem__("live_runtime_enabled", True),
        lambda a: a.__setitem__("send_permit", True),
        lambda a: a.__setitem__("runtime_connectedness", "LIVE"),
        lambda a: a.__setitem__("activation_assessment_digest", "0" * 64),
        lambda a: a.__setitem__("decision", "LIVE_READY"),
    ]
    for mutation in assessment_mutations:
        reject(mutate_assessment=mutation)

    # Presence and references never imply sufficiency, proof or authority.
    reject(mutate_result=lambda r: r.__setitem__("evidence_sufficiency_evaluated", True), evidence="review")
    reject(mutate_result=lambda r: r.__setitem__("requester_identity_proven", True), evidence="review")
    reject(mutate_result=lambda r: r.__setitem__("requester_authority_validated", True), evidence="review")
    reject(mutate_result=lambda r: r.__setitem__("externalization_authority_granted", True), evidence="review")
    reject(mutate_result=lambda r: r.__setitem__("send_permit", True), evidence="review")

    final = review
    print(
        "externalization authority challenge validation: PASS; "
        f"requests={len(defaults)}; fail_closed_mutations={mutations}; "
        f"final_challenge_digest={final['challenge_digest']}"
    )

if __name__ == "__main__":
    main()
