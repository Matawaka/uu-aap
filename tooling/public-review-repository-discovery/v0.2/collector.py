#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
POLICY_PATH = HERE / "policy.json"
SCHEMA_PATH = HERE / "receipt.schema.json"
API_ROOT = "https://api.github.com"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def api_get(path: str, token: str | None):
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "uu-aap-public-review-repository-discovery-v0.2",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(API_ROOT + path, headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API {exc.code} for {path}: {body[:500]}") from exc


def fetch_paginated(endpoint: str, token: str | None, extra: dict[str, str] | None = None):
    items = []
    page = 1
    while True:
        params = {"per_page": "100", "page": str(page)}
        if extra:
            params.update(extra)
        batch = api_get(endpoint + "?" + urlencode(params), token)
        if not isinstance(batch, list):
            raise RuntimeError(f"GitHub response is not a list for {endpoint}")
        items.extend(batch)
        if len(batch) < 100:
            return items
        page += 1
        if page > 1000:
            raise RuntimeError(f"pagination safety limit exceeded for {endpoint}")


def issue_number_from_url(issue_url: str) -> int:
    try:
        number = int(issue_url.rstrip("/").rsplit("/", 1)[1])
    except (AttributeError, ValueError, IndexError) as exc:
        raise ValueError(f"cannot parse issue number from {issue_url!r}") from exc
    if number < 1:
        raise ValueError("issue number must be positive")
    return number


def comment_surface_kind(comment: dict, repository: str) -> str:
    html_url = comment.get("html_url")
    if not isinstance(html_url, str):
        raise ValueError("comment html_url missing")
    pr_prefix = f"https://github.com/{repository}/pull/"
    issue_prefix = f"https://github.com/{repository}/issues/"
    if html_url.startswith(pr_prefix) and "#issuecomment-" in html_url:
        return "PULL_REQUEST_COMMENT"
    if html_url.startswith(issue_prefix) and "#issuecomment-" in html_url:
        return "ISSUE_COMMENT"
    raise ValueError(f"unexpected repository issue-comment html_url: {html_url!r}")


def account_classification(obj: dict, project_account: str) -> str:
    user = obj.get("user")
    if not user:
        return "UNATTRIBUTED_SOURCE"
    login = user.get("login")
    if login == project_account:
        return "PROJECT_ACCOUNT_SOURCE"
    if user.get("type") == "Bot":
        return "AUTOMATION_SOURCE"
    return "EXTERNAL_ACCOUNT_SOURCE"


def source_record(kind: str, issue: dict, obj: dict, classification: str) -> dict:
    if kind not in {"ISSUE_BODY", "ISSUE_COMMENT"}:
        raise ValueError("unsupported source kind")
    user = obj.get("user") or {}
    app = obj.get("performed_via_github_app") or {}
    body = obj.get("body") or ""
    source_id = int(obj["id"])
    return {
        "source_kind": kind,
        "issue_number": int(issue["number"]),
        "issue_state": issue["state"],
        "source_id": source_id,
        "url": obj["html_url"],
        "author_account_identifier": user.get("login") or "UNKNOWN_ACCOUNT_IDENTIFIER",
        "author_type": user.get("type") or "UNKNOWN_ACCOUNT_TYPE",
        "author_association": obj.get("author_association"),
        "performed_via_github_app_slug": app.get("slug"),
        "created_at": obj.get("created_at"),
        "updated_at": obj.get("updated_at"),
        "body_sha256": sha256_text(body),
        "classification": classification,
    }


def historical_index(policy: dict):
    index = {}
    for entry in policy["known_historical_external_sources"]:
        key = (entry["source_kind"], int(entry["issue_number"]), int(entry["source_id"]))
        if key in index:
            raise ValueError(f"duplicate historical source key: {key}")
        index[key] = entry
    return index


def classify_external_record(record: dict, known: dict) -> str:
    key = (record["source_kind"], record["issue_number"], record["source_id"])
    expected = known.get(key)
    if not expected:
        return "NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED"
    for field in ("url", "author_account_identifier", "body_sha256"):
        if record[field] != expected[field]:
            raise ValueError(f"historical source binding drift for {key}: {field}")
    return "KNOWN_HISTORICAL_EXTERNAL_SOURCE"


def build_receipt(policy: dict, raw_items: list[dict], raw_comments: list[dict], observed_at: str):
    if policy["repository"] != "Matawaka/uu-aap":
        raise ValueError("repository policy drift")
    if policy["included_channels"] != ["issue_bodies", "issue_comments"]:
        raise ValueError("included channel drift")
    if policy["issue_states"] != ["open", "closed"]:
        raise ValueError("issue-state scope drift")

    repository = policy["repository"]
    project_account = policy["project_account_identifier"]
    known = historical_index(policy)

    issue_map = {}
    pr_numbers = set()
    for item in raw_items:
        number = int(item["number"])
        if number in issue_map or number in pr_numbers:
            raise ValueError(f"duplicate issue/PR number from pagination: {number}")
        if "pull_request" in item:
            pr_numbers.add(number)
            continue
        if item.get("state") not in {"open", "closed"}:
            raise ValueError(f"unexpected issue state: {number}")
        if item.get("html_url") != f"https://github.com/{repository}/issues/{number}":
            raise ValueError(f"issue URL mismatch: {number}")
        issue_map[number] = item

    project_sources = 0
    automation_sources = 0
    unattributed_sources = 0
    external_sources = []

    def consume(kind: str, issue: dict, obj: dict):
        nonlocal project_sources, automation_sources, unattributed_sources
        account_class = account_classification(obj, project_account)
        if account_class == "PROJECT_ACCOUNT_SOURCE":
            project_sources += 1
            return
        if account_class == "AUTOMATION_SOURCE":
            automation_sources += 1
            return
        if account_class == "UNATTRIBUTED_SOURCE":
            unattributed_sources += 1
            return
        preliminary = source_record(kind, issue, obj, "NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED")
        preliminary["classification"] = classify_external_record(preliminary, known)
        external_sources.append(preliminary)

    for number in sorted(issue_map):
        consume("ISSUE_BODY", issue_map[number], issue_map[number])

    issue_comment_count = 0
    for comment in raw_comments:
        surface_kind = comment_surface_kind(comment, repository)
        if surface_kind == "PULL_REQUEST_COMMENT":
            continue
        number = issue_number_from_url(comment.get("issue_url"))
        if number in pr_numbers:
            continue
        issue = issue_map.get(number)
        if issue is None:
            raise ValueError(f"issue comment references unobserved issue {number}")
        issue_comment_count += 1
        consume("ISSUE_COMMENT", issue, comment)

    external_sources.sort(key=lambda x: (x["issue_number"], x["source_kind"], x["source_id"]))
    known_observed = [x for x in external_sources if x["classification"] == "KNOWN_HISTORICAL_EXTERNAL_SOURCE"]
    new_observed = [x for x in external_sources if x["classification"] == "NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED"]

    expected_known_keys = set(known)
    observed_known_keys = {
        (x["source_kind"], x["issue_number"], x["source_id"])
        for x in known_observed
    }
    if observed_known_keys != expected_known_keys:
        missing = sorted(expected_known_keys - observed_known_keys)
        extra = sorted(observed_known_keys - expected_known_keys)
        raise ValueError(f"historical source registry observation mismatch: missing={missing} extra={extra}")

    status = "NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED" if new_observed else "NO_NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED"
    receipt = {
        "schema": "urn:uu-aap:public-review-repository-discovery:0.2",
        "repository": repository,
        "observed_at_utc": observed_at,
        "observed_at_is_trusted_time": False,
        "status": status,
        "counts": {
            "issue_objects": len(issue_map),
            "pull_request_objects_excluded": len(pr_numbers),
            "issue_comments": issue_comment_count,
            "project_account_sources": project_sources,
            "automation_sources": automation_sources,
            "unattributed_sources": unattributed_sources,
            "external_account_sources": len(external_sources),
            "known_historical_external_sources": len(known_observed),
            "new_external_account_sources": len(new_observed),
        },
        "known_historical_external_sources": known_observed,
        "new_external_account_sources": new_observed,
        "boundaries": {
            "verified_human_identity": False,
            "independence_established": False,
            "standing_established": False,
            "expertise_established": False,
            "authority_established": False,
            "claim_relevance_established": False,
            "claim_truth_established": False,
            "admission_decision": "NOT_MADE",
            "disposition_decision": "NOT_MADE",
        },
        "non_effects": {
            "issues_or_comments_mutated": False,
            "reviewers_contacted": False,
            "identity_profiles_built": False,
            "reputation_scores_created": False,
            "normative_change_made": False,
            "release_or_tag_created": False,
            "publication_authorized": False,
            "action_permit_created": False,
            "recurring_schedule_created": False,
            "c2pa_reclassified": False,
            "workbench_reactivated": False,
        },
    }
    validate_receipt(receipt, policy)
    return receipt


def validate_receipt(receipt: dict, policy: dict | None = None):
    if policy is None:
        policy = load_json(POLICY_PATH)
    schema = load_json(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(receipt), key=lambda e: list(e.absolute_path))
    if errors:
        raise ValueError("receipt schema validation failed: " + errors[0].message)

    counts = receipt["counts"]
    if counts["known_historical_external_sources"] != len(receipt["known_historical_external_sources"]):
        raise ValueError("known historical count mismatch")
    if counts["new_external_account_sources"] != len(receipt["new_external_account_sources"]):
        raise ValueError("new external count mismatch")
    if counts["external_account_sources"] != counts["known_historical_external_sources"] + counts["new_external_account_sources"]:
        raise ValueError("external source aggregate mismatch")
    expected_status = "NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED" if counts["new_external_account_sources"] else "NO_NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED"
    if receipt["status"] != expected_status:
        raise ValueError("status/count mismatch")

    known = historical_index(policy)
    observed_known_keys = set()
    for source in receipt["known_historical_external_sources"]:
        if source["classification"] != "KNOWN_HISTORICAL_EXTERNAL_SOURCE":
            raise ValueError("known source classification drift")
        key = (source["source_kind"], source["issue_number"], source["source_id"])
        expected = known.get(key)
        if not expected:
            raise ValueError("receipt contains unregistered historical source")
        for field in ("url", "author_account_identifier", "body_sha256"):
            if source[field] != expected[field]:
                raise ValueError(f"historical receipt binding drift: {field}")
        observed_known_keys.add(key)
    if observed_known_keys != set(known):
        raise ValueError("receipt does not contain exact historical source registry")

    for source in receipt["new_external_account_sources"]:
        if source["classification"] != "NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED":
            raise ValueError("new source classification drift")
        key = (source["source_kind"], source["issue_number"], source["source_id"])
        if key in known:
            raise ValueError("historical source rediscovered as new")

    for key in (
        "verified_human_identity",
        "independence_established",
        "standing_established",
        "expertise_established",
        "authority_established",
        "claim_relevance_established",
        "claim_truth_established",
    ):
        if receipt["boundaries"][key]:
            raise ValueError(f"boundary escalated: {key}")
    if receipt["boundaries"]["admission_decision"] != "NOT_MADE":
        raise ValueError("observer made admission decision")
    if receipt["boundaries"]["disposition_decision"] != "NOT_MADE":
        raise ValueError("observer made disposition decision")
    if any(receipt["non_effects"].values()):
        raise ValueError("observer claimed external effect")


def observe_live(output: Path):
    policy = load_json(POLICY_PATH)
    repository = policy["repository"]
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    raw_items = fetch_paginated(
        f"/repos/{repository}/issues",
        token,
        {"state": "all", "sort": "created", "direction": "asc"},
    )
    raw_comments = fetch_paginated(
        f"/repos/{repository}/issues/comments",
        token,
        {"sort": "created", "direction": "asc"},
    )
    observed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    receipt = build_receipt(policy, raw_items, raw_comments, observed_at)
    output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        "PUBLIC_REVIEW_REPOSITORY_DISCOVERY_V0_2_"
        f"{receipt['status']} new={len(receipt['new_external_account_sources'])} "
        f"historical={len(receipt['known_historical_external_sources'])}"
    )


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output", type=Path, help="perform live read-only repository discovery and write receipt")
    group.add_argument("--validate", type=Path, help="validate an existing receipt")
    args = parser.parse_args()
    if args.output:
        observe_live(args.output)
    else:
        validate_receipt(load_json(args.validate))
        print("PUBLIC_REVIEW_REPOSITORY_DISCOVERY_V0_2_RECEIPT_VALID")


if __name__ == "__main__":
    main()
