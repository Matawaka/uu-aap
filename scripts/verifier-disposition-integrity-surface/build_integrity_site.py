#!/usr/bin/env python3
"""Publish merged P1.11 as a browser-local integrity surface without changing semantics."""
from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
P1_10_DIR = REPO_ROOT / "scripts" / "verifier-federated-disposition"
P1_11_DIR = REPO_ROOT / "scripts" / "verifier-disposition-integrity"
HERE = Path(__file__).resolve().parent
DEFAULT_UI = HERE / "ui.js"
DEFAULT_BINDINGS = HERE / "source-bindings.json"

if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))
if str(P1_10_DIR) not in sys.path:
    sys.path.insert(0, str(P1_10_DIR))

import build_disposition_site as p1_10_builder  # noqa:E402
from uuaap_verifier_presentation import (  # noqa:E402
    build_disposition_integrity_input,
    materialize_federated_disposition,
    validate_disposition_integrity_input,
    validate_disposition_integrity_result,
    verify_disposition_integrity,
)


def build_example_input() -> dict:
    p1_10_result = materialize_federated_disposition(p1_10_builder.build_example_input())
    record = build_disposition_integrity_input(p1_10_result)
    validate_disposition_integrity_input(record)
    return record


def page_html(example: dict) -> str:
    text = html.escape(json.dumps(example, indent=2, ensure_ascii=False), quote=False)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Local Disposition Integrity Verifier</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Local Disposition Integrity Verifier</h1>",
        "    <p>Verify that a supplied P1.10 disposition result exactly matches deterministic historical rematerialization through P1.11.</p>",
        "    <p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>",
        "    <p><strong>Semantic boundary:</strong> canonical rematerialization equality establishes bounded result integrity only. It does not establish truth, identity, authority, authorship, responsibility or publication/action permission.</p>",
        '    <p><a href="../disposition/">Open the P1.10 federated disposition gate</a></p>',
        '    <p><a href="../">Open the immutable seven-dimension reference verifier</a></p>',
        '    <p><a href="example.json">Open the example P1.11 integrity input JSON</a></p>',
        '    <p><a href="example-result.json">Open the example P1.11 integrity result JSON</a></p>',
        '    <label for="integrity-file-input">Select a local P1.11 integrity input JSON file:</label>',
        '    <input id="integrity-file-input" type="file" accept=".json,application/json">',
        '    <label for="integrity-input-json">Or paste/edit a P1.11 integrity input JSON:</label>',
        f'    <textarea id="integrity-input-json" rows="42" cols="100">{text}</textarea>',
        '    <button id="integrity-button" type="button">Verify disposition result integrity</button>',
        '    <p id="integrity-error" role="alert" aria-live="assertive"></p>',
        '    <div id="integrity-result" aria-live="polite"></div>',
        "  </main>",
        '  <script src="../interactive/app.js"></script>',
        '  <script src="../adapt/app.js"></script>',
        '  <script src="../attest/app.js"></script>',
        '  <script src="../candidates/app.js"></script>',
        '  <script src="../disposition/app.js"></script>',
        '  <script src="core.js"></script>',
        '  <script src="ui.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def augment_site(site_dir: str | Path, ui_path: str | Path = DEFAULT_UI) -> dict:
    site = Path(site_dir)
    reference = site / "verifier/index.html"
    for required in (
        "verifier/interactive/app.js",
        "verifier/adapt/app.js",
        "verifier/attest/app.js",
        "verifier/candidates/app.js",
        "verifier/disposition/app.js",
    ):
        assert (site / required).is_file(), f"validated predecessor browser API required: {required}"
    reference_before = reference.read_bytes()

    example = build_example_input()
    result = verify_disposition_integrity(example)
    validate_disposition_integrity_result(result)

    out = site / "verifier/integrity"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page_html(example), encoding="utf-8")
    (out / "core.js").write_bytes((P1_11_DIR / "app.js").read_bytes())
    (out / "ui.js").write_text(Path(ui_path).read_text(encoding="utf-8"), encoding="utf-8")
    (out / "example.json").write_text(json.dumps(example, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "example-result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "source-bindings.json").write_bytes(DEFAULT_BINDINGS.read_bytes())

    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/integrity/">Open the local disposition integrity verifier</a></p>\n'
    if link not in root_text:
        marker = "  </main>"
        assert marker in root_text, "Pages root marker changed"
        root.write_text(root_text.replace(marker, link + marker, 1), encoding="utf-8")

    assert reference.read_bytes() == reference_before, "P1.12 must not mutate immutable P1.1 reference"
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--ui", default=str(DEFAULT_UI))
    args = parser.parse_args()
    augment_site(args.site, args.ui)


if __name__ == "__main__":
    main()
