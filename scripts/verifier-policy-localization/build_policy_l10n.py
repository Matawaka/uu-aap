#!/usr/bin/env python3
"""Add P1.6 technical policy and EN/RU static-shell localization to a validated verifier Pages artifact."""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_MESSAGES = HERE / "messages.json"
DEFAULT_RUNTIME = HERE / "runtime.js"

PAGE_PATCHES = {
    "index.html": [
        ('<h1>UU-AAP Layered Verifier</h1>', '<h1 data-i18n="root.heading">UU-AAP Layered Verifier</h1>'),
        ('<p>Reference deployment of the reusable seven-dimension verifier presentation contract.</p>', '<p data-i18n="root.description">Reference deployment of the reusable seven-dimension verifier presentation contract.</p>'),
        ('<p>The public page and embeddable library use the same canonical implementation.</p>', '<p data-i18n="root.one_source">The public page and embeddable library use the same canonical implementation.</p>'),
        ('<h2>Independent dimensions</h2>', '<h2 data-i18n="root.dimensions_heading">Independent dimensions</h2>'),
        ('<a href="verifier/">Open the layered verifier reference</a>', '<a href="verifier/" data-i18n="root.reference_link">Open the layered verifier reference</a>'),
        ('<a href="verifier/presentation.json">Machine-readable reference presentation</a>', '<a href="verifier/presentation.json" data-i18n="root.machine_link">Machine-readable reference presentation</a>'),
        ('<a href="verifier/interactive/">Open the local interactive verifier</a>', '<a href="verifier/interactive/" data-i18n="root.interactive_link">Open the local interactive verifier</a>'),
        ('<a href="verifier/adapt/">Open the local evidence adapter</a>', '<a href="verifier/adapt/" data-i18n="root.adapter_link">Open the local evidence adapter</a>'),
        ('<a href="verifier/accept/">Open the local candidate acceptance gate</a>', '<a href="verifier/accept/" data-i18n="root.accept_link">Open the local candidate acceptance gate</a>'),
    ],
    "verifier/interactive/index.html": [
        ('<h1>UU-AAP Local Interactive Verifier</h1>', '<h1 data-i18n="interactive.heading">UU-AAP Local Interactive Verifier</h1>'),
        ('<p>Validate explicit evidence references and seven independent dimension claims in your browser.</p>', '<p data-i18n="interactive.description">Validate explicit evidence references and seven independent dimension claims in your browser.</p>'),
        ('<p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>', '<p data-i18n="interactive.privacy">Privacy boundary: selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>'),
        ('<p>The verifier validates what the input explicitly claims. Opaque evidence payload content does not automatically establish integrity, identity, provenance, availability, authority, responsibility or truth.</p>', '<p data-i18n="interactive.semantic">The verifier validates what the input explicitly claims. Opaque evidence payload content does not automatically establish integrity, identity, provenance, availability, authority, responsibility or truth.</p>'),
        ('<a href="../">Open the immutable seven-dimension reference verifier</a>', '<a href="../" data-i18n="interactive.reference_link">Open the immutable seven-dimension reference verifier</a>'),
        ('<a href="example.json">Open the example input JSON</a>', '<a href="example.json" data-i18n="interactive.example_link">Open the example input JSON</a>'),
        ('<label for="file-input">Select a local JSON file:</label>', '<label for="file-input" data-i18n="interactive.file_label">Select a local JSON file:</label>'),
        ('<label for="input-json">Or paste/edit explicit input JSON:</label>', '<label for="input-json" data-i18n="interactive.paste_label">Or paste/edit explicit input JSON:</label>'),
        ('<button id="validate-button" type="button">Validate local input</button>', '<button id="validate-button" type="button" data-i18n="interactive.action">Validate local input</button>'),
    ],
    "verifier/adapt/index.html": [
        ('<h1>UU-AAP Local Evidence Adapter</h1>', '<h1 data-i18n="adapter.heading">UU-AAP Local Evidence Adapter</h1>'),
        ('<p>Convert documented external observations into bounded candidate claims. Candidate claims are not accepted verifier claims.</p>', '<p data-i18n="adapter.description">Convert documented external observations into bounded candidate claims. Candidate claims are not accepted verifier claims.</p>'),
        ('<p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>', '<p data-i18n="adapter.privacy">Privacy boundary: selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>'),
        ('<p><strong>Semantic boundary:</strong> each registered adapter may emit candidates only for its allowlisted verifier dimension. Unknown adapters remain unmapped. No P1.4 adapter emits identity or truth.</p>', '<p data-i18n="adapter.semantic">Semantic boundary: each registered adapter may emit candidates only for its allowlisted verifier dimension. Unknown adapters remain unmapped. No P1.4 adapter emits identity or truth.</p>'),
        ('<a href="../interactive/">Open the P1.3 explicit-input verifier</a>', '<a href="../interactive/" data-i18n="adapter.interactive_link">Open the P1.3 explicit-input verifier</a>'),
        ('<a href="../">Open the immutable seven-dimension reference verifier</a>', '<a href="../" data-i18n="adapter.reference_link">Open the immutable seven-dimension reference verifier</a>'),
        ('<a href="example.json">Open the example adapter input JSON</a>', '<a href="example.json" data-i18n="adapter.example_link">Open the example adapter input JSON</a>'),
        ('<label for="adapter-file-input">Select a local adapter JSON file:</label>', '<label for="adapter-file-input" data-i18n="adapter.file_label">Select a local adapter JSON file:</label>'),
        ('<label for="adapter-input-json">Or paste/edit adapter input JSON:</label>', '<label for="adapter-input-json" data-i18n="adapter.paste_label">Or paste/edit adapter input JSON:</label>'),
        ('<button id="adapt-button" type="button">Adapt local observations</button>', '<button id="adapt-button" type="button" data-i18n="adapter.action">Adapt local observations</button>'),
    ],
    "verifier/accept/index.html": [
        ('<h1>UU-AAP Local Candidate Acceptance</h1>', '<h1 data-i18n="accept.heading">UU-AAP Local Candidate Acceptance</h1>'),
        ('<p>Apply explicit ACCEPT, REJECT or DEFER dispositions to a validated P1.4 candidate set and materialize a P1.3 verifier input.</p>', '<p data-i18n="accept.description">Apply explicit ACCEPT, REJECT or DEFER dispositions to a validated P1.4 candidate set and materialize a P1.3 verifier input.</p>'),
        ('<p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>', '<p data-i18n="accept.privacy">Privacy boundary: selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>'),
        ('<p><strong>Authority boundary:</strong> the acceptance actor reference records an explicit local selection event only. It does not prove identity, authority, authorship, responsibility or legal validity.</p>', '<p data-i18n="accept.authority">Authority boundary: the acceptance actor reference records an explicit local selection event only. It does not prove identity, authority, authorship, responsibility or legal validity.</p>'),
        ('<p><strong>Semantic boundary:</strong> acceptance does not strengthen a candidate claim. It copies the selected claim semantics and binds an explicit acceptance receipt.</p>', '<p data-i18n="accept.semantic">Semantic boundary: acceptance does not strengthen a candidate claim. It copies the selected claim semantics and binds an explicit acceptance receipt.</p>'),
        ('<a href="../adapt/">Open the P1.4 evidence adapter</a>', '<a href="../adapt/" data-i18n="accept.adapter_link">Open the P1.4 evidence adapter</a>'),
        ('<a href="../interactive/">Open the P1.3 explicit-input verifier</a>', '<a href="../interactive/" data-i18n="accept.interactive_link">Open the P1.3 explicit-input verifier</a>'),
        ('<a href="../">Open the immutable seven-dimension reference verifier</a>', '<a href="../" data-i18n="accept.reference_link">Open the immutable seven-dimension reference verifier</a>'),
        ('<a href="example.json">Open the example acceptance input JSON</a>', '<a href="example.json" data-i18n="accept.example_link">Open the example acceptance input JSON</a>'),
        ('<a href="materialized-input.json">Open the example materialized P1.3 input JSON</a>', '<a href="materialized-input.json" data-i18n="accept.materialized_link">Open the example materialized P1.3 input JSON</a>'),
        ('<label for="acceptance-file-input">Select a local acceptance JSON file:</label>', '<label for="acceptance-file-input" data-i18n="accept.file_label">Select a local acceptance JSON file:</label>'),
        ('<label for="acceptance-input-json">Or paste/edit acceptance input JSON:</label>', '<label for="acceptance-input-json" data-i18n="accept.paste_label">Or paste/edit acceptance input JSON:</label>'),
        ('<button id="materialize-button" type="button">Materialize explicit dispositions</button>', '<button id="materialize-button" type="button" data-i18n="accept.action">Materialize explicit dispositions</button>'),
    ],
}


