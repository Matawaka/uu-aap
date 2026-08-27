# FCL → UU-AAP Core AuthorityReceipt Binding v0.1

**Status:** experimental bounded adapter  
**Issue:** #546  
**Predecessor:** FCL Authority Evaluation v0.1 (#545)  
**Core:** `protocols/core/v0.1`

## Purpose

This profile is the first FCL layer that materializes a canonical UU-AAP Core receipt. It binds already-established, request-scoped FCL authority evidence to an already-existing Core `IntentReceipt` and emits a Core `AuthorityReceipt`.

```text
FCLAuthorityEvaluationReceipt(positive)
+ Core IntentReceipt(pre-existing)
-> deterministic binding
-> Core AuthorityReceipt
!= AuthorityGrant
!= ActionPermit
!= execution
```

The adapter does not create authority. It creates evidence that pre-existing authority has been bound to one pre-existing intent at one Core frontier.

## Boundary

```text
Core AuthorityReceipt creation != Authority creation
Core AuthorityReceipt != AuthorityGrant
Core AuthorityReceipt != ActionPermit
AuthorityReceipt bound != action permitted
AuthorityReceipt bound != action performed
```

The output uses the existing Core `AuthorityReceipt` primitive exactly. Core v0.1 is not modified.

## Why a Core IntentReceipt is mandatory

Core requires an `IntentReceipt` predecessor for `AuthorityReceipt`. FCL `intent_ref` is currently an opaque reference, not a Core content hash. The adapter therefore cannot infer or invent a Core intent.

The input must contain a pre-existing Core `IntentReceipt`. Its free-form Core payload must explicitly include:

```json
{
  "fcl_binding": {
    "intent_ref": "...",
    "requested_control": "REQUEST_INTERRUPT",
    "run_id": "...",
    "run_epoch": 7,
    "chain_id": "...",
    "required_scope": "fcl.run.interrupt",
    "required_target": "urn:uu-aap:fcl:run:<run_id>:epoch:7"
  }
}
```

All seven fields must match the positive FCL authority evaluation exactly.

This is an adapter-profile constraint inside the already-open Core `payload`. It is not a Core schema change.

## Pre-existing means temporally pre-existing

The Core intent must exist no later than the FCL authority evaluation:

```text
Core IntentReceipt.issued_at <= FCLAuthorityEvaluationReceipt.evaluated_at
```

The binding receipt itself must be issued at or after both inputs. This prevents constructing a new intent after authority evidence exists and then back-binding it as though it were the original predecessor.

## Positive FCL authority requirements

The FCL authority input must validate under the merged #545 validator and must satisfy all of:

```text
classification = PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED
preexisting_request_scoped_authority_observed = true
forwardable_to_core_authority_adapter = true
next_safe_action = BIND_CORE_AUTHORITY_RECEIPT
```

A stale, mismatched, unestablished or tampered authority evaluation is not bindable.

## Core IntentReceipt validation scope

The adapter validates the Core intent **envelope and identity**, including:

- exact Core protocol/version/type;
- Core subject and frontier structure;
- content hash under the Core v0.1 identity rule;
- `intent_declared=true`;
- required Core IntentReceipt non-effects;
- explicit `payload.fcl_binding`.

It deliberately does **not** claim to revalidate the full upstream Core chain because the predecessor `StateReceipt` is not an input to this adapter.

The output records:

```text
core_intent_envelope_validated = true
core_intent_chain_revalidated = false
```

## Output

A positive binding emits only a canonical Core v0.1 `AuthorityReceipt`:

```text
protocol = UU-AAP Core
version = 0.1
receipt_type = AuthorityReceipt
subject = exact Core IntentReceipt subject
frontier = exact Core IntentReceipt frontier
predecessor_receipt_hashes = [exact Core IntentReceipt.content_hash]
assertions.authority_bound = true
assertions.authority_scope = exact FCL required_scope
assertions.authority_target = exact FCL required_target
```

The payload preserves exact provenance to the FCL authority evaluation, PoAI authority verification, effect actor, run/epoch/chain/intent context, and Core intent hash.

## Core content identity

The output uses the existing Core v0.1 identity rule, not an FCL fingerprint rule:

```text
sha256(UTF8(canonical-json(identity-projection(receipt))))
```

`content_hash` and `signature_profile` are excluded from the identity projection. Canonical JSON follows the Core v0.1 recursively key-sorted representation.

CI recomputes the generated hash independently and validates the generated artifact against the existing Core receipt-envelope JSON Schema.

## Required non-effects

In addition to the Core-required `AuthorityReceipt` non-effects:

```text
permissions_expanded = false
action_performed = false
responsibility_accepted = false
liability_established = false
```

the profile fixes:

```text
authority_granted = false
authority_expanded = false
intent_created = false
action_permitted = false
execution_authorized = false
execution_admitted = false
interrupt_completed = false
continuation_receipt_created = false
successor_run_created = false
runtime_state_transitioned = false
legal_authority_established = false
universal_authority_established = false
legal_effect_established = false
truth_certified = false
causality_proven = false
private_reasoning_included = false
```

## Fail closed

Conformance rejects tampered or non-positive FCL authority evidence, non-Intent Core predecessors, invalid Core hashes, missing required non-effects, missing or substituted FCL intent bindings, run/epoch/chain/scope/target drift, intents created after authority evaluation, binding-time rollback, output subject/frontier/predecessor substitution, permission expansion, ActionPermit escalation, legal-authority overclaim and receipt-type escalation.

## CLI

```text
node core-authority-binding.js validate <input.json|->
node core-authority-binding.js bind <input.json|->
```

`validate` has no receipt-creation effect. `bind` deterministically emits a Core `AuthorityReceipt` as JSON only.

There is no `grant`, `permit`, `interrupt`, `execute`, `resume`, `send`, `switch`, `activate` or `create-successor` command.

## Non-effects

This adapter does not modify Authority Roots or grants; create an intent; grant or expand authority; create an ActionPermit; enter execution; interrupt a run; create a continuation or successor run; mutate runtime/UI state; invoke a model/provider; send transport; establish legal/universal authority; certify truth or causality; determine responsibility or liability; or expose private reasoning.
