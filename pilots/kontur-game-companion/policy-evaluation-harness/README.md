# KONTUR Game Companion — Policy Evaluation Harness / Pre-Text Policy Receipt v0.1

**Status:** synthetic / non-executing / pre-text policy evaluation  
**Related:** Issue #445, PRs #452, #456, #459–#469  
**Origin frontier:** `6b9c2d17de295bd05c11740c631722093ddebc82`

## Purpose

The candidate-envelope layer derives a bounded policy request from the current synthetic session state and the current PLAYER event. This slice evaluates that request against a deterministic policy context and produces a machine-readable **Pre-Text Policy Receipt**.

The important boundary is that this is still **before candidate response text exists**.

The existing Interaction Receipt v0.2 explicitly records admissibility of an already-formed candidate response. Therefore this layer does not counterfeit an Interaction Receipt before there is content to inspect.

`Pre-Text Policy Receipt != Interaction Receipt`

`Shape Admissible != Response Admissible`

`Policy Evaluation != Response Authority`

`Policy Pass != Permission to Generate`

`Requested Depth != Selected Depth`

`Selected Depth != Authorized Response`

`Downstream Reduction != New Authority`

`Blocked Shape != Conversation Failure`

`No Candidate != Refusal`

`Receipt Digest != Authority`

`Pre-Text Evaluation != Runtime Connectedness`

## Pipeline

The synthetic pipeline is now:

`Session State + PLAYER Event`
`→ Candidate Envelope`
`→ Policy Evaluation Harness`
`→ Pre-Text Policy Receipt`
`→ future candidate formation`
`→ Interaction Receipt`

The evaluator consumes:

- current synthetic session state;
- current PLAYER event;
- the exact candidate-envelope digest;
- a current-event-only policy context.

It does not invoke a language model and does not generate response text.

## Policy context

The default v0.1 policy context is intentionally small and current-event scoped. It gives only ceilings and a possible block:

- assistance ceiling;
- initiative ceiling;
- blocked / block reason;
- authority/action/successor effects, all fixed to `NONE`.

A supplied context may only narrow the canonical event policy. It cannot widen it.

Examples:

- a `HINT_REQUEST` envelope requesting `HINT` may be reduced to `QUESTION`;
- an explicit `SOLUTION_REQUEST` may be blocked;
- no context can promote ordinary conversation to `HINT` or `SOLUTION`;
- no context can create response, action, or successor authority.

`Policy Context Can Narrow != Policy Context Can Escalate`

## Canonical events

The harness evaluates the eight PLAYER events already present in the merged 15-turn synthetic conversation:

1. player hypothesis;
2. player correction;
3. local observation;
4. pause;
5. resume;
6. explicit hint request;
7. challenge to the hint;
8. explicit solution request.

The ordinary canonical path yields:

- seven `SHAPE_ADMISSIBLE` receipts;
- one `NO_RESPONSE_CANDIDATE` receipt for pause.

Pause is deliberately not treated as a blocked response or refusal.

## Downstream reduction

v0.1 explicitly tests a stricter policy snapshot for the hint request:

`requested HINT → selected QUESTION`

The receipt becomes:

`SHAPE_REDUCED`

The evaluator never increases assistance or initiative above either:

- the candidate envelope; or
- the current policy context.

## Downstream block

v0.1 explicitly tests a blocked solution request.

The result is:

`SHAPE_BLOCKED`

with:

- selected assistance `NONE`;
- no response text;
- `response_admissible = null`;
- `interaction_receipt_ready = false`;
- no future solution authority;
- no solver mode.

A block at this stage does not create a refusal narrative and does not establish future policy.

## Why this is not yet Interaction Receipt

Interaction Receipt v0.2 defines `response_admissible` for an already-formed candidate response. At this stage:

- `response_text = null`;
- `content_candidate_present = false`;
- `content_safety_evaluated = false`;
- `factual_correctness_evaluated = false`;
- `player_judgment_evaluated = false`;
- `response_admissible = null`;
- `interaction_receipt_ready = false`.

A structurally admissible shape must still be bound to an actual candidate before the downstream Interaction Receipt can evaluate content-sensitive constraints.

This prevents a pre-text structural pass from silently becoming full response approval.

## Receipt scope

The Pre-Text Policy Receipt scope is exactly:

`THIS_CANDIDATE_SHAPE_ONLY`

A passing receipt may be consumed by a later candidate-formation layer. It does not authorize generation, sending, retry, escalation, persistence, or reuse.

## Determinism and provenance

Each receipt binds:

- source state digest;
- source event digest;
- source envelope digest;
- policy context digest;
- selected shape;
- policy receipt digest.

Hash continuity is evidence of deterministic synthetic evaluation only.

`Receipt Digest != Authority`

## Validation

Run:

```bash
python pilots/kontur-game-companion/policy-evaluation-harness/validate.py
```

The validator:

- derives all eight canonical envelopes from the merged session runner + candidate generator;
- evaluates them twice for deterministic equality;
- verifies the canonical decisions;
- verifies explicit hint downshift;
- verifies explicit solution block;
- rejects mutations that invent text, set `response_admissible`, claim Interaction Receipt readiness, create authority, persist solver mode, restore stale focus, widen policy ceilings, or corrupt source envelopes.

A dedicated read-only workflow runs this validator. The umbrella Game Companion chain runs it after the candidate-envelope validator.

## Non-effects

This layer authorizes no:

- language-model invocation;
- live KONTUR connection;
- response generation;
- response sending;
- proactive or background messaging;
- autonomous gameplay;
- game-account control;
- external effect;
- response authority;
- ActionPermit;
- successor permit;
- player profiling;
- attention tracking;
- engagement or retention optimization;
- total-history capture;
- cross-game preference profile;
- Stable Core promotion;
- deployment, release, permission, or protection change.
