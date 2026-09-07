#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

import validate_taxonomy as vt

BASE = Path(__file__).resolve().parent
LEDGER = json.loads((BASE / "taxonomy-ledger.json").read_text(encoding="utf-8"))
MATRIX = json.loads((BASE / "promotion-matrix.json").read_text(encoding="utf-8"))


def src(ledger, sid):
    return next(x for x in ledger["sources"] if x["id"] == sid)


def cls(matrix, cid):
    return next(x for x in matrix["classes"] if x["id"] == cid)


def expect_fail(label, mutate):
    ledger = copy.deepcopy(LEDGER)
    matrix = copy.deepcopy(MATRIX)
    mutate(ledger, matrix)
    try:
        vt.validate_data(ledger, matrix, check_frozen=False)
    except ValueError:
        return
    raise AssertionError(f"hostile mutation unexpectedly passed: {label}")


def main():
    vt.validate_data(copy.deepcopy(LEDGER), copy.deepcopy(MATRIX), check_frozen=True)

    tests = [
        ("ledger predecessor rewrite", lambda l, m: l.__setitem__("predecessor", "0" * 40)),
        ("matrix predecessor rewrite", lambda l, m: m.__setitem__("predecessor", "f" * 40)),
        ("duplicate source", lambda l, m: l["sources"].append(copy.deepcopy(l["sources"][0]))),
        ("source corpus shrink", lambda l, m: l.__setitem__("sources", l["sources"][:8])),
        ("unknown source field", lambda l, m: l["sources"][0].__setitem__("confidence", 0.99)),
        ("unknown promotion target", lambda l, m: l["sources"][0]["promotion_targets"].append("TRUTH_TO_LIABILITY")),
        ("erase source non-overlap", lambda l, m: l["sources"][0].__setitem__("non_overlap", [])),
        ("StateBench date laundering", lambda l, m: src(l, "statebench-2025-12-21").__setitem__("first_public_date", "2026-08-23")),
        ("EAL promoted to predecessor", lambda l, m: src(l, "eal-bench-2026-09-01").__setitem__("temporal_class", "PUBLIC_PREDECESSOR")),
        ("ActionProxy promoted to predecessor", lambda l, m: src(l, "actionproxy-approval-authorization-2026-08-22").__setitem__("temporal_class", "PUBLIC_PREDECESSOR")),
        ("remove WEXP", lambda l, m: l.__setitem__("sources", [x for x in l["sources"] if x["id"] != "wexp-core-2026-07-05"])),
        ("remove StateBench", lambda l, m: l.__setitem__("sources", [x for x in l["sources"] if x["id"] != "statebench-2025-12-21"])),
        ("remove AIRGuard test status", lambda l, m: src(l, "airguard-authority-confusion-2026-05-27").__setitem__("tested", False)),
        ("remove CAP test status", lambda l, m: src(l, "cap-pcl-context-attestation-2026-06-04").__setitem__("tested", False)),
        ("erase causality named tests", lambda l, m: (src(l, "causality-laundering-2026-04-05").__setitem__("tested", False), src(l, "wexp-core-2026-07-05").__setitem__("tested", False))),
        ("change top result", lambda l, m: m.__setitem__("top_result", "BROAD_TAXONOMY_CLAIM_DEFEATED")),
        ("undeafeat broad taxonomy", lambda l, m: m.__setitem__("broad_taxonomy_claim_defeated", False)),
        ("world-first candidate", lambda l, m: m.__setitem__("narrow_candidate", "World-first unified semantic escalation benchmark that is patentable and completely novel." * 2)),
        ("remove narrow candidate", lambda l, m: m.__setitem__("narrow_candidate", None)),
        ("drop promotion class", lambda l, m: m["classes"].pop()),
        ("duplicate promotion class", lambda l, m: m["classes"][1].__setitem__("id", m["classes"][0]["id"])),
        ("unknown class field", lambda l, m: m["classes"][0].__setitem__("score", 1.0)),
        ("unknown source ref", lambda l, m: cls(m, "CONTEXT_TO_AUTHORITY")["source_refs"].append("invented-benchmark")),
        ("source ref target mismatch", lambda l, m: cls(m, "CONTEXT_TO_AUTHORITY")["source_refs"].append("cheney-provenance-causality-2010-04-19")),
        ("inflate observation class", lambda l, m: cls(m, "OBSERVATION_TO_BROAD_TRUTH").__setitem__("classification", "EXACT_MATERIALIZATION_NOT_FOUND_IN_BOUNDED_AUDIT")),
        ("inflate context-authority class", lambda l, m: cls(m, "CONTEXT_TO_AUTHORITY").__setitem__("classification", "EXACT_MATERIALIZATION_NOT_FOUND_IN_BOUNDED_AUDIT")),
        ("hide EAL convergence", lambda l, m: cls(m, "STALE_MEMORY_TO_CURRENT_AUTHORITY").__setitem__("classification", "EXACT_MATERIALIZATION_NOT_FOUND_IN_BOUNDED_AUDIT")),
        ("inflate review class", lambda l, m: cls(m, "REVIEW_TO_EXECUTION_PERMISSION").__setitem__("classification", "EXACT_MATERIALIZATION_NOT_FOUND_IN_BOUNDED_AUDIT")),
        ("contradict exact absence", lambda l, m: (src(l, "observation-missingness-2026-05-12").__setitem__("named_failures", ["Availability Laundering"]), src(l, "observation-missingness-2026-05-12").__setitem__("tested", True))),
        ("erase class why", lambda l, m: cls(m, "PROVENANCE_TO_CAUSALITY").__setitem__("why", [])),
        ("erase residual gap", lambda l, m: cls(m, "IDENTITY_TO_AUTHORITY").__setitem__("residual_gap", "")),
        ("novelty established", lambda l, m: m["non_effects"].__setitem__("novelty_established", True)),
        ("foundational novelty revived", lambda l, m: m["non_effects"].__setitem__("foundational_novelty_revived", True)),
        ("merge authority leaked", lambda l, m: m["non_effects"].__setitem__("merge_authorized", True)),
    ]

    for label, mutate in tests:
        expect_fail(label, mutate)

    print(f"PASS: {1 + len(tests)}/{1 + len(tests)} baseline+hostile v0.4 taxonomy checks")


if __name__ == "__main__":
    main()
