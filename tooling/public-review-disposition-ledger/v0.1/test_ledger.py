#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]

spec = importlib.util.spec_from_file_location("ledger_validator", HERE / "validate_ledger.py")
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


ledger = load(HERE / "ledger.json")
result = load(ROOT / "pilots/core-pilot-002/run-001/result/v0.1/result.json")
stage_b = load(ROOT / "protocols/responsibility-status-provenance/v0.1/implementation-receipt.json")
stage_c = load(ROOT / "protocols/responsibility-assurance/v0.1/implementation-receipt.json")
impl = load(HERE / "implementation-receipt.json")

module.validate_data(ledger, result, stage_b, stage_c, impl, verify_git=False)

cases = []


def add(name, target, mutate):
    cases.append((name, target, mutate))


add("source-comment", "ledger", lambda x: x["entries"][0]["source"].__setitem__("comment_id", 1))
add("source-digest", "ledger", lambda x: x["entries"][0]["source"].__setitem__("body_sha256", "0" * 64))
add("result-blob", "ledger", lambda x: x["entries"][0]["machine_result"].__setitem__("blob", "0" * 40))
add("result-class", "ledger", lambda x: x["entries"][0]["machine_result"].__setitem__("result_class", "TRUTH_CONFIRMED"))
add("disposition-reclassified", "ledger", lambda x: x["entries"][0]["disposition"].__setitem__("source_disposition_state", "accepted"))
add("editorial-bucket-invented", "ledger", lambda x: x["entries"][0]["disposition"].__setitem__("editorial_bucket", "accepted"))
add("objection-erased", "ledger", lambda x: x["entries"][0]["disposition"].__setitem__("objection_preserved", False))
add("normative-authority", "ledger", lambda x: x["entries"][0]["disposition"].__setitem__("normative_change_authorized", True))
add("decision-comment", "ledger", lambda x: x["entries"][0]["normative_resolution"].__setitem__("decision_comment_id", 1))
add("decision-digest", "ledger", lambda x: x["entries"][0]["normative_resolution"].__setitem__("decision_comment_body_sha256", "0" * 64))
add("decision-sequence", "ledger", lambda x: x["entries"][0]["normative_resolution"].__setitem__("selected_sequence", "A"))
add("stage-b-frontier", "ledger", lambda x: x["entries"][0]["normative_resolution"]["stage_b"].__setitem__("accepted_frontier", "0" * 40))
add("stage-c-blob", "ledger", lambda x: x["entries"][0]["normative_resolution"]["stage_c"].__setitem__("implementation_receipt_blob", "0" * 40))
add("synthetic-extra-entry", "ledger", lambda x: x["entries"].append(copy.deepcopy(x["entries"][0])))
add("broader-review-closed", "ledger", lambda x: x["summary"].__setitem__("broader_public_review_complete", True))
add("truth-escalation", "ledger", lambda x: x["boundaries"].__setitem__("claim_truth_established", True))
add("authority-escalation", "ledger", lambda x: x["boundaries"].__setitem__("reviewer_authority_established", True))
add("certification-escalation", "ledger", lambda x: x["boundaries"].__setitem__("certification_established", True))
add("release-effect", "ledger", lambda x: x["non_effects"].__setitem__("release_or_tag_created", True))
add("source-promoted-truth", "result", lambda x: x["interpretation"].__setitem__("accepted_as_truth", True))
add("source-disposition-changed", "result", lambda x: x["disposition"].__setitem__("state", "rejected"))
add("stage-b-decision-drift", "stage_b", lambda x: x["human_design_gate"].__setitem__("decision", "A"))
add("stage-c-identity-promotion", "stage_c", lambda x: x["human_design_gate"].__setitem__("decision_actor_identity_status", "VERIFIED"))
add("stage-c-stage-b-drift", "stage_c", lambda x: x["accepted_stage_b"].__setitem__("implementation_receipt_blob", "0" * 40))
add("impl-editorial-authority", "impl", lambda x: x["index_contract"].__setitem__("creates_editorial_bucket", True))
add("impl-review-closure", "impl", lambda x: x["index_contract"].__setitem__("broader_public_review_completed", True))

for name, target, mutate in cases:
    l = copy.deepcopy(ledger)
    r = copy.deepcopy(result)
    b = copy.deepcopy(stage_b)
    c = copy.deepcopy(stage_c)
    i = copy.deepcopy(impl)
    obj = {"ledger": l, "result": r, "stage_b": b, "stage_c": c, "impl": i}[target]
    mutate(obj)
    try:
        module.validate_data(l, r, b, c, i, verify_git=False)
    except (ValueError, Exception) as exc:
        if isinstance(exc, AssertionError):
            raise
        continue
    raise AssertionError(f"hostile mutation unexpectedly accepted: {name}")

print(f"PUBLIC_REVIEW_DISPOSITION_LEDGER_V0_1_TESTS_PASS hostile={len(cases)}")
