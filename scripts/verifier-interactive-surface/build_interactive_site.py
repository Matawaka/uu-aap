#!/usr/bin/env python3
"""Augment an already-validated P1.2 Pages artifact with the local P1.3 interactive surface."""

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

from uuaap_verifier_presentation import load_json, normalize_interactive_input  # noqa: E402

HERE = Path(__file__).resolve().parent
DEFAULT_FIXTURE = HERE / "fixture.json"
DEFAULT_APP = HERE / "app.js"


def interactive_html(example_input: dict) -> str:
    example_text = json.dumps(example_input, indent=2, ensure_ascii=False)
    escaped_example = html.escape(example_text, quote=False)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Local Interactive Verifier</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Local Interactive Verifier</h1>",
        "    <p>Validate explicit evidence references and seven independent dimension claims in your browser.</p>",
        "    <p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>",
        "    <p>The verifier validates what the input explicitly claims. Opaque evidence payload content does not automatically establish integrity, identity, provenance, availability, authority, responsibility or truth.</p>",
        '    <p><a href="../">Open the immutable seven-dimension reference verifier</a></p>',
        '    <p><a href="example.json">Open the example input JSON</a></p>',
        '    <label for="file-input">Select a local JSON file:</label>',
        '    <input id="file-input" type="file" accept=".json,application/json">',
        '    <label for="input-json">Or paste/edit explicit input JSON:</label>',
        f'    <textarea id="input-json" rows="32" cols="100">{escaped_example}</textarea>',
        '    <button id="validate-button" type="button">Validate local input</button>',
        '    <p id="validation-error" role="alert" aria-live="assertive"></p>',
        '    <div id="validation-result" aria-live="polite"></div>',
        "  </main>",
        '  <script src="app.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def _add_root_navigation(site_dir: Path) -> None:
    root = site_dir / "index.html"
    text = root.read_text(encoding="utf-8")
    link = '    <p><a href="verifier/interactive/">Open the local interactive verifier</a></p>\n'
    if link in text:
        return
    marker = "  </main>"
    assert marker in text, "P1.2 root landing marker changed"
    root.write_text(text.replace(marker, link + marker, 1), encoding="utf-8")


def augment_site(
    site_dir: str | Path,
    fixture_path: str | Path = DEFAULT_FIXTURE,
    app_path: str | Path = DEFAULT_APP,
) -> dict:
    site = Path(site_dir)
    assert (site / "verifier" / "index.html").is_file(), "validated P1.2 verifier artifact is required"

    fixture = load_json(fixture_path)
    normalized = normalize_interactive_input(fixture)
    app_source = Path(app_path).read_text(encoding="utf-8")

    interactive = site / "verifier" / "interactive"
    interactive.mkdir(parents=True, exist_ok=True)
    (interactive / "index.html").write_text(interactive_html(fixture), encoding="utf-8")
    (interactive / "app.js").write_text(app_source, encoding="utf-8")
    (interactive / "example.json").write_text(
        json.dumps(fixture, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (interactive / "example-result.json").write_text(
        json.dumps(normalized, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    _add_root_navigation(site)
    return normalized


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--fixture", default=str(DEFAULT_FIXTURE))
    parser.add_argument("--app", default=str(DEFAULT_APP))
    args = parser.parse_args()
    augment_site(args.site, args.fixture, args.app)


if __name__ == "__main__":
    main()
