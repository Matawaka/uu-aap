# Event-Responsive Dormancy v0.1

**Status:** experimental integration profile / provider-neutral / non-actuating  
**Tracking issue:** #877  
**Origin frontier:** `3a8c836bb3a1a619b6d292ac3b830e7a963fc1d5`

## Purpose

Event-Responsive Dormancy minimizes active waiting without turning an external event into permission to act.

```text
Dormant Capability
  -> supplied Wake Signal
  -> Wake Attention
  -> Current Evidence / Authority / Intent checks
  -> Wake Re-evaluation Receipt
  -> separate Pre-Action interface, if independently admitted
```

The profile stops before action authority. It contains no polling loop, timer, scheduler, network client,
background worker, process spawning, actuator, or ActionPermit issuer.

## Reused semantics

It is compatible with CCRP/C4 explicit successor/fencing semantics (#144) and the accepted KONTUR×PCL
close-on-pause/fresh-successor-on-resume policy (#736/#737). Checkpoint and provenance may be preserved,
but predecessor lease, intent and ActionPermit are never inherited.

## Invariants

`Trigger != Authorization`

`Wake != Resume of Old Authority`

`Dormancy != Termination`

`Dormancy != Background Polling`

`Checkpoint/Provenance Continuity != Intent Continuity`

`All Re-evaluation Checks Pass != ActionPermit`

## States

- `NO_WAKE_SIGNAL_MATCH`
- `WAKE_ATTENTION_ONLY`
- `RETURN_TO_DORMANCY_EVIDENCE_STALE`
- `RETURN_TO_DORMANCY_AUTHORITY_STALE`
- `RETURN_TO_DORMANCY_INTENT_CLOSED`
- `READY_FOR_SEPARATE_ACTION_ADMISSION`

The last state only exposes `PreActionEvidenceBundle` as a separately governed next admissible interface.
`automatic_transition=false` remains fixed.

## Source trust

A wake signal carries an evidence reference and an explicit source-assurance label. This profile checks the
signal against the dormant capability's declared kind/context/scope. It does not authenticate the external
producer and does not infer authority from source assurance.

## Validation

```bash
node protocols/integration/event-responsive-dormancy/v0.1/test-event-responsive-dormancy.js
```

The test emits sample artifacts under `/tmp/event-responsive-dormancy-v0.1`; dedicated CI validates those
bytes against the closed JSON Schemas and scans the implementation for forbidden active-wait/runtime surfaces.

## Non-effects

No Stable Core/SPEC/roadmap change, no scheduler installation, no network monitoring, no runtime activation,
no ActionPermit/authority creation, no external effect, no release/tag, and no Workbench reactivation.
