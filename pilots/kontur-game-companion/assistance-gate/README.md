# KONTUR Game Companion — Assistance Escalation & Spoiler Budget Gate v0.1

**Status:** synthetic / non-executing / policy experiment  
**Related:** Issue #445  
**Predecessor:** PR #446 (`pilots/kontur-game-companion/observational-lane`)  
**Origin frontier:** `6465e6bc680346a1b49b4e71a079e79ff09ad5ab`

This slice turns the anti-solver progression into an explicit, machine-checkable gate without introducing autonomous gameplay, account control, broad profiling, or a live personalization loop.

The gate answers one narrow question:

> Given the player's expressed intent, the companion's epistemic mode, spoiler state, and consequence class, how deep may the next response go?

It does **not** decide what action the player should take and does not grant authority to perform game actions.

## Core invariants

`Request for Conversation != Request for Completion`

`Possible Answer != Authorized Answer Depth`

`Knowledge != Spoiler Right`

`Confidence != Interaction Authority`

`Already Revealed Information != New Spoiler`

`More Engagement != Less Agency`

`Repeated Help-Seeking != Permission to Become Indispensable`

`Assistance Gate != Action Permit`

## Assistance ladder

The gate uses the same ordered intervention ladder introduced by the observational predecessor:

`COMMENT -> NOTICE -> QUESTION -> THEORY -> NUDGE -> HINT -> PARTIAL_SOLUTION -> SOLUTION`

A response may stay below the maximum permitted depth. Permission to reveal a deeper answer does not require the companion to do so.

## Intent classes

The fixture distinguishes only the intent needed for this experiment:

- `CONVERSATION` — discussion, reaction, commentary, or exploratory exchange;
- `HINT_REQUEST` — explicit request for bounded help short of completion;
- `PARTIAL_SOLUTION_REQUEST` — explicit request for a substantial but incomplete answer;
- `SOLUTION_REQUEST` — explicit request for the direct solution.

The gate must not silently reinterpret ordinary conversation as a solution request.

## Spoiler budget

`spoiler_budget` is the maximum new disclosure level authorized for the next response. `already_revealed_spoiler_level` records information that can no longer be made secret.

The policy is monotonic with respect to prior disclosure:

- referring to information already revealed is not counted as a new spoiler increase;
- revealing beyond both the already-revealed level and the current budget is blocked;
- a previously revealed spoiler does not automatically authorize a still deeper spoiler.

## Stakes-aware escalation

High-depth advice is most constrained when the companion is uncertain and the consequence is irreversible.

A direct solution may be permitted for an explicit solution request in a reversible situation when the answer is `KNOWN`. The same depth is blocked for a `GUESS` attached to irreversible-loss risk.

This preserves:

`Permission to Be Wrong != Permission to Cause Avoidable Loss`

## Anti-dependency response

Repeated routine help-seeking is an observational signal, not a diagnosis and not a reason to refuse ordinary help.

For this synthetic gate, a `dependency_risk_signal` may cause the companion to choose a lower-depth response than the player's maximum authorized depth, while still remaining helpful. It must not create a durable psychological profile or engagement-maximization objective.

## Fixture cases

The machine-readable cases demonstrate:

1. ordinary conversation remains exploratory rather than becoming a solution;
2. an explicit hint request can authorize a hint without authorizing a full solution;
3. an explicit solution request plus `KNOWN` reversible knowledge can authorize a solution;
4. an unsolicited solution is blocked;
5. an uncertain irreversible solution is blocked even after an explicit solution request;
6. already revealed information may be referenced without consuming additional spoiler budget;
7. repeated routine help may validly choose a shallower response while preserving help and agency.

## Non-effects

Merging this slice authorizes no KONTUR external effect, autonomous gameplay, game-account control, behavioral or psychological profiling, total-history capture, engagement maximization, stable-core promotion, release/tag, permission/protection change, or successor permit.
