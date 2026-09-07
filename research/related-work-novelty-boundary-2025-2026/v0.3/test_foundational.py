#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

import validate_foundational as vf

BASE = Path(__file__).resolve().parent
LEDGER = json.loads((BASE / "foundational-ledger.json").read_text(encoding="utf-8"))
MATRIX = json.loads((BASE / "foundational-matrix.json").read_text(encoding="utf-8"))


def expect_fail(label, mutate):
    ledger = copy.deepcopy(LEDGER)
    matrix = copy.deepcopy(MATRIX)
    mutate(ledger, matrix)
    try:
        vf.validate_data(ledger, matrix)
    except ValueError:
        return
    raise AssertionError(f"hostile mutation unexpectedly passed: {label}")


def main():
    vf.validate_data(copy.deepcopy(LEDGER), copy.deepcopy(MATRIX))
    tests = []

    tests.append(("wrong predecessor", lambda l, m: l.__setitem__("predecessor", "0" * 40)))
    tests.append(("duplicate source", lambda l, m: l["sources"].append(copy.deepcopy(l["sources"][0]))))
    tests.append(("post-2024 source admitted", lambda l, m: l["sources"][0].__setitem__("public_date", "2025-01-01")))
    tests.append(("unknown pressure target", lambda l, m: l["sources"][0]["pressure_targets"].append("TRUTH")))
    tests.append(("erase source non-overlap", lambda l, m: l["sources"][0].__setitem__("non_overlap", [])))
    tests.append(("drop foundational family", lambda l, m: l.__setitem__("sources", [x for x in l["sources"] if x["family"] != "CHOICE_AWARENESS"])))
    tests.append(("drop claim", lambda l, m: m["claims"].pop()))
    tests.append(("duplicate claim id", lambda l, m: m["claims"][1].__setitem__("id", m["claims"][0]["id"])))
    tests.append(("unknown foundational ref", lambda l, m: m["claims"][0]["foundational_sources"].append("invented-source")))
    tests.append(("novelty promotion", lambda l, m: m["claims"][0].__setitem__("novelty_established", True)))
    tests.append(("retain defeated claim", lambda l, m: m["claims"][0].__setitem__("surviving_claim", "Still foundationally novel.")))
    tests.append(("erase narrowed surviving claim", lambda l, m: m["claims"][2].__setitem__("surviving_claim", None)))
    tests.append(("SNE result inflation", lambda l, m: m["claims"][0].__setitem__("result", "SURVIVES_FOUNDATIONAL_PRESSURE")))
    tests.append(("available-considered result inflation", lambda l, m: m["claims"][2].__setitem__("result", "SURVIVES_FOUNDATIONAL_PRESSURE")))
    tests.append(("cross-domain result inflation", lambda l, m: m["claims"][4].__setitem__("result", "SURVIVES_FOUNDATIONAL_PRESSURE")))
    tests.append(("remove Denning pressure", lambda l, m: m["claims"][0].__setitem__("foundational_sources", [x for x in m["claims"][0]["foundational_sources"] if x != "denning-lattice-1976"])))
    tests.append(("remove effect-system pressure", lambda l, m: m["claims"][1].__setitem__("foundational_sources", [x for x in m["claims"][1]["foundational_sources"] if x != "lucassen-gifford-effects-1988"])))
    tests.append(("remove consideration-set pressure", lambda l, m: m["claims"][2].__setitem__("foundational_sources", [x for x in m["claims"][2]["foundational_sources"] if x != "gensch-soofi-consideration-1995"])))
    tests.append(("remove PROV continuity pressure", lambda l, m: m["claims"][3].__setitem__("foundational_sources", [x for x in m["claims"][3]["foundational_sources"] if x != "w3c-prov-2013"])))
    tests.append(("remove OPM cross-domain pressure", lambda l, m: m["claims"][4].__setitem__("foundational_sources", [x for x in m["claims"][4]["foundational_sources"] if x != "opm-2011"])))
    tests.append(("unknown claim field", lambda l, m: m["claims"][0].__setitem__("confidence_score", 0.99)))
    tests.append(("empty forbidden claims", lambda l, m: m["claims"][4].__setitem__("forbidden_claims", [])))
    tests.append(("matrix predecessor rewrite", lambda l, m: m.__setitem__("predecessor", "f" * 40)))

    for label, mutate in tests:
        expect_fail(label, mutate)

    print(f"PASS: {1 + len(tests)}/{1 + len(tests)} baseline+hostile v0.3 foundational checks")


if __name__ == "__main__":
    main()
