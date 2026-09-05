#!/usr/bin/env python3
"""Cross-check #893 pairwise deltas against merged #890 and #892 boundaries."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


tri = load_module("triangulation_receipt", HERE / "receipt.py")
gate = load_module("authority_admission_gate", SCRIPTS / "c2pa-authority-admission" / "gate.py")
observable = load_module(
    "observable_consistency_receipt",
    SCRIPTS / "observable-authority-consistency" / "receipt.py",
)


def fixture(name: str) -> dict:
    return json.loads((HERE / "fixtures" / name).read_text(encoding="utf-8"))


def gate_input(data: dict) -> dict:
    root = data["signed_root"]
    return {
        "schema": gate.INPUT_SCHEMA,
        "trust_root": {
            "id": root["id"],
            "version": root["version"],
            "document_sha256": root["document_sha256"],
            "verification_status": root["verification_status"],
            "admitted_signers": list(root["admitted_signers"]),
            "quorum_required": 1,
        },
        "configured_signers": list(data["runtime_surface"]["configured_signers"]),
        "signatures": [],
    }


def observable_input(data: dict) -> dict:
    return {
        "schema": observable.INPUT_SCHEMA,
        "export_surface": {
            "id": data["export_surface"]["id"],
            "document_sha256": data["export_surface"]["document_sha256"],
            "signers": list(data["export_surface"]["signers"]),
        },
        "signed_root": {
            "id": data["signed_root"]["id"],
            "version": data["signed_root"]["version"],
            "document_sha256": data["signed_root"]["document_sha256"],
            "verification_status": data["signed_root"]["verification_status"],
            "admitted_signers": list(data["signed_root"]["admitted_signers"]),
        },
    }


def check(name: str) -> dict:
    data = fixture(name)
    tri_receipt = tri.evaluate(data)
    gate_receipt = gate.evaluate(gate_input(data))
    observable_receipt = observable.evaluate(observable_input(data))

    tri_runtime_root = tri_receipt["comparisons"]["runtime_vs_signed_root"]
    gate_config = gate_receipt["configuration"]
    assert tri_runtime_root["configured_but_unadmitted"] == gate_config["configured_but_unadmitted"]
    assert tri_runtime_root["admitted_but_unconfigured"] == gate_config["admitted_but_unconfigured"]
    assert tri_runtime_root["delta_present"] == bool(
        gate_config["configured_but_unadmitted"] or gate_config["admitted_but_unconfigured"]
    )

    tri_export_root = tri_receipt["comparisons"]["export_vs_signed_root"]
    observable_consistency = observable_receipt["consistency"]
    assert tri_export_root["exported_but_unadmitted"] == observable_consistency["exported_but_unadmitted"]
    assert tri_export_root["admitted_but_unexported"] == observable_consistency["admitted_but_unexported"]
    assert tri_export_root["delta_present"] == observable_consistency["delta_present"]

    assert tri_receipt["signed_root"]["document_sha256"] == gate_receipt["trust_root"]["document_sha256"]
    assert tri_receipt["signed_root"]["document_sha256"] == observable_receipt["signed_root"]["document_sha256"]

    return {
        "fixture": name,
        "runtime_root_matches_890": True,
        "export_root_matches_892": True,
        "root_digest_bound_across_receipts": True,
    }


def main() -> None:
    checked = [
        check("corrected-external-shape.json"),
        check("aligned.json"),
        check("runtime-only.json"),
        check("root-only.json"),
        check("independent-bidirectional.json"),
        check("successor-v3.json"),
    ]
    print(json.dumps({"cross_check": "PASS", "checked": checked}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
