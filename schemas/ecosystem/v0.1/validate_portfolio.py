#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / "schemas" / "ecosystem" / "v0.1" / "examples" / "uu-aap-ecosystem-portfolio.json"

EXPECTED_FRONTIER = "84fc5c968d9b786f5f84f8224179c8a182672089"
EXPECTED_TREE = "c3c600be51e901abf77f361830b9d9cb9c1842ab"
EXPECTED_PRODUCTS = {
    "uu-aap-core",
    "ial",
    "ai-transport",
    "kontur",
    "marketer-pessimist",
    "freeshield",
    "honest-hiring",
}
EXPECTED_INVARIANTS = {
    "Core != Product",
    "Product Success != Stable-Core Requirement",
    "Transport != Authority",
    "IAL Expression != Execution Admission",
    "KONTUR Responsibility State != ActionPermit",
    "Protective Review != Automatic Block or Sanction",
    "Product Contract != Product Runtime",
    "Application Filed != Application Registered",
}


class PortfolioError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PortfolioError(message)


def validate(data: dict[str, Any]) -> None:
    require(data.get("schema_version") == "0.1", "schema version mismatch")
    require(data.get("snapshot_id") == "uu-aap-ecosystem-portfolio-2026-08-26", "snapshot id mismatch")

    frontier = data["frontier"]
    require(frontier["repository"] == "Matawaka/uu-aap", "repository substitution")
    require(frontier["commit_sha"] == EXPECTED_FRONTIER, "frontier substitution")
    require(frontier["tree_sha"] == EXPECTED_TREE, "tree substitution")

    milestone = data["external_milestones"]["core_software_registration_application"]
    require(milestone["evidence_source"] == "applicant_report", "filing evidence source overclaimed")
    require(milestone["reported_state"] == "reported_submitted", "applicant-reported milestone lost")
    require(milestone["public_receipt_bound"] is False, "public filing receipt fabricated")
    require(milestone["registration_established"] is False, "registration outcome fabricated")

    require(set(data["portfolio_invariants"]) == EXPECTED_INVARIANTS, "portfolio invariant drift")

    balance = data["balance_policy"]
    require(balance["max_active_domain_product_lines"] == 2, "domain WIP cap changed")
    require(balance["new_core_primitive_requires_product_consumers"] >= 2, "orphan Core layer permitted")
    require(balance["new_core_primitive_requires_cross_product_case"] is True, "cross-product case removed")
    require(balance["product_contract_before_deep_implementation"] is True, "contract-first boundary removed")
    require(balance["product_specific_reverse_core_dependency_allowed"] is False, "reverse Core dependency enabled")

    products = data["products"]
    ids = [product["id"] for product in products]
    require(len(ids) == len(set(ids)), "duplicate product id")
    require(set(ids) == EXPECTED_PRODUCTS, "product inventory mismatch")
    by_id = {product["id"]: product for product in products}

    for product in products:
        product_id = product["id"]
        require(product["external_effect_authorized"] is False, f"external effect authorized by portfolio: {product_id}")
        require(product["stable_core_promotion_authorized"] is False, f"stable Core promotion authorized: {product_id}")
        require(product["reverse_core_dependency_allowed"] is False, f"reverse Core dependency authorized: {product_id}")

        dependencies = product["current_dependencies"] + product["planned_dependencies"]
        require(product_id not in dependencies, f"self dependency: {product_id}")
        require(set(dependencies) <= EXPECTED_PRODUCTS, f"unknown dependency: {product_id}")

        evidence_state = product["repository_evidence_state"]
        paths = product["canonical_paths"]
        if evidence_state == "not_materialized_at_frontier":
            require(product["maturity"] == "definition_required", f"unmaterialized product maturity overclaimed: {product_id}")
            require(paths == [], f"unmaterialized product has canonical paths: {product_id}")
            require(product["current_dependencies"] == [], f"unmaterialized product has claimed current dependencies: {product_id}")
        else:
            require(paths, f"implemented product lacks canonical paths: {product_id}")
            for relative_path in paths:
                require((ROOT / relative_path).exists(), f"missing canonical path for {product_id}: {relative_path}")

    require(by_id["uu-aap-core"]["core_member"] is True, "Core membership lost")
    require(all(not product["core_member"] for pid, product in by_id.items() if pid != "uu-aap-core"), "non-Core product promoted into Core")
    require(by_id["uu-aap-core"]["maturity"] == "stable_core_candidate", "Core maturity overclaimed or lost")
    require(by_id["ial"]["maturity"] == "experimental_protocol", "IAL maturity drift")
    require(by_id["ai-transport"]["maturity"] == "experimental_infrastructure", "transport maturity drift")
    require(by_id["kontur"]["maturity"] == "field_pilot", "KONTUR field-pilot evidence lost")

    for product_id in ("marketer-pessimist", "freeshield", "honest-hiring"):
        product = by_id[product_id]
        require(product["maturity"] == "definition_required", f"product implementation fabricated: {product_id}")
        require(product["repository_evidence_state"] == "not_materialized_at_frontier", f"product evidence fabricated: {product_id}")

    require("server/kontur/v0.1/README.md" in by_id["kontur"]["canonical_paths"], "KONTUR responsibility kernel omitted")
    require("pilots/kontur-game-companion" in by_id["kontur"]["canonical_paths"], "KONTUR field pilot omitted")
    require("protocols/ial/v0.1/README.md" in by_id["ial"]["canonical_paths"], "IAL canonical path omitted")
    require("protocols/integration/ai-gateway/v0.1/README.md" in by_id["ai-transport"]["canonical_paths"], "AI Gateway canonical path omitted")


