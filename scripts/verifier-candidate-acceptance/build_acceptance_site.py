#!/usr/bin/env python3
"""Augment an already-validated P1.2–P1.4 Pages artifact with the local P1.5 acceptance surface."""

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
    load_json,
    materialize_candidate_acceptance,
)

HERE = Path(__file__).resolve().parent
DEFAULT_ADAPTER_FIXTURE = REPO_ROOT / "scripts" / "verifier-evidence-adapter" / "fixture.json"
DEFAULT_DECISION_FIXTURE = HERE / "decision.fixture.json"
DEFAULT_APP = HERE / "app.js"


def acceptance_html(example_input: dict) -> str:
    example_text = json.dumps(example_input, indent=2, ensure_ascii=False)
    escaped_example = html.escape(example_text, quote=False)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Local Candidate Acceptance</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Local Candidate Acceptance</h1>",
        "    <p>Apply explicit ACCEPT, REJECT or DEFER dispositions to a validated P1.4 candidate set and materialize a P1.3 verifier input.</p>",
        "    <p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>",
        "    <p><strong>Authority boundary:</strong> the acceptance actor reference records an explicit local selection event only. It does not prove identity, authority, authorship, responsibility or legal validity.</p>",
        "    <p><strong>Semantic boundary:</strong> acceptance does not strengthen a candidate claim. It copies the selected claim semantics and binds an explicit acceptance receipt.</p>",
        '    <p><a href="../adapt/">Open the P1.4 evidence adapter</a></p>',
        '    <p><a href="../interactive/">Open the P1.3 explicit-input verifier</a></p>',
        '    <p><a href="../">Open the immutable seven-dimension reference verifier</a></p>',
        '    <p><a href="example.json">Open the example acceptance input JSON</a></p>',
        '    <p><a href="materialized-input.json">Open the example materialized P1.3 input JSON</a></p>',
        '    <label for="acceptance-file-input">Select a local acceptance JSON file:</label>',
        '    <input id="acceptance-file-input" type="file" accept=".json,application/json">',
        '    <label for="acceptance-input-json">Or paste/edit acceptance input JSON:</label>',
        f'    <textarea id="acceptance-input-json" rows="36" cols="100">{escaped_example}</textarea>',
        '    <button id="materialize-button" type="button">Materialize explicit dispositions</button>',
        '    <p id="acceptance-error" role="alert" aria-live="assertive"></p>',
        '    <div id="acceptance-result" aria-live="polite"></div>',
        "  </main>",
        '  <script src="../adapt/app.js"></script>',
        '  <script src="../interactive/app.js"></script>',
        '  <script src="app.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def _add_root_navigation(site_dir: Path) -> None:
    root = site_dir / "index.html"
    text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/accept/">Open the local candidate acceptance gate</a></p>\n'
    if link in text:
        return
    marker = "  </main>"
    assert marker in text, "root landing marker changed"
    root.write_text(text.replace(marker, link + marker, 1), encoding="utf-8")


def augment_site(
    site_dir: str | Path,
    adapter_fixture_path: str | Path = DEFAULT_ADAPTER_FIXTURE,
    decision_fixture_path: str | Path = DEFAULT_DECISION_FIXTURE,
    app_path: str | Path = DEFAULT_APP,
) -> dict:
    site = Path(site_dir)
    assert (site / "verifier" / "index.html").is_file(), "validated P1.2 verifier artifact is required"
    assert (site / "verifier" / "interactive" / "index.html").is_file(), "validated P1.3 surface is required"
    assert (site / "verifier" / "adapt" / "index.html").is_file(), "validated P1.4 surface is required"

    adapter_input = load_json(adapter_fixture_path)
    decision = load_json(decision_fixture_path)
    adapter_result = adapt_evidence(adapter_input)
    acceptance_input = build_acceptance_input(adapter_result, decision)
    acceptance_result = materialize_candidate_acceptance(acceptance_input)
    app_source = Path(app_path).read_text(encoding="utf-8")

    acceptance_dir = site / "verifier" / "accept"
    acceptance_dir.mkdir(parents=True, exist_ok=True)
    (acceptance_dir / "index.html").write_text(acceptance_html(acceptance_input), encoding="utf-8")
    (acceptance_dir / "app.js").write_text(app_source, encoding="utf-8")
    (acceptance_dir / "example.json").write_text(
        json.dumps(acceptance_input, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (acceptance_dir / "example-result.json").write_text(
        json.dumps(acceptance_result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (acceptance_dir / "materialized-input.json").write_text(
        json.dumps(acceptance_result["materialized_interactive_input"], indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    _add_root_navigation(site)
    return acceptance_result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--adapter-fixture", default=str(DEFAULT_ADAPTER_FIXTURE))
    parser.add_argument("--decision-fixture", default=str(DEFAULT_DECISION_FIXTURE))
    parser.add_argument("--app", default=str(DEFAULT_APP))
    args = parser.parse_args()
    augment_site(args.site, args.adapter_fixture, args.decision_fixture, args.app)


if __name__ == "__main__":
    main()
