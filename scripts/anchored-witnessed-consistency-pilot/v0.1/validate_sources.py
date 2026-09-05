#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from pilot import fail, validate_profile


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--profile", default="scripts/anchored-witnessed-consistency-pilot/v0.1/profile.json")
    p.add_argument("--old-receipt", default="scripts/external-checkpoint-anchor-pilot/v0.1/current-receipt.json")
    p.add_argument("--external-config", required=True)
    args = p.parse_args()
    try:
        profile = json.loads(Path(args.profile).read_text(encoding="utf-8"))
        validate_profile(profile)
        old = json.loads(Path(args.old_receipt).read_text(encoding="utf-8"))
        ext = json.loads(Path(args.external_config).read_text(encoding="utf-8"))

        pold = profile["old_checkpoint"]
        if old.get("tracking_issue") != 929:
            fail("old receipt tracking issue mismatch")
        if old.get("receipt_fingerprint_sha256") != pold["accepted_receipt_fingerprint_sha256"]:
            fail("old #932 receipt fingerprint mismatch")
        if old.get("checkpoint_anchor", {}).get("origin") != pold["origin"]:
            fail("old #932 origin mismatch")
        if old.get("inclusion", {}).get("tree_size") != pold["tree_size"]:
            fail("old #932 tree size mismatch")
        if old.get("checkpoint_anchor", {}).get("root_b64") != pold["root_b64"]:
            fail("old #932 root mismatch")
        if old.get("checkpoint_anchor", {}).get("ots_binding_verified") is not True:
            fail("old #932 external anchor binding no longer verified")
        if old.get("checkpoint_anchor", {}).get("bitcoin_chain_confirmation") != "NOT_ESTABLISHED":
            fail("old #932 Bitcoin-chain boundary drift")
        if old.get("evidence_layers", {}).get("log_append_only_consistency") != "NOT_VERIFIED_SINGLE_CHECKPOINT_ONLY":
            fail("old #932 historical consistency nonclaim rewritten")

        if ext.get("log_url") != profile["log_url"]:
            fail("external monitor log URL mismatch")
        if ext.get("log_vkey") != profile["log_vkey"]:
            fail("external monitor log vkey mismatch")
        if ext.get("witness_vkeys") != profile["witness_vkeys"]:
            fail("external monitor witness vkey list mismatch")
        if ext.get("quorum_min") != profile["quorum_min"]:
            fail("external monitor quorum mismatch")
        source = ext.get("witness_vkeys_source", "")
        if "site-published pins" not in source or "witness operator" not in source:
            fail("external monitor key-source disclosure changed")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"ANCHORED_WITNESSED_CONSISTENCY_SOURCE_FAIL_CLOSED: {exc}")
        return 1
    print("ANCHORED_WITNESSED_CONSISTENCY_SOURCE_BINDING_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
