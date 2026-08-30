#!/usr/bin/env python3
"""Augment validated verifier Pages with P1.8 browser-local scoped-attestation surface."""
from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))
from uuaap_verifier_presentation import bridge_attestations, load_json  # noqa:E402

HERE = Path(__file__).resolve().parent
DEFAULT_FIXTURE = HERE / "fixture.json"
DEFAULT_APP = HERE / "app.js"


def attestation_html(example: dict) -> str:
    text = html.escape(json.dumps(example, indent=2, ensure_ascii=False), quote=False)
    return "\n".join([
        "<!doctype html>", '<html lang="en">', "<head>", '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Local Scoped Attestation Bridge</title>", "</head>", "<body>", "  <main>",
        "    <h1>UU-AAP Local Scoped Attestation Bridge</h1>",
        "    <p>Bridge external CAWG Identity Assertion 1.3 and W3C VC 2.0 validation receipts into bounded identity candidates and auxiliary role/review attestations.</p>",
        "    <p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page performs no DID, wallet, revocation, status-list, model, analytics or backend call.</p>",
        "    <p><strong>Semantic boundary:</strong> credential validity and CAWG roles do not become UU-AAP authority, responsibility, authorship or factual truth. P1.8 identity candidates are not auto-materialized into the seven-dimension verifier.</p>",
        '    <p><a href="../contest/">Open the P1.7 contestability overlay</a></p>',
        '    <p><a href="../interactive/">Open the P1.3 explicit-input verifier</a></p>',
        '    <p><a href="../">Open the immutable seven-dimension reference verifier</a></p>',
        '    <p><a href="example.json">Open the example attestation input JSON</a></p>',
        '    <p><a href="example-result.json">Open the example attestation result JSON</a></p>',
        '    <label for="attestation-file-input">Select a local attestation JSON file:</label>',
        '    <input id="attestation-file-input" type="file" accept=".json,application/json">',
        '    <label for="attestation-input-json">Or paste/edit attestation validation receipts:</label>',
        f'    <textarea id="attestation-input-json" rows="36" cols="100">{text}</textarea>',
        '    <button id="attestation-button" type="button">Bridge local attestation receipts</button>',
        '    <p id="attestation-error" role="alert" aria-live="assertive"></p>',
        '    <div id="attestation-result" aria-live="polite"></div>',
        "  </main>", '  <script src="app.js"></script>', "</body>", "</html>", "",
    ])


def augment_site(site_dir: str | Path, fixture_path: str | Path = DEFAULT_FIXTURE, app_path: str | Path = DEFAULT_APP) -> dict:
    site = Path(site_dir)
    reference = site / "verifier/index.html"
    assert reference.is_file(), "validated verifier reference required"
    assert (site / "verifier/contest/index.html").is_file(), "P1.7 contestability surface required"
    reference_before = reference.read_bytes()
    fixture = load_json(fixture_path)
    result = bridge_attestations(fixture)
    out = site / "verifier/attest"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(attestation_html(fixture), encoding="utf-8")
    (out / "app.js").write_text(Path(app_path).read_text(encoding="utf-8"), encoding="utf-8")
    (out / "example.json").write_text(json.dumps(fixture, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    (out / "example-result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/attest/">Open the local scoped attestation bridge</a></p>\n'
    if link not in root_text:
        marker = "  </main>"
        assert marker in root_text
        root.write_text(root_text.replace(marker, link+marker, 1), encoding="utf-8")
    assert reference.read_bytes() == reference_before
    return result


def main() -> None:
    parser=argparse.ArgumentParser(); parser.add_argument("--site",required=True); parser.add_argument("--fixture",default=str(DEFAULT_FIXTURE)); parser.add_argument("--app",default=str(DEFAULT_APP)); args=parser.parse_args()
    augment_site(args.site,args.fixture,args.app)

if __name__ == "__main__": main()
