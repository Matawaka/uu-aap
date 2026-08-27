# FCL Projection Delivery v0.1 — stale-safe UI/transport delivery

**Status:** experimental bounded protocol slice  
**Tracking:** Issue #534  
**Predecessor:** FCL Progress Chain v0.1 / PR #533  
**Origin frontier:** `a4122a8c6ab023fb39f299c60d86f69b65116761`  
**Origin tree:** `576e60490b03eb371650e0eeadd5e876eba8a3ad`

## Purpose

FCL Projection Delivery v0.1 defines the first provider-neutral delivery boundary between a validated `ProgressProjectionReceipt` and a human-facing UI/transport session.

The predecessor layers already prove:

```text
RunObservation
  -> RunLivenessReceipt
  -> ProgressChain
  -> ProgressProjectionReceipt
```

This slice adds:

```text
ProgressProjectionReceipt
  -> ProjectionDeliveryTrace
  -> ProjectionDeliveryAssessmentReceipt
  -> later real UI adapter
```

It does **not** create progress, make a provider connection authoritative, resume a run, or send anything to a production UI.

```text
Valid Projection != Safe Delivery
Delivery Success != Progress
Reconnect != New Run
Heartbeat != Work Advancement
Transport ACK != Liveness Proof
```

## Why a separate delivery layer is required

A correct progress chain can still be presented incorrectly if the delivery layer:

- displays an older projection after a newer one has already been accepted;
- counts an exact duplicate/replay as new progress;
- treats reconnect as evidence that model work advanced;
- interprets a transport heartbeat as a liveness receipt;
- accepts two different projections for the same head sequence;
- silently switches run, epoch, intent or chain identity in one UI session;
- restores authority after reconnect;
- shows a non-terminal projection after a terminal projection was accepted.

Those are delivery failures, not reasoning failures.

## Canonical invariants

```text
Projection Delivery != Progress Creation
Duplicate Delivery != New Progress
Reconnect != Authority Restoration
Transport Availability != Model/Run Liveness
Stale Projection Cannot Replace Newer Display State
Same Head Sequence + Different Projection Fingerprint = Fail Closed
Terminal Projection Is Monotonic Within One Delivery Session
Delivery Session Cannot Drift Run, Epoch, Intent, or Chain Identity
UI Display State != Execution Authority
Transport Metadata != Chain-of-Thought
Transport Metadata != Progress Evidence
```

The core FCL principle remains:

> Reasoning may be private. Progress must be observable.

This slice adds:

> Observable delivery must not manufacture progress that the causal receipt chain never proved.

## Files

- `projection-delivery-trace.schema.json` — closed structural contract for observed delivery events;
- `projection-delivery-assessment-receipt.schema.json` — closed output receipt contract;
- `delivery.js` — read-only validator and deterministic assessor;
- `test-delivery.js` — conformance and fail-closed tests;
- `examples/live.trace.json` — updates with heartbeat, ACK, reconnect, replay and stale delivery;
- `examples/terminal.trace.json` — terminal delivery followed by transport-only events and exact replay.

## ProjectionDeliveryTrace

A trace describes observations in one human-facing delivery session. Each event contains:

- `delivery_sequence`;
- `event_kind`;
- `connection_generation`;
- `received_at`;
- opaque `transport_event_ref`;
- optional `display_predecessor_projection_fingerprint`;
- `transport_progress_claim = false`;
- either one exact projection or `null`.

The first slice recognizes only:

```text
PROJECTION_DELIVERY
TRANSPORT_HEARTBEAT
TRANSPORT_ACK
RECONNECT
```

Only `PROJECTION_DELIVERY` may carry a `ProgressProjectionReceipt`. Heartbeat, ACK and reconnect are transport observations only.

## Connection generation

`connection_generation` models reconnect history without equating transport continuity with run continuity. The session begins at generation `0`; a generation may increase only through an explicit `RECONNECT`, and only by exactly one.

```text
connection generation change != run_epoch change
connection generation change != successor run
connection generation change != authority restoration
```

A projection delivered after reconnect must retain the same `chain_id`, `run_id`, `run_epoch`, and `intent_ref`.

Switching to a successor run is deliberately deferred to a later handoff protocol.

## Projection integrity

Every embedded projection is revalidated independently. The validator requires:

- exact `ProgressProjectionReceipt` field set;
- `chain_length = head_sequence + 1`;
- valid canonical `fingerprint_sha256`;
- consistent terminal/continuation semantics;
- `execution_admitted = false`;
- `authority_established = false`;
- `transport_delivery_proves_progress = false`;
- `private_reasoning_included = false`.

```text
Invalid Projection + Successful Delivery != Valid UI State
```

## Display predecessor binding

A newly accepted projection after the first accepted projection must bind the currently displayed projection:

```text
display_predecessor_projection_fingerprint
  == accepted_projection_fingerprint
```

The first accepted projection uses `null` as display predecessor. An exact replay must preserve the same predecessor binding it had originally; replay cannot rewrite display ancestry.

## Delivery dispositions

The deterministic assessor classifies every event.

### `ACCEPTED_NEWER_PROJECTION`

A projection is accepted when it is the first accepted projection, or when it has a greater `head_sequence`, preserves identity, binds the current accepted display predecessor, increases chain length, does not regress projection/progress time, and does not supersede terminal closure.