def expect_fail(base: dict[str, Any], mutate: Callable[[dict[str, Any]], None]) -> None:
    candidate = copy.deepcopy(base)
    mutate(candidate)
    try:
        validate(candidate)
    except (PortfolioError, KeyError, TypeError):
        return
    raise AssertionError("unsafe portfolio mutation unexpectedly passed")


def main() -> None:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    validate(data)

    mutations: list[Callable[[dict[str, Any]], None]] = [
        lambda d: d["frontier"].__setitem__("commit_sha", "0" * 40),
        lambda d: d["frontier"].__setitem__("tree_sha", "1" * 40),
        lambda d: d["external_milestones"]["core_software_registration_application"].__setitem__("registration_established", True),
        lambda d: d["external_milestones"]["core_software_registration_application"].__setitem__("public_receipt_bound", True),
        lambda d: d["balance_policy"].__setitem__("max_active_domain_product_lines", 5),
        lambda d: d["balance_policy"].__setitem__("new_core_primitive_requires_product_consumers", 0),
        lambda d: d["balance_policy"].__setitem__("new_core_primitive_requires_cross_product_case", False),
        lambda d: d["balance_policy"].__setitem__("product_specific_reverse_core_dependency_allowed", True),
        lambda d: d["products"].append(copy.deepcopy(d["products"][0])),
        lambda d: d["products"].pop(),
        lambda d: next(p for p in d["products"] if p["id"] == "kontur").__setitem__("core_member", True),
        lambda d: next(p for p in d["products"] if p["id"] == "honest-hiring").__setitem__("maturity", "field_pilot"),
        lambda d: next(p for p in d["products"] if p["id"] == "freeshield").__setitem__("repository_evidence_state", "canonical_implementation"),
        lambda d: next(p for p in d["products"] if p["id"] == "marketer-pessimist")["canonical_paths"].append("README.md"),
        lambda d: next(p for p in d["products"] if p["id"] == "ai-transport").__setitem__("external_effect_authorized", True),
        lambda d: next(p for p in d["products"] if p["id"] == "ial").__setitem__("stable_core_promotion_authorized", True),
        lambda d: next(p for p in d["products"] if p["id"] == "kontur").__setitem__("reverse_core_dependency_allowed", True),
        lambda d: next(p for p in d["products"] if p["id"] == "honest-hiring")["current_dependencies"].append("unknown-product"),
        lambda d: next(p for p in d["products"] if p["id"] == "freeshield")["current_dependencies"].append("freeshield"),
        lambda d: d["portfolio_invariants"].remove("Transport != Authority"),
    ]

    for mutation in mutations:
        expect_fail(data, mutation)

    print(f"UU-AAP ecosystem portfolio validation: PASS ({len(mutations)} fail-closed mutations rejected)")


if __name__ == "__main__":
    main()
