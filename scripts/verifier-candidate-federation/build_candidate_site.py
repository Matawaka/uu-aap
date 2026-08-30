#!/usr/bin/env python3
"""Augment validated verifier Pages with P1.9 browser-local candidate federation."""
from __future__ import annotations

import argparse
import html
import json
import sys
from copy import deepcopy
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from uuaap_verifier_presentation import (  # noqa:E402
    adapt_evidence,
    bridge_attestations,
    build_federation_input,
    federate_candidate_sources,
    load_json,
)

HERE = Path(__file__).resolve().parent
DEFAULT_APP = HERE / "app.js"
ADAPTER_FIXTURE = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "fixture.json"
ATTESTATION_FIXTURE = REPO_ROOT / "scripts" / "verifier-scoped-attestations" / "fixture.json"
COMMON_ARTIFACT = {
    "id": "urn:uu-aap:artifact:p1.9:reference",
    "description": "Synthetic P1.9 candidate-source federation reference",
}


def build_example_input() -> dict:
    adapter_input = load_json(ADAPTER_FIXTURE)
    attestation_input = load_json(ATTESTATION_FIXTURE)
    adapter_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    attestation_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    return build_federation_input(
        adapt_evidence(adapter_input),
        bridge_attestations(attestation_input),
    )


def federation_html(example: dict) -> str:
    text = html.escape(json.dumps(example, indent=2, ensure_ascii=False), quote=False)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Local Candidate Source Federation</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Local Candidate Source Federation</h1>",
        "    <p>Combine already validated P1.4 evidence-adapter candidates and P1.8 identity candidates into one seven-bucket candidate set while preserving source provenance.</p>",
        "    <p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>",
        "    <p><strong>Semantic boundary:</strong> federation is not acceptance, ranking, consensus, confidence or trust. Source order is history/presentation order only. CAWG roles and W3C review attestations remain auxiliary and never become candidates.</p>",
        '    <p><a href="../attest/">Open the P1.8 scoped attestation bridge</a></p>',
        '    <p><a href="../adapt/">Open the P1.4 bounded evidence adapter</a></p>',
        '    <p><a href="../accept/">Open the historical P1.5 adapter-candidate acceptance gate</a></p>',
        '    <p><a href="../">Open the immutable seven-dimension reference verifier</a></p>',
        '    <p><a href="example.json">Open the example federation input JSON</a></p>',
        '    <p><a href="example-result.json">Open the example federated candidate set JSON</a></p>',
        '    <label for="federation-file-input">Select a local federation JSON file:</label>',
        '    <input id="federation-file-input" type="file" accept=".json,application/json">',
        '    <label for="federation-input-json">Or paste/edit validated P1.4 + P1.8 source results:</label>',
        f'    <textarea id="federation-input-json" rows="40" cols="100">{text}</textarea>',
        '    <button id="federation-button" type="button">Federate candidate sources</button>',
        '    <p id="federation-error" role="alert" aria-live="assertive"></p>',
        '    <div id="federation-result" aria-live="polite"></div>',
        "  </main>",
        '  <script src="../adapt/app.js"></script>',
        '  <script src="../attest/app.js"></script>',
        '  <script src="app.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def augment_site(site_dir: str | Path, app_path: str | Path = DEFAULT_APP) -> dict:
    site = Path(site_dir)
    reference = site / "verifier/index.html"
    assert reference.is_file(), "validated verifier reference required"
    assert (site / "verifier/adapt/app.js").is_file(), "P1.4 browser validator required"
    assert (site / "verifier/attest/app.js").is_file(), "P1.8 browser validator required"
    reference_before = reference.read_bytes()

    example = build_example_input()
    result = federate_candidate_sources(example)
    out = site / "verifier/candidates"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(federation_html(example), encoding="utf-8")
    (out / "app.js").write_text(Path(app_path).read_text(encoding="utf-8"), encoding="utf-8")
    (out / "example.json").write_text(
        json.dumps(example, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (out / "example-result.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/candidates/">Open the local candidate source federation</a></p>\n'
    if link not in root_text:
        marker = "  </main>"
        assert marker in root_text, "Pages root marker changed"
        root.write_text(root_text.replace(marker, link + marker, 1), encoding="utf-8")

    assert reference.read_bytes() == reference_before, "P1.9 must not mutate immutable P1.1 reference"
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--app", default=str(DEFAULT_APP))
    args = parser.parse_args()
    augment_site(args.site, args.app)


if __name__ == "__main__":
    main()
