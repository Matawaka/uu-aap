# FCL → UU-AAP Core CoordinationReceipt Binding v0.1 — reconciled hardening

**Status:** experimental bounded adapter  
**Tracking:** Issue #549  
**Merged predecessor:** PR #550  
**Earlier predecessor:** PR #547  
**Core:** `protocols/core/v0.1`  
**Availability reference:** `protocols/integration/execution-capability-availability/v0.1`

## Purpose

This revision reconciles two independently materialized implementations of the same Core coordination boundary. Merged PR #550 remains the canonical predecessor and preserves full Core prerequisite closure. The former competing PR #551 is converted into a successor hardening layer instead of replaying or replacing #550.

The resulting profile keeps both guarantees:

```text
Core StateReceipt
  -> Core AvailabilityClaim
Core StateReceipt
  -> Core IntentReceipt
  -> Core AuthorityReceipt
AvailabilityClaim + IntentReceipt + AuthorityReceipt
  -> Core CoordinationReceipt
  != ActionPermit
```

and:

```text
Availability != Intent
Availability freshness != future availability guarantee
Coordination != ActionPermit
Coordination != Execution
```

## Why reconciliation is required

PR #550 and the original #551 were created from the same predecessor frontier and wrote the same five repository paths. A direct merge would therefore be a duplicate implementation conflict. Selecting only one side would lose useful invariants:

- #550: complete `StateReceipt` predecessor closure and explicit Core edge validation;
- original #551: intent-free availability binding, `valid_until` freshness at coordination time, and explicit compatibility with the existing execution-capability availability profile.

This successor keeps #550 in history and strengthens it on top of the merged frontier.

## Full prerequisite closure

The adapter consumes only already-existing receipts:

```text
positive FCLAuthorityEvaluationReceipt
Core StateReceipt
Core AvailabilityClaim
Core IntentReceipt
Core AuthorityReceipt produced under #547 semantics
coordination issued_at
```

It verifies:

```text
StateReceipt.predecessors = []
AvailabilityClaim.predecessors = [StateReceipt.content_hash]
IntentReceipt.predecessors = [StateReceipt.content_hash]
AuthorityReceipt.predecessors = [IntentReceipt.content_hash]
```

All Core prerequisites must have the same exact subject and `frontier.revision`.

## Availability does not carry human intent

The reconciled `AvailabilityClaim.payload.fcl_binding` is a closed five-field object:

```json
{
  "run_id": "...",
  "run_epoch": 0,
  "chain_id": "...",
  "operation_scope": "fcl.run.interrupt | fcl.run.successor.create",
  "target": "urn:uu-aap:fcl:run:<run_id>:epoch:<epoch>"
}
```

It MUST NOT contain `intent_ref` or `requested_control`.

```text
Availability Binding != Human Intent
Capability Availability != Request
```

Human request/intent remains bound separately by the Core `IntentReceipt` and #547 AuthorityReceipt path.

## Freshness boundary

A positive `AvailabilityClaim` must satisfy:

```text
availability_qualified = true
payload.status = available
AvailabilityClaim.issued_at <= payload.valid_until
CoordinationReceipt.issued_at <= payload.valid_until
```

The claim's observation time must precede its `valid_until`, and the claim may not be issued after expiry.

The CoordinationReceipt copies the exact `availability_valid_until` and fixes:

```text
availability_horizon_extended = false
availability_extended = false
```

No coordination step may turn bounded availability into future availability.

## Compatibility with existing availability profile

This adapter does not create another availability primitive. It consumes an ordinary Core v0.1 `AvailabilityClaim`, including claims produced by `execution-capability-availability/v0.1` when they carry the additional FCL consumer binding in the Core payload.

The existing availability profile remains unchanged and is rerun by CI.

## Authority compatibility

The supplied Core `AuthorityReceipt` is revalidated using merged #547 semantics against the exact Core `IntentReceipt` and positive FCL authority evidence. A syntactically similar authority object is insufficient.

```text
Authority evidence != new grant
AuthorityReceipt != ActionPermit
```

## Output

The sole positive output is a canonical Core v0.1 `CoordinationReceipt`:

```text
protocol = UU-AAP Core
version = 0.1
receipt_type = CoordinationReceipt
subject = exact shared predecessor subject
frontier.revision = exact shared predecessor revision
frontier.observed_at = coordination issued_at
predecessor_receipt_hashes = [AvailabilityClaim, IntentReceipt, AuthorityReceipt]
assertions.coordination_established = true
assertions.shared_frontier = exact shared revision
assertions.coordination_scope = exact authority scope
assertions.coordination_target = exact authority target
assertions.availability_fresh_at_coordination = true
```

The payload retains exact predecessor refs, FCL execution context, authority provenance, the unchanged availability horizon, and explicit validation-boundary flags.

Because `StateReceipt` is part of the adapter input, the reconciled profile can truthfully record:

```text
core_state_envelope_validated = true
core_availability_envelope_validated = true
core_availability_chain_revalidated = true
core_authority_binding_revalidated = true
core_prerequisite_chain_validated = true
```

No absent upstream edge is inferred.

## Core identity

The generated receipt keeps the unchanged Core v0.1 identity rule:

```text
sha256(UTF8(canonical-json(identity-projection(receipt))))
```

`content_hash` and `signature_profile` are excluded from the identity projection and object keys are recursively sorted. CI independently recomputes this hash.

## Non-effects

The generated CoordinationReceipt fixes false at least for:

```text
execution_authorized
action_performed
authority_expanded
liability_established
action_permitted
action_permit_created
availability_created
availability_extended
intent_created
authority_created
authority_granted
execution_admitted
interrupt_completed
continuation_receipt_created
successor_run_created
runtime_state_transitioned
legal_authority_established
universal_authority_established
legal_effect_established
truth_certified
causality_proven
private_reasoning_included
```

Therefore:

```text
CoordinationReceipt created != ActionPermit created
Coordination established != execution authorized
Coordination established != action performed
```

## Fail-closed coverage

The conformance suite rejects malformed Core receipts/hashes, broken State→Availability or State→Intent or Intent→Authority edges, subject/frontier drift, non-positive authority evidence, unavailable or stale availability, missing `valid_until`, intent/control leakage into availability, run/epoch/chain/scope/target substitution, timing rollback, predecessor substitution, availability horizon extension, ActionPermit/execution/authority/legal/truth/causality escalation, and actuating CLI commands.

## CLI

Only:

```text
validate
bind
help
```

are supported. `bind` emits JSON only. There is no `permit`, `execute`, `interrupt`, `resume`, `send`, `switch`, `activate`, `create-successor`, or `grant` command.

## Repository non-effects

This successor does not rewrite #550, modify Core v0.1, modify PoAI Authority Roots/Grants, modify `execution-capability-availability/v0.1`, create an AvailabilityClaim/IntentReceipt/AuthorityReceipt, create an ActionPermit, execute an interrupt, create a successor/ContinuationReceipt, mutate production UI, invoke a provider/model, send transport, activate KONTUR, or publish a release/tag.
