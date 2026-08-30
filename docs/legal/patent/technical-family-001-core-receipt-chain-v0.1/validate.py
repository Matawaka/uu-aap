#!/usr/bin/env python3
import copy
import hashlib
import json
import pathlib
import sys

sys.dont_write_bytecode = True

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[3]
INVENTORY = ROOT / "inventory.json"

EXPECTED_ORIGIN = "739f0364172b336f80d870a1ae55418203f059d4"
EXPECTED_DISCLOSURE = {
    "architecture_issue": 303,
    "origin_pr": 320,
    "origin_merge_sha": "fd3a3fa7e84c11a80d2af5ff389fe10979720ef9",
    "origin_merge_timestamp_utc": "2026-08-24T14:01:17Z",
    "origin_merge_timestamp_plus05": "2026-08-24T19:01:17+05:00",
    "disclosure_class": "EARLIEST_KNOWN_REPOSITORY_PUBLIC_DISCLOSURE",
    "universal_prior_art_search_completed": False,
    "external_novelty_search_completed": False,
}
EXPECTED_SOURCES = {
    "protocols/core/v0.1/validate-core.js": ("19b8cc90f34ad2eb3819d02d6335f584c65caa46", "EXECUTABLE_VALIDATOR"),
    "protocols/core/v0.1/receipt-envelope.schema.json": ("38d2d439ad6a1065da96cc9e5f2190734fd2cd7b", "TYPED_RECEIPT_SCHEMA"),
    "protocols/core/v0.1/end-to-end.fixture.json": ("9ed65bfae43f157f6fb051bf6460ebaec13ea480", "CONFORMANCE_CHAIN_FIXTURE"),
    "protocols/core/v0.1/README.md": ("290483f9704704160337d5c06800f3e66d32e05a", "NORMATIVE_IMPLEMENTATION_DESCRIPTION"),
}
EXPECTED_ELEMENTS = {
    "DETERMINISTIC_RECEIPT_IDENTITY_HASH",
    "TYPED_PREDECESSOR_HASH_CHAIN",
    "FAIL_CLOSED_ACTION_PREREQUISITE_GATE",
    "FRONTIER_CONSISTENCY_ENFORCEMENT",
    "ASSERTION_NON_EFFECT_BOUNDARY_VALIDATION",
    "OUTCOME_TO_SUCCESSOR_STATE_LINKAGE",
}
EXPECTED_CONTEXTS = {
    "SEVEN_LAYER_ARCHITECTURAL_MEANING",
    "RESPONSIBILITY_OR_LIABILITY_NORMATIVE_MEANING",
    "GOVERNANCE_OR_INSTITUTIONAL_AUTHORITY_RULES",
}
FALSE_DEFERRED = {
    "inventorship_identified_from_actual_creative_technical_contribution",
    "novelty_search_completed",
    "inventive_step_analysis_completed",
    "industrial_applicability_analysis_completed",
    "ru_2027_programmable_means_examination_practice_reviewed",
    "foreign_jurisdiction_strategy_decided",
    "claim_drafting_completed",
    "patent_filing_decision_made",
}
FALSE_CLAIMS = {
    "inventorship_established",
    "ownership_established",
    "novelty_established",
    "inventive_step_established",
    "industrial_applicability_established",
    "patentability_established",
    "patent_application_prepared",
    "patent_application_filed",
    "patent_right_granted",
}
TRUE_CLAIMS = {
    "repository_provenance_established",
    "current_source_bytes_bound",
    "earliest_known_repository_public_disclosure_bound",
}
FALSE_EFFECTS = {
    "external_patent_search_submitted",
    "filing_authority_created",
    "application_submitted",
    "fee_paid",
    "private_identity_data_published",
    "source_release_or_tag_created",
    "core_semantics_changed",
    "external_effect_authority_created",
}


