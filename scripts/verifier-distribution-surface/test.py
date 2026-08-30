#!/usr/bin/env python3
"""P1.2 equivalence and distribution-boundary tests."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from uuaap_verifier_presentation import DIMENSION_ORDER, build_presentation, load_json, render  # noqa: E402
from build_site import build_site  # noqa: E402

P11 = REPO_ROOT / "scripts" / "verifier-presentation-contract"
FIXTURE = P11 / "fixture.json"
SNAPSHOT = P11 / "reference.html"


def main() -> None:
    fixture = load_json(FIXTURE)
    package_presentation = build_presentation(fixture)
    package_html = render(package_presentation)
    snapshot = SNAPSHOT.read_text(encoding="utf-8")

    assert package_html == snapshot, "package renderer drifted from merged P1.1 snapshot"
    assert package_html.count('data-dimension="') == 7
    assert tuple(package_presentation["dimension_order"]) == DIMENSION_ORDER

    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        legacy_json = temp / "legacy.json"
        legacy_html = temp / "legacy.html"
        site = temp / "site"

        subprocess.run(
            [sys.executable, str(P11 / "build.py"), str(FIXTURE), "--output", str(legacy_json)],
            cwd=REPO_ROOT,
            check=True,
        )
        subprocess.run(
            [sys.executable, str(P11 / "render.py"), str(legacy_json), "--output", str(legacy_html)],
            cwd=REPO_ROOT,
            check=True,
        )
        assert json.loads(legacy_json.read_text(encoding="utf-8")) == package_presentation
        assert legacy_html.read_text(encoding="utf-8") == package_html

        built = build_site(FIXTURE, site)
        assert built == package_presentation
        assert (site / "verifier" / "index.html").read_text(encoding="utf-8") == package_html
        assert json.loads((site / "verifier" / "presentation.json").read_text(encoding="utf-8")) == package_presentation
        assert (site / ".nojekyll").exists()
        landing = (site / "index.html").read_text(encoding="utf-8")
        assert 'href="verifier/"' in landing
        assert landing.count("<code>") == 7
        for name in DIMENSION_ORDER:
            assert f"<code>{name}</code>" in landing

        all_html = landing + package_html
        lowered = all_html.lower()
        for forbidden in (
            "verified true",
            "trust score",
            "truth score",
            "overall trust",
            "overall verdict",
            "umbrella verified",
            "<script",
            "http://",
            "https://",
        ):
            assert forbidden not in lowered, forbidden

    print("P1.2 package == legacy P1.1 == Pages verifier: PASS")
    print("one semantic implementation -> reusable package + static reference deployment")
    print("seven dimensions preserved; aggregate verdict remains forbidden")


if __name__ == "__main__":
    main()
