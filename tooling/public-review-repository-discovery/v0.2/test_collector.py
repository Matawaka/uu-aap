#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("repo_discovery", HERE / "collector.py")
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def user(login, user_type="User"):
    return {"login": login, "type": user_type}


def issue(number, login="Matawaka", body="project issue", state="open", pr=False, user_type="User"):
    obj = {
        "id": 100000 + number,
        "number": number,
        "html_url": f"https://github.com/Matawaka/uu-aap/issues/{number}",
        "state": state,
        "user": user(login, user_type) if login is not None else None,
        "author_association": "OWNER" if login == "Matawaka" else "NONE",
        "performed_via_github_app": None,
        "created_at": "2026-08-30T00:00:00Z",
        "updated_at": "2026-08-30T00:00:00Z",
        "body": body,
    }
    if pr:
        obj["html_url"] = f"https://github.com/Matawaka/uu-aap/pull/{number}"
        obj["pull_request"] = {"url": f"https://api.github.com/repos/Matawaka/uu-aap/pulls/{number}"}
    return obj


def comment(issue_number, comment_id, login, body, user_type="User", app_slug=None, pr=False):
    surface = "pull" if pr else "issues"
    return {
        "id": comment_id,
        "html_url": f"https://github.com/Matawaka/uu-aap/{surface}/{issue_number}#issuecomment-{comment_id}",
        "issue_url": f"https://api.github.com/repos/Matawaka/uu-aap/issues/{issue_number}",
        "user": user(login, user_type) if login is not None else None,
        "author_association": "OWNER" if login == "Matawaka" else "NONE",
        "performed_via_github_app": {"slug": app_slug} if app_slug else None,
        "created_at": "2026-08-30T01:00:00Z",
        "updated_at": "2026-08-30T01:00:00Z",
        "body": body,
    }


def policy():
    p = mod.load_json(HERE / "policy.json")
    p = copy.deepcopy(p)
    p["known_historical_external_sources"] = [{
        "source_kind": "ISSUE_COMMENT",
        "issue_number": 422,
        "source_id": 9001,
        "url": "https://github.com/Matawaka/uu-aap/issues/422#issuecomment-9001",
        "author_account_identifier": "known-reviewer",
        "body_sha256": sha("known historical"),
        "accepted_lineage": ["#845", "#846", "#849"],
    }]
    return p


def fixture(include_new=True):
    items = [
        issue(1),
        issue(2, "alice" if include_new else "Matawaka", "external issue body" if include_new else "project issue body"),
        issue(3, "Matawaka", "pull request body", pr=True),
        issue(4, "some-bot[bot]", "automation", user_type="Bot"),
        issue(5, None, "deleted account source"),
        issue(422, "Matawaka", "project intake issue"),
    ]
    comments = [
        comment(1, 1001, "Matawaka", "project comment"),
        comment(3, 1002, "external-pr-commenter", "known PR comment must be excluded", pr=True),
        comment(9, 1009, "external-pr-commenter", "PR comment with no PR object in issue snapshot must be excluded", pr=True),
        comment(4, 1003, "helper-bot[bot]", "bot comment", user_type="Bot"),
        comment(5, 1004, None, "deleted comment author"),
        comment(422, 9001, "known-reviewer", "known historical", app_slug="chatgpt-codex-connector"),
    ]
    if include_new:
        comments.append(comment(2, 2002, "bob", "new external comment"))
    return items, comments


def must_reject(label, fn):
    try:
        fn()
    except (ValueError, RuntimeError):
        return
    raise AssertionError(f"hostile case accepted: {label}")


