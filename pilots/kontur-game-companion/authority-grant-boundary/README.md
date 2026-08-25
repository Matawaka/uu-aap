# KONTUR Game Companion — Separate Authority Grant Boundary v0.1

Status: synthetic, non-executing, pre-runtime authority-plane experiment.

## Purpose

This layer consumes a successful `Authority Review Receipt` whose decision is `REVIEW_COMPLETE_GRANT_REQUIRED` and models a **separate, bounded grant step**. It is the first KONTUR Game Companion layer allowed to create a scoped synthetic externalization authority state, while still being unable to bind transport, enable a network/user surface, create a send permit, or execute delivery.

Placement:

`... → Authority Review Receipt → Separate Authority Grant Boundary → transport/runtime binding still required → no send`

## Grant lifecycle

- `NOT_APPLICABLE` — review is not grantable.
- `GRANT_NOT_ISSUED` — review is complete, but no separate grant decision has been made.
- `BOUNDED_GRANT_ISSUED` — synthetic externalization authority exists only for the exact reviewed scope/capability/duration.
- `GRANT_REVOKED` — the historical grant remains provable but is no longer active.
- `GRANT_EXPIRED` — the historical grant remains provable after the session expiry boundary.

v0.1 grants only:

- scope: `THIS_SYNTHETIC_SESSION_ONLY`;
- capability: `LIVE_RESPONSE_DELIVERY`;
- duration: `ONE_SESSION`;
- expiry boundary: `SESSION_END`;
- revocation mode: `EXPLICIT_OR_SESSION_END`.

No automatic renewal, scope expansion, capability expansion, persistent authority, bearer token, network enablement, transport binding, or send permit can be requested by this layer.

## Authority semantics

For an active `BOUNDED_GRANT_ISSUED` receipt:

- `externalization_authority_granted = true`;
- `scope_authorized_now = true`;
- `capability_authorized_now = true`;
- `authority_effect = CREATE_BOUNDED_EXTERNALIZATION_AUTHORITY`.

At the same time:

- `send_permit = false`;
- `send_authority = false`;
- `live_runtime_enabled = false`;
- `external_transport_bound = false`;
- `network_enabled = false`;
- `external_effect_authorized = false`.

A grant receipt is not a bearer credential. It contains a deterministic revocation handle that is a public provenance handle, not a secret or capability token.

## Core boundaries

- `Review Complete != Grant Issued`
- `Grant Issued != Runtime Activated`
- `Externalization Authority != Send Permit`
- `Externalization Authority != Transport Binding`
- `Granted Scope != Session Ownership`
- `Granted Capability != Executed Capability`
- `Grant Receipt != Bearer Credential`
- `Revocation Handle != Grant Secret`
- `Revocable != Revoked`
- `Expired Grant != Erased Grant`
- `Revoked Grant != Never-Issued Grant`
- `Expiry != Automatic Renewal`
- `Synthetic Grant Authority != Real-World Authority Proof`
- `Authority Effect != Action Effect`

## Provenance and lifecycle

Every grant receipt binds the exact upstream authority-review receipt digest and a grant-context digest. A deterministic revocation handle is derived from that review receipt. Revocation or expiry removes current authority while preserving `grant_historically_issued = true`.

## Non-effects

Even an active grant cannot perform transport or response delivery. No live runtime, external transport, network, user surface, send permit, send authority, response authority, external effect, ActionPermit, successor permit, delivery attempt, payload persistence, proactive/background messaging, autonomous gameplay, account control, profiling, cross-game authority, Stable Core promotion, deployment, release, or permission/protection change is authorized.

The next downstream step, if ever modeled, must independently bind an active non-expired/non-revoked grant to a bounded runtime/transport context. The grant itself is insufficient.