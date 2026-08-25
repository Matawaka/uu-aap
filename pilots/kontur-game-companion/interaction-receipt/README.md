# KONTUR Game Companion — Interaction Receipt v0.1

This slice extends the synthetic/non-executing KONTUR Game Companion line after PRs #446, #452, #453, #454 and #455.

Its purpose is not to add a new source of authority. It records why a candidate conversational response was admissible or blocked across the already-separated boundaries of assistance depth, initiative, memory reuse, focus selection, epistemic uncertainty, spoiler disclosure, reversibility and player agency.

## Core invariant

`Receipt != Authority`

A valid receipt explains a decision. It does not authorize the next response, a retry, a deeper answer, a new initiative, memory retention, profiling, game control or any external effect.

## Cross-layer invariants

- `Recorded Intent != Future Intent`
- `Allowed Response != Required Response`
- `Blocked Response != Conversation Failure`
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

## Receipt fields

Each synthetic case records:

- interaction ownership: `PLAYER_LED` or `COMPANION_LED`;
- player intent class: `CONVERSATION`, `HINT_REQUEST`, `PARTIAL_SOLUTION_REQUEST`, `SOLUTION_REQUEST`;
- epistemic mode: `KNOWN`, `LIKELY`, `GUESS`, `PLAYFUL_THEORY`;
- chosen assistance depth and maximum permitted assistance depth;
- initiative authorization and initiative depth;
- bounded memory reuse state and scope match;
- focus source and whether system focus overrides player focus;
- spoiler budget, prior exposure and proposed new disclosure level;
- reversibility and irreversible-loss risk;
- player-correction and revision state;
- anti-dependency signal handling;
- explicit player agency and ability to ignore the response;
- final `response_authorized` result.

## Assistance and initiative remain distinct

Assistance depth uses:

`COMMENT -> NOTICE -> QUESTION -> THEORY -> NUDGE -> HINT -> PARTIAL_SOLUTION -> SOLUTION`

Companion-led initiative remains bounded to:

`NONE -> NOTICE -> QUESTION -> THEORY -> NUDGE`

Therefore an explicit player request may authorize deeper assistance, while proactive companion initiative never gains `HINT`, `PARTIAL_SOLUTION` or `SOLUTION` authority through this receipt.

## Memory boundary

A memory item may influence the receipt only when it is active and scope-matched. Expired, contested-as-fact, or cross-scope material cannot silently become a current fact or preference.

`Historical Provenance != Active Reuse`

A correction may be retained as local provenance, but the receipt must not promote it into universal player expertise, a durable personality claim or global factual authority.

## Focus boundary

A player-selected focus always outranks predicted interest. A system-predicted focus can at most remain optional and tentative.

The receipt cannot justify attention steering using engagement, retention, behavioral prediction or psychological inference.

## Spoiler boundary

New disclosure must remain within the current spoiler budget. Already revealed information may be referenced without counting as a new increase, but prior disclosure does not authorize deeper future disclosure.

## Stakes-aware uncertainty

For uncertain (`GUESS` or `PLAYFUL_THEORY`) irreversible situations with avoidable-loss risk, deep direct assistance remains blocked. Proactive `NUDGE` is also blocked in that combination.

The receipt therefore preserves:

`Conversational Error Budget ∝ Reversibility`

without treating uncertainty as a reason to stop ordinary conversation.

## Correction provenance

When a player correction is received, a response that continues to rely on the corrected hypothesis without revision is not authorized.

Valid local outcomes include `REVISED` or `CONTESTED`; the receipt does not declare a global winner unless separately supported.

## Anti-dependency boundary

A local dependency-risk signal may justify choosing a shallower helpful response, but it must not become:

- refusal of ordinary help;
- a durable player profile;
- a diagnosis;
- an engagement-maximization objective.

## Canonical synthetic cases

The fixture covers ten boundaries:

1. ordinary player-led conversation;
2. explicit hint request;
3. bounded companion-led question from a current cue;
4. active local open-mystery callback;
5. player correction requiring local revision;
6. unsolicited deep solution blocked by intent/spoiler limits;
7. expired or scope-mismatched memory reuse blocked;
8. predicted-interest focus overriding player focus blocked;
9. uncertain irreversible proactive nudge blocked;
10. anti-dependency signal producing a shallower but still helpful response.

## Non-effects

This pilot is synthetic and non-executing. Merging it authorizes no:

- live KONTUR response generation or proactive messaging;
- autonomous gameplay or game-account control;
- behavioral or psychological profiling;
- attention tracking, engagement maximization or retention optimization;
- total-history capture or cross-game preference construction;
- stable-core promotion;
- external effect, release/tag, permission/protection change;
- successor permit or reusable authority.

Related: #445, #446, #452, #453, #454, #455.
