# FCL Progress Chain v0.1 — causal receipt continuity and human-facing projection

**Status:** experimental read-only FCL successor slice  
**Tracking:** Issue #530  
**Origin frontier:** `db5c32b81d734a243b9d485ae70b2514c8bac92b`  
**Origin tree:** `1fb71e09b08bda4a1b5f8a4bf7f9acd7ea834c41`  
**Predecessor:** FCL v0.1 merged by PR #529

## Purpose

The first FCL slice proves that one observation can be classified as `RUNNING`, `SUSPECTED_STALL`, or `TIMED_OUT_CLOSED`, that timeout closure is irreversible, and that a closed run cannot reacquire authority.

This second slice proves something different: **a sequence of individually valid liveness receipts must itself form a valid causal chain before it may be projected as continuous human-visible progress.**

```text
RunObservation
  -> RunLivenessReceipt
  -> ProgressChain
  -> ProgressProjectionReceipt
  -> later transport / UI adapter
```

The layer is provider-neutral and read-only. It does not stream a live model, create a heartbeat, interrupt a run, start a successor, or admit execution.

## Core distinctions

```text
Valid Receipt != Valid Receipt Chain
Sequence Position != Authority
Later Observation != Permission to Rewrite Earlier Evidence
Progress Timestamp Must Not Regress
Run Identity Must Not Drift Within One Chain
Intent Binding Must Not Drift Within One Chain
Checkpoint Continuity Must Be Explicit
Terminal Closure Is Monotonic
Projection != Execution Authority
Human-Facing Status != Chain-of-Thought Disclosure
Transport Delivery != Progress Truth
Spinner != Progress Receipt
```

A delivery acknowledgement, websocket frame, poll response, queue event, or animation may prove that some transport activity occurred. It does not prove that the underlying work advanced.

## Files

- `progress-chain.schema.json` — closed schema for a progress chain;
- `progress-projection-receipt.schema.json` — closed human-facing projection contract;
- `progress-chain.js` — read-only validator and projector CLI;
- `test-progress-chain.js` — positive and fail-closed conformance suite;
- `examples/active.chain.json` — advancing run;
- `examples/waiting.chain.json` — explicit dependency wait with committed checkpoint;
- `examples/stall.chain.json` — causally linked transition to suspected stall;
- `examples/closed.chain.json` — monotonic transition to timeout closure.

## Progress-chain structure

Each event contains:

```text
sequence
predecessor_fingerprint
committed_checkpoint_refs[]
receipt: RunLivenessReceipt
```

The first event requires:

```text
sequence = 0
predecessor_fingerprint = null
```

Every later event requires:

```text
sequence = previous.sequence + 1
predecessor_fingerprint = previous.receipt.fingerprint_sha256
```

Therefore a projection cannot silently skip, reorder, substitute, or re-parent receipts and still claim one continuous causal stream.

## Embedded receipt identity

Every embedded `RunLivenessReceipt` is independently revalidated with the FCL fingerprint rule:

```text
sha256(
  UTF8(
    recursively-key-sorted compact JSON
    with fingerprint_sha256 replaced by ""
  )
)
```

Changing a phase, timestamp, authority field, checkpoint, state, safe action, or any other bound field invalidates the fingerprint.

Recomputing a fingerprint does not authorize rewriting history: predecessor linkage, run identity, temporal monotonicity, checkpoint lineage, authority non-amplification, and terminal monotonicity are checked separately.

## Immutable run identity

Within one chain these values must remain identical:

```text
run_id
run_epoch
intent_ref
lease_expires_at
```

A new `run_id` or epoch belongs to a separately established successor run and chain.

```text
Continuation != Same-Run Extension
New Epoch != Progress Event
```

Intent acknowledgement is also non-regressing: once acknowledged, it cannot later become unacknowledged inside the same chain.

## Temporal monotonicity

For each event:

```text
last_progress_age_seconds
  == floor((evaluated_at - last_progress_at) / 1000)
```

Across events:

```text
next.last_progress_at >= previous.last_progress_at
next.evaluated_at     >= previous.evaluated_at
```

Non-terminal receipts are rejected at or after lease expiry. Terminal receipts are accepted only at or after expiry.

Thus a newer network delivery time cannot be substituted for actual progress time.

## Checkpoint continuity

Each event carries cumulative `committed_checkpoint_refs`.

The previous checkpoint list must be a prefix of the next list:

```text
previous.committed_checkpoint_refs
  prefix-of
next.committed_checkpoint_refs
```

The embedded receipt must reference the latest committed checkpoint, or `null` if no checkpoint exists.

Once a checkpoint is committed, later events cannot silently delete or replace it.

