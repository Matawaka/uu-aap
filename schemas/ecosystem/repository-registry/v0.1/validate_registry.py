#!/usr/bin/env python3
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "repository-disclosure-registry.schema.json"
SNAPSHOT_PATH = ROOT / "examples" / "public-repository-disclosure-registry.json"
PUBLIC_DOC = ROOT.parents[3] / "docs" / "ecosystem" / "MATAWAKA-REPOSITORY-PORTFOLIO-DISCLOSURE-2026-08.ru.md"

EXPECTED = {
    "uu-aap": {
        "full_name": "Matawaka/uu-aap",
        "commit_sha": "8ebb0e5a13089f6d43e499310a869102810577da",
        "tree_sha": "cc3617f3318bbc6b61ae8bfe42ba0c25422f9b68",
    },
    "marketcloser-public": {
        "full_name": "Matawaka/marketcloser-public",
        "commit_sha": "3984a516ab4b5c5e193a77dc94f58e03af3afc5f",
        "tree_sha": "eb14db38c7bf54c22894bfffb6b8de8efea1192e",
    },
    "vibe-coding-reality": {
        "full_name": "Matawaka/vibe-coding-reality",
        "commit_sha": "bcfbd797a87215ce095e6c24be5275897f64c124",
        "tree_sha": "290019663be14da208eb40844e46752a12197f6a",
    },
}
PUBLIC_NAMES = {v["full_name"] for v in EXPECTED.values()}
REQUIRED_INVARIANTS = {
    "Repository != Product",
    "Repository Visibility != Disclosure Authorization",
    "Private Repository Existence != Authorization to Publish Its Name",
    "Open Source != Zero Monetization",
    "Monetization Priority != Core Membership",
    "Development Priority != Monetization Priority",
    "Public Disclosure != Runtime Deployment",
}
FALSE_TOP = {
    "repository_visibility_changed",
    "private_repository_name_published",
    "private_repository_content_published",
    "pricing_committed",
    "license_changed",
    "deployment_authorized",
    "external_effect_authorized",
}