This advances display state but does not create progress:

```text
display_state_advanced = true
new_progress_created_by_delivery = false
```

### `IDEMPOTENT_REPLAY`

An exact replay has the same head sequence, projection fingerprint and predecessor binding. It is safe to observe again but does not advance display state and does not count as progress.

### `DROPPED_STALE_PROJECTION`

A valid projection with lower `head_sequence` than the accepted projection is stale. It may remain in the trace as transport evidence, but it cannot replace the displayed state.

```text
stale_projection_can_replace_display = false
```

### `TRANSPORT_ONLY`

Heartbeat, ACK and reconnect events are retained as transport observations only. They do not change accepted projection, human status, last confirmed progress, run authority, or execution state.

## Equivocation / same-head fork

If two different projection fingerprints claim the same `head_sequence` in one delivery session, the assessor fails closed:

```text
same head sequence + different projection fingerprint
  != replay
  != stale message
  == conflicting projection evidence
```

This layer does not select a winner automatically.

## Terminal monotonicity

After a terminal projection is accepted:

- heartbeat remains transport-only;
- ACK remains transport-only;
- reconnect remains transport-only;
- exact replay of the terminal projection is idempotent;
- a newer projection for the same run/epoch/intent cannot supersede terminal closure;
- an older out-of-order projection remains stale and cannot replace display state.

This preserves:

```text
Terminal State != Paused State
Closed Run Cannot Reacquire Authority
```

## ProjectionDeliveryAssessmentReceipt

The output receipt records accepted chain/run/epoch/intent identity, accepted projection fingerprint/head sequence, human-facing status, last confirmed progress, current phase/wait, next observable event, next safe action, and one disposition per delivery event.

The following are fixed:

```text
delivery_creates_progress = false
duplicate_delivery_counts_as_progress = false
reconnect_restores_authority = false
stale_projection_can_replace_display = false
transport_events_prove_liveness = false
execution_admitted = false
authority_established = false
private_reasoning_included = false
```

The receipt is delivery provenance, not an `ActionPermit`.

## Examples

`examples/live.trace.json` demonstrates:

1. initial `ACTIVE` projection accepted;
2. heartbeat is transport-only;
3. ACK is transport-only;
4. newer `WAITING` projection accepted;
5. reconnect increments connection generation;
6. exact replay is idempotent;
7. delayed older projection is dropped as stale.

The final display remains the waiting projection.

`examples/terminal.trace.json` demonstrates:

1. active projection;
2. waiting projection;
3. terminal `CONTINUATION_AVAILABLE` projection;
4. heartbeat after closure;
5. reconnect after closure;
6. exact terminal replay.

Neither heartbeat nor reconnect changes terminal state or restores authority.

## CLI

Validate:

```bash
node protocols/fcl/v0.1/delivery/delivery.js validate \
  protocols/fcl/v0.1/delivery/examples/live.trace.json
```

Assess:

```bash
node protocols/fcl/v0.1/delivery/delivery.js assess \
  protocols/fcl/v0.1/delivery/examples/terminal.trace.json
```

The only commands are:

```text
validate
assess
help
```

There is deliberately no `send`, `execute`, `resume`, or `interrupt` command.

## Conformance coverage

The first slice proves:

- correct final display selection;
- heartbeat/ACK/reconnect are transport-only;
- duplicate delivery is idempotent;
- stale delivery cannot replace accepted display state;
- projection fingerprint and fixed non-effects are enforced;
- run/epoch/intent/chain identity drift is rejected;
- newer projection requires explicit display predecessor binding;
- same-head equivocation fails closed;
- terminal projection is monotonic and exact terminal replay is safe;
- transport-only events cannot carry projections or claim progress;
- connection generation cannot change without reconnect;
- delivery timestamps cannot regress;
- replay predecessor binding cannot be rewritten;
- CLI exposes no actuating command.

## Layering

```text
Intent
  -> RunLease
  -> RunObservation
  -> RunLivenessReceipt
  -> ProgressChain
  -> ProgressProjectionReceipt
  -> ProjectionDeliveryTrace
  -> ProjectionDeliveryAssessmentReceipt
  -> later real UI adapter
```

Each layer answers a different question:

- `RunLivenessReceipt`: is the run observably running, stalled or terminal?
- `ProgressChain`: do multiple receipts form one valid causal history?
- `ProgressProjectionReceipt`: what bounded human-facing state follows from that history?
- `ProjectionDeliveryAssessmentReceipt`: which projection may the UI safely keep displayed despite transport disorder?

## Deliberately out of scope

This slice does not implement websocket/SSE/polling transport, background heartbeat generation, actual UI rendering, transport authentication, automatic interrupt, live timeout enforcement, lease renegotiation, automatic successor creation, successor-run UI handoff, cross-device continuation, distributed transport consensus, or ActionPermit/external-effect authority.

## Runtime non-effects

The CLI performs no network access, sends no message, renders no production UI, changes no external system, creates no successor run, grants no authority, executes no interrupt, and creates no ActionPermit.

```text
Validation Success != Send Authority
Delivery Assessment != Progress Creation
Displayed Projection != Execution Permit
Reconnect != Authority Reacquisition
```
