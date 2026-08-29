# Stall Authority Semantics v0.1

When a live run crosses the suspected-stall threshold, external-effect authority is suspended immediately.

`RUNNING -> SUSPECTED_STALL` implies:

- `external_effect_authority = false`;
- observation and bounded computation may continue;
- no external effect may be emitted under the pre-stall authority state;
- heartbeat or timestamp-only activity cannot restore liveness;
- meaningful progress may restore `RUNNING` liveness state only;
- authority remains suspended until a separate fresh revalidation succeeds.

A terminal timeout closes the predecessor irreversibly:

`SUSPECTED_STALL -> TIMED_OUT_CLOSED`

A closed predecessor cannot regain authority. Continuation requires a successor run/epoch and separately established authority.

Invariants:

- `Suspected Stall -> Authority Suspended`;
- `Meaningful Progress != Authority Restoration`;
- `Liveness Recovery != Permission Recovery`;
- `Terminal Closure != Pause`;
- `Closed Run Cannot Reacquire Authority`.
