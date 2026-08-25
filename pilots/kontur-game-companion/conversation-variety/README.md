# KONTUR Game Companion — Conversational Variety / Anti-Repetition v0.1

**Status:** synthetic / non-executing / post-admissibility surface selection  
**Related:** #445, #456, #461, #462  
**Origin frontier:** `c5c7dfbc3018125fe11ee9be5ee05bf90f6b388d`

## Purpose

Prevent a safe Game Companion from becoming mechanical through repeated question shapes, repeated disclaimers, repeated hint forms, or repetitive callbacks.

This layer may vary **surface form and conversational move class only after a candidate response is already admissible**. It does not create response authority and cannot raise assistance, initiative, spoiler depth, or redirect the player's chosen focus.

```text
Interaction Receipt admissibility
        +
Cross-cutting safety boundary
        ↓
Conversational Variety selector
        ↓
surface move candidate at the same authority/depth
```

Core boundary:

`Variety may select presentation inside existing bounds; it may not create new bounds.`

## Placement

This is a `POST_ADMISSIBILITY_SURFACE_SELECTOR`, not an authority gate and not a Stable Core primitive.

A blocked Interaction Receipt remains blocked. Variety cannot revive it.

Required distinctions:

- `Variation != Manipulation`
- `Novelty != Engagement Optimization`
- `Repeated Phrase != Stable Player Preference`
- `Local Turn Pattern != Durable Conversational Profile`
- `Style Adaptation != Personality Inference`
- `Interestingness != Attention Capture`
- `Different Wording != Different Authority`
- `Variety != Forced Topic Switching`
- `Avoid Repetition != Avoid Necessary Safety Boundary`
- `Freshness != Spoiler Escalation`
- `Playful Voice != False Certainty`
- `Question Diversity != Interrogation`
- `Player Correction > Style Consistency`
- `Player Focus > Variety Objective`
- `Conversation Variety != Action Permit`

## Surface move classes

The selector uses exactly these presentation classes:

`COMMENT | OBSERVATION | QUESTION | THEORY | CALLBACK | PLAYFUL_HYPOTHESIS | REFLECTION | WAIT`

`NUDGE`, `HINT`, `PARTIAL_SOLUTION`, and `SOLUTION` are deliberately **not** surface move classes here because they carry assistance-depth semantics elsewhere.

A selected surface move must preserve:

- the already authorized assistance depth;
- the already authorized initiative depth;
- the current spoiler depth;
- the player's current focus.

## Local repetition memory

Only a small ephemeral rolling window is needed:

- maximum 5 recent move classes;
- local scope only;
- no full transcript required;
- no durable style profile;
- no cross-game style profile.

The layer does not infer that repeated acceptance of a move shape is a permanent player preference.

## Anti-interrogation guard

Two consecutive `QUESTION` moves are enough to create a local repetition signal. A third consecutive question is rejected unless the player explicitly asks for the same interaction shape.

The selector should prefer a permitted `COMMENT`, `OBSERVATION`, `REFLECTION`, or `WAIT` where appropriate rather than turning the companion into an interviewer.

## Legitimate repetition

Anti-repetition is subordinate to clarity and agency.

Repetition can remain correct when:

1. the player explicitly asks for the same form again;
2. a safety boundary requires repetition;
3. a player correction requires content repair even if the same move class is reused.

Therefore:

`Avoid Repetition != Avoid Necessary Safety Boundary`

and

`Player Correction > Style Consistency`

## Selection objective

Allowed local inputs include the small rolling move history and the player's explicit request.

The selector must not choose a move because it is predicted to:

- maximize engagement;
- maximize retention;
- hold attention;
- exploit inferred personality;
- optimize dependency.

Interestingness is a conversational quality constraint, not a retention objective.

## Canonical cases

The fixture covers:

1. two questions followed by a comment;
2. repeated comments followed by a playful hypothesis;
3. explicit request allowing the same question shape;
4. safety clarity allowing repetition;
5. novelty attempting to redirect player focus — blocked;
6. variety attempting assistance escalation — blocked;
7. personality-based style adaptation — blocked;
8. local move history expiring without a durable profile;
9. player correction overriding style consistency;
10. third consecutive question — blocked;
11. engagement-maximizing selection objective — blocked;
12. spoiler increase for freshness — blocked;
13. a blocked receipt being revived by variety — blocked.

## Validation

Run:

```bash
python pilots/kontur-game-companion/conversation-variety/validate.py
```

The validator checks the exact move vocabulary, local rolling-memory boundary, predecessor evidence, invariant set, non-effects, canonical cases, and fail-closed mutations.

## Non-effects

This synthetic layer authorizes no:

- live response generation;
- proactive/background messaging;
- runtime activation;
- external effect;
- action or successor permit;
- response authority creation;
- personality, psychological, behavioral, or mood profiling;
- attention tracking;
- engagement or retention optimization;
- cross-game style profile;
- transcript retention;
- Stable Core promotion.

`Conversation Variety != Action Permit`
