# Sustainability Recovery / Resume Contract v0.1

**Status:** non-normative candidate  
**Predecessor:** Sustainability Kernel v0.1 on `main`  
**Purpose:** make kernel invariants K3 and K5 operational without creating execution authority.

This contract defines the minimum evidence required to resume work after a pause, context loss, handoff, or uncertain interruption.

It does not execute Git, GitHub, CHSP, KONTUR, repository-permission, release, publication, or external-provider mutations.

## Core state machine

`observed -> paused/context_lost -> stale_or_unknown -> reobserve -> reconciled -> safe_to_prepare`

`safe_to_prepare != execute`

A resume event never inherits execution authority merely because the previous context had it.

## Required frontiers

A recovery record binds two distinct frontiers:

1. **historical frontier** — the last state known to the interrupted context;
2. **fresh frontier** — a new observation made after recovery starts.

The historical frontier must not be silently replaced by the fresh frontier. Both are evidence.

`old observation != current truth`

`new observation != authority`

## Resume classifications

A recovery assessment produces exactly one of:

- `unchanged` — the fresh frontier equals the historical frontier;
- `advanced` — the relevant external state moved forward without evidence of incompatible divergence;
- `diverged` — material state differs in a way that requires reconciliation;
- `unknown` — freshness or comparison evidence is insufficient.

Only `unchanged` or explicitly reconciled `advanced` may reach `safe_to_prepare`.

`diverged -> blocked`

`unknown -> blocked`

## Authorization continuity

Project history may survive indefinitely; mutable authorization does not.

The contract requires:

- `authority_transfer = false`;
- `authorization_reuse_allowed = false` unless a separate current protocol explicitly proves the authorization remains active;
- no inference of consent from inactivity, elapsed time, branch existence, prior intent, or prior capability;
- no permission expansion during recovery.

`project continuity != authorization continuity`

## Permitted resume modes

The strongest modes represented by this contract are:

- `observe-only`;
- `validate-only`;
- `prepare-only`.

`execute` is intentionally not a recovery/resume mode.

If execution is later required, the relevant execution protocol must establish its own fresh authorization boundary.

## Reconciliation evidence

When the fresh frontier differs from the historical frontier, the recovery record must state:

- what changed;
- whether the change is material to the intended work;
- whether the intended work is still semantically valid;
- whether path/resource overlap changed;
- unresolved items;
- the resulting disposition.

A reconciliation record can preserve a prior plan, modify it, supersede it, or reject it. None of these dispositions grants execution authority.

## Fail-closed rules

Recovery must block if any of the following is true:

- current external state cannot be freshly observed;
- the historical frontier is missing when it should exist;
- a mutable authorization is assumed current without independent proof;
- an unresolved divergence can affect external behavior;
- prior intent is treated as present intent without a fresh attributable decision;
- denied or expired capability is routed around;
- a paused or aborted action is silently converted into executable work.

## Relationship to CHSP v1.0

CHSP v1.0 remains the bounded external execution architecture.

This recovery contract may prepare evidence that a future CHSP or other protocol can consume, but it neither invokes nor authorizes CHSP execution.

`recovered != authorized`

`reconciled != executable`

`safe_to_prepare != external_transition_allowed`

## Relationship to KONTUR

Recovery of project context never activates KONTUR and never expands its permissions.

`resume context != activate KONTUR`

## Minimal invariant

A durable project must be able to stop without losing its evidence, and resume without pretending the world stayed unchanged while it was stopped.
