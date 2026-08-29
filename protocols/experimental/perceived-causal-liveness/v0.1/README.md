# Perceived Causal Liveness v0.1

First implementation slice for #528.

Canonical execution shape:

`Intent -> RunLease -> ProgressReceipt -> Checkpoint -> Stall Detection -> Terminal Closure -> Continuation Capsule -> Successor Run`

This slice proves only the execution-state invariants needed before UI/runtime integration:

- live runs carry a bounded lease;
- `RUNNING -> SUSPECTED_STALL -> TIMED_OUT_CLOSED` is representable;
- terminal closure is irreversible;
- terminal closure revokes external-effect authority;
- a late result from an older epoch cannot become active;
- a continuation capsule transfers bounded checkpoint/provenance state, not hidden reasoning or predecessor authority.

## Invariants

- `Silence != Thinking`
- `Spinner != Progress`
- `Feedback != Chain of Thought`
- `Terminal State != Paused State`
- `Closed Run Cannot Reacquire Authority`
- `Continuation != Resurrection`
- `Checkpoint Transfer != Authority Transfer`
- `Late Result != Active Effect`

This slice does not change production timeouts, ChatGPT UI, external agents, KONTUR, credentials, permissions, or action authority. It is a provider-neutral state-machine foundation only.
