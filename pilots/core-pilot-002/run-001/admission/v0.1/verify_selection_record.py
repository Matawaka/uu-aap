#!/usr/bin/env python3
import hashlib
import json
import urllib.request

URL = "https://api.github.com/repos/Matawaka/uu-aap/issues/comments/5474174497"
EXPECTED_BODY_SHA256 = "422315f0694a435cbb17ea1f8d3ac9554bbf859580478546606771290ea4b9dd"

req = urllib.request.Request(
    URL,
    headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "uu-aap-core-pilot-002-run-001-admission-v0.1",
    },
)
with urllib.request.urlopen(req, timeout=30) as response:
    data = json.load(response)

assert data["id"] == 5474174497
assert data["html_url"] == "https://github.com/Matawaka/uu-aap/issues/718#issuecomment-5474174497"
assert data["user"]["login"] == "Matawaka"
assert data["author_association"] == "OWNER"
assert data["performed_via_github_app"]["slug"] == "chatgpt-codex-connector"
assert hashlib.sha256(data["body"].encode("utf-8")).hexdigest() == EXPECTED_BODY_SHA256
assert "source selected != reviewer identity verified" in data["body"]
assert "source admitted != claim accepted as truth" in data["body"]
assert "pilot disposition != normative change" in data["body"]
print("Run 001 repository-owner selection record: PASS")
