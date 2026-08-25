# KONTUR Game Companion — Candidate Envelope Generator v0.1

**Status:** synthetic / non-executing / pre-policy request generation  
**Related:** Issue #445, PRs #452, #456, #467, #468  
**Origin frontier:** `eb4d23cd70f0dcf6608e4363f90dd31a14dffcb3`

## Purpose

The deterministic session runner can now compute successor session state from the integrated conversation trace. This slice adds the next narrow step: derive a **candidate policy-request envelope** from the current synthetic state plus the current PLAYER event.

The envelope is not a response, permission, Interaction Receipt, or authority decision. It is only a bounded request for downstream policy evaluation.

`Candidate Envelope != Admissible Response`

`Requested Depth != Authorized Depth`

`Generator != Policy Gate`

`Generator != Language Model`

`Event Intent != Persistent Intent`

`Hint Request != Solution Request`

`Solution Request != Solver Mode`

`No Explicit Help Request != Permission to Escalate`

`Minimum Sufficient Request != Maximum Available Help`

`Envelope Digest != Authority`

`Candidate Envelope Generator != Runtime Connectedness`

## Position

```text
current synthetic session state
        +
current PLAYER event
        ↓
Candidate Envelope Generator
        ↓
bounded policy-request envelope
        ↓
existing Assistance / Initiative / Discovery / Safety gates
        ↓
Interaction Receipt
```

The generator cannot bypass the downstream gates. A generated envelope may still be reduced or blocked.

## Envelope

Every envelope carries:

- exact `scope_id`;
- current-event source turn and event type;
- `source_state_digest`;
- `source_event_digest`;
- `request_scope = CURRENT_EVENT_ONLY`;
- requested assistance depth;
- requested initiative depth;
- requested discovery posture;
- requested surface move;
- focus request;
- `response_text = null`;
- `response_admissible = null`;
- `authority_effect = NONE`;
- `action_effect = NONE`;
- `successor_effect = NONE`;
- `persistent_solver_mode = false`.

The explicit nulls are important:

`Unknown Downstream Decision != Implicit Approval`

## Minimum sufficient request

The generator uses the narrowest request matching the current event:

- ordinary hypothesis/conversation → conversational theory request, never help depth;
- local correction/challenge → evidence-oriented question request;
- new local observation → minimal notice request;
- pause → no-response / wait request;
- resume → neutral check-in request without restoring old focus or help;
- explicit hint request → exactly `HINT`;
- explicit solution request → exactly `SOLUTION`, current event only.

A `SOLUTION_REQUEST` is allowed to request the `SOLUTION` ceiling because the player explicitly asked for it. The generator still does not authorize it.

## State boundary

The generator may inspect only the synthetic session state needed for the current request: session phase, current focus, pending current PLAYER event, local scope, spoiler exposure and local correction provenance.

It must not turn memory, past help, past solution exposure, or previous admissibility into current authority.

`Persistent State != Persistent Authority`

## Validation

Run:

```bash
python pilots/kontur-game-companion/candidate-envelope/validate.py
```

The validator derives envelopes for every PLAYER event in the merged 15-turn integrated trace, verifies deterministic output and source digests, checks exact per-event minimum requests, and rejects unsafe mutations including help escalation, stale focus restoration, persistent solver mode, synthetic approval, generated response text, and authority/action/successor effects.

## Non-effects

This synthetic component authorizes no live response generation, language-model invocation, runtime KONTUR connection, proactive/background messaging, autonomous gameplay, account control, external effect, response authority, ActionPermit, successor permit, player profiling, attention tracking, engagement/retention optimization, total-history capture, cross-game preference profile, Stable Core promotion, release, deployment, permission, or protection change.
