#!/usr/bin/env python3
"""Extend validated EN/RU verifier shell with P1.9 candidate-federation labels only."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
DEFAULT_MESSAGES = HERE / "messages.json"
RUNTIME_TEMPLATE = REPO_ROOT / "scripts" / "verifier-policy-localization" / "runtime.js"

PATCHES = [
    ('<h1>UU-AAP Local Candidate Source Federation</h1>', '<h1 data-i18n="candidates.heading">UU-AAP Local Candidate Source Federation</h1>'),
    ('<p>Combine already validated P1.4 evidence-adapter candidates and P1.8 identity candidates into one seven-bucket candidate set while preserving source provenance.</p>', '<p data-i18n="candidates.description">Combine already validated P1.4 evidence-adapter candidates and P1.8 identity candidates into one seven-bucket candidate set while preserving source provenance.</p>'),
    ('<p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>', '<p data-i18n="candidates.privacy">Privacy boundary: selected files and pasted JSON stay in this browser. This page has no server upload, model, analytics or external runtime dependency.</p>'),
    ('<p><strong>Semantic boundary:</strong> federation is not acceptance, ranking, consensus, confidence or trust. Source order is history/presentation order only. CAWG roles and W3C review attestations remain auxiliary and never become candidates.</p>', '<p data-i18n="candidates.semantic">Semantic boundary: federation is not acceptance, ranking, consensus, confidence or trust. Source order is history/presentation order only. CAWG roles and W3C review attestations remain auxiliary and never become candidates.</p>'),
    ('<a href="../attest/">Open the P1.8 scoped attestation bridge</a>', '<a href="../attest/" data-i18n="candidates.attest_link">Open the P1.8 scoped attestation bridge</a>'),
    ('<a href="../adapt/">Open the P1.4 bounded evidence adapter</a>', '<a href="../adapt/" data-i18n="candidates.adapt_link">Open the P1.4 bounded evidence adapter</a>'),
    ('<a href="../accept/">Open the historical P1.5 adapter-candidate acceptance gate</a>', '<a href="../accept/" data-i18n="candidates.accept_link">Open the historical P1.5 adapter-candidate acceptance gate</a>'),
    ('<a href="../">Open the immutable seven-dimension reference verifier</a>', '<a href="../" data-i18n="candidates.reference_link">Open the immutable seven-dimension reference verifier</a>'),
    ('<a href="example.json">Open the example federation input JSON</a>', '<a href="example.json" data-i18n="candidates.example_link">Open the example federation input JSON</a>'),
    ('<a href="example-result.json">Open the example federated candidate set JSON</a>', '<a href="example-result.json" data-i18n="candidates.result_link">Open the example federated candidate set JSON</a>'),
    ('<label for="federation-file-input">Select a local federation JSON file:</label>', '<label for="federation-file-input" data-i18n="candidates.file_label">Select a local federation JSON file:</label>'),
    ('<label for="federation-input-json">Or paste/edit validated P1.4 + P1.8 source results:</label>', '<label for="federation-input-json" data-i18n="candidates.paste_label">Or paste/edit validated P1.4 + P1.8 source results:</label>'),
    ('<button id="federation-button" type="button">Federate candidate sources</button>', '<button id="federation-button" type="button" data-i18n="candidates.action">Federate candidate sources</button>'),
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
    return template.replace(
        marker,
        json.dumps(catalog, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
    )


def extract_controls(page: str) -> str:
    start = page.index('<nav data-l10n-controls')
    end = page.index('</nav>', start) + len('</nav>')
    return page[start:end]


def augment_localization(site_dir: str | Path, messages_path: str | Path = DEFAULT_MESSAGES) -> None:
    site = Path(site_dir)
    reference = site / "verifier/index.html"
    candidates = site / "verifier/candidates/index.html"
    interactive = site / "verifier/interactive/index.html"
    assets = site / "verifier/assets"
    base_messages_path = assets / "messages.json"
    assert reference.is_file() and candidates.is_file() and interactive.is_file()
    assert base_messages_path.is_file() and (assets / "l10n.js").is_file()
    reference_before = reference.read_bytes()

    base = load_catalog(base_messages_path)
    extension = load_catalog(messages_path)
    merged = {locale: dict(base[locale]) for locale in ("en", "ru")}
    for locale in ("en", "ru"):
        overlap = set(merged[locale]) & set(extension[locale])
        assert not overlap, f"P1.9 localization keys collide with earlier layers: {sorted(overlap)}"
        merged[locale].update(extension[locale])
    base_messages_path.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (assets / "l10n.js").write_text(compile_runtime(merged), encoding="utf-8")

    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    old = '<a href="verifier/candidates/">Open the local candidate source federation</a>'
    new = '<a href="verifier/candidates/" data-i18n="root.candidates_link">Open the local candidate source federation</a>'
    assert root_text.count(old) == 1, "P1.9 root federation link changed"
    root.write_text(root_text.replace(old, new, 1), encoding="utf-8")

    page = candidates.read_text(encoding="utf-8")
    assert "data-l10n-controls" not in page, "P1.9 localization already applied"
    for old_text, new_text in PATCHES:
        assert page.count(old_text) == 1, f"P1.9 static shell changed: {old_text}"
        page = page.replace(old_text, new_text, 1)
    controls = extract_controls(interactive.read_text(encoding="utf-8"))
    page = page.replace("<body>", "<body>\n" + controls, 1)
    page = page.replace("</body>", '  <script src="../assets/l10n.js"></script>\n</body>', 1)
    candidates.write_text(page, encoding="utf-8")

    assert reference.read_bytes() == reference_before, "P1.9 localization mutated immutable reference"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--messages", default=str(DEFAULT_MESSAGES))
    args = parser.parse_args()
    augment_localization(args.site, args.messages)


if __name__ == "__main__":
    main()