def load_catalog(path: str | Path = DEFAULT_MESSAGES) -> dict:
    catalog = json.loads(Path(path).read_text(encoding="utf-8"))
    assert set(catalog) == {"en", "ru"}, "P1.6 supports exactly en/ru"
    assert set(catalog["en"]) == set(catalog["ru"]), "localization catalogs must have identical keys"
    assert all(isinstance(value, str) and value for locale in catalog.values() for value in locale.values())
    return catalog


def compile_runtime(catalog: dict, runtime_path: str | Path = DEFAULT_RUNTIME) -> str:
    template = Path(runtime_path).read_text(encoding="utf-8")
    marker = "__UUAAP_L10N_CATALOG__"
    assert template.count(marker) == 1, "runtime catalog marker changed"
    payload = json.dumps(catalog, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return template.replace(marker, payload)


def locale_controls(policy_href: str) -> str:
    return "\n".join([
        '  <nav data-l10n-controls aria-label="Interface language">',
        '    <span data-i18n="common.language_label">Interface language</span>',
        '    <button type="button" data-locale="en" aria-pressed="true">English</button>',
        '    <button type="button" data-locale="ru" aria-pressed="false">Русский</button>',
        f'    <a href="{html.escape(policy_href, quote=True)}" data-i18n="common.policy_link">Verifier technical policy</a>',
        "  </nav>",
    ])


def decorate_page(path: Path, patches: list[tuple[str, str]], policy_href: str, script_src: str) -> None:
    text = path.read_text(encoding="utf-8")
    assert "data-l10n-controls" not in text, f"{path}: localization already applied"
    for old, new in patches:
        assert text.count(old) == 1, f"{path}: expected one static UI fragment: {old}"
        text = text.replace(old, new, 1)
    assert "<body>" in text and "</body>" in text
    text = text.replace("<body>", "<body>\n" + locale_controls(policy_href), 1)
    text = text.replace("</body>", f'  <script src="{script_src}"></script>\n</body>', 1)
    path.write_text(text, encoding="utf-8")


def policy_html(catalog: dict) -> str:
    en = catalog["en"]
    def node(tag: str, key: str) -> str:
        return f'    <{tag} data-i18n="{key}">{html.escape(en[key])}</{tag}>'
    return "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>UU-AAP Verifier Technical Policy</title>",
        "</head>",
        "<body>",
        locale_controls("./"),
        "  <main>",
        node("h1", "policy.heading"),
        node("p", "policy.intro"),
        node("h2", "policy.processing_heading"),
        node("p", "policy.processing_body"),
        node("p", "policy.environment_body"),
        node("h2", "policy.semantic_heading"),
        node("p", "policy.semantic_body"),
        node("p", "policy.candidate_body"),
        node("p", "policy.dimensions_body"),
        node("h2", "policy.privacy_heading"),
        node("p", "policy.privacy_body"),
        node("h2", "policy.accessibility_heading"),
        node("p", "policy.accessibility_body"),
        node("p", "policy.wcag_body"),
        node("h2", "policy.localization_heading"),
        node("p", "policy.localization_body"),
        node("p", "policy.canonical_body"),
        node("h2", "policy.repo_heading"),
        node("p", "policy.repo_body"),
        '    <p><a href="../../" data-i18n="policy.return_root">Return to verifier landing</a></p>',
        "  </main>",
        '  <script src="../assets/l10n.js"></script>',
        "</body>",
        "</html>",
        "",
    ])


