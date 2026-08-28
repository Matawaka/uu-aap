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
PUBLIC_DOC = ROOT.parents[3] / "docs" / "ecosystem" / "MATAWAKA-REPOSITORY-PORTFOLIO-DISCLOSURE-2026-08-v0.2.ru.md"

EXPECTED = {
    "uu-aap": {"full_name":"Matawaka/uu-aap","commit_sha":"53279493e4e34afd3ce517dc41b35433e9a383d7","tree_sha":"da723667d3045b02149894425dae2a81298291f5"},
    "marketcloser-public": {"full_name":"Matawaka/marketcloser-public","commit_sha":"3984a516ab4b5c5e193a77dc94f58e03af3afc5f","tree_sha":"eb14db38c7bf54c22894bfffb6b8de8efea1192e"},
    "truehire-public": {"full_name":"Matawaka/truehire-public","commit_sha":"99a8ed329f20d670b1130795eecff305c0c996bf","tree_sha":"585cd1d24e6feecdfebdcfe54faf27db3d4b1475"},
    "vibe-coding-reality": {"full_name":"Matawaka/vibe-coding-reality","commit_sha":"bcfbd797a87215ce095e6c24be5275897f64c124","tree_sha":"290019663be14da208eb40844e46752a12197f6a"},
}
PUBLIC_NAMES = {v["full_name"] for v in EXPECTED.values()}
REQUIRED_INVARIANTS = {
    "Repository != Product",
    "Repository Visibility != Disclosure Authorization",
    "Private Repository Existence != Authorization to Publish Its Name",
    "Open Source != Zero Monetization",
    "Public Disclosure != Runtime Deployment",
    "Public Projection != Private History Export",
    "Authorization Receipt != Action Receipt != Outcome Receipt",
    "Source Publication PASS != Binary Distribution Compliance PASS",
}
TRUEHIRE_ROOT = "sha256:41be1d4f43f16e7b10f7d4242e782651d326632efe4e56369de40051abb1351e"


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

    c = value["coverage"]
    if c["private_inventory_complete"] or c["private_repository_details_disclosed"] or c["full_ecosystem_disclosure_decision_complete"]:
        raise ValueError("private portfolio completion/disclosure must remain false")
    if c["all_private_projects_assessed"] is not False:
        raise ValueError("all private projects are not assessed")
    if c["at_least_one_private_origin_publication_completed"] is not True:
        raise ValueError("completed private-origin publication must be represented")

    repos = value["repositories"]
    if len(repos) != 4:
        raise ValueError("v0.2 public snapshot must contain exactly four verified public repositories")
    seen = set()
    for repo in repos:
        rid = repo["repository_id"]
        if rid in seen or rid not in EXPECTED:
            raise ValueError("duplicate or unexpected repository_id")
        seen.add(rid)
        expected = EXPECTED[rid]
        if repo["full_name"] != expected["full_name"]:
            raise ValueError(f"{rid}: full_name mismatch")
        if repo["visibility"] != "public":
            raise ValueError(f"{rid}: public registry cannot contain non-public repo")
        if repo["observed_main"] != {"commit_sha": expected["commit_sha"], "tree_sha": expected["tree_sha"]}:
            raise ValueError(f"{rid}: observed frontier mismatch")
        if repo["current_disclosure_state"] != "fully_public" or repo["recommended_disclosure_posture"] != "KEEP_FULLY_PUBLIC":
            raise ValueError(f"{rid}: disclosure posture mismatch")
        if any(v is not False for v in repo["non_effects"].values()):
            raise ValueError(f"{rid}: recommendation claims an effect")
    if seen != set(EXPECTED):
        raise ValueError("verified public repository set mismatch")

    by_id = {r["repository_id"]: r for r in repos}
    if by_id["marketcloser-public"]["development_wip_priority"] != "P0" or by_id["marketcloser-public"]["monetization_priority"] != "P0":
        raise ValueError("MarketCloser must retain P0 development/monetization focus")
    if by_id["uu-aap"]["strategic_priority"] != "P0":
        raise ValueError("UU-AAP must retain P0 strategic priority")
    th = by_id["truehire-public"]
    if (th["strategic_priority"], th["development_wip_priority"], th["monetization_priority"]) != ("P1","P1","P1"):
        raise ValueError("TRUEHIRE must remain bounded P1 in v0.2")
    ev = th.get("public_release_evidence") or {}
    if ev.get("release_anchor") != "release/v0.1" or ev.get("projection_root") != TRUEHIRE_ROOT:
        raise ValueError("TRUEHIRE public release binding mismatch")
    if ev.get("non_receipt_file_count") != 45 or ev.get("total_public_file_count") != 47 or ev.get("root_parent_count") != 0:
        raise ValueError("TRUEHIRE public release structure mismatch")

    decision = value["portfolio_decision"]
    if decision["development_focus"][0] != "marketcloser-public" or decision["monetization_focus"][0] != "marketcloser-public":
        raise ValueError("MarketCloser must remain first near-term focus")
    if set(decision["keep_fully_public"]) != set(EXPECTED):
        raise ValueError("public keep-set mismatch")
    if decision["completed_public_projection_publications"] != ["truehire-public"]:
        raise ValueError("completed projection publication set mismatch")
    if decision["private_repository_names_added_by_this_registry"] != []:
        raise ValueError("v0.2 may not add private repository names")
    if decision["all_private_projects_assessed"] is not False:
        raise ValueError("private portfolio cannot be marked fully assessed")

    if not REQUIRED_INVARIANTS.issubset(set(value["invariants"])):
        raise ValueError("required invariants missing")
    if any(v is not False for v in value["non_effects"].values()):
        raise ValueError("registry claims prohibited effect")

    if public_doc_text is not None:
        refs = set(re.findall(r"Matawaka/[A-Za-z0-9_.-]+", public_doc_text))
        if not refs.issubset(PUBLIC_NAMES):
            raise ValueError(f"public document contains names outside public allowlist: {sorted(refs - PUBLIC_NAMES)}")
        for required in ["Matawaka/truehire-public", TRUEHIRE_ROOT, "private portfolio"]:
            if required.lower() not in public_doc_text.lower():
                raise ValueError(f"public document missing required public-safe statement: {required}")
    return True


