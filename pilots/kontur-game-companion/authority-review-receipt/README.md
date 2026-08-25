# KONTUR Game Companion — Authority Review Receipt v0.1

Status: synthetic, non-executing, pre-live authority boundary.

## Purpose

This layer consumes a `READY_FOR_AUTHORITY_REVIEW` result from the Externalization Authority Challenge and records what an authority review has actually inspected and concluded.

It deliberately separates three different facts:

1. evidence was presented;
2. evidence was reviewed and may be sufficient for this bounded request;
3. externalization authority was granted.

Only the first two can occur here. The third is forbidden.

Placement:

`... → Live Activation Request → Authority Challenge → Authority Review Receipt → separate grant step required → no live activation`

## Review dimensions

The synthetic reviewer may independently record review of:

- requester identity evidence;
- requester authority-basis evidence;
- requested scope;
- requested capability;
- requested duration.

Each dimension has a separate reviewed marker and outcome marker. A positive outcome cannot exist without the corresponding review marker.

The reviewer is itself only a synthetic claim (`SYNTHETIC_AUTHORITY_REVIEWER`). The artifact does not prove reviewer identity or independence.

## Decisions

- `NOT_APPLICABLE` — predecessor is not `READY_FOR_AUTHORITY_REVIEW`.
- `REVIEW_INCOMPLETE` — one or more review dimensions remain unreviewed.
- `REVIEW_REJECTED_IDENTITY` — identity evidence is insufficient for this bounded request.
- `REVIEW_REJECTED_AUTHORITY` — requester authority basis is insufficient for this bounded request.
- `REVIEW_REJECTED_SCOPE` — requested scope is outside reviewed bounds.
- `REVIEW_REJECTED_CAPABILITY` — requested capability is outside reviewed bounds.
- `REVIEW_REJECTED_DURATION` — requested duration is outside reviewed bounds.
- `REVIEW_COMPLETE_GRANT_REQUIRED` — all bounded review dimensions passed; a separate grant step is still required.

There is intentionally no `AUTHORIZED`, `GRANTED`, `LIVE_READY`, `SEND_ALLOWED`, or `ACTIVATED` state.

## Core boundaries

- `Evidence Presented != Evidence Reviewed`
- `Evidence Reviewed != Evidence Sufficient`
- `Evidence Sufficient != Authority Granted`
- `Identity Evidence Sufficient for Request != Universal Identity Proof`
- `Authority Basis Sufficient for Request != Externalization Authority Granted`
- `Scope Within Reviewed Bounds != Scope Authorized`
- `Capability Within Reviewed Bounds != Capability Granted`
- `Review Complete != Activation`
- `Review Receipt != Grant Token`
- `Independent Review Asserted != Independent Review Proven`
- `Reviewer Claim != Reviewer Identity Proof`
- `Review Digest != Authority`
- `Grant Required != Grant Issued`
- `Review Decision != Send Permit`

## Non-effects

Every receipt keeps all of the following false:

- externalization authority granted;
- grant decision/token creation;
- live runtime enabled/bound;
- external transport/network/user surface;
- send permit / send authority;
- response authority;
- external effect authorization;
- delivery attempt / transport invocation / delivery receipt;
- ActionPermit / successor permit;
- payload persistence;
- proactive/background messaging;
- autonomous gameplay / account control;
- profiling / cross-game scope;
- persistent authority;
- requested scope/capability authorization;
- Stable Core promotion.

The receipt is evidence about a review event. It is not a runtime authorization token and cannot be consumed as one.
