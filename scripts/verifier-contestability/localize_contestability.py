#!/usr/bin/env python3
"""Extend a validated P1.6 EN/RU shell with P1.7 contestability-only labels."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
DEFAULT_MESSAGES = HERE / "messages.json"
RUNTIME_TEMPLATE = REPO_ROOT / "scripts" / "verifier-policy-localization" / "runtime.js"

CONTEST_PATCHES = [
    ('<h1>UU-AAP Local Contestability Overlay</h1>', '<h1 data-i18n="contest.heading">UU-AAP Local Contestability Overlay</h1>'),
    ('<p>Apply explicit correction, dispute and appeal records over a validated seven-dimension verifier input without silently rewriting history.</p>', '<p data-i18n="contest.description">Apply explicit correction, dispute and appeal records over a validated seven-dimension verifier input without silently rewriting history.</p>'),
    ('<p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>', '<p data-i18n="contest.privacy">Privacy boundary: selected files and pasted JSON stay in this browser. This page has no server upload, model call, analytics or external runtime dependency.</p>'),
    ('<p><strong>Semantic boundary:</strong> contestability is an overlay, not an eighth verifier dimension. Disputes and appeals do not mutate claims; applied corrections preserve the historical claim and expose an explicit successor.</p>', '<p data-i18n="contest.semantic">Semantic boundary: contestability is an overlay, not an eighth verifier dimension. Disputes and appeals do not mutate claims; applied corrections preserve the historical claim and expose an explicit successor.</p>'),
    ('<a href="../accept/">Open the P1.5 candidate acceptance gate</a>', '<a href="../accept/" data-i18n="contest.accept_link">Open the P1.5 candidate acceptance gate</a>'),
    ('<a href="../interactive/">Open the P1.3 explicit-input verifier</a>', '<a href="../interactive/" data-i18n="contest.interactive_link">Open the P1.3 explicit-input verifier</a>'),
    ('<a href="../">Open the immutable seven-dimension reference verifier</a>', '<a href="../" data-i18n="contest.reference_link">Open the immutable seven-dimension reference verifier</a>'),
    ('<a href="example.json">Open the example contestability input JSON</a>', '<a href="example.json" data-i18n="contest.example_link">Open the example contestability input JSON</a>'),
    ('<a href="example-result.json">Open the example contestability result JSON</a>', '<a href="example-result.json" data-i18n="contest.result_link">Open the example contestability result JSON</a>'),
    ('<label for="contestability-file-input">Select a local contestability JSON file:</label>', '<label for="contestability-file-input" data-i18n="contest.file_label">Select a local contestability JSON file:</label>'),
    ('<label for="contestability-input-json">Or paste/edit contestability input JSON:</label>', '<label for="contestability-input-json" data-i18n="contest.paste_label">Or paste/edit contestability input JSON:</label>'),
    ('<button id="contestability-button" type="button">Apply contestability overlay</button>', '<button id="contestability-button" type="button" data-i18n="contest.action">Apply contestability overlay</button>'),
]


def load_catalog(path: Path) -> dict:
    catalog = json.loads(path.read_text(encoding="utf-8"))
    assert set(catalog) == {"en", "ru"}
    assert set(catalog["en"]) == set(catalog["ru"])
    assert all(isinstance(value, str) and value for locale in catalog.values() for value in locale.values())
    return catalog


def merge_catalogs(base: dict, extension: dict) -> dict:
    merged = {locale: dict(base[locale]) for locale in ("en", "ru")}
    for locale in ("en", "ru"):
        overlap = set(merged[locale]) & set(extension[locale])
        assert not overlap, f"P1.7 localization keys collide with P1.6: {sorted(overlap)}"
        merged[locale].update(extension[locale])
    assert set(merged["en"]) == set(merged["ru"])
    return merged


def compile_runtime(catalog: dict) -> str:
    template = RUNTIME_TEMPLATE.read_text(encoding="utf-8")
    marker = "__UUAAP_L10N_CATALOG__"
    assert template.count(marker) == 1
    payload = json.dumps(catalog, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return template.replace(marker, payload)


def _extract_controls(localized_page: str) -> str:
    start = localized_page.index('<nav data-l10n-controls')
    end = localized_page.index('</nav>', start) + len('</nav>')
    return localized_page[start:end]


def augment_localization(site_dir: str | Path, messages_path: str | Path = DEFAULT_MESSAGES) -> None:
    site = Path(site_dir)
    reference = site / "verifier" / "index.html"
    contest = site / "verifier" / "contest" / "index.html"
    interactive = site / "verifier" / "interactive" / "index.html"
    assets = site / "verifier" / "assets"
    base_messages_path = assets / "messages.json"
    assert reference.is_file() and contest.is_file() and interactive.is_file()
    assert base_messages_path.is_file() and (assets / "l10n.js").is_file(), "validated P1.6 localization is required"
    reference_before = reference.read_bytes()

    base = load_catalog(base_messages_path)
    extension = load_catalog(Path(messages_path))
    merged = merge_catalogs(base, extension)
    base_messages_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (assets / "l10n.js").write_text(compile_runtime(merged), encoding="utf-8")

    root = site / "index.html"
    root_text = root.read_text(encoding="utf-8")
    root_old = '<a href="verifier/contest/">Open the local contestability overlay</a>'
    root_new = '<a href="verifier/contest/" data-i18n="root.contest_link">Open the local contestability overlay</a>'
    assert root_text.count(root_old) == 1, "P1.7 root contestability link changed"
    root.write_text(root_text.replace(root_old, root_new, 1), encoding="utf-8")

    contest_text = contest.read_text(encoding="utf-8")
    assert "data-l10n-controls" not in contest_text, "contestability localization already applied"
    for old, new in CONTEST_PATCHES:
        assert contest_text.count(old) == 1, f"contestability static shell changed: {old}"
        contest_text = contest_text.replace(old, new, 1)
    controls = _extract_controls(interactive.read_text(encoding="utf-8"))
    assert "<body>" in contest_text and "</body>" in contest_text
    contest_text = contest_text.replace("<body>", "<body>\n" + controls, 1)
    contest_text = contest_text.replace("</body>", '  <script src="../assets/l10n.js"></script>\n</body>', 1)
    contest.write_text(contest_text, encoding="utf-8")

    assert reference.read_bytes() == reference_before, "P1.7 localization must not mutate immutable P1.1 reference"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True)
    parser.add_argument("--messages", default=str(DEFAULT_MESSAGES))
    args = parser.parse_args()
    augment_localization(args.site, args.messages)


if __name__ == "__main__":
    main()
