# FCL Runtime UI Adapter v0.1

This directory defines the first provider-neutral render boundary for **Feedback Continuity & Perceived Causal Liveness (FCL)**.

```text
RunObservation
  -> RunLivenessReceipt
  -> ProgressChain
  -> ProgressProjectionReceipt
  -> ProjectionDeliveryAssessmentReceipt
  -> SuccessorUIHandoffReceipt
  -> RuntimeUIViewModelReceipt
  -> later concrete client renderer
```

The adapter is deliberately a **pure evidence-to-view transform**. It is not a model runtime, transport client, heartbeat generator, timeout controller, successor creator, or action executor.

## Core distinction

```text
Render State != Runtime Truth Source
UI Animation != Progress Evidence
Visible Control != ActionPermit
Connected Transport != Live Run
Displayed Continuity != Execution-Context Continuity
```

The adapter may display already-proven FCL state. Rendering itself cannot create or prove liveness.

## Inputs

`RuntimeUIAdapterInput` accepts exactly one already-proven source:

```text
DELIVERY_ASSESSMENT
SUCCESSOR_HANDOFF
```

`DELIVERY_ASSESSMENT` binds the exact accepted run / epoch / chain / intent from `ProjectionDeliveryAssessmentReceipt`.

`SUCCESSOR_HANDOFF` binds the exact `SuccessorUIHandoffReceipt`, makes the successor primary, and keeps the predecessor terminal state explicitly visible.

The following are never valid liveness sources:

```text
SPINNER
TRANSPORT_HEARTBEAT
TRANSPORT_ACK
RECONNECT
provider metadata
```

## Display states

The first slice emits only:

```text
ACTIVE
WAITING
STALL_SUSPECTED
CONTINUATION_AVAILABLE
CONTINUED_ON_SUCCESSOR
```

Free-form UI text, localization, icons, color, animation and layout remain downstream.

## Request-only controls

The view model may expose:

```text
NONE
REQUEST_INTERRUPT
REQUEST_SUCCESSOR
```

Every control fixes:

```text
control_semantics = REQUEST_ONLY
control_executes_action = false
action_permit_established = false
```

A visible control expresses a new human intent; it is not execution authority.

Current mapping:

```text
ACTIVE / WAITING          -> NONE
STALL_SUSPECTED           -> REQUEST_INTERRUPT
CONTINUATION_AVAILABLE    -> REQUEST_SUCCESSOR
CONTINUED_ON_SUCCESSOR    -> NONE
```

## Source binding

Every `RuntimeUIViewModelReceipt` binds the exact source receipt fingerprint and the displayed run, epoch, chain and intent identity.

For delivery state:

```text
continuity_mode = SAME_RUN
```

For handoff:

```text
continuity_mode = SUCCESSOR_OF_CLOSED_RUN
predecessor terminal remains visible
successor becomes primary display
predecessor_run_id != successor_run_id
```

## Last confirmed progress

Delivery-based rendering preserves `last_confirmed_progress_at` and computes:

```text
last_confirmed_progress_age_seconds = floor(rendered_at - last_confirmed_progress_at)
```

A handoff receipt does not itself prove a new work-progress timestamp, so the first handoff render uses `null` for progress time/age/phase. The client must wait for successor progress evidence rather than inventing progress from the handoff event.

```text
Handoff != Work Advancement
Display Update != Progress
```

## Fixed non-effects

Every output fixes:

```text
source_evidence_verified = true
rendering_creates_progress = false
rendering_itself_proves_liveness = false
spinner_is_progress_evidence = false
transport_is_liveness_evidence = false
control_executes_action = false
action_permit_established = false
execution_admitted = false
authority_established = false
private_reasoning_included = false
```

## CLI

```bash
node runtime-ui.js validate examples/waiting.input.json
node runtime-ui.js render examples/waiting.input.json
node runtime-ui.js render examples/terminal.input.json
node runtime-ui.js render examples/handoff.input.json
```

Accepted commands are only `validate`, `render`, and `help`.

There is no `send`, `execute`, `resume`, `interrupt`, `switch`, `activate`, or `create-successor` command.

## Conformance

`test-runtime-ui.js` provides 16 grouped surfaces covering:

1. WAITING rendering;
2. terminal request-only successor control;
3. distinct-successor handoff rendering;
4. delivery fingerprint fail-closed;
5. handoff fingerprint fail-closed;
6. closed source type/slot semantics;
7. terminal cannot masquerade as active;
8. non-terminal cannot masquerade as continuation-ready;
9. no resurrection, run reuse, authority transfer or hidden-reasoning transfer;
10. render timestamp causality;
11. spinner/transport/control authority constraints;
12. stall -> request-only interrupt mapping;
13. fixed output non-effects;
14. output rejects authority/executing-control claims;
15. displayed identity equals source identity;
16. deterministic rendering and no actuating CLI.

## Deliberately out of scope

This slice does not mutate a production UI, open a transport, invoke a model/provider, generate heartbeats, enforce timeout, execute interruption, create a successor, create an ActionPermit, restore/transfer authority, persist cross-device state, or activate KONTUR.

A later concrete renderer may consume `RuntimeUIViewModelReceipt`, but must remain causally downstream of this evidence boundary.
