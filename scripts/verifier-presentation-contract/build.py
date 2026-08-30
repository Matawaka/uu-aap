#!/usr/bin/env python3
"""Compatibility CLI for the canonical reusable P1.1 verifier presentation package."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from uuaap_verifier_presentation.core import (  # noqa: E402
    ALLOWED_AGGREGATE_FLAGS,
    DIMENSION_ORDER,
    EVALUATION_STATES,
    FORBIDDEN_KEYS,
    assert_no_aggregate_semantic_collapse,
    build_presentation,
    load_json,
    validate_dimension,
    validate_fixture,
    validate_presentation,
    walk,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture")
    parser.add_argument("--output")
    args = parser.parse_args()

    presentation = build_presentation(load_json(args.fixture))
    rendered = json.dumps(presentation, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
