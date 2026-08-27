# FCL v0.1 — Feedback Continuity & Perceived Causal Liveness

**Status:** experimental core protocol slice  
**Tracking:** Issue #528  
**Origin frontier:** `62f223bb8a17f335f8a5ad44ead033818aefd21c`  
**Origin tree:** `70dd06d0c1da0e221e2bc3b709564378f6bbeebd`

## Purpose

FCL v0.1 makes long-running human–AI work observably alive without exposing private
chain-of-thought. It separates useful progress evidence from generic UI activity,
derives a bounded liveness state from a fixed run lease, irreversibly closes an
expired run, and permits continuation only through a new successor run.

Canonical principle:

```text
Feedback Continuity > Result Optimality
Reasoning may be private. Progress must be observable.
```

The first slice addresses the **Last-Mile Liveness Failure** in which an indefinite
spinner collapses several causally different states — active work, dependency wait,
stall, lost synchronization, and dead execution — into one indistinguishable signal.

## First-slice chain

```text
Intent
  -> RunLease
  -> ProgressReceipt
  -> CheckpointCommit
  -> StallDetection
  -> TimeoutGate
  -> TIMED_OUT_CLOSED
  -> ContinuationCapsule
  -> SuccessorRun
```

A late backend result from the closed predecessor is handled separately:

```text
LateResultEnvelope -> REJECTED_CLOSED_RUN
```

## Canonical invariants

```text
Silence != Thinking
Spinner != Progress
Computation != Interaction
Feedback != Explanation
Proof of Intelligence != Proof of Liveness
Result Without Continuity != Fully Available Intelligence
Terminal State != Paused State
Closed Run Cannot Reacquire Authority
Closed Run != Successor Run
Continuation != Resurrection
```

FCL progress receipts describe externally representable state changes. They do not
contain hidden reasoning and do not require the model to disclose chain-of-thought.

## Files

- `run-observation.schema.json` — observable run state and bounded lease;
- `run-liveness-receipt.schema.json` — derived `RunLivenessReceipt` contract;
- `continuation-capsule.schema.json` — transferable state for a new successor run;
- `continuation-receipt.schema.json` — successor-admissibility receipt;
- `late-result-envelope.schema.json` — closed-run late result envelope;
- `late-result-disposition.schema.json` — fail-closed late-result disposition;
- `fcl.js` — deterministic, read-only validator/evaluator CLI;
- `test-fcl.js` — conformance and fail-closed tests;
- `examples/live.run.json` — live progress;
- `examples/stalled.run.json` — suspected stall;
- `examples/timed-out.run.json` — irreversible timeout closure;
- `examples/continuation.capsule.json` — valid successor continuation;
- `examples/late-result.json` — stale closed-run result requesting reply and effect.

## RunLease

A run observation contains a fixed first-slice lease:

```json
{
  "starts_at": "2026-08-27T10:00:00Z",
  "stall_after_seconds": 60,
  "expires_at": "2026-08-27T10:10:00Z"
}
```

The validator requires:

- `expires_at > starts_at`;
- `stall_after_seconds > 0` and shorter than the total lease;
- `last_progress_at >= starts_at`;
- `last_progress_at < expires_at`;
- `last_progress_at <= evaluated_at`.

The strict `last_progress_at < expires_at` rule matters: a backend event arriving
after terminal expiry cannot be relabeled as fresh progress to resurrect the old run.
It must instead pass through late-result handling.

## ProgressReceipt

The accepted first-slice progress kinds are deliberately finite:

```text
INTENT_ACK
CHECKPOINT_COMMIT
TOOL_OBSERVATION
DEPENDENCY_WAIT
SUBRESULT_COMMIT
```

`SPINNER` is intentionally absent. UI animation is not progress evidence.

A `RunLivenessReceipt` exposes, among other fields:

- `run_id` and `run_epoch`;
- `state`;
- `current_phase`;
- `last_progress_at` and `last_progress_age_seconds`;
- `progress_kind`;
- `waiting_on`;
- `next_observable_event`;
- `checkpoint_ref`;
- `lease_expires_at`;
- `external_effect_authority`;
- `terminal`;
- `continuation_available`;
- `next_safe_action`;
- deterministic `fingerprint_sha256`.

The receipt is evidence of observable run state, not evidence of the hidden content
of reasoning.

## Deterministic liveness derivation

For a validated observation at `evaluated_at`:

```text
if evaluated_at >= lease.expires_at:
    TIMED_OUT_CLOSED
else if age(last_progress_at) >= stall_after_seconds:
    SUSPECTED_STALL
else:
    RUNNING
```

Therefore live work and suspected stall are no longer observationally identical.

### RUNNING

The last confirmed progress remains younger than the stall threshold. The next safe
action is `WAIT_FOR_NEXT_RECEIPT`.

### SUSPECTED_STALL

The lease is still alive but confirmed progress is stale. The next safe action is
`WAIT_OR_INTERRUPT`. This state is not terminal.

### TIMED_OUT_CLOSED

