#!/usr/bin/env python3
import hashlib
import json
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXPECTED = json.loads((HERE / "observation.json").read_text(encoding="utf-8"))["source"]


def main():
    request = urllib.request.Request(
        EXPECTED["api_url"],
        headers={"Accept": "application/vnd.github+json", "User-Agent": "uu-aap-core-pilot-002-observer-v0.1"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"unexpected HTTP status {response.status}")
        source = json.load(response)

    checks = {
        "id": EXPECTED["comment_id"],
        "html_url": EXPECTED["url"],
        "issue_url": "https://api.github.com/repos/Matawaka/uu-aap/issues/422",
        "author_association": EXPECTED["author_association"],
        "created_at": EXPECTED["created_at"],
        "updated_at": EXPECTED["updated_at"],
    }
    for key, value in checks.items():
        if source.get(key) != value:
            raise RuntimeError(f"live source drift: {key}")

    user = source.get("user") or {}
    if user.get("login") != EXPECTED["author_account_identifier"]:
        raise RuntimeError("live source drift: author account identifier")
    if user.get("id") != EXPECTED["author_account_numeric_id"]:
        raise RuntimeError("live source drift: author account numeric id")
    if user.get("login") == "Matawaka":
        raise RuntimeError("source account label unexpectedly equals repository owner")

    app = source.get("performed_via_github_app") or {}
    expected_app = EXPECTED["performed_via_github_app"]
    if app.get("slug") != expected_app["slug"] or app.get("id") != expected_app["id"]:
        raise RuntimeError("live source drift: GitHub app mediation")

    body = source.get("body")
    if not isinstance(body, str) or not body:
        raise RuntimeError("live source body missing")
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    if digest != EXPECTED["body_sha256"]:
        raise RuntimeError("live source drift: body digest")

    print("CORE_PILOT_002_LIVE_SOURCE_BINDING_PASS")
    print(f"comment_id={EXPECTED['comment_id']} body_sha256={digest} app_mediated=true")


if __name__ == "__main__":
    main()
