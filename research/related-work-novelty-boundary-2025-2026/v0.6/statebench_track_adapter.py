#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parent
MAPPING_PATH = BASE / "track-mapping.json"


def load_mapping() -> dict[str, Any]:
    return json.loads(MAPPING_PATH.read_text(encoding="utf-8"))


def mapping_index() -> dict[str, dict[str, Any]]:
    data = load_mapping()
    return {row["track"]: row for row in data["mappings"]}


def classify_track(track: str) -> dict[str, Any]:
    row = mapping_index().get(track)
    if row is None:
        return {
            "track": track,
            "classification": "UNSEEN_TRACK",
            "candidate_promotions": [],
            "reason": "Track is not present in the bounded documented mapping audit; no semantic promotion is inferred.",
        }
    return row


def main() -> None:
    data = load_mapping()
    counts: dict[str, int] = {}
    for row in data["mappings"]:
        counts[row["classification"]] = counts.get(row["classification"], 0) + 1
    print(json.dumps({"tracks": len(data["mappings"]), "counts": counts}, sort_keys=True))


if __name__ == "__main__":
    main()
