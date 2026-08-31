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
POLICY_PATH = HERE / "policy.json"
SCHEMA_PATH = HERE / "receipt.schema.json"
GRAPHQL_ENDPOINT = "https://api.github.com/graphql"

DISCUSSION_QUERY = r"""
query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      id
      number
      title
      url
      body
      createdAt
      updatedAt
      closed
      isAnswered
      author { __typename login }
      authorAssociation
      comments(first: 100, after: $after) {
        nodes {
          id
          url
          body
          createdAt
          lastEditedAt
          author { __typename login }
          authorAssociation
          replies(first: 100) {
            nodes {
              id
              url
              body
              createdAt
              lastEditedAt
              author { __typename login }
              authorAssociation
            }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""

REPLIES_QUERY = r"""
query($id: ID!, $after: String) {
  node(id: $id) {
    ... on DiscussionComment {
      id
      replies(first: 100, after: $after) {
        nodes {
          id
          url
          body
          createdAt
          lastEditedAt
          author { __typename login }
          authorAssociation
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def graphql_request(query: str, variables: dict, token: str):
    if not token:
        raise RuntimeError("GitHub token is required for Discussion discovery")
    payload = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    request = Request(
        GRAPHQL_ENDPOINT,
        data=payload,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "uu-aap-public-review-discussion-discovery-v0.3",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub GraphQL HTTP {exc.code}: {body[:1000]}") from exc
    if not isinstance(result, dict):
        raise RuntimeError("GitHub GraphQL response is not an object")
    if result.get("errors"):
        raise RuntimeError("GitHub GraphQL errors: " + json.dumps(result["errors"], ensure_ascii=False)[:2000])
    data = result.get("data")
    if not isinstance(data, dict):
        raise RuntimeError("GitHub GraphQL response has no data object")
    return data


def require_connection(connection: dict, label: str):
    if not isinstance(connection, dict):
        raise ValueError(f"{label} connection missing")
    nodes = connection.get("nodes")
    page_info = connection.get("pageInfo")
    if not isinstance(nodes, list) or not isinstance(page_info, dict):
        raise ValueError(f"{label} connection shape invalid")
    has_next = page_info.get("hasNextPage")
    end_cursor = page_info.get("endCursor")
    if not isinstance(has_next, bool):
        raise ValueError(f"{label} hasNextPage is not boolean")
    if has_next and not isinstance(end_cursor, str):
        raise ValueError(f"{label} pagination has no endCursor")
    if not has_next and end_cursor is not None and not isinstance(end_cursor, str):
        raise ValueError(f"{label} endCursor shape invalid")
    return nodes, has_next, end_cursor


def fetch_all_replies(comment: dict, token: str, request_fn=graphql_request):
    comment_id = comment.get("id")
    if not isinstance(comment_id, str) or not comment_id:
        raise ValueError("Discussion comment has no node id")
    initial = comment.get("replies")
    nodes, has_next, cursor = require_connection(initial, f"replies:{comment_id}")
    replies = list(nodes)
    seen_cursors = set()
    while has_next:
        if cursor in seen_cursors:
            raise ValueError(f"reply pagination cursor loop for {comment_id}")
        seen_cursors.add(cursor)
        data = request_fn(REPLIES_QUERY, {"id": comment_id, "after": cursor}, token)
        node = data.get("node")
        if not isinstance(node, dict) or node.get("id") != comment_id:
            raise ValueError(f"reply pagination node mismatch for {comment_id}")
        nodes, has_next, cursor = require_connection(node.get("replies"), f"replies:{comment_id}")
        replies.extend(nodes)
    return replies


def fetch_discussion(number: int, token: str, request_fn=graphql_request):
    owner, name = "Matawaka", "uu-aap"
    after = None
    seen_cursors = set()
    identity = None
    result = None
    comments = []
    while True:
        data = request_fn(
            DISCUSSION_QUERY,
            {"owner": owner, "name": name, "number": number, "after": after},
            token,
        )
        repository = data.get("repository")
        if not isinstance(repository, dict):
            raise ValueError("Discussion repository not found")
        discussion = repository.get("discussion")
        if not isinstance(discussion, dict):
            raise ValueError(f"Discussion #{number} not found")
        current_identity = (discussion.get("id"), discussion.get("number"), discussion.get("url"))
        if identity is None:
            identity = current_identity
            result = {k: v for k, v in discussion.items() if k != "comments"}
        elif current_identity != identity:
            raise ValueError(f"Discussion #{number} identity drift during pagination")

        batch, has_next, cursor = require_connection(discussion.get("comments"), f"discussion:{number}:comments")
        for comment in batch:
            if not isinstance(comment, dict):
                raise ValueError(f"Discussion #{number} comment is not an object")
            normalized = {k: v for k, v in comment.items() if k != "replies"}
            normalized["replies"] = fetch_all_replies(comment, token, request_fn)
            comments.append(normalized)
        if not has_next:
            break
        if cursor in seen_cursors:
            raise ValueError(f"Discussion #{number} comment pagination cursor loop")
        seen_cursors.add(cursor)
        after = cursor

    result["comments"] = comments
    return result


def account_classification(obj: dict, project_account: str) -> str:
    author = obj.get("author")
    if not author:
        return "UNATTRIBUTED_SOURCE"
    login = author.get("login")
    if login == project_account:
        return "PROJECT_ACCOUNT_SOURCE"
    if author.get("__typename") == "Bot":
        return "AUTOMATION_SOURCE"
    return "EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED"


def validate_source_url(repository: str, discussion_number: int, source_kind: str, url: str):
    base = f"https://github.com/{repository}/discussions/{discussion_number}"
    if source_kind == "DISCUSSION_BODY":
        if url != base:
            raise ValueError(f"Discussion #{discussion_number} URL mismatch")
        return
    if source_kind not in {"DISCUSSION_COMMENT", "DISCUSSION_REPLY"}:
        raise ValueError(f"unsupported source kind: {source_kind}")
    if not isinstance(url, str) or not url.startswith(base + "#discussioncomment-"):
        raise ValueError(f"Discussion #{discussion_number} comment/reply URL mismatch")


def source_record(repository: str, discussion_number: int, source_kind: str, obj: dict) -> dict:
    if source_kind not in {"DISCUSSION_BODY", "DISCUSSION_COMMENT", "DISCUSSION_REPLY"}:
        raise ValueError("unsupported source kind")
    node_id = obj.get("id")
    if not isinstance(node_id, str) or not node_id:
        raise ValueError(f"{source_kind} has no GraphQL node id")
    url = obj.get("url")
    validate_source_url(repository, discussion_number, source_kind, url)
    author = obj.get("author") or {}
    if source_kind == "DISCUSSION_BODY":
        updated_at = obj.get("updatedAt")
    else:
        updated_at = obj.get("lastEditedAt")
    return {
        "discussion_number": discussion_number,
        "source_kind": source_kind,
        "node_id": node_id,
        "url": url,
        "author_account_identifier": author.get("login") or "UNKNOWN_ACCOUNT_IDENTIFIER",
        "author_type": author.get("__typename") or "UNKNOWN_ACCOUNT_TYPE",
        "author_association": obj.get("authorAssociation"),
        "created_at": obj.get("createdAt"),
        "updated_at": updated_at,
        "body_sha256": sha256_text(obj.get("body") or ""),
        "classification": "EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED",
    }


def build_receipt(policy: dict, discussions: dict[int, dict], observed_at: str):
    repository = policy.get("repository")
    targets = policy.get("target_discussion_numbers")
    if repository != "Matawaka/uu-aap":
        raise ValueError("repository policy drift")
    if targets != [8, 10]:
        raise ValueError("Discussion target scope drift")
    if policy.get("included_source_kinds") != ["DISCUSSION_BODY", "DISCUSSION_COMMENT", "DISCUSSION_REPLY"]:
        raise ValueError("Discussion source-kind scope drift")
    if set(discussions) != {8, 10}:
        raise ValueError("exact Discussion set was not observed")

    project_account = policy["project_account_identifier"]
    seen_node_ids = set()
    observations = []
    external_sources = []

    for number in targets:
        discussion = discussions[number]
        if discussion.get("number") != number:
            raise ValueError(f"Discussion number mismatch for #{number}")
        if not isinstance(discussion.get("closed"), bool):
            raise ValueError(f"Discussion #{number} closed state invalid")
        if not isinstance(discussion.get("isAnswered"), bool):
            raise ValueError(f"Discussion #{number} answered state invalid")
        validate_source_url(repository, number, "DISCUSSION_BODY", discussion.get("url"))
        comments = discussion.get("comments")
        if not isinstance(comments, list):
            raise ValueError(f"Discussion #{number} comments missing")

        project_count = 0
        automation_count = 0
        unattributed_count = 0
        external_count = 0
        reply_count = 0

        def consume(kind: str, obj: dict):
            nonlocal project_count, automation_count, unattributed_count, external_count
            node_id = obj.get("id")
            if not isinstance(node_id, str) or not node_id:
                raise ValueError(f"{kind} has no node id")
            if node_id in seen_node_ids:
                raise ValueError(f"duplicate Discussion source node id: {node_id}")
            seen_node_ids.add(node_id)
            validate_source_url(repository, number, kind, obj.get("url"))
            classification = account_classification(obj, project_account)
            if classification == "PROJECT_ACCOUNT_SOURCE":
                project_count += 1
            elif classification == "AUTOMATION_SOURCE":
                automation_count += 1
            elif classification == "UNATTRIBUTED_SOURCE":
                unattributed_count += 1
            else:
                external_count += 1
                external_sources.append(source_record(repository, number, kind, obj))

        consume("DISCUSSION_BODY", discussion)
        for comment in comments:
            if not isinstance(comment, dict):
                raise ValueError(f"Discussion #{number} comment is not an object")
            consume("DISCUSSION_COMMENT", comment)
            replies = comment.get("replies")
            if not isinstance(replies, list):
                raise ValueError(f"Discussion #{number} comment replies missing")
            reply_count += len(replies)
            for reply in replies:
                if not isinstance(reply, dict):
                    raise ValueError(f"Discussion #{number} reply is not an object")
                consume("DISCUSSION_REPLY", reply)

        observations.append(
            {
                "discussion_number": number,
                "url": discussion["url"],
                "closed": discussion["closed"],
                "is_answered": discussion["isAnswered"],
                "top_level_comment_count": len(comments),
                "reply_count": reply_count,
                "project_account_source_count": project_count,
                "automation_source_count": automation_count,
                "unattributed_source_count": unattributed_count,
                "external_account_source_count": external_count,
            }
        )

    external_sources.sort(key=lambda x: (x["discussion_number"], x["source_kind"], x["node_id"]))
    status = (
        "EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED"
        if external_sources
        else "NO_EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED"
    )
    receipt = {
        "schema": "urn:uu-aap:public-review-discussion-discovery:0.3",
        "repository": repository,
        "target_discussion_numbers": targets,
        "observed_at_utc": observed_at,
        "observed_at_is_trusted_time": False,
        "status": status,
        "discussion_observations": observations,
        "external_account_sources": external_sources,
        "boundaries": {
            "verified_human_identity": False,
            "independence_established": False,
            "standing_established": False,
            "expertise_established": False,
            "authority_established": False,
            "claim_relevance_established": False,
            "claim_truth_established": False,
            "github_answer_state_is_protocol_disposition": False,
            "admission_decision": "NOT_MADE",
            "disposition_decision": "NOT_MADE",
        },
        "non_effects": {
            "discussions_or_comments_mutated": False,
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
    if receipt["target_discussion_numbers"] != [8, 10]:
        raise ValueError("receipt Discussion target scope drift")
    observed_numbers = [item["discussion_number"] for item in receipt["discussion_observations"]]
    if observed_numbers != [8, 10]:
        raise ValueError("receipt Discussion observation order/set drift")
    total_external = sum(item["external_account_source_count"] for item in receipt["discussion_observations"])
    if total_external != len(receipt["external_account_sources"]):
        raise ValueError("external Discussion source count mismatch")
    expected_status = (
        "EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED"
        if total_external
        else "NO_EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED"
    )
    if receipt["status"] != expected_status:
        raise ValueError("Discussion receipt status/count mismatch")

    seen = set()
    for source in receipt["external_account_sources"]:
        if source["classification"] != "EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED":
            raise ValueError("external Discussion source classification drift")
        if source["discussion_number"] not in {8, 10}:
            raise ValueError("external source outside Discussion scope")
        validate_source_url(
            receipt["repository"], source["discussion_number"], source["source_kind"], source["url"]
        )
        if source["node_id"] in seen:
            raise ValueError("duplicate external Discussion source node id")
        seen.add(source["node_id"])

    for key in (
        "verified_human_identity",
        "independence_established",
        "standing_established",
        "expertise_established",
        "authority_established",
        "claim_relevance_established",
        "claim_truth_established",
        "github_answer_state_is_protocol_disposition",
    ):
        if receipt["boundaries"][key]:
            raise ValueError(f"Discussion boundary escalated: {key}")
    if receipt["boundaries"]["admission_decision"] != "NOT_MADE":
        raise ValueError("Discussion observer made an admission decision")
    if receipt["boundaries"]["disposition_decision"] != "NOT_MADE":
        raise ValueError("Discussion observer made a disposition decision")
    if any(receipt["non_effects"].values()):
        raise ValueError("Discussion observer claimed an external effect")


def observe_live(output: Path):
    policy = load_json(POLICY_PATH)
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN or GH_TOKEN is required")
    discussions = {
        number: fetch_discussion(number, token)
        for number in policy["target_discussion_numbers"]
    }
    observed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    receipt = build_receipt(policy, discussions, observed_at)
    output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        "PUBLIC_REVIEW_DISCUSSION_DISCOVERY_V0_3_"
        f"{receipt['status']} external={len(receipt['external_account_sources'])}"
    )


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output", type=Path, help="perform live read-only Discussion discovery and write receipt")
    group.add_argument("--validate", type=Path, help="validate an existing Discussion discovery receipt")
    args = parser.parse_args()
    if args.output:
        observe_live(args.output)
    else:
        validate_receipt(load_json(args.validate))
        print("PUBLIC_REVIEW_DISCUSSION_DISCOVERY_V0_3_RECEIPT_VALID")


if __name__ == "__main__":
    main()
