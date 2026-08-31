#!/usr/bin/env python3
"""Compose PoAI docs and the validated verifier site into one GitHub Pages artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

RECEIPT_SCHEMA = "urn:uu-aap:pages-composition-receipt:0.1"
ALLOWED_SOURCE_COLLISIONS = frozenset({"index.html"})
RESERVED_OUTPUT_PATHS = frozenset({"verifier-start.html", "pages-composition-receipt.json"})


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inventory(root: Path) -> list[dict[str, Any]]:
    assert root.is_dir(), f"source root missing: {root}"
    entries: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        assert not path.is_symlink(), f"symlink not permitted in Pages source: {path}"
        if path.is_file():
            entries.append({
                "path": path.relative_to(root).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": _sha256(path),
            })
    return entries


def _index(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result = {entry["path"]: entry for entry in entries}
    assert len(result) == len(entries), "duplicate inventory path"
    return result


def tree_digest(entries: list[dict[str, Any]]) -> str:
    canonical = json.dumps(entries, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _copy_tree(source: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    for path in sorted(source.rglob("*")):
        assert not path.is_symlink(), f"symlink not permitted in Pages source: {path}"
        relative = path.relative_to(source)
        destination = target / relative
        if path.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        elif path.is_file():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)


def _receipt(docs_entries: list[dict[str, Any]], verifier_entries: list[dict[str, Any]]) -> dict[str, Any]:
    collisions = sorted(set(_index(docs_entries)) & set(_index(verifier_entries)))
    return {
        "schema": RECEIPT_SCHEMA,
        "composition": "poai_docs_root_plus_validated_verifier_tree",
        "root_owner": "PoAI docs/index.html",
        "verifier_root_landing_relocated_to": "verifier-start.html",
        "source_collisions": collisions,
        "allowed_source_collisions": sorted(ALLOWED_SOURCE_COLLISIONS),
        "poai_docs": {
            "file_count": len(docs_entries),
            "tree_sha256": tree_digest(docs_entries),
        },
        "validated_verifier_site": {
            "file_count": len(verifier_entries),
            "tree_sha256": tree_digest(verifier_entries),
        },
        "non_effects": {
            "semantic_contracts_merged": False,
            "truth_established": False,
            "identity_established": False,
            "authority_established": False,
            "responsibility_established": False,
            "publication_or_action_authority_established": False,
        },
    }


def compose_pages(docs_root: str | Path, verifier_site: str | Path, output_root: str | Path) -> dict[str, Any]:
    docs = Path(docs_root)
    verifier = Path(verifier_site)
    output = Path(output_root)
    assert docs.is_dir(), "PoAI docs root is required"
    assert verifier.is_dir(), "validated verifier site is required"
    assert not output.exists(), "composition output must not already exist"

    docs_entries = inventory(docs)
    verifier_entries = inventory(verifier)
    docs_index = _index(docs_entries)
    verifier_index = _index(verifier_entries)

    assert "index.html" in docs_index, "PoAI docs/index.html is required"
    assert "index.html" in verifier_index, "validated verifier root index.html is required"
    assert "verifier/index.html" in verifier_index, "validated verifier tree is required"
    assert ".nojekyll" in verifier_index, "validated verifier .nojekyll is required"

    collisions = set(docs_index) & set(verifier_index)
    assert collisions == ALLOWED_SOURCE_COLLISIONS, (
        f"unexpected docs/verifier source collision set: {sorted(collisions)}"
    )
    assert not any(path == "verifier" or path.startswith("verifier/") for path in docs_index), (
        "docs/ may not occupy the reserved verifier/ URL tree"
    )
    assert not (set(docs_index) & RESERVED_OUTPUT_PATHS), "docs/ occupies a composition-reserved output path"

    verifier_root_files = {
        path for path in verifier_index
        if "/" not in path
    }
    assert verifier_root_files == {".nojekyll", "index.html"}, (
        f"unexpected validated verifier root files: {sorted(verifier_root_files)}"
    )
    assert all(
        path in {".nojekyll", "index.html"} or path.startswith("verifier/")
        for path in verifier_index
    ), "validated verifier artifact introduced an unowned top-level path"

    _copy_tree(docs, output)
    _copy_tree(verifier / "verifier", output / "verifier")
    shutil.copyfile(verifier / ".nojekyll", output / ".nojekyll")
    shutil.copyfile(verifier / "index.html", output / "verifier-start.html")

    receipt = _receipt(docs_entries, verifier_entries)
    (output / "pages-composition-receipt.json").write_text(
        json.dumps(receipt, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    verify_composed_artifact(docs, verifier, output)
    return receipt


def verify_composed_artifact(
    docs_root: str | Path,
    verifier_site: str | Path,
    output_root: str | Path,
) -> dict[str, Any]:
    docs = Path(docs_root)
    verifier = Path(verifier_site)
    output = Path(output_root)
    docs_entries = inventory(docs)
    verifier_entries = inventory(verifier)
    output_entries = inventory(output)
    docs_index = _index(docs_entries)
    verifier_index = _index(verifier_entries)
    output_index = _index(output_entries)

    expected_receipt = _receipt(docs_entries, verifier_entries)
    receipt_path = output / "pages-composition-receipt.json"
    assert receipt_path.is_file(), "composition receipt missing"
    observed_receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    assert observed_receipt == expected_receipt, "composition receipt/source binding mismatch"

    for relative, entry in docs_index.items():
        target = output / relative
        assert target.is_file(), f"PoAI docs file missing after composition: {relative}"
        assert target.stat().st_size == entry["bytes"], f"PoAI docs length changed: {relative}"
        assert _sha256(target) == entry["sha256"], f"PoAI docs bytes changed: {relative}"

    for relative, entry in verifier_index.items():
        if relative == "index.html":
            target = output / "verifier-start.html"
        elif relative == ".nojekyll":
            target = output / ".nojekyll"
        else:
            target = output / relative
        assert target.is_file(), f"verifier file missing after composition: {relative}"
        assert target.stat().st_size == entry["bytes"], f"verifier length changed: {relative}"
        assert _sha256(target) == entry["sha256"], f"verifier bytes changed: {relative}"

    assert (output / "index.html").read_bytes() == (docs / "index.html").read_bytes(), (
        "composed root must preserve PoAI docs/index.html exactly"
    )
    assert (output / "verifier-start.html").read_bytes() == (verifier / "index.html").read_bytes(), (
        "relocated verifier landing must preserve historical bytes exactly"
    )

    expected_paths = set(docs_index)
    expected_paths.update(path for path in verifier_index if path.startswith("verifier/"))
    expected_paths.update({".nojekyll", "verifier-start.html", "pages-composition-receipt.json"})
    assert set(output_index) == expected_paths, (
        f"unexpected composed artifact path set: extra={sorted(set(output_index)-expected_paths)} "
        f"missing={sorted(expected_paths-set(output_index))}"
    )

    non_effects = observed_receipt["non_effects"]
    assert all(value is False for value in non_effects.values()), "composition must not mint semantic authority"
    return observed_receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs", required=True)
    parser.add_argument("--verifier-site", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    if args.verify_only:
        receipt = verify_composed_artifact(args.docs, args.verifier_site, args.output)
    else:
        receipt = compose_pages(args.docs, args.verifier_site, args.output)
    print(json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
