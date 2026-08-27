# FCL Successor UI Handoff v0.1

**Status:** experimental read-only protocol slice  
**Tracking:** Issue #536  
**Origin frontier:** `784d520b5e78b57dae8b6b97b31f6161bfae5652`  
**Origin tree:** `517515bc7b2fe11c11a8719a5c9803ca47019e1a`

## Purpose

This slice closes the next last-mile gap after FCL run liveness, Progress Chain and stale-safe Projection Delivery.

A human should be able to experience the work as continuing after a timeout, while the machine-readable state proves that the old execution context remains closed and a distinct successor has taken over.

```text
Human Continuity != Execution Continuity
Intent Continuity != Run Continuity
Intent Continuity != Authority Continuity
Successor Visible != Predecessor Resumed
Continuation != Resurrection
```

## Chain

```text
terminal ProjectionDeliveryAssessmentReceipt
  + exact terminal ProgressProjectionReceipt
  + ContinuationReceipt
  + first successor ProgressProjectionReceipt
  -> SuccessorUIHandoffReceipt
```

The terminal projection is not accepted merely by identity. Its exact projection fingerprint must be the final accepted display of the predecessor delivery assessment. Its `head_fingerprint` must equal the `ContinuationReceipt.terminal_receipt_fingerprint`, binding the visible terminal UI state to the closed `RunLivenessReceipt`.

## First-slice invariants

- predecessor delivery state is terminal and continuation-ready;
- the delivered terminal projection is bound exactly by fingerprint;
- predecessor run/epoch/intent/chain identity cannot drift;
- the continuation receipt is bound to the exact terminal liveness receipt through the projection head fingerprint;
- predecessor resurrection and authority reacquisition remain false;
- successor `run_id` is different;
- successor epoch is strictly greater;
- successor chain is different;
- intent is preserved explicitly;
- the visible checkpoint is preserved through continuation into the first successor projection;
- no hidden chain-of-thought is transferred;
- successor authority must be established separately from this handoff;
- the handoff itself never admits execution or establishes authority.

```text
Checkpoint Continuity != Hidden Reasoning Transfer
Display Replacement != Causal Erasure
Handoff Receipt != ActionPermit
```

## Human-facing meaning

A UI adapter may render a bounded semantic equivalent of:

```text
Previous run closed
  -> continuing from checkpoint
  -> successor run active
```

but it must not render that transition as proof that the predecessor resumed.

The receipt therefore keeps both facts visible:

```text
predecessor_terminal_visible = true
successor_primary_display = true
```

These are display semantics, not authority.

## First successor restriction

The first slice requires:

```text
successor.head_sequence = 0
successor.chain_length = 1
successor.terminal = false
```

This proves the handoff boundary before later work allows attaching a UI after a successor has already accumulated progress.

## Files

- `successor-ui-handoff.schema.json` — closed handoff input contract;
- `successor-ui-handoff-receipt.schema.json` — closed deterministic handoff receipt;
- `handoff.js` — read-only semantic validator and assessor;
- `test-handoff.js` — conformance and fail-closed tests;
- `examples/successor.handoff.json` — synthetic terminal-predecessor to fresh-successor handoff.

## CLI

```bash
node protocols/fcl/v0.1/handoff/handoff.js validate \
  protocols/fcl/v0.1/handoff/examples/successor.handoff.json

node protocols/fcl/v0.1/handoff/handoff.js assess \
  protocols/fcl/v0.1/handoff/examples/successor.handoff.json
```

Only `validate`, `assess` and `help` exist.

There is deliberately no `resume`, `execute`, `send`, `switch`, or `activate` command.

## Non-effects

This layer:

- creates no successor run;
- invokes no model or provider;
- changes no production UI;
- sends no transport message;
- grants no authority;
- transfers no authority;
- transfers no hidden reasoning;
- creates no ActionPermit;
- admits no execution;
- cannot reopen a closed predecessor.

```text
SuccessorUIHandoffReceipt != ActionPermit
Human Continuity != Authority Continuity
```

## Deferred scope

Later slices may address actual UI adapter behavior, successor projections whose chain already contains more than one event, cross-device continuation, transport authentication, and runtime integration. Those additions must preserve the irreversible predecessor closure and fresh-authority boundary.
