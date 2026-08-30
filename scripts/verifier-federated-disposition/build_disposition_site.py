#!/usr/bin/env python3
"""Augment validated verifier Pages with P1.10 browser-local federated disposition."""
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
    DIMENSION_ORDER,
    FEDERATED_DISPOSITION_SCOPE,
    adapt_evidence,
    bridge_attestations,
    build_federated_disposition_input,
    build_federation_input,
    federate_candidate_sources,
    load_json,
    materialize_federated_disposition,
)

HERE = Path(__file__).resolve().parent
DEFAULT_APP = HERE / "app.js"
ADAPTER_FIXTURE = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "fixture.json"
ATTESTATION_FIXTURE = REPO_ROOT / "scripts" / "verifier-scoped-attestations" / "fixture.json"
COMMON_ARTIFACT = {
    "id": "urn:uu-aap:artifact:p1.10:reference",
    "description": "Synthetic P1.10 federated disposition reference",
}


def build_federated_set() -> dict:
    adapter_input = load_json(ADAPTER_FIXTURE)
    attestation_input = load_json(ATTESTATION_FIXTURE)
    adapter_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    attestation_input["artifact"] = deepcopy(COMMON_ARTIFACT)
    return federate_candidate_sources(
        build_federation_input(
            adapt_evidence(adapter_input),
            bridge_attestations(attestation_input),
        )
    )


def build_event(fset: dict) -> dict:
    dispositions = []
    for dimension in DIMENSION_ORDER:
        for candidate in fset["candidate_buckets"][dimension]:
            value = candidate["claim"]["value"]
            if dimension in {"provenance", "availability", "authority", "responsibility"}:
                decision = "ACCEPT"
            elif dimension == "identity" and value == "CAWG_IDENTITY_TRUSTED":
                decision = "ACCEPT"
            elif dimension == "identity" and value == "CAWG_IDENTITY_WELL_FORMED":
                decision = "DEFER"
            else:
                decision = "REJECT"
            dispositions.append({
                "federated_candidate_id": candidate["federated_candidate_id"],
                "decision": decision,
                "rationale": f"Explicit synthetic P1.10 disposition for {dimension}/{value}; no source family or evaluation state selects automatically.",
            })
    return {
        "id": "p1-10-disposition-reference",
        "actor_ref": "urn:uu-aap:actor:declared-local-reviewer:p1.10",
        "scope": FEDERATED_DISPOSITION_SCOPE,
        "dispositions": dispositions,
    }


def build_example_input() -> dict:
    fset = build_federated_set()
    return build_federated_disposition_input(fset, build_event(fset))


def page_html(example: dict) -> str:
    text = html.escape(json.dumps(example, indent=2, ensure_ascii=False), quote=False)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Local Federated Candidate Disposition</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Local Federated Candidate Disposition</h1>",
        "    <p>Apply explicit ACCEPT, REJECT or DEFER decisions to every validated P1.9 federated candidate, with at most one accepted candidate per verifier dimension.</p>",
        "    <p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>",
        "    <p><strong>Semantic boundary:</strong> disposition is explicit selection, not truth, identity, authority or reputation. Source family, source order, source count and evaluation state never select a winner automatically. REJECT and DEFER are not negative evidence.</p>",
        '    <p><a href="../candidates/">Open the P1.9 federated candidate set</a></p>',
        '    <p><a href="../accept/">Open the historical P1.5 adapter-only acceptance gate</a></p>',
        '    <p><a href="../interactive/">Open the P1.3 explicit-input verifier</a></p>',
        '    <p><a href="../">Open the immutable seven-dimension reference verifier</a></p>',
        '    <p><a href="example.json">Open the example disposition input JSON</a></p>',
        '    <p><a href="example-result.json">Open the example disposition result JSON</a></p>',
        '    <p><a href="materialized-input.json">Open the materialized P1.3 input JSON</a></p>',
        '    <label for="disposition-file-input">Select a local federated disposition JSON file:</label>',
        '    <input id="disposition-file-input" type="file" accept=".json,application/json">',
        '    <label for="disposition-input-json">Or paste/edit federated candidate set + explicit dispositions:</label>',
        f'    <textarea id="disposition-input-json" rows="42" cols="100">{text}</textarea>',
        '    <button id="disposition-button" type="button">Apply explicit dispositions</button>',
        '    <p id="disposition-error" role="alert" aria-live="assertive"></p>',
        '    <div id="disposition-result" aria-live="polite"></div>',
        "  </main>",
        '  <script src="../interactive/app.js"></script>',
        '  <script src="../adapt/app.js"></script>',
        '  <script src="../attest/app.js"></script>',
        '  <script src="../candidates/app.js"></script>',
        '  <script src="app.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def augment_site(site_dir: str | Path, app_path: str | Path = DEFAULT_APP) -> dict:
    site = Path(site_dir)
    reference = site / "verifier/index.html"
    for required in (
        "verifier/interactive/app.js",
        "verifier/adapt/app.js",
        "verifier/attest/app.js",
        "verifier/candidates/app.js",
    ):
        assert (site / required).is_file(), f"validated predecessor browser API required: {required}"
    reference_before = reference.read_bytes()
    example = build_example_input()
    result = materialize_federated_disposition(example)

    out = site / "verifier/disposition"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page_html(example), encoding="utf-8")
    (out / "app.js").write_text(Path(app_path).read_text(encoding="utf-8"), encoding="utf-8")
    (out / "example.json").write_text(json.dumps(example, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "example-result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "materialized-input.json").write_text(
        json.dumps(result["materialized_interactive_input"], indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/disposition/">Open the local federated candidate disposition gate</a></p>\n'
    if link not in root_text:
        marker = "  </main>"
        assert marker in root_text, "Pages root marker changed"
        root.write_text(root_text.replace(marker, link + marker, 1), encoding="utf-8")

    assert reference.read_bytes() == reference_before, "P1.10 must not mutate immutable P1.1 reference"
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--app", default=str(DEFAULT_APP))
    args = parser.parse_args()
    augment_site(args.site, args.app)


if __name__ == "__main__":
    main()
