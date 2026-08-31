#!/usr/bin/env python3
import copy
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("discussion_discovery", HERE / "collector.py")
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def author(login, typename="User"):
    if login is None:
        return None
    return {"login": login, "__typename": typename}


def reply(number, suffix, login, body="reply", typename="User"):
    return {
        "id": f"R_{number}_{suffix}",
        "url": f"https://github.com/Matawaka/uu-aap/discussions/{number}#discussioncomment-{suffix}",
        "body": body,
        "createdAt": "2026-08-30T01:20:00Z",
        "lastEditedAt": None,
        "author": author(login, typename),
        "authorAssociation": "NONE" if login != "Matawaka" else "OWNER",
    }


def comment(number, suffix, login, body="comment", typename="User", replies=None):
    return {
        "id": f"C_{number}_{suffix}",
        "url": f"https://github.com/Matawaka/uu-aap/discussions/{number}#discussioncomment-{suffix}",
        "body": body,
        "createdAt": "2026-08-30T01:10:00Z",
        "lastEditedAt": None,
        "author": author(login, typename),
        "authorAssociation": "NONE" if login != "Matawaka" else "OWNER",
        "replies": list(replies or []),
    }


def discussion(number, comments=None, body_login="Matawaka", is_answered=False):
    return {
        "id": f"D_{number}",
        "number": number,
        "title": f"Discussion {number}",
        "url": f"https://github.com/Matawaka/uu-aap/discussions/{number}",
        "body": f"body {number}",
        "createdAt": "2026-08-30T01:00:00Z",
        "updatedAt": "2026-08-30T01:00:00Z",
        "closed": False,
        "isAnswered": is_answered,
        "author": author(body_login),
        "authorAssociation": "OWNER" if body_login == "Matawaka" else "NONE",
        "comments": list(comments or []),
    }


def policy():
    return copy.deepcopy(mod.load_json(HERE / "policy.json"))


def must_reject(label, fn):
    try:
        fn()
    except (ValueError, RuntimeError):
        return
    raise AssertionError(f"hostile case accepted: {label}")


class PaginatedFake:
    def __call__(self, query, variables, token):
        assert token == "test-token"
        if "repository(owner:" in query:
            number = variables["number"]
            after = variables["after"]
            if number != 8:
                raise AssertionError("unexpected Discussion number")
            if after is None:
                c1 = comment(8, "801", "alice", "external top level")
                c1["replies"] = {
                    "nodes": [reply(8, "811", "Matawaka", "project reply")],
                    "pageInfo": {"hasNextPage": True, "endCursor": "reply-page-1"},
                }
                d = discussion(8, is_answered=None)
                d["comments"] = {
                    "nodes": [c1],
                    "pageInfo": {"hasNextPage": True, "endCursor": "comment-page-1"},
                }
                return {"repository": {"discussion": d}}
            if after == "comment-page-1":
                c2 = comment(8, "802", "Matawaka", "project second page")
                c2["replies"] = {
                    "nodes": [],
                    "pageInfo": {"hasNextPage": False, "endCursor": None},
                }
                d = discussion(8, is_answered=None)
                d["comments"] = {
                    "nodes": [c2],
                    "pageInfo": {"hasNextPage": False, "endCursor": None},
                }
                return {"repository": {"discussion": d}}
            raise AssertionError(f"unexpected comments cursor {after}")
        if "... on DiscussionComment" in query:
            assert variables == {"id": "C_8_801", "after": "reply-page-1"}
            return {
                "node": {
                    "id": "C_8_801",
                    "replies": {
                        "nodes": [reply(8, "812", "bob", "external paginated reply")],
                        "pageInfo": {"hasNextPage": False, "endCursor": None},
                    },
                }
            }
        raise AssertionError("unexpected query")


class ReplyCursorLoopFake:
    def __call__(self, query, variables, token):
        if "repository(owner:" in query:
            c1 = comment(8, "901", "Matawaka")
            c1["replies"] = {
                "nodes": [],
                "pageInfo": {"hasNextPage": True, "endCursor": "same"},
            }
            d = discussion(8)
            d["comments"] = {
                "nodes": [c1],
                "pageInfo": {"hasNextPage": False, "endCursor": None},
            }
            return {"repository": {"discussion": d}}
        return {
            "node": {
                "id": variables["id"],
                "replies": {
                    "nodes": [],
                    "pageInfo": {"hasNextPage": True, "endCursor": "same"},
                },
            }
        }


class CommentCursorLoopFake:
    def __call__(self, query, variables, token):
        d = discussion(8)
        d["comments"] = {
            "nodes": [],
            "pageInfo": {"hasNextPage": True, "endCursor": "same"},
        }
        return {"repository": {"discussion": d}}


