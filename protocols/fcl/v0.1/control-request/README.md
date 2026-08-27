# FCL User Control Request v0.1

`FCL User Control Request v0.1` is the sixth bounded slice of **Feedback Continuity & Perceived Causal Liveness (FCL)**.

It converts a request-only control offered by the merged Runtime UI Adapter into an explicit human request receipt while preserving the boundary between a human request and any operational effect.

## Position in the stack

```text
RunObservation
  -> RunLivenessReceipt
  -> ProgressChain
  -> ProgressProjectionReceipt
  -> ProjectionDeliveryTrace / DeliveryAssessment
  -> ContinuationReceipt
  -> SuccessorUIHandoffReceipt
  -> RuntimeUIViewModelReceipt
  -> UserControlRequestReceipt
  -> later Authority / Action Gate
```

This layer consumes **only** a valid `RuntimeUIViewModelReceipt`. It does not accept spinner state, heartbeat, reconnect, transport ACK, provider metadata, hover, focus, or passive visibility as proof of a human request.

## Canonical distinctions

```text
Control Offer != Human Request
Human Request != Effect
Human Request != ActionPermit
Request Interrupt != Run Interrupted
Request Successor != ContinuationReceipt
Request Successor != Successor Run
UI Event != Authority
Request Receipt != Runtime State Transition
```

A valid control activation is evidence that an **expressed request event** occurred. It is deliberately not proof of the user's internal mental state or proof that the request was non-induced:

```text
expressed_request_recorded = true
internal_intent_proven = false
non_induced_intent_proven = false
```

This preserves the wider UU-AAP distinction between observable expression and inferred internal intent.

## Supported request-only controls

The first slice supports exactly:

```text
REQUEST_INTERRUPT
REQUEST_SUCCESSOR
```

`NONE` cannot be invoked.

The requested control must exactly equal `RuntimeUIViewModelReceipt.offered_control`.

### Interrupt request

Admissible only from:

```text
display_state = STALL_SUSPECTED
offered_control = REQUEST_INTERRUPT
source_next_safe_action = WAIT_OR_INTERRUPT
```

The receipt emits:

```text
next_safe_action = EVALUATE_INTERRUPT_REQUEST
interrupt_completed = false
runtime_state_transitioned = false
```

### Successor request

Admissible only from:

```text
display_state = CONTINUATION_AVAILABLE
offered_control = REQUEST_SUCCESSOR
source_next_safe_action = CREATE_SUCCESSOR_RUN
terminal_run_visible = true
```

The receipt emits:

```text
next_safe_action = EVALUATE_SUCCESSOR_REQUEST
continuation_receipt_created = false
successor_run_created = false
```

## Human event boundary

Accepted explicit activation classes:

```text
POINTER_ACTIVATION
KEYBOARD_ACTIVATION
VOICE_ACTIVATION
ACCESSIBILITY_ACTIVATION
```

Rejected as request evidence:

```text
HOVER
FOCUS
SPINNER
TRANSPORT_HEARTBEAT
RECONNECT
PROVIDER_ACK
passive observation
```

Thus:

```text
Exposure != Activation
Focus != Request
Hover != Request
Visible Button != Intent
```

## Causal binding

Every input binds the exact source view twice:

1. `source_view_fingerprint` must equal the embedded `source_view.fingerprint_sha256`;
2. `display_binding` must exactly repeat the displayed run, epoch, chain, intent and display state.

This redundancy is intentional. The output preserves the same identity so a later gate can compare the request against the **current** state and reject stale requests.

```text
request_requires_current_state_revalidation = true
request_requires_downstream_gate = true
```

## Fixed non-effects

Every valid `UserControlRequestReceipt` fixes:

```text
interrupt_completed = false
continuation_receipt_created = false
successor_run_created = false
runtime_state_transitioned = false
progress_created = false
liveness_proven = false
action_permit_established = false
execution_admitted = false
authority_established = false
hidden_reasoning_included = false
```

No request receipt can itself interrupt a run or create a successor.

## Files

```text
control-request.js
user-control-request-input.schema.json
user-control-request-receipt.schema.json
examples/interrupt.request.json
examples/successor.request.json
test-control-request.js
```

## Read-only CLI

```bash
node protocols/fcl/v0.1/control-request/control-request.js validate \
  protocols/fcl/v0.1/control-request/examples/interrupt.request.json

node protocols/fcl/v0.1/control-request/control-request.js receipt \
  protocols/fcl/v0.1/control-request/examples/successor.request.json
```

Accepted commands:

```text
validate
receipt
help
```

There is deliberately no:

```text
interrupt
resume
execute
send
switch
activate
create-successor
grant
```

## Conformance direction

The first implementation verifies at least:

- valid interrupt request receipt;
- valid successor request receipt;
- exact Runtime UI source fingerprint;
- request-only source semantics;
- requested control equals the offered control;
- `NONE` cannot be invoked;
- state-specific interrupt/successor admissibility;
- immutable displayed identity binding;
- passive/non-human/transport/UI-animation events cannot create a request;
- temporal causality from render -> human event -> request;
- all operational effects fixed false;
- output rejects authority/effect claims;
- deterministic output fingerprint;
- actuating CLI commands rejected.

## Non-effects

This module is provider-neutral and read-only. It does not perform production UI mutation, interrupt execution, successor creation, ContinuationReceipt creation, timeout enforcement, provider/model invocation, transport send, ActionPermit creation, authority grant/transfer, external effects, KONTUR activation, release, tag, or merge.
