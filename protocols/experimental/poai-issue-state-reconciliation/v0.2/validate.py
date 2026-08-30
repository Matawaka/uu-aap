import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
AUDIT_PATH = HERE / "audit.json"

EXPECTED_RESEARCH = {"#34", "#37", "#38", "#45", "#49", "#55", "#60", "#64", "#69"}
EXPECTED_CHECKPOINT = {"#75"}
EXPECTED_ACCEPTANCE = {"#43", "#47", "#51", "#57", "#62", "#66"}
ALLOWED_RELATIONS = {"REUSED", "SUPERSEDED_BY"}


def git_blob_sha(path: Path) -> str:
    data = path.read_bytes()
    header = f"blob {len(data)}\0".encode()
    return hashlib.sha1(header + data).hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def reject(msg: str):
    raise AssertionError(msg)


def validate(audit):
    if audit.get("type") != "LegacyPoAI31IssueStateAudit" or audit.get("version") != "0.1":
        reject("unexpected audit type/version")

    source_path = ROOT / audit["source_map"]["path"]
    checkpoint_path = ROOT / audit["checkpoint"]["path"]
    if not source_path.is_file() or not checkpoint_path.is_file():
        reject("bound source evidence missing")
    if git_blob_sha(source_path) != audit["source_map"]["blob_sha"]:
        reject("source-map bytes changed")
    if git_blob_sha(checkpoint_path) != audit["checkpoint"]["blob_sha"]:
        reject("checkpoint bytes changed")

    source = load_json(source_path)
    checkpoint = checkpoint_path.read_text(encoding="utf-8")
    entries = {e["family"]: e for e in source["entries"]}

    decisions = audit.get("decisions", [])
    issues = [d["issue"] for d in decisions]
    if len(issues) != len(set(issues)):
        reject("duplicate issue decision")

    research = {d["issue"] for d in decisions if d["class"] == "research_rfc"}
    checkpoint_tasks = {d["issue"] for d in decisions if d["class"] == "checkpoint_task"}
    acceptance = {d["issue"] for d in decisions if d["class"] == "live_acceptance_boundary"}
    if research != EXPECTED_RESEARCH or checkpoint_tasks != EXPECTED_CHECKPOINT or acceptance != EXPECTED_ACCEPTANCE:
        reject("candidate set drift")

    for d in decisions:
        family = entries.get(d["family"])
        if not family:
            reject(f"unknown family for {d['issue']}")
        if d["issue"] not in family["legacy_issues"]:
            reject(f"issue/family mismatch for {d['issue']}")

        if d["class"] == "research_rfc":
            if d["decision"] != "CLOSE_COMPLETED":
                reject("research RFC decision drift")
            if family["relation"] not in ALLOWED_RELATIONS or not family.get("current_refs"):
                reject("research RFC lacks reusable/superseding successor evidence")
            for ref in family["current_refs"]:
                if not (ROOT / ref).exists():
                    reject(f"current successor ref missing: {ref}")
        elif d["class"] == "live_acceptance_boundary":
            if d["decision"] != "PRESERVE_OPEN":
                reject("live acceptance may not close from semantic successor evidence")
        elif d["class"] == "checkpoint_task":
            if d["decision"] != "CLOSE_COMPLETED":
                reject("checkpoint task decision drift")
            if "#75" not in family["legacy_issues"]:
                reject("checkpoint family mismatch")
        else:
            reject("unknown decision class")

    required_checkpoint_text = [
        "accepted Level 3.1 successor line",
        "Decision -> Review -> Appeal Request -> Adjudication -> Execution Report -> Execution Verification -> Observed Outcome -> Successor Proposal",
        "Issue #71 is fully completed. Earlier live-checklist issues #43, #47, #51, #57, #62 and #66 remain open only for additional boundary coverage",
        "does **not** claim PoAI/V conformance",
        "The tag, if created, should point exactly to the checkpoint commit above. It must not be moved later.",
    ]
    for text in required_checkpoint_text:
        if text not in checkpoint:
            reject(f"checkpoint evidence missing: {text}")

    auth = audit.get("closure_authorization", {})
    if auth.get("after_green_merge_only") is not True:
        reject("closure must remain post-green-merge only")
    if set(auth.get("authorized_completed_issues", [])) != EXPECTED_RESEARCH | EXPECTED_CHECKPOINT:
        reject("closure authorization drift")
    if set(auth.get("must_remain_open_issues", [])) != EXPECTED_ACCEPTANCE:
        reject("preserve-open authorization drift")

    non_effects = audit.get("non_effects", {})
    if not non_effects or any(v is not False for v in non_effects.values()):
        reject("non-effects must remain explicitly false")


def mutation_suite(base):
    mutations = []

    m = copy.deepcopy(base)
    next(d for d in m["decisions"] if d["issue"] == "#43")["decision"] = "CLOSE_COMPLETED"
    mutations.append(m)

    m = copy.deepcopy(base)
    m["closure_authorization"]["must_remain_open_issues"] = ["#47", "#51", "#57", "#62", "#66"]
    mutations.append(m)

    m = copy.deepcopy(base)
    m["source_map"]["blob_sha"] = "0" * 40
    mutations.append(m)

    m = copy.deepcopy(base)
    m["checkpoint"]["blob_sha"] = "0" * 40
    mutations.append(m)

    m = copy.deepcopy(base)
    m["non_effects"]["external_effect_authority_created"] = True
    mutations.append(m)

    m = copy.deepcopy(base)
    m["decisions"].append({"issue":"#28","class":"research_rfc","family":"LEGACY_LEVEL_31_4_LABELS_AS_MATURITY_HIERARCHY","decision":"CLOSE_COMPLETED"})
    mutations.append(m)

    for i, mutation in enumerate(mutations):
        try:
            validate(mutation)
        except AssertionError:
            continue
        reject(f"mutation {i} was not rejected")


if __name__ == "__main__":
    audit = load_json(AUDIT_PATH)
    validate(audit)
    mutation_suite(audit)
    print("Legacy PoAI 3.1 issue-state admission audit: PASS")
