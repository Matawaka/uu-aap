#!/usr/bin/env python3
import hashlib
import json
import urllib.request

URL = "https://api.github.com/repos/Matawaka/uu-aap/issues/comments/5474573197"
EXPECTED_SHA256 = "d1137cb69f2445cbd9b5bba0d275898597275daa04fe66ba75be70533c3ff881"


def main():
    request = urllib.request.Request(URL, headers={"Accept": "application/vnd.github+json", "User-Agent": "uu-aap-stage-b-validator"})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    if data.get("id") != 5474573197:
        raise SystemExit("design decision comment id drift")
    if data.get("user", {}).get("login") != "Matawaka":
        raise SystemExit("design decision source account drift")
    if data.get("author_association") != "OWNER":
        raise SystemExit("design decision author association drift")
    app = data.get("performed_via_github_app") or {}
    if app.get("slug") != "chatgpt-codex-connector":
        raise SystemExit("design decision mediation drift")
    body = data.get("body")
    if not isinstance(body, str):
        raise SystemExit("design decision body missing")
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit("design decision body SHA-256 drift")
    print("RESPONSIBILITY_STAGE_B_HUMAN_DESIGN_DECISION_BINDING_PASS")
    print(f"comment_id=5474573197 body_sha256={digest} app_mediated=true")


if __name__ == "__main__":
    main()
