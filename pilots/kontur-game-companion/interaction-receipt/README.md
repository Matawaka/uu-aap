# KONTUR Game Companion — Interaction Receipt v0.2

This revision preserves the synthetic/non-executing Interaction Receipt introduced in PR #456 and remediates connectivity-audit finding F-003 published in PR #458.

Historical origin remains PR #456 / `7c97e26aa3b7504d48b9ded6f0dfdccab444f8bd`. The v0.1 bytes remain preserved in Git history. v0.2 changes only the currently accepted semantics.

## Core separation

`Receipt != Authority`

`Response Admissible != Response Authorized`

`Admissibility Decision != Action Permit`

`Admissibility Decision != Successor Permit`

A receipt records whether one already-formed candidate response is admissible under the bounded conversational policies represented by this synthetic layer. It does not grant authority to generate, send, retry, deepen, continue, or reuse that response.

The legacy v0.1 field name `response_authorized` is retired. The canonical field is now:

`response_admissible`

Its scope is exactly:

`THIS_CANDIDATE_ONLY`

and its authority effect is exactly:

`NONE`

## Decision semantics

Every fixture carries a top-level `decision_semantics` object:

- `decision_field = response_admissible`
- `scope = THIS_CANDIDATE_ONLY`
- `authority_effect = NONE`
- `action_effect = NONE`
- `successor_effect = NONE`

The receipt boundary additionally requires:

`response_authority_created = false`

Therefore even a case with `response_admissible = true` does not establish permission for a live response or any external effect.

## What admissibility means

`response_admissible = true` means only that the candidate does not violate the synthetic constraints checked here, including:

- assistance depth versus current player intent;
- bounded companion-led initiative;
- active, scope-matched memory reuse;
- player-focus priority;
- spoiler budget;
- uncertainty versus reversibility;
- correction provenance;
- anti-dependency handling;
- player agency and ignorable response behavior.

`response_admissible = false` means the candidate fails at least one represented policy constraint.

Neither value is an authority decision.

## Cross-layer invariants

- `Recorded Intent != Future Intent`
- `Allowed Candidate != Required Response`
- `Blocked Candidate != Conversation Failure`
- `Receipt Completeness != Truth of Unsupported Claims`
- `Assistance Depth != Initiative Depth`
- `Memory Available != Memory Reuse Authorized`
- `Player Correction != Global Truth`
- `Predicted Interest != Player Intent`
- `Player-Selected Focus > System-Predicted Focus`
- `Already Revealed Spoiler != Permission for Deeper Spoiler`
- `High Confidence != Authority`
- `Permission to Be Wrong != Permission to Cause Avoidable Loss`
- `Dependency Signal != Diagnosis`
- `Agency Preserved != Engagement Maximized`
- `Interaction Receipt != Action Permit`
- `Admissibility != Authority`

## Assistance and initiative remain distinct

Assistance depth:

`COMMENT -> NOTICE -> QUESTION -> THEORY -> NUDGE -> HINT -> PARTIAL_SOLUTION -> SOLUTION`

Companion-led initiative:

`NONE -> NOTICE -> QUESTION -> THEORY -> NUDGE`

The `initiative_authorized` field is an upstream bounded-initiative input recorded by this receipt. The receipt does not create that authorization and cannot escalate it.

## Memory boundary

Memory may influence a candidate only when active and scope-matched.

`Historical Provenance != Active Reuse`

Expired or cross-scope memory cannot silently become current fact, current preference, or current authority.

## Focus boundary

Player-selected focus outranks predicted interest.

`Predicted Interest != Steering Authority`

The receipt cannot convert attention, engagement, retention, or inferred traits into a reason to override current player focus.

## Spoiler boundary

New disclosure must stay within the current spoiler budget. Prior disclosure may be referenced but does not authorize deeper future disclosure.

## Stakes-aware uncertainty

For uncertain (`GUESS` or `PLAYFUL_THEORY`) irreversible situations with avoidable-loss risk, deep assistance remains blocked; proactive `NUDGE` is also blocked in that combination.

`Conversational Error Budget ∝ Reversibility`

## Correction provenance

A received player correction requires local revision or explicit contesting before the candidate can be admissible.

`Player Correction != Global Truth`

## Anti-dependency boundary

A local dependency-risk signal may justify a shallower helpful candidate, but it cannot become refusal, diagnosis, durable profiling, or engagement maximization.

## Canonical synthetic cases

The ten cases remain semantically equivalent to v0.1:

1. ordinary player-led conversation;
2. explicit hint request;
3. bounded companion-led question;
4. active open-mystery callback;
5. player correction with local revision;
6. unsolicited deep solution blocked;
7. expired/cross-scope memory blocked;
8. predicted-interest override blocked;
9. uncertain irreversible proactive nudge blocked;
10. dependency signal yielding shallower help.

Only the decision semantics are revised from ambiguous `response_authorized` to scoped `response_admissible`.

## Non-effects

This revision authorizes no:

- live KONTUR response generation or proactive messaging;
- autonomous gameplay or account control;
- behavioral or psychological profiling;
- attention tracking, engagement maximization, or retention optimization;
- total-history capture or cross-game preference construction;
- Stable Core promotion;
- external effect;
- response authority creation;
- action permit;
- successor permit;
- release/tag, deployment, permission, or protection change.

Related: #445, #446, #452, #453, #454, #455, #456, #458, #459.