The lease has expired. Closure is terminal and fail-closed:

```text
external_effect_authority = false
terminal = true
predecessor_resumable = false
continuation_available = true
next_safe_action = CREATE_SUCCESSOR_RUN
```

No input authority bit can survive terminal closure.

## ContinuationCapsule

FCL does not resume a terminally closed run. A continuation capsule names both the
closed predecessor and a different successor:

```text
predecessor.run_id != successor.run_id
predecessor.run_epoch < successor.run_epoch
predecessor.terminal_state = TIMED_OUT_CLOSED
```

The capsule may transfer only externally representable continuation state:

- the original `intent_ref`;
- last committed checkpoint reference;
- completed observation/result references;
- unresolved work;
- human constraints;
- explicit non-effects;
- predecessor terminal provenance and exact terminal receipt fingerprint.

The resulting `ContinuationReceipt` always states:

```text
terminal_receipt_fingerprint = <predecessor RunLivenessReceipt fingerprint>
predecessor_resurrection_admitted = false
predecessor_authority_reacquired = false
successor_requires_fresh_authority = true
transferable_hidden_reasoning = false
```

This preserves continuity of work without preserving the authority or execution
identity of the dead run.

## Late-result guard

A late backend/tool result from `TIMED_OUT_CLOSED` is never allowed to become the
active run again. `assess-result` emits:

```text
status = REJECTED_CLOSED_RUN
active_reply_admitted = false
external_effect_admitted = false
authority_reacquisition_admitted = false
retained_as_diagnostic = true
```

Terminal closure rejects the late result even when `source_run_epoch == current_run_epoch`.
If `source_run_epoch < current_run_epoch`, the independent epoch guard additionally exposes
`stale_epoch = true`.

A late result may remain diagnostic evidence; it may not produce an authoritative
reply or external effect under the closed run's authority.

## Deterministic receipt identity

`RunLivenessReceipt` and `ContinuationReceipt` use:

```text
sha256(
  UTF8(
    recursively-key-sorted compact JSON of the receipt
    with fingerprint_sha256 replaced by ""
  )
)
```

Set-like continuation arrays are sorted before receipt construction, so arrival
order does not change continuation receipt identity.

## CLI

Validate an observable run:

```bash
node protocols/fcl/v0.1/fcl.js validate-run \
  protocols/fcl/v0.1/examples/live.run.json
```

Derive liveness:

```bash
node protocols/fcl/v0.1/fcl.js observe \
  protocols/fcl/v0.1/examples/stalled.run.json
```

Validate and construct successor continuation:

```bash
node protocols/fcl/v0.1/fcl.js validate-continuation \
  protocols/fcl/v0.1/examples/continuation.capsule.json
node protocols/fcl/v0.1/fcl.js continue \
  protocols/fcl/v0.1/examples/continuation.capsule.json
```

Reject a late closed-run result:

```bash
node protocols/fcl/v0.1/fcl.js assess-result \
  protocols/fcl/v0.1/examples/late-result.json
```

There is deliberately no `resume` command and no `execute` command.

## Conformance / fail-closed coverage

The first slice proves:

- a live run emits observable progress state without chain-of-thought;
- a stale-but-unexpired run becomes `SUSPECTED_STALL`;
- timeout deterministically produces `TIMED_OUT_CLOSED`;
- timeout revokes previously declared external-effect authority;
- progress timestamped at/after lease expiry is rejected rather than resurrecting;
- future progress timestamps cannot manufacture liveness;
- `SPINNER` cannot masquerade as a progress kind;
- continuation requires a new run identity and newer epoch;
- a non-terminal predecessor cannot use the terminal continuation path;
- a late closed-run result cannot reply, act, or reacquire authority even before a newer epoch exists;
- an older `current_run_epoch` is rejected as causally invalid;
- `resume` and `execute` are absent from the CLI surface;
- ordering of set-like capsule fields does not change receipt identity.

## Runtime non-effects

The FCL CLI:

- performs no network access;
- writes no file;
- spawns a child process only inside the conformance test to prove forbidden CLI
  commands fail closed; the runtime CLI itself spawns no process;
- mutates no repository or external system;
- grants no fresh authority;
- executes no successor action;
- resumes no closed run;
- reveals no chain-of-thought.

```text
RunLivenessReceipt != ActionPermit
ContinuationReceipt != ActionPermit
Successor Admissible != Successor Authorized
Diagnostic Retention != Active Reply Authority
```

## Deliberately out of scope

This first slice does not yet implement:

- transport/UI streaming of progress receipts;
- adaptive lease negotiation;
- clock-disagreement protocols;
- distributed heartbeat consensus;
- automatic checkpoint persistence;
- cross-device continuation;
- automatic successor authority restoration;
- integration with any proprietary model runtime or ChatGPT client.

Those are later slices. FCL v0.1 first proves the safety boundary: **a hidden reasoning
process may remain private, but an expired execution context cannot remain ambiguously
alive or later resurrect itself.**