def main():
    p = policy()
    items, comments = fixture(True)
    receipt = mod.build_receipt(p, items, comments, "2026-08-31T00:00:00Z")
    assert receipt["status"] == "NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED"
    assert receipt["counts"]["pull_request_objects_excluded"] == 1
    assert receipt["counts"]["issue_objects"] == 5
    assert receipt["counts"]["issue_comments"] == 5
    assert receipt["counts"]["known_historical_external_sources"] == 1
    assert receipt["counts"]["new_external_account_sources"] == 2
    assert receipt["counts"]["external_account_sources"] == 3
    assert receipt["counts"]["automation_sources"] == 2
    assert receipt["counts"]["unattributed_sources"] == 2
    assert {(x["source_kind"], x["issue_number"]) for x in receipt["new_external_account_sources"]} == {
        ("ISSUE_BODY", 2),
        ("ISSUE_COMMENT", 2),
    }
    assert all(x["issue_number"] not in {3, 9} for x in receipt["new_external_account_sources"])
    mod.validate_receipt(receipt, p)

    no_new_items, no_new_comments = fixture(False)
    no_new = mod.build_receipt(p, no_new_items, no_new_comments, "2026-08-31T00:00:00Z")
    assert no_new["status"] == "NO_NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED"
    assert no_new["counts"]["new_external_account_sources"] == 0
    assert no_new["counts"]["known_historical_external_sources"] == 1
    assert no_new["counts"]["issue_comments"] == 4

    drifted = copy.deepcopy(no_new_comments)
    for item in drifted:
        if item["id"] == 9001:
            item["body"] = "mutated historical"
    must_reject("historical body drift", lambda: mod.build_receipt(p, no_new_items, drifted, "x"))

    missing_known = [x for x in no_new_comments if x["id"] != 9001]
    must_reject("historical source missing", lambda: mod.build_receipt(p, no_new_items, missing_known, "x"))

    duplicate_items = no_new_items + [copy.deepcopy(no_new_items[0])]
    must_reject("duplicate pagination issue", lambda: mod.build_receipt(p, duplicate_items, no_new_comments, "x"))

    orphan_comments = no_new_comments + [comment(999, 9999, "bob", "orphan real issue comment")]
    must_reject("comment for unobserved issue", lambda: mod.build_receipt(p, no_new_items, orphan_comments, "x"))

    malformed_surface = copy.deepcopy(no_new_comments)
    malformed_surface.append(comment(999, 9998, "bob", "bad surface"))
    malformed_surface[-1]["html_url"] = "https://example.com/not-a-repository-comment"
    must_reject("unexpected comment html URL", lambda: mod.build_receipt(p, no_new_items, malformed_surface, "x"))

    hostiles = []
    x = copy.deepcopy(receipt); x["trust_score"] = 1; hostiles.append(("scalar score", x))
    x = copy.deepcopy(receipt); x["boundaries"]["verified_human_identity"] = True; hostiles.append(("identity escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["independence_established"] = True; hostiles.append(("independence escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["authority_established"] = True; hostiles.append(("authority escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["claim_truth_established"] = True; hostiles.append(("truth escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["claim_relevance_established"] = True; hostiles.append(("relevance escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["admission_decision"] = "ADMIT"; hostiles.append(("admission escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["disposition_decision"] = "ACCEPT"; hostiles.append(("disposition escalation", x))
    x = copy.deepcopy(receipt); x["non_effects"]["issues_or_comments_mutated"] = True; hostiles.append(("mutation effect", x))
    x = copy.deepcopy(receipt); x["non_effects"]["recurring_schedule_created"] = True; hostiles.append(("schedule effect", x))
    x = copy.deepcopy(receipt); x["counts"]["new_external_account_sources"] += 1; hostiles.append(("count drift", x))
    x = copy.deepcopy(receipt); x["status"] = "NO_NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED"; hostiles.append(("status drift", x))
    x = copy.deepcopy(receipt); x["known_historical_external_sources"][0]["classification"] = "NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED"; hostiles.append(("historical rediscovery", x))
    x = copy.deepcopy(receipt); x["new_external_account_sources"][0]["body_sha256"] = "0"; hostiles.append(("digest shape drift", x))

    for label, hostile in hostiles:
        must_reject(label, lambda h=hostile: mod.validate_receipt(h, p))

    print(f"PUBLIC_REVIEW_REPOSITORY_DISCOVERY_V0_2_TESTS_PASS hostile={len(hostiles) + 5}")


if __name__ == "__main__":
    main()
