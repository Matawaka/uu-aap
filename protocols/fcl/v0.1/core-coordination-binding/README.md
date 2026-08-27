# FCL → UU-AAP Core CoordinationReceipt Binding v0.1

**Status:** experimental bounded adapter  
**Tracking:** Issue #548  
**Predecessor:** merged PR #547  
**Core:** `protocols/core/v0.1`

## Purpose

This profile closes the Core prerequisite chain up to `CoordinationReceipt` for an FCL control request without entering the Action Gate.

```text
Core StateReceipt
  -> Core AvailabilityClaim
  -> Core IntentReceipt
  -> Core AuthorityReceipt
  -> Core CoordinationReceipt
  != ActionPermit
```

More exactly, Core has two predecessor branches that meet at coordination:

```text
StateReceipt -> AvailabilityClaim
StateReceipt -> IntentReceipt -> AuthorityReceipt
AvailabilityClaim + IntentReceipt + AuthorityReceipt -> CoordinationReceipt
```

The adapter consumes these already-existing receipts, validates their exact Core hashes, subject/frontier continuity and FCL context binding, then emits only a canonical Core `CoordinationReceipt`.

## Why this layer exists

Merged #547 created a Core `AuthorityReceipt`, but Core v0.1 does not allow authority evidence to jump directly to an `ActionPermit`. Coordination is a distinct primitive.

```text
Availability != Intent
Intent != Authority
Authority != Coordination
Coordination != ActionPermit
```

A coordination receipt therefore proves only that the required pre-action contexts have been reconciled on one predecessor frontier. It does not authorize execution.

## Required input chain

The profile accepts:

```text
positive FCLAuthorityEvaluationReceipt
Core StateReceipt
Core AvailabilityClaim
Core IntentReceipt
Core AuthorityReceipt produced under the #547 binding semantics
issued_at
```

No StateReceipt, AvailabilityClaim, IntentReceipt or AuthorityReceipt is created by this profile.

## Exact Core predecessor rules

The binder requires:

```text
StateReceipt.predecessors = []
AvailabilityClaim.predecessors = [StateReceipt.content_hash]
IntentReceipt.predecessors = [StateReceipt.content_hash]
AuthorityReceipt.predecessors = [IntentReceipt.content_hash]
```

All four Core receipts must have the same exact `subject` and `frontier.revision`. Every receipt must carry a valid Core v0.1 content hash.

The adapter also checks predecessor time monotonicity and refuses to issue a `CoordinationReceipt` before any of its prerequisites.

## FCL availability binding

The pre-existing `AvailabilityClaim` must explicitly bind the same FCL context as the positive authority evidence:

```json
{
  "fcl_binding": {
    "intent_ref": "...",
    "requested_control": "REQUEST_INTERRUPT | REQUEST_SUCCESSOR",
    "run_id": "...",
    "run_epoch": 0,
    "chain_id": "...",
    "required_scope": "fcl.run.interrupt | fcl.run.successor.create",
    "required_target": "urn:uu-aap:fcl:run:<run_id>:epoch:<epoch>"
  }
}
```

`AvailabilityClaim.assertions.capability` must equal the exact `required_scope`.

This is only an availability statement:

```text
available != intended != authorized != permitted != executed
```

## AuthorityReceipt compatibility

The supplied Core `AuthorityReceipt` is revalidated through the merged #547 `validateBoundAuthorityReceipt` semantics using:

- the same positive `FCLAuthorityEvaluationReceipt`;
- the exact Core `IntentReceipt`;
- the AuthorityReceipt's original profile origin;
- the AuthorityReceipt's original issue time.

This prevents a syntactically valid but semantically substituted Core AuthorityReceipt from entering coordination.

## Output

A positive binding emits exactly one Core v0.1 `CoordinationReceipt`:

```text
protocol = UU-AAP Core
version = 0.1
receipt_type = CoordinationReceipt
subject = exact shared subject
frontier = exact shared predecessor frontier
predecessor_receipt_hashes = [AvailabilityClaim, IntentReceipt, AuthorityReceipt]
assertions.coordination_established = true
assertions.shared_frontier = exact frontier revision
```

Additional assertions bind the exact FCL scope and target. The payload retains provenance to all Core prerequisite receipts and the FCL authority-evaluation receipt.

## Core identity

The output uses the existing Core v0.1 identity rule:

```text
sha256(UTF8(canonical-json(identity-projection(receipt))))
```

`content_hash` and `signature_profile` are excluded from the identity projection; object keys are recursively sorted. No alternative Core hash identity is introduced.

## Non-effects

The generated `CoordinationReceipt` fixes at least:

```text
execution_authorized = false
action_performed = false
authority_expanded = false
liability_established = false
action_permitted = false
action_permit_created = false
authority_granted = false
intent_created = false
availability_created = false
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

Therefore:

```text
CoordinationReceipt created != ActionPermit created
Coordination established != execution authorized
Coordination established != action performed
```

## Fail-closed behavior

The profile rejects malformed Core envelopes or hashes, missing/extra predecessor edges, subject or frontier drift, time reversal, absent Core non-effects, missing or mismatched FCL availability binding, capability/scope mismatch, non-positive FCL authority evidence, any AuthorityReceipt that no longer matches #547, output predecessor substitution, subject/frontier substitution, permission or execution escalation, and legal/universal/truth/causality overclaims.

The CLI is deliberately read-only with respect to the world:

```text
core-coordination-binding.js validate <input.json|->
core-coordination-binding.js bind <input.json|->
```

`bind` only emits a JSON Core `CoordinationReceipt`. There is no `permit`, `execute`, `interrupt`, `resume`, `send`, `switch`, `activate`, `create-successor` or `grant` command.

## Validation

`test-core-coordination-binding.js` covers positive interrupt/successor paths, complete Core edge closure, deterministic Core hash parity, FCL binding substitutions, predecessor/frontier/subject/time failures, #547 authority substitution, non-effects and CLI boundaries.

Dedicated CI also re-runs:

- FCL Authority Evaluation;
- FCL Core AuthorityReceipt Binding;
- Core v0.1 conformance unchanged;
- JSON Schema validation of the profile input and generated CoordinationReceipt;
- an independent Python recomputation of the Core content hash;
- a guard that the PR does not modify `protocols/core/v0.1/**` or `proposals/poai/authority/**`.

## Deliberately out of scope

No Core schema change, Authority Root/Grant change, live authority expansion, prerequisite receipt creation, ActionPermit, execution, real interrupt, successor/ContinuationReceipt creation, production UI mutation, provider invocation, transport send, timeout transition, KONTUR activation, release or tag.
