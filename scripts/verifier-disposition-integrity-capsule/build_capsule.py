#!/usr/bin/env python3
"""Build a relocatable, self-contained P1.13 disposition-integrity verification capsule."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_BINDINGS = HERE / "source-bindings.json"

COPIES = {
    "interactive.js": "verifier/interactive/app.js",
    "adapt.js": "verifier/adapt/app.js",
    "attest.js": "verifier/attest/app.js",
    "candidates.js": "verifier/candidates/app.js",
    "disposition.js": "verifier/disposition/app.js",
    "integrity-core.js": "verifier/integrity/core.js",
    "ui.js": "verifier/integrity/ui.js",
    "example.json": "verifier/integrity/example.json",
    "example-result.json": "verifier/integrity/example-result.json",
    "p1-12-source-bindings.json": "verifier/integrity/source-bindings.json",
}


def page_html(example_text: str) -> str:
    import html
    escaped = html.escape(example_text, quote=False)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Portable Disposition Integrity Capsule</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Portable Disposition Integrity Capsule</h1>",
        "    <p>This directory is a self-contained offline copy of the bounded P1.11 integrity verification chain.</p>",
        "    <p><strong>Boundary:</strong> byte integrity and canonical rematerialization equality do not establish truth, producer identity, authority, responsibility, authorship, or publication/action permission.</p>",
        '    <p><a href="capsule-manifest.json">Open capsule manifest</a></p>',
        '    <p><a href="example.json">Open canonical example input</a></p>',
        '    <p><a href="example-result.json">Open canonical example result</a></p>',
        '    <label for="integrity-file-input">Select a local P1.11 integrity input JSON file:</label>',
        '    <input id="integrity-file-input" type="file" accept=".json,application/json">',
        '    <label for="integrity-input-json">Or paste/edit a P1.11 integrity input JSON:</label>',
        f'    <textarea id="integrity-input-json" rows="42" cols="100">{escaped}</textarea>',
        '    <button id="integrity-button" type="button">Verify disposition result integrity</button>',
        '    <p id="integrity-error" role="alert" aria-live="assertive"></p>',
        '    <div id="integrity-result" aria-live="polite"></div>',
        "  </main>",
        '  <script src="interactive.js"></script>',
        '  <script src="adapt.js"></script>',
        '  <script src="attest.js"></script>',
        '  <script src="candidates.js"></script>',
        '  <script src="disposition.js"></script>',
        '  <script src="integrity-core.js"></script>',
        '  <script src="ui.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def _digest(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    return {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def verify_manifest(capsule: str | Path) -> dict:
    root = Path(capsule)
    manifest = json.loads((root / "capsule-manifest.json").read_text(encoding="utf-8"))
    assert manifest["schema"] == "urn:uu-aap:portable-disposition-integrity-capsule:0.1"
    expected = set(manifest["files"])
    actual = {p.name for p in root.iterdir() if p.is_file() and p.name != "capsule-manifest.json"}
    assert actual == expected, f"capsule file set changed: expected={sorted(expected)} actual={sorted(actual)}"
    for name, receipt in manifest["files"].items():
        assert _digest(root / name) == receipt, f"capsule byte mismatch: {name}"
    assert manifest["non_effects"] == {
        "producer_authenticated": False,
        "truth_established": False,
        "identity_established": False,
        "authority_established": False,
        "responsibility_established": False,
        "publication_or_action_authority_established": False,
    }
    return manifest


def build_capsule(site_dir: str | Path) -> dict:
    site = Path(site_dir)
    out = site / "verifier/integrity-capsule"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    for target, source in COPIES.items():
        src = site / source
        assert src.is_file(), f"validated predecessor asset required: {source}"
        shutil.copyfile(src, out / target)

    (out / "p1-13-source-bindings.json").write_bytes(DEFAULT_BINDINGS.read_bytes())
    example_text = (out / "example.json").read_text(encoding="utf-8")
    (out / "index.html").write_text(page_html(example_text), encoding="utf-8")

    files = {p.name: _digest(p) for p in sorted(out.iterdir()) if p.is_file()}
    manifest = {
        "schema": "urn:uu-aap:portable-disposition-integrity-capsule:0.1",
        "source_surface": "UU-AAP/P1.12",
        "verification_core": "UU-AAP/P1.11",
        "files": files,
        "non_effects": {
            "producer_authenticated": False,
            "truth_established": False,
            "identity_established": False,
            "authority_established": False,
            "responsibility_established": False,
            "publication_or_action_authority_established": False,
        },
    }
    (out / "capsule-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    verify_manifest(out)

    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/integrity-capsule/">Open the portable offline integrity capsule</a></p>\n'
    if link not in root_text:
        marker = "  </main>"
        assert marker in root_text
        root.write_text(root_text.replace(marker, link + marker, 1), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    args = parser.parse_args()
    build_capsule(args.site)


if __name__ == "__main__":
    main()
