#!/usr/bin/env python3
"""Build the static P1.2 GitHub Pages reference surface from the canonical package API."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from uuaap_verifier_presentation import (  # noqa: E402
    DIMENSION_ORDER,
    build_presentation,
    load_json,
    render,
)


def landing_html() -> str:
    dimensions = "".join(f"<li><code>{name}</code></li>" for name in DIMENSION_ORDER)
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Layered Verifier</title>",
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>UU-AAP Layered Verifier</h1>",
        "    <p>Reference deployment of the reusable seven-dimension verifier presentation contract.</p>",
        "    <p>The public page and embeddable library use the same canonical implementation.</p>",
        "    <h2>Independent dimensions</h2>",
        f"    <ul>{dimensions}</ul>",
        '    <p><a href="verifier/">Open the layered verifier reference</a></p>',
        '    <p><a href="verifier/presentation.json">Machine-readable reference presentation</a></p>',
        "  </main>",
        "</body>",
        "</html>",
        "",
    ])


def build_site(fixture_path: str | Path, output_dir: str | Path) -> dict:
    fixture = load_json(fixture_path)
    presentation = build_presentation(fixture)
    verifier_html = render(presentation)

    output = Path(output_dir)
    verifier_dir = output / "verifier"
    verifier_dir.mkdir(parents=True, exist_ok=True)
    (output / "index.html").write_text(landing_html(), encoding="utf-8")
    (output / ".nojekyll").write_text("", encoding="utf-8")
    (verifier_dir / "index.html").write_text(verifier_html, encoding="utf-8")
    (verifier_dir / "presentation.json").write_text(
        json.dumps(presentation, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return presentation


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", default=str(REPO_ROOT / "scripts/verifier-presentation-contract/fixture.json"))
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    build_site(args.fixture, args.output)


if __name__ == "__main__":
    main()
