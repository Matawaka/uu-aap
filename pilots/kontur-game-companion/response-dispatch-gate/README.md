# KONTUR Game Companion — Response Dispatch Gate v0.1

This synthetic/non-executing layer follows the concrete candidate + Interaction Receipt bridge introduced in PR #471.

Its purpose is to make the final pre-runtime separation explicit:

`Interaction Receipt != Send Permit`

A candidate may be content-admissible and still not be authorized for delivery. This layer therefore computes only a **Synthetic Dispatch Decision**. It never invokes a transport and never creates send authority.

## Pipeline position

`Session State + PLAYER Event -> Candidate Envelope -> Pre-Text Policy Receipt -> Synthetic Candidate -> Interaction Receipt -> Synthetic Dispatch Decision -> no transport`

The gate is downstream of the Interaction Receipt. It cannot repair, widen, deepen or re-authorize a blocked upstream candidate.

## Decisions

- `DISPATCH_ELIGIBLE` — the exact current candidate/receipt pair is fresh enough to be considered by a future separately authorized runtime adapter.
- `HOLD` — the candidate is still valid but a synthetic recheck condition prevents eligibility.
- `DROP` — the candidate is stale, superseded, cancelled or no longer current.

None of these values is a send permit.

## Core invariants

- `Interaction Receipt != Send Permit`
- `Dispatch Eligible != Dispatch Authorized`
- `Dispatch Decision != External Effect`
- `Fresh Candidate != Transport Permission`
- `Admissible Candidate != Required Delivery`
- `Stale Candidate != Reusable Candidate`
- `Player Cancellation > Prior Admissibility`
- `Superseding Event > Prior Candidate`
- `Hold != Refusal`
- `Drop != Conversation Failure`
- `Dispatch Digest != Authority`
- `Synthetic Dispatch Gate != Runtime Connectedness`

## Freshness and cancellation

`DISPATCH_ELIGIBLE` requires all of the following for the exact candidate:

- the Interaction Receipt is `response_admissible=true`;
- candidate and receipt digests still match;
- dispatch scope is `THIS_CANDIDATE_ONLY`;
- current turn equals the candidate source turn;
- the candidate has not been superseded;
- the player has not cancelled the response;
- the session remains active;
- no additional safety recheck is pending.

Any later turn invalidates the candidate for this gate. A new event must produce a new envelope, policy receipt, candidate and Interaction Receipt.

## Runtime boundary

The dispatch context is deliberately a synthetic null sink:

- `delivery_channel = SYNTHETIC_NULL_SINK`
- `external_transport_bound = false`
- `live_runtime = false`
- `send_permit_available = false`

The decision always records:

- `send_permit = false`
- `send_authority = false`
- `external_effect_authorized = false`
- `dispatch_executed = false`
- `delivery_attempted = false`
- `transport_invoked = false`
- `action_permit_created = false`
- `successor_permit_created = false`

A future runtime adapter would require a separate authority design and separate acceptance evidence. This PR does not provide it.

## Canonical synthetic behavior

The seven concrete candidates from the merged 15-turn fixture are evaluated at their exact source frontier and produce `DISPATCH_ELIGIBLE`, while still carrying no send permit.

Additional probes demonstrate:

- `safety_recheck_required=true` -> `HOLD`;
- candidate superseded -> `DROP`;
- player cancellation -> `DROP`;
- current turn advanced -> `DROP`;
- attempts to bind a live/external transport or pre-install a send permit fail closed.

## Non-effects

This layer authorizes no live KONTUR connection, response sending, proactive/background messaging, external transport, network request, autonomous gameplay, account control, response authority, send authority, ActionPermit, successor permit, profiling, attention tracking, engagement/retention optimization, Stable Core promotion, deployment, release, permission or protection change.

Related: #445, #456, #460, #467, #468, #469, #470, #471.
