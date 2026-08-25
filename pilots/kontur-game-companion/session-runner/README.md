# KONTUR Game Companion — Synthetic Session Runner / Conversational State Machine v0.1

**Status:** synthetic / non-executing / deterministic state-reduction experiment  
**Related:** Issue #445, PRs #459–#467  
**Origin frontier:** `80bfe24b1017aa0ff59af22ebf7f3fd54b1def49`

## Purpose

The integrated conversation trace in PR #467 proves that a fixed 15-turn dialogue is compositionally consistent. This slice adds a deterministic session reducer that **computes conversational state from the trace event sequence**.

The runner does not generate language and does not decide game actions. It consumes already-recorded player events and already-admissible companion commits, then derives bounded session state, provenance, pause/resume state, local claim state, spoiler exposure, and ephemeral pending intent.

This is the first step from static composition evidence toward an executable conversational state machine.

## Core boundary

`Reducer != Policy Oracle`

`Computed State != Response Authority`

`Persistent State != Persistent Authority`

`Current Event Intent != Future Intent`

`Pause Clears Pending Intent`

`Resume Recall != Help Authority`

`Hint Request != Solver Mode`

`Solution Request != Persistent Solver Mode`

`One Allowed Solution != Future Solution Authority`

`State Digest != State Authority`

`Synthetic Runner != Runtime Connectedness`

The reducer can reject an inconsistent event sequence. It cannot make a blocked response admissible, issue an ActionPermit, create successor authority, or prove a game answer correct.

## Input

The canonical input is the merged v0.1 integrated trace:

`pilots/kontur-game-companion/integrated-conversation-trace/integrated-conversation-trace.json`

The runner treats PLAYER turns as incoming session events and COMPANION turns as committed synthetic conversational outcomes that must already carry a valid candidate-scoped Interaction Receipt.

The runner therefore does **not** replace:

- Assistance Gate;
- Interaction Receipt;
- Pause / Resume;
- Uncertainty Repair;
- Discovery Prompt Gate;
- Bounded Playfulness;
- the cross-layer umbrella validator.

## State

The persistent synthetic state contains only session-local material:

- session phase: `ACTIVE | PAUSED | RESUMED_NEUTRAL`;
- current local focus, or `NONE`;
- pending player event, only until a companion commit consumes it;
- local memory entries with source turn and scope;
- companion claim states keyed by originating companion turn;
- current spoiler exposure level;
- last processed turn.

The state permanently fixes these authority-like fields to `false`:

- `stored_help_authority`;
- `stored_solution_authority`;
- `stored_response_authority`;
- `solver_mode`;
- `player_profile_created`.

No durable player preference, personality, mood, psychological, behavioral, or engagement profile is created.

## Event reduction

### Player event

A normal PLAYER event opens one ephemeral `pending_player_event` containing only:

- source turn;
- event;
- current intent;
- current focus.

It is not retained after the matching companion commit.

A `PAUSE` event:

- moves the session to `PAUSED`;
- clears focus;
- clears any pending player event;
- requires all help/intent/focus carryover flags to be false.

A `RESUME` event:

- is valid only from `PAUSED`;
- moves to `RESUMED_NEUTRAL`;
- preserves no old focus or help authority;
- opens only the neutral resume event needed for the following check-in.

### Companion commit

A COMPANION turn is accepted by the reducer only when:

- a pending player event exists;
- the selected assistance depth does not exceed the maximum implied by the **current** player intent;
- spoiler disclosure stays within the current turn budget;
- initiative stays inside its recorded upstream bound;
- the Interaction Receipt is candidate-scoped, admissible, and authority-neutral;
- discovery cannot smuggle a hidden answer;
- playfulness cannot hide hints or pressure continuation;
- solution depth occurs only after a current `SOLUTION_REQUEST`;
- `BYPASS_DISCOVERY` occurs only for that solution request;
- correction repair preserves history and does not promote the player to global factual authority.

After the commit, the pending event is cleared.

## Claim provenance

The reducer materializes two companion claims from the integrated trace:

- the playful theory at turn 2;
- the bounded hint at turn 11.

Later repair events update their local states to:

- turn 2 → `DISPROVED`;
- turn 11 → `CHALLENGED`.

The original claim records remain present.

`Claim State Update != Claim Erasure`

## Pause / resume

The state machine explicitly demonstrates:

`ACTIVE -> PAUSED -> RESUMED_NEUTRAL -> ACTIVE`

The resumed neutral check-in is not a restoration of the old objective. Focus returns only when the player explicitly selects the gate again.

## Solution non-persistence

Turn 15 may contain `SOLUTION` because turn 14 is a current explicit `SOLUTION_REQUEST`.

After turn 15 the final persistent state still has:

- `stored_solution_authority = false`;
- `solver_mode = false`;
- no pending solution intent.

The validator also appends a synthetic post-solution ordinary conversation probe and proves that an unsolicited `SOLUTION` commit is rejected.

## Deterministic successor chain

For every turn the runner computes:

- `pre_state_digest`;
- `event_digest`;
- `post_state_digest`;
- `transition_digest`.

All are SHA-256 digests over canonical JSON.

These digests prove deterministic state-reduction identity only.

`Digest Continuity != Semantic Authority`

## Validation

Run:

```bash
python pilots/kontur-game-companion/session-runner/validate.py
```

The validator:

1. executes the reducer twice and requires byte-for-byte deterministic output;
2. validates exact cross-turn state properties;
3. checks claim provenance and pause/resume transitions;
4. checks final absence of stored authority and solver mode;
5. verifies the digest chain;
6. appends a post-solution conversation probe to prove solution authority does not persist;
7. runs a fail-closed mutation suite over unsafe or inconsistent event sequences.

## Non-effects

This slice authorizes no:

- live response generation;
- language-model invocation;
- runtime KONTUR connection;
- proactive/background messaging;
- autonomous gameplay;
- game-account control;
- external effect;
- response authority;
- ActionPermit;
- successor permit;
- player profiling;
- engagement or retention optimization;
- total-history capture;
- cross-game preference construction;
- Stable Core promotion;
- release, deployment, permission, or protection change.
