# FCL Execution Invocation Envelope Source Parameterization v0.1

This profile implements the successor from merged Execute Revalidation source parameterization:

```text
PARAMETERIZE_EXECUTION_INVOCATION_ENVELOPE_FCL_SOURCE
```

It consumes the exact FCL-ready revalidation chain and materializes the existing provider-neutral `ExecutionInvocationEnvelope` without emitting an actuator invocation.

## Canonical boundary

```text
ready ExecuteRevalidationDecision
+ exact FCL revalidation receipt
-> ExecutionInvocationEnvelope
!= actuator invocation
!= envelope consumption
!= ActionPermit consumption
!= ActionReceipt
```

The generic envelope remains one-shot, unconsumed and `transport_only`. Target and predecessor guards remain fail-closed.

## Historical reuse

The historical `execution-invocation-envelope/v0.1` validator, fixture and schema remain unchanged. An adjacent import-safe parameterized validator replaces only the hard-coded demo Execute Revalidation source with an explicit source argument and preserves the same 31 historical negative mutation classes.

```text
Source Parameterization != Semantic Relaxation
Explicit Revalidation Source != New Authority
Envelope Materialization != Invocation Emission
```

## FCL strengthening

The FCL binding additionally requires:

- exact reproduction of the merged FCL Execute Revalidation input, generic decision and FCL receipt;
- `created_at >= ExecuteRevalidationDecision.evaluated_at`;
- envelope creation before the exact revalidation horizon;
- exact envelope expiry equal to `execute_revalidation_must_occur_by`;
- exact Availability, Approval, ActionPermit, target and frontier bindings;
- transport-only adapter role;
- one-shot envelope unconsumed before any external emission.

## Non-effects

The binding receipt fixes false:

- actuator invocation emitted;
- envelope consumed;
- ActionPermit consumed;
- ActionReceipt created;
- action performed;
- outcome observed;
- runtime state transitioned;
- future action permission created;
- authority expanded.

## Successor

The existing `Invocation↔ActionReceipt Binding v0.1` applies only after real emitted invocation evidence and requires both envelope and permit consumption plus Core `ActionReceipt.action_performed=true`. This profile does not synthesize any of those post-execution facts.

The only development successor is:

```text
PARAMETERIZE_INVOCATION_ACTION_RECEIPT_FCL_SOURCE
```

That successor prepares the downstream validator seam. It is not permission to invoke an actuator.

## CI liveness

Conformance performs one canonical validation of the exact merged FCL revalidation source and then reuses an opaque, in-process validated context for local envelope mutations. The cached context is not serializable trust evidence and normal public production validation remains full fail-closed.

```text
Validated Source Reuse != Validation Bypass
Reduced Replay != Reduced Evidence
```