def stable(value):
    if isinstance(value, dict):
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + stable(value[k]) for k in sorted(value)) + "}"
    if isinstance(value, list):
        return "[" + ",".join(stable(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

def content_hash(value):
    cloned = copy.deepcopy(value)
    cloned["content_hash"] = ""
    return "sha256:" + hashlib.sha256(stable(cloned).encode("utf-8")).hexdigest()

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def validate_registry(value, public_doc_text=None):
    schema = load(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(value)

    if value["content_hash"] != content_hash(value):
        raise ValueError("content_hash mismatch")

    coverage = value["coverage"]
    if coverage["private_inventory_complete"] is not False:
        raise ValueError("private inventory must remain incomplete")
    if coverage["private_repository_details_disclosed"] is not False:
        raise ValueError("private repository details must remain undisclosed")
    if coverage["full_ecosystem_disclosure_decision_complete"] is not False:
        raise ValueError("full disclosure decision cannot be complete before private rescan")
    if coverage["connector_private_scope_complete"] is not False:
        raise ValueError("connector private scope cannot be claimed complete")
    if coverage["next_safe_action"] != "EXPAND_GITHUB_REPOSITORY_SCOPE_AND_RESCAN_PRIVATE_PORTFOLIO":
        raise ValueError("coverage successor mismatch")

    repos = value["repositories"]
    if len(repos) != 3:
        raise ValueError("public snapshot must contain exactly three verified public repositories")
    seen = set()
    for repo in repos:
        rid = repo["repository_id"]
        if rid in seen:
            raise ValueError("duplicate repository_id")
        seen.add(rid)
        if rid not in EXPECTED:
            raise ValueError("non-public or unverified repository present")
        expected = EXPECTED[rid]
        if repo["full_name"] != expected["full_name"]:
            raise ValueError(f"{rid}: full_name mismatch")
        if repo["visibility"] != "public":
            raise ValueError(f"{rid}: public snapshot cannot contain non-public repository")
        if repo["observed_main"]["commit_sha"] != expected["commit_sha"]:
            raise ValueError(f"{rid}: observed main commit mismatch")
        if repo["observed_main"]["tree_sha"] != expected["tree_sha"]:
            raise ValueError(f"{rid}: observed main tree mismatch")
        if repo["current_disclosure_state"] != "fully_public":
            raise ValueError(f"{rid}: current disclosure state mismatch")
        if repo["recommended_disclosure_posture"] != "KEEP_FULLY_PUBLIC":
            raise ValueError(f"{rid}: public repo disclosure recommendation must stay non-mutating")
        if any(v is not False for v in repo["non_effects"].values()):
            raise ValueError(f"{rid}: repository recommendation claims an effect")

    if seen != set(EXPECTED):
        raise ValueError("verified public repository set mismatch")

    if not REQUIRED_INVARIANTS.issubset(set(value["invariants"])):
        raise ValueError("required invariants missing")

    decision = value["portfolio_decision"]
    if decision["development_focus"][0] != "marketcloser-public":
        raise ValueError("near-term development focus must start with MarketCloser")
    if decision["monetization_focus"][0] != "marketcloser-public":
        raise ValueError("near-term monetization focus must start with MarketCloser")
    if set(decision["keep_fully_public"]) != set(EXPECTED):
        raise ValueError("public disclosure keep-set mismatch")
    if decision["private_projects_assessed_for_disclosure"] is not False:
        raise ValueError("private projects cannot be marked assessed")
    if decision["private_project_publication_authorized"] is not False:
        raise ValueError("private project publication cannot be authorized")

    by_id = {r["repository_id"]: r for r in repos}
    if by_id["uu-aap"]["strategic_priority"] != "P0":
        raise ValueError("UU-AAP must retain P0 strategic priority")
    if by_id["marketcloser-public"]["development_wip_priority"] != "P0":
        raise ValueError("MarketCloser must retain P0 development WIP priority")
    if by_id["marketcloser-public"]["monetization_priority"] != "P0":
        raise ValueError("MarketCloser must retain P0 monetization priority")
    if by_id["uu-aap"]["development_wip_priority"] == by_id["uu-aap"]["strategic_priority"]:
        raise ValueError("strategic priority must remain distinct from WIP priority for UU-AAP")

    if any(value["non_effects"][k] is not False for k in FALSE_TOP):
        raise ValueError("registry claims a prohibited effect")

    if public_doc_text is not None:
        refs = set(re.findall(r"Matawaka/[A-Za-z0-9_.-]+", public_doc_text))
        if not refs.issubset(PUBLIC_NAMES):
            raise ValueError(f"public document contains repository names outside public allowlist: {sorted(refs - PUBLIC_NAMES)}")
        lower = public_doc_text.lower()
        if "private repository" not in lower and "private-проект" not in lower:
            raise ValueError("public document must state the incomplete private-inventory boundary")
    return True

def self_test(canonical, public_doc_text):
    cases = []

    def mut(label, fn):
        x = copy.deepcopy(canonical)
        fn(x)
        if label != "content hash":
            x["content_hash"] = content_hash(x)
        cases.append((label, x))

    mut("private inventory complete", lambda x: x["coverage"].__setitem__("private_inventory_complete", True))
    mut("private details disclosed", lambda x: x["coverage"].__setitem__("private_repository_details_disclosed", True))
    mut("full disclosure complete", lambda x: x["coverage"].__setitem__("full_ecosystem_disclosure_decision_complete", True))
    mut("connector scope complete", lambda x: x["coverage"].__setitem__("connector_private_scope_complete", True))
    mut("private publication authorized", lambda x: x["portfolio_decision"].__setitem__("private_project_publication_authorized", True))
    mut("private assessed", lambda x: x["portfolio_decision"].__setitem__("private_projects_assessed_for_disclosure", True))
    mut("unknown repo", lambda x: x["repositories"].__setitem__(0, {**x["repositories"][0], "repository_id": "undisclosed"}))
    mut("private visibility", lambda x: x["repositories"][0].__setitem__("visibility", "private"))
    mut("frontier substitution", lambda x: x["repositories"][0]["observed_main"].__setitem__("commit_sha", "0"*40))
    mut("tree substitution", lambda x: x["repositories"][1]["observed_main"].__setitem__("tree_sha", "1"*40))
    mut("development order", lambda x: x["portfolio_decision"]["development_focus"].reverse())
    mut("monetization order", lambda x: x["portfolio_decision"]["monetization_focus"].reverse())
    mut("visibility effect", lambda x: x["non_effects"].__setitem__("repository_visibility_changed", True))
    mut("pricing effect", lambda x: x["repositories"][1]["non_effects"].__setitem__("pricing_committed", True))
    mut("content hash", lambda x: x.__setitem__("content_hash", "sha256:" + "f"*64))

    rejected = 0
    for label, candidate in cases:
        try:
            validate_registry(candidate, public_doc_text)
        except Exception:
            rejected += 1
        else:
            raise AssertionError(f"mutation unexpectedly accepted: {label}")
    return rejected

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", default=str(SNAPSHOT_PATH))
    ap.add_argument("--public-doc", default=str(PUBLIC_DOC))
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    snapshot = load(args.snapshot)
    doc_text = Path(args.public_doc).read_text(encoding="utf-8")
    validate_registry(snapshot, doc_text)
    print("Matawaka Repository & Disclosure Registry v0.1: PASS")
    if args.self_test:
        count = self_test(snapshot, doc_text)
        print(f"Fail-closed mutations rejected: {count}")

if __name__ == "__main__":
    main()
