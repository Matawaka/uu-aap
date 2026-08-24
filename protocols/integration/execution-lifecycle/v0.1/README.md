# UU-AAP Bounded Execution Lifecycle v0.1

**Status:** experimental reusable integration profile  
**Issue:** #349  
**Stable Core:** `protocols/core/v0.1`  
**First empirical source:** AI Gateway live-executor acceptance #332 / #339

## Purpose

This profile extracts the externally consequential execution cycle from a one-off experiment into a provider- and actuator-neutral protocol surface.

The lifecycle is:

```text
prepare -> authorize -> execute -> observe -> close
```

These are evidence phases, not implied transitions. A later phase MUST NOT retroactively manufacture evidence required by an earlier phase.

```text
prepare != authorize
authorize != execute
execute != observe
observe != causality proof
close != future authorization
```

## Phase interfaces

### 1. `prepare`

Binds the exact predecessor frontier, subject, target and the Core evidence required to understand the candidate action:

- `StateReceipt`;
- `IntentReceipt`;
- `AuthorityReceipt` or `ResponsibilityReceipt`;
- `CoordinationReceipt`;
- exact target binding hash.

Mandatory non-effects:

- no `ActionPermit` created by preparation;
- no action performed;
- no authority expansion.

### 2. `authorize`

Binds an already-existing Core `ActionPermit` to the exact prepared target and predecessor frontier.

If the action requires human approval, an action-specific approval reference is mandatory.

An optional admission adapter assessment may be recorded, but it is evidence only:

```text
adapter admission != Core ActionPermit
adapter availability != authority
```

The adapter MUST NOT create the permit. For one-shot execution the permit is unconsumed at this phase and has an explicit expiry.

### 3. `execute`

This is the only phase in the completed lifecycle allowed to assert that an external actuator invocation was emitted.

The exact prepared/authorized target binding and `ActionPermit` MUST match. A fail-closed target guard is required.

The Core `ActionReceipt` remains on the predecessor / permit frontier:

```text
ActionReceipt frontier = ActionPermit frontier = predecessor frontier
```

Execution consumes the one-shot permit. It does not by itself assert that the expected outcome was observed.

### 4. `observe`

Observation binds actuator evidence to a post-action frontier and references:

- `OutcomeReceipt`;
- `SuccessorStateReceipt`.

The outcome and successor receipts use the observed successor frontier.

```text
OutcomeReceipt frontier = observed successor frontier
SuccessorStateReceipt frontier = observed successor frontier
```

Observation is not execution and does not prove causality, factual truth, legality or liability.

### 5. `close`

Closure exhausts the bounded target scope after the one-shot permit has been consumed and the successor state has been observed.

Closure MUST NOT create generalized authority or permission for a successor action.

## Exact-target binding

`target.binding_hash` is the SHA-256 of the canonical target object excluding `binding_hash`.

The same hash is repeated in the preparation, authorization and execution phases. Any resource, operation, predecessor frontier or authority-scope substitution therefore fails validation.

## Time ordering

For a completed lifecycle:

```text
prepared_at
  <= action_permit_issued_at
  <= authorized_at
  < executed_at
  <= observed_at
  <= closed_at
```

If an admission assessment exists, the Core `ActionPermit` must pre-exist it.

Execution after `expires_at` is invalid.

## Provider / actuator neutrality

The profile does not require GitHub, OpenAI, ChatGPT, KONTUR, MCP, AI Gateway or any other provider.

An AI Gateway decision may populate `admission_assessment_ref`, but it remains optional and cannot replace Core authorization.

An actuator adapter is required only for the execution phase and does not inherit authority beyond the exact permit.

## Non-effects

A conforming record does not establish:

- causality;
- truth;
- liability;
- generalized authority;
- future action permission.

## Conformance

`validate-execution-lifecycle.js` validates the positive fixture and rejects mutations including:

1. target substitution after preparation;
2. missing approval when approval is required;
3. adapter-created ActionPermit;
4. permit mismatch between authorization and execution;
5. execution after expiry;
6. permit consumed before execution;
7. action emitted during preparation or authorization;
8. Core `ActionReceipt` relabelled onto the successor frontier;
9. `OutcomeReceipt` or `SuccessorStateReceipt` relabelled onto the predecessor frontier;
10. observation claiming execution or causality;
11. closure granting generalized or future authority;
12. overlapping expected effects and explicit non-effects;
13. phase time reversal;
14. provider-specific mandatory dependency.

CI is read-only and never invokes an actuator.
