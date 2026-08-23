# Canonical Human Succession Protocol (CHSP) v0.4

CHSP v0.4 defines the **Canonical Stewardship Handover Authorization** boundary.

It starts only after CHSP v0.3 has produced a valid `canonical_stewardship_handover_review_eligible` assessment and it stops before any external mutation or execution.

Core distinctions:

`handover review eligible != handover authorized`

`handover authorized != handover executed`

`handover executed != repository ownership transferred`

`protocol stewardship successor != account owner`

`protocol stewardship successor != canonical origin publication`

`protocol stewardship successor != KONTUR activation`

## Purpose

v0.4 records a narrowly scoped, time-bounded human authorization permitting a future bounded executor to record a **protocol-level canonical stewardship handover**. It does not contain that executor.

The layer has four machine-readable artifact classes:

1. `CHSPHandoverAuthorizationApproval` — one human approval bound to one exact v0.3 completion assessment;
2. `CHSPCanonicalStewardshipHandoverAuthorization` — quorum aggregation of valid approvals;
3. `CHSPHandoverAuthorizationRevocation` — explicit authorizer revocation or candidate withdrawal;
4. `CHSPHandoverAuthorizationAssessment` — fail-closed current-state assessment of the authorization.

## Source boundary

A handover authorization can be built only from a self-digested CHSP v0.3 `CHSPFinalHandoverAssessment` whose:

- state is `canonical_stewardship_handover_review_eligible`;
- decision is `canonical_stewardship_handover_may_be_requested`;
- handover and outcome bindings are both present;
- canonical-successor, ownership, account-control, canonical-origin, publication and KONTUR claims remain false.

The exact v0.3 predecessor disposition is also bound and rechecked against the assessment.

## Human approval quorum

Reference policy requires at least two distinct approving humans from at least two declared authorizer domains.

The candidate cannot approve their own handover.

For an `acknowledged` predecessor disposition, the predecessor steward must be one of the approvers.

For a `protocol_unavailability_attested` predecessor disposition, the predecessor must not be counted as an approver; instead reference policy requires the stronger quorum of at least three approving humans from at least three declared authorizer domains.

This is a protocol quorum for one action. It is not represented as universal or absolute proof of human/domain independence.

`distinct authorizer IDs != universal independence proven`

## Approval intent

Every approval requires:

- exact candidate and predecessor binding;
- exact v0.3 assessment and disposition digest;
- authorizer ID and declared authorizer domain;
- external authority-evidence SHA-256;
- explicit approval time;
- nonce;
- exact typed confirmation:

`APPROVE_CHSP_CANONICAL_STEWARDSHIP_HANDOVER_AUTHORIZATION_ONLY`

Approval does not itself transfer stewardship.

## Authorization window

Reference v0.4 requires:

- source v0.3 assessment no older than 30 days when approvals are made;
- all approvals within a 72-hour spread;
- authorization validity no longer than 7 days.

These are conservative reference-policy values, not universal governance laws.

## What v0.4 authorizes

The only authorized future action is:

`record_protocol_canonical_stewardship_handover`

This means a future bounded executor may be requested to create a protocol-level stewardship handover record.

It does **not** authorize:

- GitHub repository ownership transfer;
- account administration or credential transfer;
- secret/recovery-material disclosure;
- canonical-origin creation or mutation;
- canonical-publication execution;
- destructive canon rewrite;
- KONTUR activation;
- automatic rescue/failover;
- legal ownership adjudication.

## Revocation and withdrawal

Before execution, authorization remains revocable.

Two revocation modes exist:

- `authorizer_revocation` — one of the humans whose approval formed the authorization explicitly revokes it;
- `candidate_withdrawal` — the candidate explicitly withdraws from the authorized handover.

A valid revocation blocks execution review. Revocation is an immutable event; it does not rewrite or delete the original approval or authorization.

`authorization revoked != authorization never existed`

## State model

The reference assessor emits only:

- `authorization_invalid`
- `authorization_active`
- `authorization_revoked`
- `authorization_expired`

The strongest state is:

`authorization_active -> bounded_handover_executor_may_be_requested`

No executor exists in v0.4.

## Authority boundary

A valid authorization may state that the bounded protocol handover recording is authorized. It must simultaneously keep false:

- candidate stewardship already effective;
- execution performed;
- canonical successor established;
- repository ownership transferred;
- account control transferred;
- canonical origin mutated;
- canonical publication executed;
- KONTUR activated;
- distributed consensus established;
- legal effect established;
- universal trust established.

## Replay boundary

Reference tooling uses local durable exclusive reservations for:

- one approval per assessment/authorizer;
- approval nonce reuse;
- one aggregated authorization per v0.3 assessment;
- authorization nonce reuse;
- duplicate revocation event reuse.

This is intentionally local replay protection only.

`local reservation != global uniqueness`

## Digest semantics

CHSP v0.4 continues the CHSP version-scoped deterministic compact UTF-8 JSON serialization with lexicographically sorted object keys and SHA-256. It is not represented as RFC 8785/JCS.

## Execution boundary

The reference implementation performs no network I/O, no Git operations, no GitHub/account mutation, no canonical-origin publication, no ownership transfer and no KONTUR action.

A later protocol version may define a bounded executor that consumes an **active** v0.4 authorization. That executor must remain a separate artifact and execution boundary.