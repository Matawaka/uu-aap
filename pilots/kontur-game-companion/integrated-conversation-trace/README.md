# KONTUR Game Companion — Synthetic Integrated Conversation Trace v0.1

**Status:** synthetic / non-executing / composition acceptance trace  
**Related:** Issue #445, PRs #446, #452–#466  
**Origin frontier:** `8a6848b0eb56f4e471d5995155e39e852b28de45`

## Purpose

The individual KONTUR Game Companion layers are already validated in isolation and transitively. This slice adds one multi-turn synthetic conversation that composes their decisions in sequence.

The question is no longer only:

> Does each gate reject its own unsafe mutations?

It is also:

> Can the gates coexist across a realistic conversational arc without accidentally accumulating authority, becoming a solver by inertia, losing correction provenance, forcing pedagogy, or turning playfulness into pressure?

This remains a synthetic acceptance trace. It is not runtime connectedness and does not claim that a live KONTUR deployment currently executes these decisions.

## Core composition boundary

`Composed Admissibility != Runtime Authority`

`Layer Pass != Global Permission`

`Cross-Layer Consistency != Correct Game Answer`

`Integrated Trace != Runtime Connectedness`

The trace may demonstrate that a sequence is internally consistent with the current contracts. It cannot create response authority, action authority, successor authority, Stable Core membership, or a live external effect.

## Scenario

The fixture uses one fictional puzzle, `clockwork-garden-gate`, scoped to:

`game:synthetic:clockwork-garden:gate-puzzle`

The 15-turn trace covers:

1. the player proposes a local hypothesis;
2. the companion answers with a labeled playful theory;
3. the player disproves it with local evidence;
4. the companion revises without rewriting history and asks a non-leading discovery question;
5. the player notices another local fact;
6. the companion gives a minimal observation cue;
7. the player pauses the session;
8. the player later returns;
9. the companion performs a neutral resume check-in without carrying old intent/help authority;
10. the player explicitly asks for one hint, not the answer;
11. the companion supplies exactly bounded hint depth;
12. the player challenges the hint;
13. the companion marks it challenged and asks for evidence rather than declaring either side globally correct;
14. the player explicitly asks for the solution;
15. the discovery layer yields `BYPASS_DISCOVERY` and the direct local solution is allowed only for that request.

The final solution turn is intentionally present. The companion is not anti-answer; it is anti-unrequested-solver.

`Explicit Solution Request != Permanent Solver Mode`

`One Allowed Solution != Future Solution Authority`

## Components composed

The fixture names every currently required Game Companion contract used by the trace:

- `observational-lane`
- `assistance-gate`
- `shared-discovery-memory`
- `bounded-initiative`
- `focus-diversity`
- `interaction-receipt`
- `pause-resume`
- `conversation-variety`
- `uncertainty-repair`
- `self-discovery-gate`
- `bounded-playfulness`
- `safety-boundary`
- `dependency-contract`

The validator requires the README and validator for each component to exist in the repository. Their own validators continue to run independently in the umbrella workflow.

This trace therefore does **not** replace upstream validators.

`Composition Validation != Replacement of Layer Validation`

## Cross-turn properties

### No authority accumulation

Every companion turn carries a current-candidate Interaction Receipt with:

- `response_admissible = true`;
- `scope = THIS_CANDIDATE_ONLY`;
- `authority_effect = NONE`;
- `response_authority_created = false`.

The trace itself also fixes authority/action/successor/Stable-Core effects to `NONE`.

A previously admissible turn never becomes permission for a later turn.

### Assistance and spoiler monotonicity

Every selected assistance depth must remain at or below the upstream ceiling for that turn.

Every new spoiler level must remain inside the current spoiler budget.

A direct solution appears only after `SOLUTION_REQUEST` and an upstream `SOLUTION` ceiling.

### Correction provenance

The first playful theory is later `DISPROVED`; the history is preserved.

The later hint is only `CHALLENGED`; player disagreement is not promoted into global truth.

`Repair != History Rewrite`

### Self-discovery without compulsory tutoring

Discovery prompts must remain non-leading, low-cost, reversible, and focus-preserving.

When the player explicitly asks for a direct answer and upstream policy permits it, self-discovery produces:

`BYPASS_DISCOVERY`

not another compulsory question.

`Discovery Prompt != Mandatory Pedagogy`

### Pause / resume

The session break carries no help authority, intent, or focus.

The resumed exchange begins with a neutral check-in rather than silently restoring the old objective.

`Continuity != Intent Carryover`

### Playfulness

Humor targets the game mechanic or the companion's own hypothesis, never the player's ability, identity, worth, or mistake as a trait.

A playful hypothesis remains `PLAYFUL_THEORY`.

`Humor != Hidden Hint`

## Validation

Run:

```bash
python pilots/kontur-game-companion/integrated-conversation-trace/validate.py
```

The validator checks the 15-turn sequence, component presence, exact composition semantics, assistance/spoiler ceilings, initiative bounds, receipt non-authority, memory scope, correction provenance, pause/resume reset, self-discovery safety, playfulness targeting, explicit solution bypass, and final one-request-only solution scope.

It also runs a fail-closed mutation suite. v0.1 rejects **43 unsafe mutations**.

## Non-effects

This synthetic trace authorizes no:

- live response generation;
- proactive messaging;
- background activity;
- autonomous gameplay;
- game-account control;
- external effect;
- response authority;
- ActionPermit;
- successor permit;
- behavioral, psychological, or mood profiling;
- attention tracking;
- engagement or retention optimization;
- total-history capture;
- cross-game preference profiling;
- Stable Core promotion.

The trace proves only synthetic composition consistency at this repository frontier.
