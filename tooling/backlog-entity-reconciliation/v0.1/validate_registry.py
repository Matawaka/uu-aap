#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
REGISTRY_PATH = HERE / "registry.json"
SCHEMA_PATH = HERE / "registry.schema.json"
IMPL_PATH = HERE / "implementation-receipt.json"

ORIGIN = "1a5232fc3d3af8b6bc41de78a510e1ac9129c50a"
PHRASE = "exact materialization not found in bounded current audit"
ROADMAP_PATH = "docs/ROADMAP-CURRENT.md"
ROADMAP_BLOB = "6063ce07c479c6a59c78091e4212fc5d09c27a04"
ATTENTION_PATH = "pilots/kontur-game-companion/non-binding-attention-v0.1/README.md"
ATTENTION_BLOB = "c1fa727f87a54ac6810d9d4e9f11474aea88e1b8"

EXPECTED = {
    "non-binding-attention": ("Non-Binding Attention", "IMPLEMENTED"),
    "no-silent-reinterpretation": ("No Silent Reinterpretation", "INVARIANT"),
    "pause-freeze-resume": ("Pause/Freeze/Resume", "PARTIALLY_COVERED"),
    "rerc": ("RERC / Reversible Epistemic Redundancy Control", "NEW_CANDIDATE"),
    "event-responsive-dormancy": ("Event-Responsive Dormancy", "NEW_CANDIDATE"),
    "scaf": ("SCAF / Spatiotemporal Causal Affordance Fabric", "EXPLORATORY"),
    "cpot": ("CPOT / Continuity-Preserving Ordinal Transition", "EXPLORATORY"),
    "immune-tremor": ("Immune Tremor", "EXPLORATORY"),
    "conscious-ai": ("Conscious AI", "EXPLORATORY"),
    "workbench": ("Workbench", "PAUSED"),
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str):
    if not condition:
        raise ValueError(message)


def git_blob(ref: str, path: str) -> str:
    return subprocess.check_output(["git", "rev-parse", f"{ref}:{path}"], cwd=ROOT, text=True).strip()


