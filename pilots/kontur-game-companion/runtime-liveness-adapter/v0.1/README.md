# KONTUR Game Companion × Perceived Causal Liveness — Pause/Resume Adapter v0.1

This bounded adapter implements the policy selected in #736: **close-on-pause / fresh-successor-on-resume**.

It composes the existing KONTUR Game Companion Pause/Resume semantics with Perceived Causal Liveness v0.1 without adding a new `PAUSED` state to PCL.

## Lifecycle

```text
active KONTUR session + live PCL run
  -> deliberate session pause
  -> PCL run terminally closes as CANCELLED_CLOSED
     with adapter cause DELIBERATE_SESSION_PAUSE
  -> bounded ContinuationCapsule preserves checkpoint/provenance only
  -> later user/session resume
  -> fresh run_id + strictly newer run_epoch + fresh lease
  -> authority remains false until a separate gate grants anything
```

The PCL terminal state is a technical lifecycle state. `DELIBERATE_SESSION_PAUSE` records why the adapter closed the run and MUST NOT be interpreted as failure, suspected stall, user cancellation of the wider conversation, or loss of preserved checkpoint evidence.

## Required distinctions

- `Deliberate Pause != Suspected Stall`
- `Conversational Continuity != Runtime Run Continuity`
- `Resume != Authority Restoration`
- `Checkpoint Transfer != Authority Transfer`
- `Old Help Intent != Current Help Intent`
- `Pause != Background Activity Authority`
- `Closed Run != Suspended Run`
- `Continuation != Resurrection`
- `Fresh Successor != Successor Permit`

## Fail-closed rules

A deliberate pause can close only a non-terminal `RUNNING` or `SUSPECTED_STALL` PCL run. The resulting predecessor is terminal and cannot transition again.

Resume requires:

1. the exact deliberate-pause closure receipt;
2. a fresh `run_id`;
3. a strictly newer `run_epoch`;
4. a fresh live-run lease.

The successor is created with `external_effect_authority=false`. Old help intent, predecessor authority and background activity permission are never inherited.

Late output from the closed predecessor remains rejected by PCL terminal-state semantics.

## Non-effects

This adapter does not activate KONTUR, send a response, resume a real session, create an ActionPermit, infer current player intent, authorize proactive/background activity, authorize autonomous gameplay, create cross-session profiling, change PCL v0.1 semantics, create a release, or grant external-effect authority.

Related: #722, #736; `pilots/kontur-game-companion/pause-resume/`; `protocols/experimental/perceived-causal-liveness/v0.1/`.