```text
Checkpoint Commit != Hidden Mutable Scratch State
Correction != Checkpoint Erasure
```

## Authority non-amplification

The progress layer may observe an already-existing source field `external_effect_authority`, but it cannot create or restore that authority.

The chain rejects:

```text
external_effect_authority: false -> true
```

Terminal receipts require:

```text
external_effect_authority = false
```

Every human-facing projection additionally fixes:

```text
execution_admitted = false
authority_established = false
transport_delivery_proves_progress = false
private_reasoning_included = false
```

```text
Progress Receipt != ActionPermit
Projection != Authority Source
Transport != Authority
```

## Terminal monotonicity

Once a terminal receipt is present, no later event is accepted in the same chain:

```text
RUNNING
  -> SUSPECTED_STALL
  -> TIMED_OUT_CLOSED
  -> STOP
```

Continuation remains the separately validated FCL mechanism introduced by #529:

```text
TIMED_OUT_CLOSED
  -> ContinuationCapsule
  -> new run_id / newer epoch
  -> fresh authority if separately granted
```

A successor is not appended to the dead predecessor as another progress event.

## Human-facing projection

`project` deterministically maps the chain head to one bounded status:

```text
RUNNING + no wait       -> ACTIVE
RUNNING + dependency    -> WAITING
SUSPECTED_STALL         -> STALL_SUSPECTED
terminal + continuation -> CONTINUATION_AVAILABLE
```

`CLOSED` remains reserved for a future terminal profile with no continuation path. The current timeout profile from #529 has `continuation_available = true`.

The projection exposes only bounded causal facts needed to answer:

> Are we still working together, what was the last confirmed progress, and what can safely happen next?

It includes the latest confirmed progress time/age, bounded phase, wait dependency if present, latest checkpoint, next observable event, next safe action, terminal state, continuation availability, and exact head fingerprint.

It does not contain or require private chain-of-thought.

## Spinner and transport boundary

The only progress kinds remain:

```text
INTENT_ACK
CHECKPOINT_COMMIT
TOOL_OBSERVATION
DEPENDENCY_WAIT
SUBRESULT_COMMIT
```

There is no `SPINNER` progress kind.

The closed schemas reject provider/transport metadata added to chain events or liveness receipts as if it were proof of progress.

```text
Packet Delivered != Work Advanced
Provider Ack != Progress Evidence
Spinner != Progress Receipt
```

A later adapter may transport exact receipts, but the adapter must not upgrade transport success into liveness truth or authority.

## CLI

Validate:

```bash
node protocols/fcl/v0.1/progress/progress-chain.js validate \
  protocols/fcl/v0.1/progress/examples/waiting.chain.json
```

Project:

```bash
node protocols/fcl/v0.1/progress/progress-chain.js project \
  protocols/fcl/v0.1/progress/examples/stall.chain.json
```

Stdin is supported with `-`.

Only these commands exist:

```text
validate
project
help
```

There is no:

```text
execute
resume
interrupt
send
```

## Runtime non-effects

The CLI:

- performs no network access;
- invokes no provider or adapter;
- spawns no process;
- writes no file;
- creates no background heartbeat;
- interrupts no run;
- enforces no production timeout;
- starts no successor run;
- creates no `ActionPermit`;
- establishes no authority;
- admits no execution;
- exposes no hidden reasoning.

## Conformance

```bash
node protocols/fcl/v0.1/test-fcl.js
node protocols/fcl/v0.1/progress/test-progress-chain.js
```

The second suite covers ten grouped surfaces:

1. deterministic `ACTIVE`, `WAITING`, `STALL_SUSPECTED`, and `CONTINUATION_AVAILABLE` projections;
2. exact sequence and predecessor-fingerprint continuity;
3. immutable run/epoch/intent/lease identity;
4. temporal monotonicity, exact age arithmetic, and lease-boundary checks;
5. receipt fingerprint integrity;
6. append-only checkpoint lineage;
7. terminal monotonicity and terminal authority revocation;
8. authority and intent-acknowledgement non-regression;
9. rejection of `SPINNER`, provider acknowledgement, and transport metadata as progress proof;
10. deterministic bounded projection with no execution or authority claims.

## Deferred scope

This slice deliberately does not implement:

- production UI streaming;
- websocket/SSE/provider transport;
- background heartbeat generation;
- lease negotiation;
- automatic interruption;
- live-runtime timeout enforcement;
- automatic successor creation;
- cross-device continuation;
- distributed progress consensus.

Those belong to later adapters after the causal progress-chain boundary is merged and independently revalidated.

```text
Progress Chain Ready != Production Liveness Service
Projection Ready != UI Deployment
Merged Protocol != Runtime Activation
```
