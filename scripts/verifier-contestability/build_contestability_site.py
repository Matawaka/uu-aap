#!/usr/bin/env python3
"""Augment a validated P1.2-P1.5 Pages artifact with the local P1.7 contestability surface."""

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

from uuaap_verifier_presentation import (  # noqa: E402
    adapt_evidence,
    build_acceptance_input,
    build_contestability_input,
    load_json,
    materialize_candidate_acceptance,
    materialize_contestability_overlay,
)

HERE = Path(__file__).resolve().parent
DEFAULT_ADAPTER_FIXTURE = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "fixture.json"
DEFAULT_DECISION_FIXTURE = REPO_ROOT / "scripts" / "verifier-candidate-acceptance" / "decision.fixture.json"
DEFAULT_RECORDS_FIXTURE = HERE / "records.fixture.json"
DEFAULT_APP = HERE / "app.js"


def build_example(
    adapter_fixture_path: str | Path = DEFAULT_ADAPTER_FIXTURE,
    decision_fixture_path: str | Path = DEFAULT_DECISION_FIXTURE,
    records_fixture_path: str | Path = DEFAULT_RECORDS_FIXTURE,
) -> tuple[dict, dict]:
    adapter_result = adapt_evidence(load_json(adapter_fixture_path))
    acceptance_input = build_acceptance_input(adapter_result, load_json(decision_fixture_path))
    acceptance_result = materialize_candidate_acceptance(acceptance_input)
    base = acceptance_result["materialized_interactive_input"]
    fixture = load_json(records_fixture_path)
    contestability_input = build_contestability_input(
        base,
        fixture["contestability_evidence_items"],
        fixture["records"],
    )
    return contestability_input, materialize_contestability_overlay(contestability_input)


def contestability_html(example_input: dict) -> str:
    example_text = json.dumps(example_input, indent=2, ensure_ascii=False)
    escaped = html.escape(example_text, quote=False)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Local Contestability Overlay</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Local Contestability Overlay</h1>",
        "    <p>Apply explicit correction, dispute and appeal records over a validated seven-dimension verifier input without silently rewriting history.</p>",
        "    <p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>",
        "    <p><strong>Semantic boundary:</strong> contestability is an overlay, not an eighth verifier dimension. Disputes and appeals do not mutate claims; applied corrections preserve the historical claim and expose an explicit successor.</p>",
        '    <p><a href="../accept/">Open the P1.5 candidate acceptance gate</a></p>',
        '    <p><a href="../interactive/">Open the P1.3 explicit-input verifier</a></p>',
        '    <p><a href="../">Open the immutable seven-dimension reference verifier</a></p>',
        '    <p><a href="example.json">Open the example contestability input JSON</a></p>',
        '    <p><a href="example-result.json">Open the example contestability result JSON</a></p>',
        '    <label for="contestability-file-input">Select a local contestability JSON file:</label>',
        '    <input id="contestability-file-input" type="file" accept=".json,application/json">',
        '    <label for="contestability-input-json">Or paste/edit contestability input JSON:</label>',
        f'    <textarea id="contestability-input-json" rows="40" cols="100">{escaped}</textarea>',
        '    <button id="contestability-button" type="button">Apply contestability overlay</button>',
        '    <p id="contestability-error" role="alert" aria-live="assertive"></p>',
        '    <div id="contestability-result" aria-live="polite"></div>',
        "  </main>",
        '  <script src="../interactive/app.js"></script>',
        '  <script src="app.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def _add_root_navigation(site_dir: Path) -> None:
    root = site_dir / "index.html"
    text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/contest/">Open the local contestability overlay</a></p>\n'
    if link in text:
        return
    marker = "  </main>"
    assert marker in text, "root landing marker changed"
    root.write_text(text.replace(marker, link + marker, 1), encoding="utf-8")


def augment_site(
    site_dir: str | Path,
    adapter_fixture_path: str | Path = DEFAULT_ADAPTER_FIXTURE,
    decision_fixture_path: str | Path = DEFAULT_DECISION_FIXTURE,
    records_fixture_path: str | Path = DEFAULT_RECORDS_FIXTURE,
    app_path: str | Path = DEFAULT_APP,
) -> dict:
    site = Path(site_dir)
    assert (site / "verifier" / "index.html").is_file(), "validated P1.2 verifier artifact is required"
    assert (site / "verifier" / "interactive" / "index.html").is_file(), "validated P1.3 surface is required"
    assert (site / "verifier" / "adapt" / "index.html").is_file(), "validated P1.4 surface is required"
    assert (site / "verifier" / "accept" / "index.html").is_file(), "validated P1.5 surface is required"

    contestability_input, result = build_example(adapter_fixture_path, decision_fixture_path, records_fixture_path)
    app_source = Path(app_path).read_text(encoding="utf-8")
    target = site / "verifier" / "contest"
    target.mkdir(parents=True, exist_ok=True)
    (target / "index.html").write_text(contestability_html(contestability_input), encoding="utf-8")
    (target / "app.js").write_text(app_source, encoding="utf-8")
    (target / "example.json").write_text(json.dumps(contestability_input, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (target / "example-result.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    _add_root_navigation(site)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--adapter-fixture", default=str(DEFAULT_ADAPTER_FIXTURE))
    parser.add_argument("--decision-fixture", default=str(DEFAULT_DECISION_FIXTURE))
    parser.add_argument("--records-fixture", default=str(DEFAULT_RECORDS_FIXTURE))
    parser.add_argument("--app", default=str(DEFAULT_APP))
    args = parser.parse_args()
    augment_site(args.site, args.adapter_fixture, args.decision_fixture, args.records_fixture, args.app)


if __name__ == "__main__":
    main()