def main():
    p = policy()

    fetched = mod.fetch_discussion(8, "test-token", PaginatedFake())
    assert len(fetched["comments"]) == 2
    assert len(fetched["comments"][0]["replies"]) == 2
    assert fetched["comments"][0]["replies"][1]["author"]["login"] == "bob"
    assert fetched["isAnswered"] is None

    d8 = discussion(
        8,
        [
            comment(8, "1001", "alice", "external idea", replies=[reply(8, "1002", "bob", "external reply")]),
            comment(8, "1003", "Matawaka", "project response"),
            comment(8, "1004", "helper-bot", "automation", typename="Bot"),
            comment(8, "1005", None, "deleted author"),
        ],
        is_answered=None,
    )
    d10 = discussion(10, [comment(10, "2001", "Matawaka", "project PoAI comment")])
    receipt = mod.build_receipt(p, {8: d8, 10: d10}, "2026-08-31T00:00:00Z")
    assert receipt["status"] == "EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED"
    assert len(receipt["external_account_sources"]) == 2
    assert receipt["discussion_observations"][0]["is_answered"] is None
    assert {(x["source_kind"], x["author_account_identifier"]) for x in receipt["external_account_sources"]} == {
        ("DISCUSSION_COMMENT", "alice"),
        ("DISCUSSION_REPLY", "bob"),
    }
    obs8 = receipt["discussion_observations"][0]
    assert obs8["top_level_comment_count"] == 4
    assert obs8["reply_count"] == 1
    assert obs8["external_account_source_count"] == 2
    assert obs8["automation_source_count"] == 1
    assert obs8["unattributed_source_count"] == 1
    mod.validate_receipt(receipt, p)

    no_external = mod.build_receipt(
        p,
        {8: discussion(8, [comment(8, "3001", "Matawaka")], is_answered=None), 10: discussion(10)},
        "2026-08-31T00:00:00Z",
    )
    assert no_external["status"] == "NO_EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED"
    assert no_external["external_account_sources"] == []
    assert no_external["discussion_observations"][0]["is_answered"] is None

    must_reject("reply pagination cursor loop", lambda: mod.fetch_discussion(8, "x", ReplyCursorLoopFake()))
    must_reject("comment pagination cursor loop", lambda: mod.fetch_discussion(8, "x", CommentCursorLoopFake()))

    p_bad = copy.deepcopy(p); p_bad["target_discussion_numbers"] = [8, 9]
    must_reject("target scope drift", lambda: mod.build_receipt(p_bad, {8: d8, 10: d10}, "x"))
    must_reject("missing target discussion", lambda: mod.build_receipt(p, {8: d8}, "x"))

    duplicate = copy.deepcopy(d8)
    duplicate["comments"][1]["id"] = duplicate["comments"][0]["id"]
    must_reject("duplicate node id", lambda: mod.build_receipt(p, {8: duplicate, 10: d10}, "x"))

    bad_url = copy.deepcopy(d8)
    bad_url["comments"][0]["url"] = "https://github.com/other/repo/discussions/8#discussioncomment-1"
    must_reject("cross-repository comment URL", lambda: mod.build_receipt(p, {8: bad_url, 10: d10}, "x"))

    bad_discussion_url = copy.deepcopy(d8)
    bad_discussion_url["url"] = "https://github.com/Matawaka/uu-aap/discussions/9"
    must_reject("discussion URL drift", lambda: mod.build_receipt(p, {8: bad_discussion_url, 10: d10}, "x"))

    bad_answer = copy.deepcopy(d8); bad_answer["isAnswered"] = "false"
    must_reject("answer state shape", lambda: mod.build_receipt(p, {8: bad_answer, 10: d10}, "x"))
    must_reject(
        "unknown source kind",
        lambda: mod.validate_source_url("Matawaka/uu-aap", 8, "OTHER", "https://github.com/Matawaka/uu-aap/discussions/8"),
    )

    hostiles = []
    x = copy.deepcopy(receipt); x["trust_score"] = 1; hostiles.append(("scalar score", x))
    x = copy.deepcopy(receipt); x["boundaries"]["verified_human_identity"] = True; hostiles.append(("identity escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["independence_established"] = True; hostiles.append(("independence escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["authority_established"] = True; hostiles.append(("authority escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["claim_relevance_established"] = True; hostiles.append(("relevance escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["claim_truth_established"] = True; hostiles.append(("truth escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["github_answer_state_is_protocol_disposition"] = True; hostiles.append(("GitHub answer escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["admission_decision"] = "ADMIT"; hostiles.append(("admission escalation", x))
    x = copy.deepcopy(receipt); x["boundaries"]["disposition_decision"] = "ACCEPT"; hostiles.append(("disposition escalation", x))
    x = copy.deepcopy(receipt); x["non_effects"]["discussions_or_comments_mutated"] = True; hostiles.append(("mutation effect", x))
    x = copy.deepcopy(receipt); x["non_effects"]["recurring_schedule_created"] = True; hostiles.append(("schedule effect", x))
    x = copy.deepcopy(receipt); x["status"] = "NO_EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED"; hostiles.append(("status drift", x))
    x = copy.deepcopy(receipt); x["discussion_observations"][0]["external_account_source_count"] += 1; hostiles.append(("count drift", x))
    x = copy.deepcopy(receipt); x["external_account_sources"][0]["classification"] = "PROJECT_ACCOUNT_SOURCE"; hostiles.append(("classification drift", x))
    x = copy.deepcopy(receipt); x["external_account_sources"][0]["node_id"] = x["external_account_sources"][1]["node_id"]; hostiles.append(("duplicate external node", x))

    for label, hostile in hostiles:
        must_reject(label, lambda h=hostile: mod.validate_receipt(h, p))

    print(f"PUBLIC_REVIEW_DISCUSSION_DISCOVERY_V0_3_TESTS_PASS hostile={len(hostiles) + 9} nullable_answer=PASS")


if __name__ == "__main__":
    main()
