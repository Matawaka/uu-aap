# UU-AAP Just-in-Time Execute Revalidation Gate v0.1

**Status:** experimental reusable pre-execute profile  
**Issue:** #365  
**Stable Core:** `protocols/core/v0.1`  
**Authorize Admission:** `protocols/integration/pre-action-authorize-admission/v0.1`  
**Bounded Execution Lifecycle:** `protocols/integration/execution-lifecycle/v0.1`

## Purpose

This profile closes the time-of-check/time-of-use gap between an `authorize` decision and the later `execute` boundary.

```text
authorize admitted at T1
  -> time passes
  -> execute revalidation at T2
  -> ready | denied
  -> lifecycle execute may be considered
  != actuator invocation
```

A positive decision proves only that the exact already-authorized action is still admissible for entry into the `execute` phase at the recorded revalidation instant.

## Why this gate exists

The preceding authorize-admission profile re-checks freshness when the lifecycle enters `authorize`. That is intentionally not a permanent grant.

```text
authorize admitted at T1 != execute ready forever
fresh availability at T1 != fresh availability at T2
unconsumed permit at T1 != unconsumed permit at T2
unchanged frontier at T1 != unchanged frontier forever
```

The execute boundary therefore re-checks the same bounded evidence immediately before any actuator invocation.

## Exact binding

A `ready` decision binds exactly:

- the merged `PreActionAuthorizeAdmissionAssessment` ID and content hash;
- decision `admissible`;
- subject ID and scope;
- selected capability and operation;
- authority scope;
- target binding hash;
- expected predecessor frontier;
- availability binding hash and `valid_until`;
- action-specific approval hash and `valid_until`;
- Core `ActionPermit` hash, expiry, one-shot state and `consumed = false`;
- the inherited `authorization_must_occur_by` horizon;
- lifecycle transition `authorize -> execute`.

Any substitution fails closed.

## Freshness

`execute_revalidation_must_occur_by` is not a refreshed lease. It MUST equal the earliest inherited validity horizon relevant to execution and MUST NOT extend availability, approval, ActionPermit or pre-action authorization lifetime.

For `ready`:

```text
evaluated_at <= availability_valid_until
evaluated_at <= approval_valid_until
evaluated_at <= permit_expires_at
evaluated_at <= authorization_must_occur_by
evaluated_at <= execute_revalidation_must_occur_by
```

## Permit semantics

The Core `ActionPermit` must pre-exist this decision, remain one-shot and remain unconsumed.

```text
execute revalidation != ActionPermit creation
execute revalidation != permit consumption
ready != action performed
```

Permit consumption belongs to the actual execution boundary, not to this evidence gate.

## No actuator invocation

This profile never calls an actuator. A conforming decision MUST state:

```text
actuator_invocation_emitted = false
action_performed = false
outcome_observed = false
```

A later invocation profile may consume this decision as evidence, but cannot treat it as proof that any external effect occurred.

## Provider neutrality

No GitHub, OpenAI, ChatGPT, KONTUR, MCP, AI Gateway or other provider is mandatory. The gate is an evidence profile over typed bindings.

## Non-effects

A conforming decision does not create intent, authority, approval or ActionPermit; consume a permit; emit an actuator invocation; perform an action; observe an outcome; extend evidence lifetime; create future/general authority; prove causality; certify truth; or establish liability.

## Conformance

`validate-execute-revalidation.js` validates the positive fixture against the merged authorize-admission fixture and rejects stale time, horizon extension, admission/subject/capability/operation/authority/target/frontier/availability/approval/permit substitution, consumed/reusable permit state, wrong lifecycle transition, direct actuator/action claims, future authority escalation and content-hash mismatch.

CI is read-only and never invokes an actuator.