def fail(message):
    raise AssertionError(message)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def git_blob_sha1(path):
    raw = path.read_bytes()
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def validate(data):
    if data.get("profile") != "uu-aap.patent-track.technical-family-inventory.v0.1":
        fail("profile")
    if data.get("issue") != 771 or data.get("parent_issue") != 492:
        fail("issue identity")
    if data.get("origin_main") != EXPECTED_ORIGIN:
        fail("origin main")

    family = data.get("family", {})
    if family.get("family_id") != "CORE_RECEIPT_CHAIN_VALIDATOR_001":
        fail("family id")
    if family.get("inventory_scope") != "IMPLEMENTATION_OBSERVABLE_TECHNICAL_ELEMENTS_ONLY":
        fail("inventory scope")
    if family.get("patentability_conclusion") is not False or family.get("invention_claim_created") is not False:
        fail("family overclaim")

    sources = data.get("current_sources")
    if not isinstance(sources, list) or len(sources) != len(EXPECTED_SOURCES):
        fail("source set")
    seen = set()
    for source in sources:
        path = source.get("path")
        if path not in EXPECTED_SOURCES or path in seen:
            fail("source identity")
        seen.add(path)
        expected_sha, expected_role = EXPECTED_SOURCES[path]
        if source.get("git_blob_sha1") != expected_sha or source.get("role") != expected_role:
            fail("source binding")
        full = REPO / path
        if not full.is_file() or git_blob_sha1(full) != expected_sha:
            fail(f"source byte drift: {path}")
    if seen != set(EXPECTED_SOURCES):
        fail("source coverage")

    if data.get("origin_provenance") != EXPECTED_DISCLOSURE:
        fail("origin disclosure")

    elements = data.get("implementation_observable_elements")
    if not isinstance(elements, list) or {e.get("element_id") for e in elements} != EXPECTED_ELEMENTS:
        fail("mechanism element set")
    for element in elements:
        if element.get("technical_mechanism_observed") is not True:
            fail("mechanism observation")
        if element.get("patentable_invention_established") is not False:
            fail("mechanism patentability overclaim")
        refs = element.get("implementation_refs")
        if not isinstance(refs, list) or not refs:
            fail("mechanism refs")
        if any(ref not in EXPECTED_SOURCES for ref in refs):
            fail("mechanism ref outside bound source set")

    contexts = data.get("abstract_or_semantic_context")
    if not isinstance(contexts, list) or {c.get("context_id") for c in contexts} != EXPECTED_CONTEXTS:
        fail("semantic context set")
    for context in contexts:
        if context.get("classification") != "NOT_CLASSIFIED_AS_TECHNICAL_MECHANISM_BY_THIS_INVENTORY":
            fail("semantic context laundering")

    deferred = data.get("deferred_gates", {})
    if set(deferred) != FALSE_DEFERRED or any(deferred[k] is not False for k in FALSE_DEFERRED):
        fail("deferred gates")

    claims = data.get("claims", {})
    if set(claims) != TRUE_CLAIMS | FALSE_CLAIMS:
        fail("claims set")
    if any(claims[k] is not True for k in TRUE_CLAIMS):
        fail("repository evidence claims")
    if any(claims[k] is not False for k in FALSE_CLAIMS):
        fail("patent/legal overclaim")

    effects = data.get("non_effects", {})
    if set(effects) != FALSE_EFFECTS or any(effects[k] is not False for k in FALSE_EFFECTS):
        fail("non-effects")


def expect_reject(base, mutate, label):
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except AssertionError:
        return
    fail(f"mutation accepted: {label}")


def main():
    data = load(INVENTORY)
    validate(data)

    expect_reject(data, lambda x: x.__setitem__("origin_main", "0" * 40), "origin rewrite")
    expect_reject(data, lambda x: x["current_sources"][0].__setitem__("git_blob_sha1", "0" * 40), "source substitution")
    expect_reject(data, lambda x: x["origin_provenance"].__setitem__("origin_merge_timestamp_utc", "2026-08-25T00:00:00Z"), "disclosure rewrite")
    expect_reject(data, lambda x: x["origin_provenance"].__setitem__("universal_prior_art_search_completed", True), "universal prior art overclaim")
    expect_reject(data, lambda x: x["implementation_observable_elements"][0].__setitem__("patentable_invention_established", True), "element patentability overclaim")
    expect_reject(data, lambda x: x["abstract_or_semantic_context"][0].__setitem__("classification", "PATENTABLE_TECHNICAL_MECHANISM"), "semantic laundering")
    expect_reject(data, lambda x: x["deferred_gates"].__setitem__("inventorship_identified_from_actual_creative_technical_contribution", True), "inventorship fabrication")
    expect_reject(data, lambda x: x["claims"].__setitem__("novelty_established", True), "novelty overclaim")
    expect_reject(data, lambda x: x["claims"].__setitem__("ownership_established", True), "ownership overclaim")
    expect_reject(data, lambda x: x["claims"].__setitem__("patent_application_filed", True), "filing overclaim")
    expect_reject(data, lambda x: x["non_effects"].__setitem__("filing_authority_created", True), "filing authority expansion")
    expect_reject(data, lambda x: x["non_effects"].__setitem__("core_semantics_changed", True), "core mutation")

    print("UU_AAP_PATENT_TRACK_FAMILY_001_INVENTORY_V0_1_PASS")


if __name__ == "__main__":
    main()
