#!/usr/bin/env python3
"""Extend validated EN/RU verifier shell with P1.12 integrity-surface labels only."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
DEFAULT_MESSAGES = HERE / "messages.json"
RUNTIME_TEMPLATE = REPO_ROOT / "scripts" / "verifier-policy-localization" / "runtime.js"

PATCHES = [
    ('<h1>UU-AAP Local Disposition Integrity Verifier</h1>', '<h1 data-i18n="integrity.heading">UU-AAP Local Disposition Integrity Verifier</h1>'),
    ('<p>Verify that a supplied P1.10 disposition result exactly matches deterministic historical rematerialization through P1.11.</p>', '<p data-i18n="integrity.description">Verify that a supplied P1.10 disposition result exactly matches deterministic historical rematerialization through P1.11.</p>'),
    ('<p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>', '<p data-i18n="integrity.privacy">Privacy boundary: selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>'),
    ('<p><strong>Semantic boundary:</strong> canonical rematerialization equality establishes bounded result integrity only. It does not establish truth, identity, authority, authorship, responsibility or publication/action permission.</p>', '<p data-i18n="integrity.semantic">Semantic boundary: canonical rematerialization equality establishes bounded result integrity only. It does not establish truth, identity, authority, authorship, responsibility or publication/action permission.</p>'),
    ('<a href="../disposition/">Open the P1.10 federated disposition gate</a>', '<a href="../disposition/" data-i18n="integrity.disposition_link">Open the P1.10 federated disposition gate</a>'),
    ('<a href="../">Open the immutable seven-dimension reference verifier</a>', '<a href="../" data-i18n="integrity.reference_link">Open the immutable seven-dimension reference verifier</a>'),
    ('<a href="example.json">Open the example P1.11 integrity input JSON</a>', '<a href="example.json" data-i18n="integrity.example_link">Open the example P1.11 integrity input JSON</a>'),
    ('<a href="example-result.json">Open the example P1.11 integrity result JSON</a>', '<a href="example-result.json" data-i18n="integrity.result_link">Open the example P1.11 integrity result JSON</a>'),
    ('<label for="integrity-file-input">Select a local P1.11 integrity input JSON file:</label>', '<label for="integrity-file-input" data-i18n="integrity.file_label">Select a local P1.11 integrity input JSON file:</label>'),
    ('<label for="integrity-input-json">Or paste/edit a P1.11 integrity input JSON:</label>', '<label for="integrity-input-json" data-i18n="integrity.paste_label">Or paste/edit a P1.11 integrity input JSON:</label>'),
    ('<button id="integrity-button" type="button">Verify disposition result integrity</button>', '<button id="integrity-button" type="button" data-i18n="integrity.action">Verify disposition result integrity</button>'),
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
    integrity = site / "verifier/integrity/index.html"
    disposition = site / "verifier/disposition/index.html"
    assets = site / "verifier/assets"
    base_messages_path = assets / "messages.json"
    assert reference.is_file() and integrity.is_file() and disposition.is_file()
    assert base_messages_path.is_file() and (assets / "l10n.js").is_file()
    reference_before = reference.read_bytes()
    input_before = (site / "verifier/integrity/example.json").read_bytes()
    result_before = (site / "verifier/integrity/example-result.json").read_bytes()
    core_before = (site / "verifier/integrity/core.js").read_bytes()

    base = load_catalog(base_messages_path)
    extension = load_catalog(messages_path)
    merged = {locale: dict(base[locale]) for locale in ("en", "ru")}
    for locale in ("en", "ru"):
        overlap = set(merged[locale]) & set(extension[locale])
        assert not overlap, f"P1.12 localization keys collide with earlier layers: {sorted(overlap)}"
        merged[locale].update(extension[locale])
    base_messages_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (assets / "l10n.js").write_text(compile_runtime(merged), encoding="utf-8")

    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    old = '<a href="verifier/integrity/">Open the local disposition integrity verifier</a>'
    new = '<a href="verifier/integrity/" data-i18n="root.integrity_link">Open the local disposition integrity verifier</a>'
    assert root_text.count(old) == 1, "P1.12 root integrity link changed"
    root.write_text(root_text.replace(old, new, 1), encoding="utf-8")

    page = integrity.read_text(encoding="utf-8")
    assert "data-l10n-controls" not in page, "P1.12 localization already applied"
    for old_text, new_text in PATCHES:
        assert page.count(old_text) == 1, f"P1.12 static shell changed: {old_text}"
        page = page.replace(old_text, new_text, 1)
    controls = extract_controls(disposition.read_text(encoding="utf-8"))
    page = page.replace("<body>", "<body>\n" + controls, 1)
    page = page.replace("</body>", '  <script src="../assets/l10n.js"></script>\n</body>', 1)
    integrity.write_text(page, encoding="utf-8")

    assert reference.read_bytes() == reference_before, "P1.12 localization mutated immutable reference"
    assert (site / "verifier/integrity/example.json").read_bytes() == input_before, "P1.12 localization changed integrity input JSON"
    assert (site / "verifier/integrity/example-result.json").read_bytes() == result_before, "P1.12 localization changed integrity result JSON"
    assert (site / "verifier/integrity/core.js").read_bytes() == core_before, "P1.12 localization changed historical P1.11 browser core"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--messages", default=str(DEFAULT_MESSAGES))
    args = parser.parse_args()
    augment_localization(args.site, args.messages)


if __name__ == "__main__":
    main()
