#!/usr/bin/env python3
"""Deterministic, no-JavaScript reference HTML renderer for P1.1."""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from typing import Any

from build import DIMENSION_ORDER, validate_presentation


def esc(value: Any) -> str:
    return html.escape(str(value), quote=True)


def list_items(values: list[str]) -> str:
    return "".join(f"<li>{esc(value)}</li>" for value in values)


def render(presentation: dict[str, Any]) -> str:
    validate_presentation(presentation)

    dimension_sections = []
    for name in DIMENSION_ORDER:
        dimension = presentation["dimensions"][name]
        evidence = dimension["evidence_refs"]
        evidence_html = list_items(evidence) if evidence else "<li>None supplied</li>"
        non_effects_html = list_items(dimension["does_not_establish"])
        dimension_sections.append(
            "\n".join(
                [
                    f'<section data-dimension="{esc(name)}" aria-labelledby="dimension-{esc(name)}">',
                    f'  <h2 id="dimension-{esc(name)}">{esc(name.title())}</h2>',
                    "  <dl>",
                    f'    <dt>Value</dt><dd>{esc(dimension["value"])}</dd>',
                    f'    <dt>Evaluation</dt><dd>{esc(dimension["evaluation"])}</dd>',
                    f'    <dt>Source layer</dt><dd>{esc(dimension["source_layer"])}</dd>',
                    "  </dl>",
                    f'  <p>{esc(dimension["explanation"])}</p>',
                    "  <h3>Evidence references</h3>",
                    f"  <ul>{evidence_html}</ul>",
                    "  <h3>Does not establish</h3>",
                    f"  <ul>{non_effects_html}</ul>",
                    "</section>",
                ]
            )
        )

    warnings = presentation["warnings"]
    warning_html = (
        "".join(
            f'<li><strong>{esc(item["code"])}</strong>: {esc(item["message"])}</li>'
            for item in warnings
        )
        if warnings
        else "<li>None recorded</li>"
    )

    disputes = presentation["disputes"]
    dispute_html = (
        "".join(f"<li>{esc(json.dumps(item, sort_keys=True, ensure_ascii=False))}</li>" for item in disputes)
        if disputes
        else "<li>None recorded</li>"
    )

    consideration = presentation["related_observations"].get("consideration", {})
    consideration_value = consideration.get("value", "NOT_EVALUATED")

    lines = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Layered Verifier Reference</title>",
        "</head>",
        "<body>",
        "  <header>",
        "    <h1>Layered Verifier Reference</h1>",
        "    <p>Seven independent evidence dimensions. No aggregate trust or truth verdict is produced.</p>",
        f'    <p>Artifact: <code>{esc(presentation["artifact"]["id"])}</code></p>',
        "  </header>",
        "  <main>",
        *["    " + line for section in dimension_sections for line in section.splitlines()],
        '    <section aria-labelledby="related-observations">',
        '      <h2 id="related-observations">Related observations</h2>',
        f'      <p>Consideration: <strong>{esc(consideration_value)}</strong></p>',
        "    </section>",
        '    <section aria-labelledby="warnings">',
        '      <h2 id="warnings">Warnings</h2>',
        f"      <ul>{warning_html}</ul>",
        "    </section>",
        '    <section aria-labelledby="disputes">',
        '      <h2 id="disputes">Disputes</h2>',
        f"      <ul>{dispute_html}</ul>",
        "    </section>",
        "  </main>",
        "  <footer>",
        "    <p>Reference presentation only; each dimension retains its own evidence and non-effects.</p>",
        "  </footer>",
        "</body>",
        "</html>",
        "",
    ]
    output = "\n".join(lines)

    lowered = output.lower()
    forbidden_phrases = (
        "verified true",
        "trust score",
        "truth score",
        "overall trust",
        "overall verdict",
        "umbrella verified",
    )
    for phrase in forbidden_phrases:
        assert phrase not in lowered, f"forbidden aggregate phrase rendered: {phrase}"
    assert output.count('data-dimension="') == 7
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("presentation")
    parser.add_argument("--output")
    args = parser.parse_args()

    presentation = json.loads(Path(args.presentation).read_text(encoding="utf-8"))
    rendered = render(presentation)
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