def augment_site(site_dir: str | Path, messages_path: str | Path = DEFAULT_MESSAGES, runtime_path: str | Path = DEFAULT_RUNTIME) -> None:
    site = Path(site_dir)
    reference = site / "verifier" / "index.html"
    assert reference.is_file(), "immutable P1.1 reference is required"
    reference_before = reference.read_bytes()
    required = [site / "index.html", site / "verifier/interactive/index.html", site / "verifier/adapt/index.html", site / "verifier/accept/index.html"]
    assert all(path.is_file() for path in required), "validated P1.2-P1.5 Pages artifact is required"

    catalog = load_catalog(messages_path)
    assets = site / "verifier" / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "l10n.js").write_text(compile_runtime(catalog, runtime_path), encoding="utf-8")
    (assets / "messages.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    decorate_page(site / "index.html", PAGE_PATCHES["index.html"], "verifier/policy/", "verifier/assets/l10n.js")
    decorate_page(site / "verifier/interactive/index.html", PAGE_PATCHES["verifier/interactive/index.html"], "../policy/", "../assets/l10n.js")
    decorate_page(site / "verifier/adapt/index.html", PAGE_PATCHES["verifier/adapt/index.html"], "../policy/", "../assets/l10n.js")
    decorate_page(site / "verifier/accept/index.html", PAGE_PATCHES["verifier/accept/index.html"], "../policy/", "../assets/l10n.js")

    policy = site / "verifier" / "policy"
    policy.mkdir(parents=True, exist_ok=True)
    (policy / "index.html").write_text(policy_html(catalog), encoding="utf-8")
    assert reference.read_bytes() == reference_before, "P1.6 must not mutate immutable P1.1 reference"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--messages", default=str(DEFAULT_MESSAGES))
    parser.add_argument("--runtime", default=str(DEFAULT_RUNTIME))
    args = parser.parse_args()
    augment_site(args.site, args.messages, args.runtime)


if __name__ == "__main__":
    main()
