#!/usr/bin/env python3
"""Compatibility CLI for the canonical reusable P1.1 HTML renderer."""

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
    DIMENSION_ORDER,
    esc,
    list_items,
    render,
    validate_presentation,
)


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