def validate_data(registry: dict, impl: dict, verify_git: bool = True):
    schema = load(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(registry), key=lambda e: list(e.absolute_path))
    if errors:
        raise ValueError("registry schema validation failed: " + errors[0].message)

    require(registry["origin_frontier"] == ORIGIN, "origin frontier drift")
    scope = registry["audit_scope"]
    require(scope["bounded_exact_materialization_statement"] == PHRASE, "bounded audit phrase drift")
    require(scope["bounded_current_audit"] is True, "audit must remain bounded")
    require(scope["code_search_completeness_claimed"] is False, "code-search completeness overclaimed")
    require(scope["absence_inference_allowed"] is False, "bounded search promoted to absence inference")

    hb = registry["historical_boundaries"]
    require(hb["backlog_reconciliation_issue"] == 697, "historical #697 binding drift")
    require(hb["backlog_reconciliation_rewritten"] is False, "historical #697 rewritten")
    require(hb["backlog_reconciliation_semantic_authority"] is False, "#697 promoted to semantic authority")
    require(hb["external_review_issue"] == 422, "historical #422 binding drift")
    require(hb["external_review_reinterpreted"] is False, "#422 reinterpreted")
    require(hb["new_external_review_disposition_created"] is False, "registry created a #422 disposition")

    entities = registry["entities"]
    by_id = {e["id"]: e for e in entities}
    require(len(entities) == 10 and len(by_id) == 10, "entity count or duplicate id drift")
    require(len({e["name"] for e in entities}) == 10, "duplicate entity name")
    require(set(by_id) == set(EXPECTED), "fixed v0.1 entity set drift")

    for entity_id, (name, classification) in EXPECTED.items():
        e = by_id[entity_id]
        require(e["name"] == name, f"{entity_id}: name drift")
        require(e["classification"] == classification, f"{entity_id}: classification drift")
        require(not any(e["authority_effects"].values()), f"{entity_id}: authority escalation")
        issue_refs = [b["issue_number"] for b in e["source_bindings"] if b["kind"] == "ISSUE"]
        require(697 not in issue_refs, f"{entity_id}: historical #697 used as entity semantic authority")
        require(422 not in issue_refs, f"{entity_id}: #422 used as entity semantic authority")

    attention = by_id["non-binding-attention"]
    require(attention["materialization_status"] == "IMPLEMENTATION_BOUND", "attention materialization drift")
    require(any(b.get("issue_number") == 755 for b in attention["source_bindings"]), "attention issue #755 missing")
    require(any(b.get("pr_number") == 756 for b in attention["source_bindings"]), "attention PR #756 missing")
    require(any(b.get("path") == ATTENTION_PATH and b.get("blob") == ATTENTION_BLOB for b in attention["source_bindings"]), "attention blob binding missing")

    invariant = by_id["no-silent-reinterpretation"]
    require(invariant["materialization_status"] == "SEMANTIC_INVARIANT_BOUND", "invariant materialization drift")
    require(invariant["exact_term_audit"] == PHRASE, "invariant exact-term phrase drift")
    require(any(b.get("issue_number") == 852 for b in invariant["source_bindings"]), "invariant issue #852 missing")
    require(any(b.get("path") == ROADMAP_PATH and b.get("blob") == ROADMAP_BLOB for b in invariant["source_bindings"]), "invariant roadmap binding missing")

    partial = by_id["pause-freeze-resume"]
    require(partial["materialization_status"] == "PARTIAL_IMPLEMENTATION_BOUND", "partial materialization drift")
    require(any(b.get("issue_number") == 144 for b in partial["source_bindings"]), "CCRP/C4 #144 missing")
    require(partial["covered_scope"] and partial["uncovered_scope"], "partial coverage scopes missing")
    require(any("Freeze" in item for item in partial["uncovered_scope"]), "Freeze semantic remainder hidden")

    for entity_id in ("rerc", "event-responsive-dormancy", "scaf", "cpot", "immune-tremor", "conscious-ai"):
        e = by_id[entity_id]
        require(e["materialization_status"] == "NOT_FOUND_IN_BOUNDED_CURRENT_AUDIT", f"{entity_id}: bounded materialization state drift")
        require(e["exact_term_audit"] == PHRASE, f"{entity_id}: bounded phrase drift")
        require(e["source_bindings"] == [], f"{entity_id}: invented current source binding")

    workbench = by_id["workbench"]
    require(workbench["materialization_status"] == "PAUSE_STATE_BOUND", "Workbench pause state drift")
    require(any(b.get("path") == ROADMAP_PATH and b.get("blob") == ROADMAP_BLOB for b in workbench["source_bindings"]), "Workbench current roadmap pause binding missing")

    counts = {k: 0 for k in ("IMPLEMENTED", "INVARIANT", "PARTIALLY_COVERED", "NEW_CANDIDATE", "EXPLORATORY", "PAUSED")}
    for e in entities:
        counts[e["classification"]] += 1
    require(registry["summary"] == {"entity_count": 10, **counts}, "summary/classification counts drift")
    require(not any(registry["non_effects"].values()), "registry claimed a normative/external effect")

    require(impl["schema"] == "urn:uu-aap:backlog-entity-reconciliation-implementation:0.1", "implementation schema drift")
    require(impl["origin_frontier"] == ORIGIN, "implementation origin drift")
    require(impl["tracking_issue"] == 875, "tracking issue drift")
    require(impl["registry_contract"]["bounded_absence_statement"] == PHRASE, "implementation bounded phrase drift")
    require(impl["registry_contract"]["absence_claim_created"] is False, "implementation claims entity absence")
    require(impl["registry_contract"]["roadmap_priority_created"] is False, "implementation created roadmap priority")
    require(impl["registry_contract"]["implementation_authority_created"] is False, "implementation created implementation authority")
    require(not any(impl["non_effects"].values()), "implementation receipt claimed an effect")
    require(impl["source_bindings"]["current_roadmap"] == {"path": ROADMAP_PATH, "blob": ROADMAP_BLOB}, "implementation roadmap binding drift")
    require(impl["source_bindings"]["non_binding_attention_readme"] == {"path": ATTENTION_PATH, "blob": ATTENTION_BLOB}, "implementation attention binding drift")

    if verify_git:
        subprocess.check_call(["git", "cat-file", "-e", f"{ORIGIN}^{{commit}}"], cwd=ROOT)
        for path, expected in ((ROADMAP_PATH, ROADMAP_BLOB), (ATTENTION_PATH, ATTENTION_BLOB)):
            require(git_blob(ORIGIN, path) == expected, f"origin source blob drift: {path}")
            require(git_blob("HEAD", path) == expected, f"branch mutated bound source: {path}")
        changed = subprocess.check_output(["git", "diff", "--name-only", ORIGIN, "HEAD"], cwd=ROOT, text=True).splitlines()
        for path in changed:
            require(path == ".github/workflows/backlog-entity-reconciliation-v0.1.yml" or path.startswith("tooling/backlog-entity-reconciliation/v0.1/"), f"unexpected changed path: {path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path, default=REGISTRY_PATH)
    parser.add_argument("--no-git", action="store_true")
    args = parser.parse_args()
    validate_data(json.loads(args.registry.read_text(encoding="utf-8")), load(IMPL_PATH), verify_git=not args.no_git)
    print("BACKLOG_ENTITY_RECONCILIATION_V0_1_VALID")


if __name__ == "__main__":
    main()
