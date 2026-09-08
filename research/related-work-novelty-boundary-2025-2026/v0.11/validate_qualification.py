#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RECEIPT = ROOT / "qualification-receipt.json"


def main() -> int:
    q = json.loads(RECEIPT.read_text(encoding="utf-8"))
    assert q["schema"] == "matawaka.statebench-frozen-sync-import-qualification-receipt/v0.11"
    assert q["issue"] == 978
    assert q["qualified_status"] == "FROZEN_SYNC_AND_IMPORT_SMOKE_EXECUTED"
    assert q["qualified_candidate_head"] == "8e55249ab77694e015cc958409e6f2a01acab154"
    assert q["workflow_run"] == 34199453507
    assert q["workflow_job"] == 101974654824
    assert q["workflow_conclusion"] == "success"
    assert q["first_independent_green"] is True
    assert q["result_sha256"] == "08068dd3ebaf9546b5c1592cf77908487fc09cc8944f19f08c55ec9e298a8ce1"
    assert q["artifact"]["id"] == 10045263322
    assert q["artifact"]["zip_sha256"] == "e9a54544ddbda6583f587a63f00186016a646cdb8f753cfd35b0f2d5e2da3f99"
    assert q["artifact"]["is_primary_durable_evidence"] is False

    gates = q["gates"]
    assert gates["v011_hostile"] == "16/16"
    for key, value in gates.items():
        if key != "v011_hostile":
            assert value is True, key

    reds = q["historical_reds_preserved"]
    assert [(r["head"], r["run"], r["job"]) for r in reds] == [
        ("1fef59c677db15e9c7408340e875bde6372cc874", 34198815950, 101972639515),
        ("5954c8d33c22113ca675da578e9430aa29055e70", 34199033437, 101973332810),
        ("4ddbb4f41d125c4d1205c15b1bd3412b28a098c2", 34199214251, 101973895922),
    ]
    assert all(r["statebench_sync_started"] is False for r in reds)
    assert all(value is False for value in q["non_effects"].values())
    print("STATEBENCH_FROZEN_SYNC_IMPORT_V0.11_QUALIFICATION_RECEIPT_VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
