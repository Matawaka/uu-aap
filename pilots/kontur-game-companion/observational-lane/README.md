# KONTUR Game Companion — Cautious Parallel Observational Lane

**Status:** synthetic / non-executing / observational  
**Related:** Issue #445  
**Origin frontier:** `06cd94208f43f3fe44956eee532d39f4a378f953`

This pilot line develops a game companion on top of UU-AAP/KONTUR without turning the companion into a solver and without making the experiment part of the stable core before evidence exists.

## Placement

```text
UU-AAP / KONTUR stable core
        ↓ optional reuse
Game Companion adapter
        ↓
Cautious observational pilot
```

The dependency is one-way by default. Pilot findings may later justify a core proposal, but observation alone creates no mainline requirement or authority.

Required invariants:

`Parallel Observation != Mainline Authority`

`Pilot Finding != Stable-Core Requirement`

`Observed Gameplay Event != Broad Player Profile`

`Useful Context != Total History`

`Engagement Signal != Permission to Maximize Engagement`

`Companion != Solver`

`Hypothesis != Fact`

`Knowledge != Spoiler Right`

`Permission to Be Wrong != Permission to Cause Avoidable Loss`

## Sparse observation boundary

The future gameplay process should prefer sparse, interaction-relevant evidence over total capture. Candidate events include:

- assistance depth used;
- epistemic mode (`KNOWN`, `LIKELY`, `GUESS`, `PLAYFUL_THEORY`);
- explicit request for a hint or solution;
- player correction of the companion;
- confirmation or refutation of a hypothesis;
- spoiler depth;
- reversibility / consequence class of advice;
- whether previously retained context was actually useful.

The pilot does not authorize broad psychological profiling, total gameplay history, engagement maximization, autonomous gameplay, or control of a game account.

## Assistance depth

The conversational intervention ladder is:

`COMMENT → NOTICE → QUESTION → THEORY → NUDGE → HINT → PARTIAL_SOLUTION → SOLUTION`

A direct solution is not the default. Deeper intervention requires stronger evidence of player intent and greater care around spoiler cost and irreversible consequences.

## Bounded fallibility

The companion may be wrong in ways that create useful shared exploration. Its internal epistemic distinction must remain machine-readable:

- `KNOWN` — sufficiently supported;
- `LIKELY` — strong inference, still defeasible;
- `GUESS` — tentative hypothesis;
- `PLAYFUL_THEORY` — exploratory conversational speculation.

A correction by the player is a positive evidence event. The old claim must not silently remain fact-like after contrary evidence is observed.

## Stakes-aware error budget

Conversational freedom is larger when consequences are reversible and smaller when advice can cause costly or irreversible loss.

Conceptually:

`Conversational Error Budget ∝ Reversibility`

The fixture `irreversible-guess-blocked` demonstrates that an uncertain direct solution with irreversible-loss risk remains disallowed even when a player explicitly asks for help.

## Learning loop

The observational loop is intentionally slow and reversible:

`observation → repeated evidence → tentative local adaptation → later evidence → retain | revise | discard`

A single event must not become a durable player trait. Local adaptation is evidence-bound and remains contestable.

## Fixture purpose

The machine-readable cases cover four boundaries:

1. a playful theory in a reversible situation is allowed;
2. player correction requires model revision;
3. a known answer can remain partially withheld when no direct solution was requested;
4. a guess presented as a direct solution before an irreversible consequence is blocked.

The validator includes fail-closed mutations for authority leakage, profiling expansion, engagement maximization, silent epistemic promotion, ignored player correction, unwanted direct solution disclosure, and unsafe irreversible advice.

## Non-effects

Merging this observational slice authorizes no KONTUR external effect, no autonomous gameplay, no game-account control, no behavioral profiling, no total-history collection, no engagement-maximization objective, no stable-core promotion, no release/tag, and no successor permit.
