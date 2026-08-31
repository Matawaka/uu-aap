#!/usr/bin/env python3
import copy
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("public_review_collector", HERE / "collector.py")
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)

SURFACES = collector.load_json(HERE / "surfaces.json")


def issue(number, comments):
    return {
        "number": number,
        "html_url": f"https://github.com/Matawaka/uu-aap/issues/{number}",
        "state": "open",
        "comments": comments,
    }


def comment(comment_id, login, user_type="User", body="body", association="NONE", app_slug=None, issue_number=1):
    item = {
        "id": comment_id,
        "html_url": f"https://github.com/Matawaka/uu-aap/issues/{issue_number}#issuecomment-{comment_id}",
        "body": body,
        "author_association": association,
        "created_at": "2026-08-31T00:00:00Z",
        "updated_at": "2026-08-31T00:00:00Z",
        "user": {"login": login, "type": user_type},
        "performed_via_github_app": None,
    }
    if app_slug is not None:
        item["performed_via_github_app"] = {"slug": app_slug}
    return item


def build_inputs(include_external=False):
    comments = {n: [] for n in range(1, 8)}
    comments[4].append(comment(1004, "Matawaka", body="project coordination", association="OWNER", issue_number=4))
    comments[3].append(comment(1003, "github-actions[bot]", user_type="Bot", body="automation", issue_number=3))
    if include_external:
        comments[2].append(
            comment(
                2002,
                "external-reviewer",
                body="Concrete failure case",
                association="NONE",
                app_slug="chatgpt-codex-connector",
                issue_number=2,
            )
        )
    issues = {n: issue(n, len(comments[n])) for n in range(1, 8)}
    return issues, comments


def must_fail(receipt, mutate, label):
    candidate = copy.deepcopy(receipt)
    mutate(candidate)
    try:
        collector.validate_receipt(candidate)
    except (ValueError, KeyError, TypeError):
        return
    raise AssertionError(f"hostile mutation unexpectedly passed: {label}")


def main():
    issues, comments = build_inputs(include_external=False)
    empty = collector.build_receipt(SURFACES, issues, comments, "2026-08-31T00:00:00Z")
    collector.validate_receipt(empty)
    assert empty["status"] == "NO_EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED"
    assert empty["external_account_submissions"] == []
    assert empty["issue_observations"][3]["project_account_comment_count"] == 1
    assert empty["issue_observations"][2]["automation_comment_count"] == 1

    issues, comments = build_inputs(include_external=True)
    observed = collector.build_receipt(SURFACES, issues, comments, "2026-08-31T00:00:00Z")
    collector.validate_receipt(observed)
    assert observed["status"] == "EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED"
    assert len(observed["external_account_submissions"]) == 1
    submission = observed["external_account_submissions"][0]
    assert submission["issue_number"] == 2
    assert submission["author_account_identifier"] == "external-reviewer"
    assert submission["performed_via_github_app_slug"] == "chatgpt-codex-connector"
    assert submission["body_sha256"] == collector.sha256_text("Concrete failure case")
    assert observed["boundaries"]["verified_human_identity"] is False
    assert observed["boundaries"]["independence_established"] is False
    assert observed["boundaries"]["authority_established"] is False
    assert observed["boundaries"]["claim_truth_established"] is False

    hostile = [
        (lambda x: x.update({"trust_score": 1.0}), "scalar trust score"),
        (lambda x: x["boundaries"].__setitem__("verified_human_identity", True), "identity escalation"),
        (lambda x: x["boundaries"].__setitem__("independence_established", True), "independence escalation"),
        (lambda x: x["boundaries"].__setitem__("authority_established", True), "authority escalation"),
        (lambda x: x["boundaries"].__setitem__("claim_truth_established", True), "truth escalation"),
        (lambda x: x["boundaries"].__setitem__("admission_decision", "ACCEPT"), "admission escalation"),
        (lambda x: x["boundaries"].__setitem__("disposition_decision", "ACCEPT"), "disposition escalation"),
        (lambda x: x["non_effects"].__setitem__("reviewers_contacted", True), "contact effect"),
        (lambda x: x["non_effects"].__setitem__("recurring_schedule_created", True), "schedule effect"),
        (lambda x: x["issue_observations"][0].__setitem__("issue_number", 8), "surface drift"),
        (lambda x: x["external_account_submissions"][0].__setitem__("body_sha256", "not-a-digest"), "digest drift"),
    ]
    for mutate, label in hostile:
        must_fail(observed, mutate, label)

    broken_issues, broken_comments = build_inputs(include_external=False)
    broken_issues[5]["comments"] = 9
    try:
        collector.build_receipt(SURFACES, broken_issues, broken_comments, "2026-08-31T00:00:00Z")
    except ValueError:
        pass
    else:
        raise AssertionError("comment count mismatch unexpectedly passed")

    print(f"PUBLIC_REVIEW_INTAKE_OBSERVATION_V0_1_TESTS_PASS hostile={len(hostile)}")


if __name__ == "__main__":
    main()
