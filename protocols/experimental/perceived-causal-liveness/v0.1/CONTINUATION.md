# Perceived Causal Liveness — Continuation v0.1

Continuation does not resurrect a closed run.

A predecessor may contribute only a bounded `CheckpointCommit` containing externally representable state such as intent reference, constraints, completed observations/subresults, remaining work, and pending dependencies.

The checkpoint explicitly excludes hidden reasoning and authority.

A `ContinuationCapsule` binds the closed predecessor and checkpoint. A successor must:

- use a new `run_id`;
- use a strictly greater `run_epoch`;
- receive a fresh RunLease;
- begin with `external_effect_authority=false`;
- obtain authority separately before any external effect.

Invariants:

- `Continuation != Resurrection`;
- `Checkpoint != Hidden Reasoning Transfer`;
- `Checkpoint != Authority Transfer`;
- `Successor State != Successor Authority`;
- `Fresh Run != Reopened Closed Run`.
