# Core Pilot 005 Run 001 — Ambiguous Acknowledgement / Observe-Before-Retry

**Status:** materialized contract / not executable  
**Issue:** #440  
**Origin frontier:** `711b9b203ae637170e2780e214161e196f29ce48`

## Purpose

Run 001 exercises one low-risk GitHub `issue_comment_create` attempt while deliberately refusing to treat the write acknowledgement as proof of success.

The required state machine is:

`authorized attempt → UNKNOWN → read-only observation → CONFIRMED | ABSENT | CONFLICT → stop`

No reconciliation class authorizes automatic retry.

## Candidate effect

- repository: `Matawaka/uu-aap`
- target issue: `#440`
- expected target state: `open`
- effect type: `issue_comment_create`
- maximum effect count: `1`
- exact payload SHA-256: `2ab6bb1a99b7839062a02a27b41a0dc472581b8bf9218d5e356ab23719688226`
- execution frontier: `711b9b203ae637170e2780e214161e196f29ce48`

This contract is deliberately non-executable until a separate exact permit is materialized and explicitly approved by a human.

## Acknowledgement rule

If the write call is attempted, the execution adapter MUST set the immediate outcome to `UNKNOWN` regardless of whether the transport/API call appears to return success.

The write response is not accepted as final evidence for this pilot.

`write response != reconciled outcome`

`timeout != proof of absence`

`UNKNOWN != failed outcome`

## Observation rule

A separate read-only observation step may inspect issue #440 and its comments.

Observation may classify only:

- `CONFIRMED`: exactly one matching comment is observed with the exact payload;
- `ABSENT`: sufficiently scoped observation finds no matching comment and no conflicting candidate;
- `CONFLICT`: duplicate, altered, ambiguous, or otherwise conflicting evidence exists.

Observation itself authorizes no mutation.

## Retry rule

All of the following remain non-authorizing:

`UNKNOWN`

`ABSENT`

`CONFIRMED`

`CONFLICT`

A retry requires a fresh, separately materialized authority decision. The original permit, once attempted, cannot be reused merely because acknowledgement was uncertain or reconciliation returned `ABSENT`.

## Non-effects

Merging this contract does not authorize the comment, retry, issue/PR mutation, push/merge, release/tag, permission/secret/protection changes, KONTUR effects, external publication, or successor permit creation.