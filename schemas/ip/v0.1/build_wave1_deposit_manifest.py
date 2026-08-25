#!/usr/bin/env python3
"""Build or verify the frozen Wave 1 UU-AAP Core deposit inventory."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
OBJECT_ID = "urn:uu-aap:software:core-receipt-chain-validator:v0.1"
TITLE_RU = "Валидатор цепочек квитанций UU-AAP Core v0.1"
TITLE_EN = "UU-AAP Core v0.1 Receipt Chain Validator"
FREEZE_FRONTIER = "8aec7684a54e2570c285720a22d30d99f958131a"
FIRST_PUBLIC_DISCLOSURE = "2026-08-24T19:01:17+05:00"
PATENT_TRACK_ISSUE = 492

FILES = [
    ("protocols/core/v0.1/validate-core.js", "PROGRAM_SOURCE"),
    ("protocols/core/v0.1/receipt-envelope.schema.json", "IDENTIFYING_SCHEMA"),
    ("protocols/core/v0.1/end-to-end.fixture.json", "CONFORMANCE_FIXTURE"),
]

ABSTRACT_RU = (
    "Валидатор цепочек квитанций UU-AAP Core v0.1 предназначен для проверки "
    "машиночитаемых цепочек квитанций протокола UU-AAP Core. Программа проверяет "
    "структуру квитанций, типы семи протокольных примитивов, связи с предшествующими "
    "квитанциями, контрольные хэши, утверждения и явно заданные non-effects, а также "
    "fail-closed условия переходов от состояния через возможность, намерение, "
    "полномочия/ответственность, координацию и действие к результату и последующему "
    "состоянию. Область применения: системы provenance, accountability и доказуемого "
    "взаимодействия человека, искусственного интеллекта и цифровых сервисов. "
    "Язык программирования: JavaScript (Node.js). Объем программы: 15144 байта."
)


def git_blob_sha1(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build() -> dict:
    entries = []
    program_size = 0
    support_size = 0

    for rel, role in FILES:
        data = (REPO_ROOT / rel).read_bytes()
        size = len(data)
        if role == "PROGRAM_SOURCE":
            program_size += size
        else:
            support_size += size
        entries.append(
            {
                "path": rel,
                "role": role,
                "size_bytes": size,
                "git_blob_sha1": git_blob_sha1(data),
                "sha256": sha256(data),
            }
        )

    entries.sort(key=lambda item: item["path"])

    inventory = bytearray(b"UU-AAP-DEPOSIT-INVENTORY-v0.1\n")
    for entry in entries:
        inventory.extend(entry["path"].encode("utf-8"))
        inventory.extend(b"\0")
        inventory.extend(entry["role"].encode("ascii"))
        inventory.extend(b"\0")
        inventory.extend(str(entry["size_bytes"]).encode("ascii"))
        inventory.extend(b"\0")
        inventory.extend(entry["sha256"].encode("ascii"))
        inventory.extend(b"\n")

    return {
        "record_version": "0.1",
        "object_id": OBJECT_ID,
        "title_ru": TITLE_RU,
        "title_en": TITLE_EN,
        "freeze_frontier": FREEZE_FRONTIER,
        "first_public_disclosure": FIRST_PUBLIC_DISCLOSURE,
        "patent_screen": {
            "software_registration_scope": "PROGRAM_EXPRESSION_ONLY",
            "public_disclosure_status": "ALREADY_PUBLIC",
            "separate_patent_track_issue": PATENT_TRACK_ISSUE,
            "technical_patent_rights_effect": "PRESERVED_FOR_SEPARATE_REVIEW",
        },
        "programming_languages": ["JavaScript (Node.js)"],
        "program_size_bytes": program_size,
        "deposit_support_size_bytes": support_size,
        "deposit_total_size_bytes": program_size + support_size,
        "canonicalization": "UU-AAP-DEPOSIT-INVENTORY-v0.1",
        "package_digest_algorithm": "SHA-256",
        "package_digest": "sha256:" + sha256(bytes(inventory)),
        "files": entries,
        "abstract_ru": ABSTRACT_RU,
        "abstract_characters": len(ABSTRACT_RU),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", type=Path, help="Compare generated record with committed JSON")
    args = parser.parse_args()

    generated = build()
    rendered = json.dumps(generated, ensure_ascii=False, indent=2) + "\n"

    if args.check:
        committed = json.loads(args.check.read_text(encoding="utf-8"))
        if committed != generated:
            print("DEPOSIT_MANIFEST_MISMATCH")
            print(rendered, end="")
            return 1
        print("deposit manifest: exact reproducible match")
        print(f"package_digest={generated['package_digest']}")
        return 0

    print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
