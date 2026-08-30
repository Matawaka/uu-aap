#!/usr/bin/env python3
"""Extend validated EN/RU verifier shell with P1.10 disposition labels only."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
DEFAULT_MESSAGES = HERE / "messages.json"
RUNTIME_TEMPLATE = REPO_ROOT / "scripts" / "verifier-policy-localization" / "runtime.js"

PATCHES = [
    ('<h1>UU-AAP Local Federated Candidate Disposition</h1>', '<h1 data-i18n="disposition.heading">UU-AAP Local Federated Candidate Disposition</h1>'),
    ('<p>Apply explicit ACCEPT, REJECT or DEFER decisions to every validated P1.9 federated candidate, with at most one accepted candidate per verifier dimension.</p>', '<p data-i18n="disposition.description">Apply explicit ACCEPT, REJECT or DEFER decisions to every validated P1.9 federated candidate, with at most one accepted candidate per verifier dimension.</p>'),
    ('<p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>', '<p data-i18n="disposition.privacy">Privacy boundary: selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>'),
    ('<p><strong>Semantic boundary:</strong> disposition is explicit selection, not truth, identity, authority or reputation. Source family, source order, source count and evaluation state never select a winner automatically. REJECT and DEFER are not negative evidence.</p>', '<p data-i18n="disposition.semantic">Semantic boundary: disposition is explicit selection, not truth, identity, authority or reputation. Source family, source order, source count and evaluation state never select a winner automatically. REJECT and DEFER are not negative evidence.</p>'),
    ('<a href="../candidates/">Open the P1.9 federated candidate set</a>', '<a href="../candidates/" data-i18n="disposition.candidates_link">Open the P1.9 federated candidate set</a>'),
    ('<a href="../accept/">Open the historical P1.5 adapter-only acceptance gate</a>', '<a href="../accept/" data-i18n="disposition.accept_link">Open the historical P1.5 adapter-only acceptance gate</a>'),
    ('<a href="../interactive/">Open the P1.3 explicit-input verifier</a>', '<a href="../interactive/" data-i18n="disposition.interactive_link">Open the P1.3 explicit-input verifier</a>'),
    ('<a href="../">Open the immutable seven-dimension reference verifier</a>', '<a href="../" data-i18n="disposition.reference_link">Open the immutable seven-dimension reference verifier</a>'),
    ('<a href="example.json">Open the example disposition input JSON</a>', '<a href="example.json" data-i18n="disposition.example_link">Open the example disposition input JSON</a>'),
    ('<a href="example-result.json">Open the example disposition result JSON</a>', '<a href="example-result.json" data-i18n="disposition.result_link">Open the example disposition result JSON</a>'),
    ('<a href="materialized-input.json">Open the materialized P1.3 input JSON</a>', '<a href="materialized-input.json" data-i18n="disposition.materialized_link">Open the materialized P1.3 input JSON</a>'),
    ('<label for="disposition-file-input">Select a local federated disposition JSON file:</label>', '<label for="disposition-file-input" data-i18n="disposition.file_label">Select a local federated disposition JSON file:</label>'),
    ('<label for="disposition-input-json">Or paste/edit federated candidate set + explicit dispositions:</label>', '<label for="disposition-input-json" data-i18n="disposition.paste_label">Or paste/edit federated candidate set + explicit dispositions:</label>'),
    ('<button id="disposition-button" type="button">Apply explicit dispositions</button>', '<button id="disposition-button" type="button" data-i18n="disposition.action">Apply explicit dispositions</button>'),
]


def load_catalog(path: str | Path) -> dict:
    catalog = json.loads(Path(path).read_text(encoding="utf-8"))
    assert set(catalog) == {"en", "ru"}
    assert set(catalog["en"]) == set(catalog["ru"])
    assert all(isinstance(value, str) and value for locale in catalog.values() for value in locale.values())
    return catalog


def compile_runtime(catalog: dict) -> str:
    template = RUNTIME_TEMPLATE.read_text(encoding="utf-8")
    marker = "__UUAAP_L10N_CATALOG__"
    assert template.count(marker) == 1
    return template.replace(marker, json.dumps(catalog, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def extract_controls(page: str) -> str:
    start = page.index('<nav data-l10n-controls')
    end = page.index('</nav>', start) + len('</nav>')
    return page[start:end]


def augment_localization(site_dir: str | Path, messages_path: str | Path = DEFAULT_MESSAGES) -> None:
    site = Path(site_dir)
    reference = site / "verifier/index.html"
    disposition = site / "verifier/disposition/index.html"
    interactive = site / "verifier/interactive/index.html"
    assets = site / "verifier/assets"
    base_messages_path = assets / "messages.json"
    assert reference.is_file() and disposition.is_file() and interactive.is_file()
    assert base_messages_path.is_file() and (assets / "l10n.js").is_file()
    reference_before = reference.read_bytes()

    base = load_catalog(base_messages_path)
    extension = load_catalog(messages_path)
    merged = {locale: dict(base[locale]) for locale in ("en", "ru")}
    for locale in ("en", "ru"):
        overlap = set(merged[locale]) & set(extension[locale])
        assert not overlap, f"P1.10 localization keys collide with earlier layers: {sorted(overlap)}"
        merged[locale].update(extension[locale])
    base_messages_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (assets / "l10n.js").write_text(compile_runtime(merged), encoding="utf-8")

    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    old = '<a href="verifier/disposition/">Open the local federated candidate disposition gate</a>'
    new = '<a href="verifier/disposition/" data-i18n="root.disposition_link">Open the local federated candidate disposition gate</a>'
    assert root_text.count(old) == 1, "P1.10 root disposition link changed"
    root.write_text(root_text.replace(old, new, 1), encoding="utf-8")

    page = disposition.read_text(encoding="utf-8")
    assert "data-l10n-controls" not in page, "P1.10 localization already applied"
    for old_text, new_text in PATCHES:
        assert page.count(old_text) == 1, f"P1.10 static shell changed: {old_text}"
        page = page.replace(old_text, new_text, 1)
    controls = extract_controls(interactive.read_text(encoding="utf-8"))
    page = page.replace("<body>", "<body>\n" + controls, 1)
    page = page.replace("</body>", '  <script src="../assets/l10n.js"></script>\n</body>', 1)
    disposition.write_text(page, encoding="utf-8")

    assert reference.read_bytes() == reference_before, "P1.10 localization mutated immutable reference"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--messages", default=str(DEFAULT_MESSAGES))
    args = parser.parse_args()
    augment_localization(args.site, args.messages)


if __name__ == "__main__":
    main()