def self_test(canonical, public_doc_text):
    cases = []
    def mut(label, fn):
        x = copy.deepcopy(canonical); fn(x)
        if label != "content hash": x["content_hash"] = content_hash(x)
        cases.append((label, x))
    mut("private inventory complete", lambda x: x["coverage"].__setitem__("private_inventory_complete", True))
    mut("private details disclosed", lambda x: x["coverage"].__setitem__("private_repository_details_disclosed", True))
    mut("all private assessed", lambda x: x["coverage"].__setitem__("all_private_projects_assessed", True))
    mut("publication lost", lambda x: x["coverage"].__setitem__("at_least_one_private_origin_publication_completed", False))
    mut("unknown repo", lambda x: x["repositories"][0].__setitem__("repository_id", "undisclosed"))
    mut("private visibility", lambda x: x["repositories"][2].__setitem__("visibility", "private"))
    mut("truehire frontier substitution", lambda x: x["repositories"][2]["observed_main"].__setitem__("commit_sha", "0"*40))
    mut("truehire tree substitution", lambda x: x["repositories"][2]["observed_main"].__setitem__("tree_sha", "1"*40))
    mut("projection root substitution", lambda x: x["repositories"][2]["public_release_evidence"].__setitem__("projection_root", "sha256:"+"2"*64))
    mut("history imported", lambda x: x["repositories"][2]["public_release_evidence"].__setitem__("root_parent_count", 1))
    mut("private name added", lambda x: x["portfolio_decision"].__setitem__("private_repository_names_added_by_this_registry", ["undisclosed-private-name"]))
    mut("development order", lambda x: x["portfolio_decision"]["development_focus"].reverse())
    mut("monetization order", lambda x: x["portfolio_decision"]["monetization_focus"].reverse())
    mut("deployment effect", lambda x: x["non_effects"].__setitem__("deployment_authorized", True))
    mut("candidate processing effect", lambda x: x["non_effects"].__setitem__("candidate_data_processing_authorized", True))
    mut("binary clearance effect", lambda x: x["non_effects"].__setitem__("binary_distribution_cleared", True))
    mut("pricing effect", lambda x: x["repositories"][2]["non_effects"].__setitem__("pricing_committed", True))
    mut("content hash", lambda x: x.__setitem__("content_hash", "sha256:"+"f"*64))
    rejected = 0
    for label, candidate in cases:
        try: validate_registry(candidate, public_doc_text)
        except Exception: rejected += 1
        else: raise AssertionError(f"mutation unexpectedly accepted: {label}")
    return rejected


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", default=str(SNAPSHOT_PATH))
    ap.add_argument("--public-doc", default=str(PUBLIC_DOC))
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    snapshot = load(args.snapshot)
    doc = Path(args.public_doc).read_text(encoding="utf-8")
    validate_registry(snapshot, doc)
    print("Matawaka Repository & Disclosure Registry v0.2: PASS")
    if args.self_test:
        print(f"Fail-closed mutations rejected: {self_test(snapshot, doc)}")

if __name__ == "__main__":
    main()
