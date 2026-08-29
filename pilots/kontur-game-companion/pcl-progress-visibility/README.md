# KONTUR × Perceived Causal Liveness — Progress Visibility Adapter v0.1

Synthetic, read-only integration under #722 / #738.

The adapter consumes existing Perceived Causal Liveness `ProgressReceipt` and `HumanLivenessView` semantics and projects only bounded session/process visibility for KONTUR.

Visible fields include current phase, last confirmed meaningful progress, waiting category, next observable event, next safe action, checkpoint reference, and run/session identity.

## Invariants

- `Visible Progress != Chain of Thought`.
- `Heartbeat != Meaningful Progress`.
- `Waiting != Failure`.
- `Silence != Thinking`.
- `Progress Cue != Pressure to Continue Playing`.
- `Session Liveness != Engagement Optimization`.
- `Player Attention != Runtime Authority`.
- `Stale Predecessor != Current Session Progress`.

A heartbeat-only receipt is never displayed as confirmed meaningful progress. A progress receipt bound to another run or epoch is rejected.

The adapter rejects pressure-to-continue flags, engagement objectives, mood inference and durable profiling inputs rather than silently incorporating them into liveness.

## Non-effects

This adapter creates no live KONTUR activation, response send, background notification, autonomous gameplay, account control, engagement/retention objective, psychological inference, durable profile, external-effect authority, ActionPermit, release or Stable Core dependency.
