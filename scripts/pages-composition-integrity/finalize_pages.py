#!/usr/bin/env python3
"""P1.16 self-contained byte-integrity envelope over a validated P1.15 Pages artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

ENVELOPE_SCHEMA = "urn:uu-aap:relocatable-pages-integrity-envelope:0.1"
ENVELOPE_NAME = "pages-integrity-envelope.json"
P1_15_RECEIPT_SCHEMA = "urn:uu-aap:pages-composition-receipt:0.1"
PREDECESSOR_MAIN = "a8539292b237379904fc2fda0abd356f09c9d552"
SOURCE_BINDINGS = {
    "p1_15_compose_pages": {
        "path": "scripts/pages-composition/compose_pages.py",
        "blob": "c84bdb170bf700347b798615174c6a435d09353b",
    },
    "p1_15_adversarial_test": {
        "path": "scripts/pages-composition/test.py",
        "blob": "a4f95f2e5cbd4f0dfd7185fc9fc615bb8e7c6713",
    },
    "p1_15_workflow": {
        "path": ".github/workflows/pages-composition-v0.1.yml",
        "blob": "ad9c83a7fc6870fa196e69ed0d1a8675cb54ad61",
    },
    "p1_15_physical_pages_owner": {
        "path": ".github/workflows/verifier-distribution-surface-v0.1.yml",
        "blob": "ed7dc87bc1852178e7fd9cf0601373950a572d25",
    },
}

REQUIRED_PAYLOAD_PATHS = frozenset({
    ".nojekyll",
    "index.html",
    "poai/index.html",
    "verifier-start.html",
    "verifier/index.html",
    "verifier/integrity-capsule/capsule-manifest.json",
    "pages-composition-receipt.json",
})


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _inventory(root: Path, *, include_envelope: bool = False) -> list[dict[str, Any]]:
    assert root.is_dir(), f"Pages root missing: {root}"
    entries: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        assert not path.is_symlink(), f"symlink not permitted in Pages integrity set: {path}"
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        if not include_envelope and relative == ENVELOPE_NAME:
            continue
        entries.append({
            "path": relative,
            "bytes": path.stat().st_size,
            "sha256": _sha256(path),
        })
    assert [entry["path"] for entry in entries] == sorted(entry["path"] for entry in entries), (
        "payload inventory order must be deterministic"
    )
    assert len({entry["path"] for entry in entries}) == len(entries), "duplicate payload path"
    return entries


def _tree_digest(entries: list[dict[str, Any]]) -> str:
    canonical = json.dumps(entries, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _entry_index(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {entry["path"]: entry for entry in entries}


def build_envelope(root: str | Path) -> dict[str, Any]:
    pages = Path(root)
    entries = _inventory(pages)
    index = _entry_index(entries)
    missing = REQUIRED_PAYLOAD_PATHS - set(index)
    assert not missing, f"required P1.15 payload paths missing: {sorted(missing)}"
    assert ENVELOPE_NAME not in index, "integrity envelope must not inventory itself"

    p1_15_receipt_path = pages / "pages-composition-receipt.json"
    p1_15_receipt = json.loads(p1_15_receipt_path.read_text(encoding="utf-8"))
    assert p1_15_receipt.get("schema") == P1_15_RECEIPT_SCHEMA, "unexpected P1.15 receipt schema"
    assert isinstance(p1_15_receipt.get("non_effects"), dict), "P1.15 non-effects missing"
    assert all(value is False for value in p1_15_receipt["non_effects"].values()), (
        "P1.15 receipt must not mint semantic authority"
    )

    p1_15_entry = index["pages-composition-receipt.json"]
    return {
        "schema": ENVELOPE_SCHEMA,
        "predecessor_main": PREDECESSOR_MAIN,
        "source_bindings": SOURCE_BINDINGS,
        "payload_file_count": len(entries),
        "payload_tree_sha256": _tree_digest(entries),
        "p1_15_composition_receipt": {
            "path": "pages-composition-receipt.json",
            "schema": P1_15_RECEIPT_SCHEMA,
            "bytes": p1_15_entry["bytes"],
            "sha256": p1_15_entry["sha256"],
        },
        "files": entries,
        "verification_scope": "relocated_byte_consistency_against_this_envelope",
        "non_effects": {
            "producer_authenticated": False,
            "truth_established": False,
            "identity_established": False,
            "authority_established": False,
            "responsibility_established": False,
            "publication_or_action_authority_established": False,
            "trust_anchor_established": False,
            "external_timestamp_established": False,
        },
    }


def verify_integrity_envelope(root: str | Path) -> dict[str, Any]:
    pages = Path(root)
    assert pages.is_dir(), "final Pages root is required"
    envelope_path = pages / ENVELOPE_NAME
    assert envelope_path.is_file() and not envelope_path.is_symlink(), "P1.16 integrity envelope missing"
    envelope = json.loads(envelope_path.read_text(encoding="utf-8"))

    expected_top_level = {
        "schema",
        "predecessor_main",
        "source_bindings",
        "payload_file_count",
        "payload_tree_sha256",
        "p1_15_composition_receipt",
        "files",
        "verification_scope",
        "non_effects",
    }
    assert set(envelope) == expected_top_level, f"P1.16 envelope fields changed: {set(envelope)}"
    assert envelope["schema"] == ENVELOPE_SCHEMA, "unsupported P1.16 envelope schema"
    assert envelope["predecessor_main"] == PREDECESSOR_MAIN, "P1.16 predecessor binding changed"
    assert envelope["source_bindings"] == SOURCE_BINDINGS, "P1.16 historical source bindings changed"
    assert envelope["verification_scope"] == "relocated_byte_consistency_against_this_envelope"

    observed_entries = _inventory(pages)
    observed_index = _entry_index(observed_entries)
    declared_entries = envelope["files"]
    assert isinstance(declared_entries, list), "P1.16 files must be an array"
    assert declared_entries == sorted(declared_entries, key=lambda entry: entry["path"]), (
        "P1.16 declared payload order changed"
    )
    for entry in declared_entries:
        assert isinstance(entry, dict) and set(entry) == {"path", "bytes", "sha256"}, "invalid payload entry"
        assert isinstance(entry["path"], str) and entry["path"] and not entry["path"].startswith("/"), "invalid payload path"
        assert ".." not in Path(entry["path"]).parts, "parent traversal forbidden in payload path"
        assert isinstance(entry["bytes"], int) and entry["bytes"] >= 0, "invalid payload byte length"
        assert isinstance(entry["sha256"], str) and len(entry["sha256"]) == 64, "invalid payload SHA-256"
    assert len({entry["path"] for entry in declared_entries}) == len(declared_entries), "duplicate declared payload path"

    declared_index = _entry_index(declared_entries)
    assert set(declared_index) == set(observed_index), (
        f"P1.16 payload path set changed: extra={sorted(set(observed_index)-set(declared_index))} "
        f"missing={sorted(set(declared_index)-set(observed_index))}"
    )
    assert declared_entries == observed_entries, "P1.16 payload bytes/lengths/digests changed"
    assert envelope["payload_file_count"] == len(declared_entries), "P1.16 payload file count changed"
    assert envelope["payload_tree_sha256"] == _tree_digest(declared_entries), "P1.16 payload tree digest changed"
    assert REQUIRED_PAYLOAD_PATHS <= set(declared_index), "required P1.15 payload disappeared"

    receipt_entry = declared_index["pages-composition-receipt.json"]
    expected_receipt_binding = {
        "path": "pages-composition-receipt.json",
        "schema": P1_15_RECEIPT_SCHEMA,
        "bytes": receipt_entry["bytes"],
        "sha256": receipt_entry["sha256"],
    }
    assert envelope["p1_15_composition_receipt"] == expected_receipt_binding, (
        "P1.15 composition receipt binding changed"
    )
    p1_15_receipt = json.loads((pages / "pages-composition-receipt.json").read_text(encoding="utf-8"))
    assert p1_15_receipt.get("schema") == P1_15_RECEIPT_SCHEMA, "embedded P1.15 receipt schema changed"
    assert isinstance(p1_15_receipt.get("non_effects"), dict), "embedded P1.15 non-effects missing"
    assert all(value is False for value in p1_15_receipt["non_effects"].values()), (
        "embedded P1.15 receipt minted semantic authority"
    )

    expected_non_effect_keys = {
        "producer_authenticated",
        "truth_established",
        "identity_established",
        "authority_established",
        "responsibility_established",
        "publication_or_action_authority_established",
        "trust_anchor_established",
        "external_timestamp_established",
    }
    assert set(envelope["non_effects"]) == expected_non_effect_keys, "P1.16 non-effect set changed"
    assert all(value is False for value in envelope["non_effects"].values()), (
        "relocated byte integrity must not mint semantic authority"
    )
    return envelope


def finalize_pages(p1_15_root: str | Path, output_root: str | Path) -> dict[str, Any]:
    source = Path(p1_15_root)
    output = Path(output_root)
    assert source.is_dir(), "validated P1.15 composed root is required"
    assert not (source / ENVELOPE_NAME).exists(), "P1.15 source unexpectedly already contains a P1.16 envelope"
    assert not output.exists(), "P1.16 output root must not already exist"

    source_entries = _inventory(source)
    shutil.copytree(source, output, symlinks=False)
    copied_entries = _inventory(output)
    assert copied_entries == source_entries, "P1.16 copy changed P1.15 payload bytes"

    envelope = build_envelope(output)
    (output / ENVELOPE_NAME).write_text(
        json.dumps(envelope, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    assert verify_integrity_envelope(output) == envelope
    return envelope


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--p1-15-root")
    parser.add_argument("--output")
    parser.add_argument("--verify-only")
    args = parser.parse_args()

    if args.verify_only:
        assert not args.p1_15_root and not args.output, "verify-only accepts only the final root"
        envelope = verify_integrity_envelope(args.verify_only)
    else:
        assert args.p1_15_root and args.output, "finalization requires --p1-15-root and --output"
        envelope = finalize_pages(args.p1_15_root, args.output)
    print(json.dumps(envelope, sort_keys=True))


if __name__ == "__main__":
    main()
