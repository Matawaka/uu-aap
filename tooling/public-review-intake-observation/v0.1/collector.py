#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
SURFACES_PATH = HERE / "surfaces.json"
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
        "User-Agent": "uu-aap-public-review-intake-observer-v0.1",
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


def fetch_all_comments(repository: str, issue_number: int, token: str | None):
    comments = []
    page = 1
    while True:
        batch = api_get(
            f"/repos/{repository}/issues/{issue_number}/comments?per_page=100&page={page}",
            token,
        )
        if not isinstance(batch, list):
            raise RuntimeError("GitHub comments response is not a list")
        comments.extend(batch)
        if len(batch) < 100:
            return comments
        page += 1


def classify_comment(comment: dict, project_account: str) -> str:
    user = comment.get("user") or {}
    login = user.get("login")
    user_type = user.get("type")
    if login == project_account:
        return "PROJECT_ACCOUNT_COMMENT"
    if user_type == "Bot":
        return "AUTOMATION_COMMENT"
    return "EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED"


def build_receipt(surface_set: dict, issues: dict[int, dict], comments: dict[int, list[dict]], observed_at: str):
    expected_numbers = surface_set["target_issue_numbers"]
    if expected_numbers != [1, 2, 3, 4, 5, 6, 7]:
        raise ValueError("surface set drift: expected exact issues 1..7")
    project_account = surface_set["project_account_identifier"]
    repository = surface_set["repository"]

    issue_observations = []
    external_submissions = []

    for number in expected_numbers:
        issue = issues[number]
        issue_comments = comments[number]
        project_count = 0
        automation_count = 0
        external_count = 0

        for comment in issue_comments:
            classification = classify_comment(comment, project_account)
            if classification == "PROJECT_ACCOUNT_COMMENT":
                project_count += 1
            elif classification == "AUTOMATION_COMMENT":
                automation_count += 1
            else:
                external_count += 1
                user = comment.get("user") or {}
                app = comment.get("performed_via_github_app") or {}
                body = comment.get("body") or ""
                external_submissions.append(
                    {
                        "issue_number": number,
                        "comment_id": int(comment["id"]),
                        "url": comment["html_url"],
                        "author_account_identifier": user.get("login") or "UNKNOWN_ACCOUNT_IDENTIFIER",
                        "author_type": user.get("type") or "UNKNOWN_ACCOUNT_TYPE",
                        "author_association": comment.get("author_association"),
                        "performed_via_github_app_slug": app.get("slug"),
                        "created_at": comment.get("created_at"),
                        "updated_at": comment.get("updated_at"),
                        "body_sha256": sha256_text(body),
                    }
                )

        if issue.get("number") != number:
            raise ValueError(f"issue number mismatch for surface {number}")
        if issue.get("html_url") != f"https://github.com/{repository}/issues/{number}":
            raise ValueError(f"issue URL mismatch for surface {number}")
        if issue.get("state") not in {"open", "closed"}:
            raise ValueError(f"unexpected issue state for surface {number}")
        if int(issue.get("comments", -1)) != len(issue_comments):
            raise ValueError(f"issue comment count mismatch for surface {number}")

        issue_observations.append(
            {
                "issue_number": number,
                "url": issue["html_url"],
                "state": issue["state"],
                "comment_count": len(issue_comments),
                "project_account_comment_count": project_count,
                "automation_comment_count": automation_count,
                "external_account_submission_count": external_count,
            }
        )

    external_submissions.sort(key=lambda x: (x["issue_number"], x["comment_id"]))
    status = (
        "EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED"
        if external_submissions
        else "NO_EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED"
    )

    return {
        "schema": "urn:uu-aap:public-review-intake-observation:0.1",
        "repository": repository,
        "surface_set_version": "0.1",
        "observed_at_utc": observed_at,
        "observed_at_is_trusted_time": False,
        "status": status,
        "issue_observations": issue_observations,
        "external_account_submissions": external_submissions,
        "boundaries": {
            "verified_human_identity": False,
            "independence_established": False,
            "standing_established": False,
            "expertise_established": False,
            "authority_established": False,
            "claim_truth_established": False,
            "admission_decision": "NOT_MADE",
            "disposition_decision": "NOT_MADE",
        },
        "non_effects": {
            "issues_mutated": False,
            "reviewers_contacted": False,
            "identity_profiles_built": False,
            "reputation_scores_created": False,
            "normative_change_made": False,
            "release_or_tag_created": False,
            "publication_authorized": False,
            "action_permit_created": False,
            "recurring_schedule_created": False,
            "workbench_reactivated": False,
        },
    }


def validate_receipt(receipt: dict):
    schema = load_json(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(receipt), key=lambda e: list(e.absolute_path))
    if errors:
        raise ValueError("receipt schema validation failed: " + errors[0].message)

    observed_numbers = [item["issue_number"] for item in receipt["issue_observations"]]
    if observed_numbers != [1, 2, 3, 4, 5, 6, 7]:
        raise ValueError("receipt surface order/set drift")
    total_external = sum(item["external_account_submission_count"] for item in receipt["issue_observations"])
    if total_external != len(receipt["external_account_submissions"]):
        raise ValueError("external submission count mismatch")
    expected_status = (
        "EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED"
        if total_external
        else "NO_EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED"
    )
    if receipt["status"] != expected_status:
        raise ValueError("receipt status/count mismatch")
    if any(receipt["boundaries"][key] for key in (
        "verified_human_identity",
        "independence_established",
        "standing_established",
        "expertise_established",
        "authority_established",
        "claim_truth_established",
    )):
        raise ValueError("epistemic/authority boundary escalated")
    if receipt["boundaries"]["admission_decision"] != "NOT_MADE":
        raise ValueError("observer made an admission decision")
    if receipt["boundaries"]["disposition_decision"] != "NOT_MADE":
        raise ValueError("observer made a disposition decision")
    if any(receipt["non_effects"].values()):
        raise ValueError("observer claimed an external effect")


def observe_live(output: Path):
    surface_set = load_json(SURFACES_PATH)
    repository = surface_set["repository"]
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    issues = {}
    comments = {}
    for number in surface_set["target_issue_numbers"]:
        issues[number] = api_get(f"/repos/{repository}/issues/{number}", token)
        comments[number] = fetch_all_comments(repository, number, token)
    observed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    receipt = build_receipt(surface_set, issues, comments, observed_at)
    validate_receipt(receipt)
    output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PUBLIC_REVIEW_INTAKE_OBSERVATION_V0_1_{receipt['status']} external={len(receipt['external_account_submissions'])}")


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output", type=Path, help="perform live read-only observation and write receipt")
    group.add_argument("--validate", type=Path, help="validate an existing receipt")
    args = parser.parse_args()
    if args.output:
        observe_live(args.output)
    else:
        validate_receipt(load_json(args.validate))
        print("PUBLIC_REVIEW_INTAKE_OBSERVATION_V0_1_RECEIPT_VALID")


if __name__ == "__main__":
    main()
