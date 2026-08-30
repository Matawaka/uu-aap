#!/usr/bin/env python3
"""Extend validated P1.6/P1.7 EN/RU shell with P1.8 attestation-only labels."""
from __future__ import annotations
import argparse, json
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO_ROOT=HERE.parents[1]
DEFAULT_MESSAGES=HERE/"messages.json"
RUNTIME_TEMPLATE=REPO_ROOT/"scripts/verifier-policy-localization/runtime.js"
PATCHES=[
 ('<h1>UU-AAP Local Scoped Attestation Bridge</h1>','<h1 data-i18n="attest.heading">UU-AAP Local Scoped Attestation Bridge</h1>'),
 ('<p>Bridge external CAWG Identity Assertion 1.3 and W3C VC 2.0 validation receipts into bounded identity candidates and auxiliary role/review attestations.</p>','<p data-i18n="attest.description">Bridge external CAWG Identity Assertion 1.3 and W3C VC 2.0 validation receipts into bounded identity candidates and auxiliary role/review attestations.</p>'),
 ('<p><strong>Privacy boundary:</strong> selected files and pasted JSON stay in this browser. This page performs no DID, wallet, revocation, status-list, model, analytics or backend call.</p>','<p data-i18n="attest.privacy">Privacy boundary: selected files and pasted JSON stay in this browser. This page performs no DID, wallet, revocation, status-list, model, analytics or backend call.</p>'),
 ('<p><strong>Semantic boundary:</strong> credential validity and CAWG roles do not become UU-AAP authority, responsibility, authorship or factual truth. P1.8 identity candidates are not auto-materialized into the seven-dimension verifier.</p>','<p data-i18n="attest.semantic">Semantic boundary: credential validity and CAWG roles do not become UU-AAP authority, responsibility, authorship or factual truth. P1.8 identity candidates are not auto-materialized into the seven-dimension verifier.</p>'),
 ('<a href="../contest/">Open the P1.7 contestability overlay</a>','<a href="../contest/" data-i18n="attest.contest_link">Open the P1.7 contestability overlay</a>'),
 ('<a href="../interactive/">Open the P1.3 explicit-input verifier</a>','<a href="../interactive/" data-i18n="attest.interactive_link">Open the P1.3 explicit-input verifier</a>'),
 ('<a href="../">Open the immutable seven-dimension reference verifier</a>','<a href="../" data-i18n="attest.reference_link">Open the immutable seven-dimension reference verifier</a>'),
 ('<a href="example.json">Open the example attestation input JSON</a>','<a href="example.json" data-i18n="attest.example_link">Open the example attestation input JSON</a>'),
 ('<a href="example-result.json">Open the example attestation result JSON</a>','<a href="example-result.json" data-i18n="attest.result_link">Open the example attestation result JSON</a>'),
 ('<label for="attestation-file-input">Select a local attestation JSON file:</label>','<label for="attestation-file-input" data-i18n="attest.file_label">Select a local attestation JSON file:</label>'),
 ('<label for="attestation-input-json">Or paste/edit attestation validation receipts:</label>','<label for="attestation-input-json" data-i18n="attest.paste_label">Or paste/edit attestation validation receipts:</label>'),
 ('<button id="attestation-button" type="button">Bridge local attestation receipts</button>','<button id="attestation-button" type="button" data-i18n="attest.action">Bridge local attestation receipts</button>'),
]

def load(path):
 d=json.loads(Path(path).read_text(encoding="utf-8")); assert set(d)=={"en","ru"}; assert set(d["en"])==set(d["ru"]); return d

def compile_runtime(catalog):
 t=RUNTIME_TEMPLATE.read_text(encoding="utf-8"); marker="__UUAAP_L10N_CATALOG__"; assert t.count(marker)==1
 return t.replace(marker,json.dumps(catalog,ensure_ascii=False,sort_keys=True,separators=(",",":")))

def controls(page):
 start=page.index('<nav data-l10n-controls'); end=page.index('</nav>',start)+len('</nav>'); return page[start:end]

def augment_localization(site_dir, messages_path=DEFAULT_MESSAGES):
 site=Path(site_dir); reference=site/"verifier/index.html"; attest=site/"verifier/attest/index.html"; interactive=site/"verifier/interactive/index.html"; assets=site/"verifier/assets"; base_path=assets/"messages.json"
 assert reference.is_file() and attest.is_file() and interactive.is_file() and base_path.is_file()
 before=reference.read_bytes(); base=load(base_path); ext=load(messages_path); merged={k:dict(base[k]) for k in ("en","ru")}
 for locale in ("en","ru"):
  overlap=set(merged[locale])&set(ext[locale]); assert not overlap, f"P1.8 localization collision: {sorted(overlap)}"; merged[locale].update(ext[locale])
 base_path.write_text(json.dumps(merged,indent=2,ensure_ascii=False)+"\n",encoding="utf-8"); (assets/"l10n.js").write_text(compile_runtime(merged),encoding="utf-8")
 root=site/"index.html"; rt=root.read_text(encoding="utf-8"); old='<a href="verifier/attest/">Open the local scoped attestation bridge</a>'; new='<a href="verifier/attest/" data-i18n="root.attest_link">Open the local scoped attestation bridge</a>'; assert rt.count(old)==1; root.write_text(rt.replace(old,new,1),encoding="utf-8")
 text=attest.read_text(encoding="utf-8"); assert "data-l10n-controls" not in text
 for old,new in PATCHES: assert text.count(old)==1, f"attestation static shell changed: {old}"; text=text.replace(old,new,1)
 text=text.replace("<body>","<body>\n"+controls(interactive.read_text(encoding="utf-8")),1); text=text.replace("</body>",'  <script src="../assets/l10n.js"></script>\n</body>',1); attest.write_text(text,encoding="utf-8")
 assert reference.read_bytes()==before

def main():
 p=argparse.ArgumentParser(); p.add_argument("--site",required=True); p.add_argument("--messages",default=str(DEFAULT_MESSAGES)); a=p.parse_args(); augment_localization(a.site,a.messages)
if __name__=="__main__": main()
