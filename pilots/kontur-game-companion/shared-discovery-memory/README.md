# KONTUR Game Companion — Shared Discovery Memory & Correction Provenance v0.1

**Status:** synthetic / non-executing / bounded conversational memory experiment  
**Related:** Issue #445  
**Predecessors:** PR #446, PR #452  
**Origin frontier:** `3fc4b66d6eebe90321baea3c92dbad80f3b0afc0`

This slice defines a narrow memory layer for the KONTUR game companion: enough continuity to make shared discovery feel coherent, while refusing to turn sparse gameplay interactions into a durable behavioral or psychological profile.

The memory is about the conversation and local game-discovery context, not about constructing a generalized model of the child.

## Core invariants

`Remembered Correction != Permanent Player Profile`

`Past Expertise != Universal Expertise`

`Shared Joke != Permission for Manipulative Familiarity`

`Memory Candidate != Durable Memory`

`Local Discovery Memory != Cross-Game Profile`

`Correction Evidence != Global Truth`

`Contradiction != Permission to Pick a Winner`

`Forget / Expire != Rewrite Provenance`

`Spoiler Exposure Memory != Permission for Deeper Spoilers`

`Shared Discovery Memory != Action Permit`

## What may be remembered

The pilot admits only interaction-local memory classes that directly support a better companion conversation:

- `HYPOTHESIS` — a theory previously proposed by companion or player;
- `CORRECTION` — evidence that a prior hypothesis was challenged or disproved;
- `CONFIRMED_LOCAL_FACT` — a locally confirmed game fact with explicit scope;
- `OPEN_MYSTERY` — an unresolved question worth revisiting;
- `SHARED_LABEL` — a harmless recurring name/joke for a local in-game thing;
- `SPOILER_EXPOSURE` — information already revealed in this game context;
- `LOCAL_EXPERTISE_SIGNAL` — evidence that the player knows more in one bounded topic.

None of these classes is permission to infer temperament, intelligence, personality, health, motivation, dependency, or universal skill.

## Scope

Every retained item is bound to an explicit `scope_id`, such as one game, campaign, save, puzzle thread, or bounded dialogue topic.

Reuse outside that scope is blocked by default.

`Observed Local Skill != Global Player Trait`

A player correcting the companion in one game must not become a universal `expert=true` flag.

## Correction provenance

A correction does not erase the old hypothesis. Instead the old entry remains provenance-visible and changes state.

Preferred transition:

`ACTIVE_HYPOTHESIS -> CHALLENGED | DISPROVED`

with a separate correction record pointing back to it.

The system must not rewrite history to make the companion appear to have known the corrected answer all along.

## Conflict handling

Player correction is important evidence, but it is not automatically universal truth. When incompatible evidence remains unresolved, the memory state stays `CONTESTED` or `OPEN_MYSTERY` rather than silently selecting a winner.

This preserves:

`Player Correction != Automatic Canonical Truth`

and still permits:

`Player Correction -> Required Local Model Revision`

when the evidence is sufficient to show that the companion's prior claim should no longer be treated as active fact-like guidance.

## Retention classes

The pilot uses bounded retention classes:

- `TURN` — useful only for immediate exchange;
- `SESSION` — useful during the current play session;
- `LOCAL_THREAD` — retained for one bounded game/topic thread;
- `UNTIL_RESOLVED` — kept only while an explicit mystery/conflict remains open.

There is no default `FOREVER` class.

Expiration removes the item from active conversational reuse but must not be represented as proof that the historical event never happened.

## Spoiler continuity

Previously disclosed information may be remembered so the companion does not awkwardly pretend it is still secret. This memory only establishes the already-exposed level within the same scope.

`Remembered Spoiler Level N != Permission for Spoiler Level N+1`

The assistance gate introduced in PR #452 remains responsible for authorizing any new disclosure depth.

## Shared labels and familiarity

A recurring nickname or joke may be retained as `SHARED_LABEL` when it is bounded to the local game context. It must not be used to infer psychological traits, manufacture intimacy, or pressure continued engagement.

## Fixture cases

The machine-readable cases demonstrate:

1. a disproved companion hypothesis remains provenance-visible but is no longer active;
2. a player correction creates local model revision without becoming global truth;
3. local expertise remains scoped to one topic;
4. an unresolved contradiction stays contested instead of selecting a winner;
5. a shared label can be reused locally without profile construction;
6. remembered spoiler exposure prevents false secrecy but grants no deeper spoiler authority;
7. an open mystery can persist until resolved;
8. cross-game reuse of local memory is blocked;
9. expiration removes active reuse without falsifying provenance.

## Non-effects

Merging this slice authorizes no live KONTUR memory ingestion, autonomous gameplay, game-account control, cross-game profiling, psychological inference, engagement maximization, total-history capture, stable-core promotion, release/tag, permission/protection change, external effect, or successor permit.
