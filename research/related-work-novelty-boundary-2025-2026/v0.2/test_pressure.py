#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

import validate_pressure as vp

BASE = Path(__file__).resolve().parent
LEDGER = json.loads((BASE / "pressure-ledger.json").read_text(encoding="utf-8"))
MATRIX = json.loads((BASE / "candidate-pressure-matrix.json").read_text(encoding="utf-8"))


def expect_fail(label, mutate):
    ledger = copy.deepcopy(LEDGER)
    matrix = copy.deepcopy(MATRIX)
    mutate(ledger, matrix)
    try:
        vp.validate_data(ledger, matrix)
    except ValueError:
        return
    raise AssertionError(f"hostile mutation unexpectedly passed: {label}")


def main():
    vp.validate_data(copy.deepcopy(LEDGER), copy.deepcopy(MATRIX))
    tests = []

    tests.append(("wrong predecessor", lambda l, m: l.__setitem__("predecessor", "0" * 40)))
    tests.append(("duplicate source", lambda l, m: l["sources"].append(copy.deepcopy(l["sources"][0]))))
    tests.append(("post-anchor predecessor", lambda l, m: l["sources"][0].__setitem__("first_public_date", "2026-08-24")))
    tests.append(("unknown pressure target", lambda l, m: l["sources"][0]["pressure_targets"].append("TRUTH")))
    tests.append(("erase source non-overlap", lambda l, m: l["sources"][0].__setitem__("non_overlap", [])))
    tests.append(("drop candidate", lambda l, m: m["candidates"].pop()))
    tests.append(("duplicate candidate id", lambda l, m: m["candidates"][1].__setitem__("id", m["candidates"][0]["id"])))
    tests.append(("unknown pressure source ref", lambda l, m: m["candidates"][0]["pressure_sources"].append("invented-source")))
    tests.append(("novelty promotion", lambda l, m: m["candidates"][0].__setitem__("novelty_established", True)))
    tests.append(("world-first promotion", lambda l, m: m["candidates"][0].__setitem__("surviving_claim", "World-first semantic composition system.")))
    tests.append(("erase narrowed surviving claim", lambda l, m: m["candidates"][0].__setitem__("surviving_claim", None)))
    tests.append(("result inflation", lambda l, m: m["candidates"][0].__setitem__("result", "SURVIVES_BOUNDED_PRESSURE")))
    tests.append(("cross-domain result drift", lambda l, m: m["candidates"][4].__setitem__("result", "MATERIALLY_NARROWED")))
    tests.append(("remove Oplogica pressure", lambda l, m: m["candidates"][1].__setitem__("pressure_sources", [x for x in m["candidates"][1]["pressure_sources"] if x != "oplogica-verification-discipline-2026-06-06"])))
    tests.append(("remove observation-missingness pressure", lambda l, m: m["candidates"][2].__setitem__("pressure_sources", [])))
    tests.append(("remove SOOS pressure", lambda l, m: m["candidates"][3].__setitem__("pressure_sources", [x for x in m["candidates"][3]["pressure_sources"] if x != "soos-idp-2026-05-10"])))
    tests.append(("remove EP-AEC pressure", lambda l, m: m["candidates"][0].__setitem__("pressure_sources", [x for x in m["candidates"][0]["pressure_sources"] if x != "ep-aec-2026-06-22"])))
    tests.append(("unknown candidate field", lambda l, m: m["candidates"][0].__setitem__("confidence_score", 0.99)))
    tests.append(("empty forbidden claims", lambda l, m: m["candidates"][4].__setitem__("forbidden_claims", [])))
    tests.append(("matrix predecessor rewrite", lambda l, m: m.__setitem__("predecessor", "f" * 40)))

    for label, mutate in tests:
        expect_fail(label, mutate)

    print(f"PASS: {1 + len(tests)}/{1 + len(tests)} baseline+hostile v0.2 pressure checks")


if __name__ == "__main__":
    main()
