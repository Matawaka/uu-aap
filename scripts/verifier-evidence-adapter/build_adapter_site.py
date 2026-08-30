#!/usr/bin/env python3
"""Augment an already-validated P1.2/P1.3 Pages artifact with the local P1.4 adapter surface."""

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

from uuaap_verifier_presentation import adapt_evidence, load_json  # noqa: E402

HERE = Path(__file__).resolve().parent
DEFAULT_FIXTURE = HERE / "fixture.json"
DEFAULT_APP = HERE / "app.js"


def adapter_html(example_input: dict) -> str:
    example_text = json.dumps(example_input, indent=2, ensure_ascii=False)
    escaped_example = html.escape(example_text, quote=False)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Local Evidence Adapter</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Local Evidence Adapter</h1>",
        "    <p>Convert documented external observations into bounded candidate claims. Candidate claims are not accepted verifier claims.</p>",
        "    <p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>",
        "    <p><strong>Semantic boundary:</strong> each registered adapter may emit candidates only for its allowlisted verifier dimension. Unknown adapters remain unmapped. No P1.4 adapter emits identity or truth.</p>",
        '    <p><a href="../interactive/">Open the P1.3 explicit-input verifier</a></p>',
        '    <p><a href="../">Open the immutable seven-dimension reference verifier</a></p>',
        '    <p><a href="example.json">Open the example adapter input JSON</a></p>',
        '    <label for="adapter-file-input">Select a local adapter JSON file:</label>',
        '    <input id="adapter-file-input" type="file" accept=".json,application/json">',
        '    <label for="adapter-input-json">Or paste/edit adapter input JSON:</label>',
        f'    <textarea id="adapter-input-json" rows="32" cols="100">{escaped_example}</textarea>',
        '    <button id="adapt-button" type="button">Adapt local observations</button>',
        '    <p id="adapter-error" role="alert" aria-live="assertive"></p>',
        '    <div id="adapter-result" aria-live="polite"></div>',
        "  </main>",
        '  <script src="app.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def _add_root_navigation(site_dir: Path) -> None:
    root = site_dir / "index.html"
    text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/adapt/">Open the local evidence adapter</a></p>\n'
    if link in text:
        return
    marker = "  </main>"
    assert marker in text, "root landing marker changed"
    root.write_text(text.replace(marker, link + marker, 1), encoding="utf-8")


def augment_site(
    site_dir: str | Path,
    fixture_path: str | Path = DEFAULT_FIXTURE,
    app_path: str | Path = DEFAULT_APP,
) -> dict:
    site = Path(site_dir)
    reference = site / "verifier" / "index.html"
    interactive = site / "verifier" / "interactive" / "index.html"
    assert reference.is_file(), "validated P1.2 verifier artifact is required"
    assert interactive.is_file(), "validated P1.3 interactive artifact is required"

    fixture = load_json(fixture_path)
    result = adapt_evidence(fixture)
    app_source = Path(app_path).read_text(encoding="utf-8")

    adapter_dir = site / "verifier" / "adapt"
    adapter_dir.mkdir(parents=True, exist_ok=True)
    (adapter_dir / "index.html").write_text(adapter_html(fixture), encoding="utf-8")
    (adapter_dir / "app.js").write_text(app_source, encoding="utf-8")
    (adapter_dir / "example.json").write_text(
        json.dumps(fixture, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (adapter_dir / "example-result.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    _add_root_navigation(site)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--fixture", default=str(DEFAULT_FIXTURE))
    parser.add_argument("--app", default=str(DEFAULT_APP))
    args = parser.parse_args()
    augment_site(args.site, args.fixture, args.app)


if __name__ == "__main__":
    main()
