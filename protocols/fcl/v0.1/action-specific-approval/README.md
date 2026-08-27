# FCL Action-Specific Approval v0.1

**Status:** experimental bounded approval adapter  
**Tracking:** Issue #553  
**Canonical predecessor:** merged #554  
**Core ActionPermit:** `protocols/fcl/v0.1/core-action-permit-binding`  
**Reusable downstream:** `protocols/integration/pre-action-evidence-bundle/v0.1`

## Purpose

This profile records a second, explicit human approval event for one exact already-materialized FCL Core `ActionPermit` before that permit may enter the reusable pre-action / authorize stack.

```text
UserControlRequestReceipt
-> current-state / authority / Core prerequisite chain
-> Core CoordinationReceipt
-> Core ActionPermit (one-shot, unconsumed)
-> explicit Action-Specific Approval
-> later PreActionEvidenceBundle
-> later AuthorizeAdmission
-> later ExecuteRevalidation
-> later execution
```

The profile exists because a request, a permit and a later approval are different causal objects.

```text
Human Request != Action-Specific Approval
ActionPermit Materialized != Human Approval
Approval != Authority
Approval != ActionPermit Creation
Approval != Authorize Admission
Approval != Execution
```

## Reconciled ordering after #554

Issue #553 and its branch were reserved before #554 existed, but the branch contained no implementation. After #554 merged, the canonical order was reconciled without reverting history.

The Core `ActionPermit` is now a bounded permission artifact that may exist while still being non-executing and unconsumed. A separate approval is required before the later bundle/admission path may use it.

This makes the human approve the **exact permit object** rather than an abstract future effect.

## Input

`ActionSpecificApprovalInput` contains:

- exact `UserControlRequestReceipt`;
- exact #554 `CoreActionPermitBindingInput`;
- exact #554 Core `ActionPermit`;
- a distinct explicit human approval event;
- approval receipt timestamp;
- approval expiry.

The adapter calls the merged request and ActionPermit validators directly. The ActionPermit validator transitively revalidates the reconciled CoordinationReceipt chain.

## Exact identity binding

The request and permit must agree exactly on:

```text
request_id
requested_control
run_id
run_epoch
chain_id
intent_ref
```

Any substitution fails closed.

## Explicit approval event

Accepted event classes:

```text
POINTER_ACTIVATION
KEYBOARD_ACTIVATION
VOICE_ACTIVATION
ACCESSIBILITY_ACTIVATION
```

The approval event must be different from the original request event and explicitly bind:

```text
ActionPermit.content_hash
CoordinationReceipt.content_hash
target_binding_hash
```

The following are not approval evidence:

```text
hover
focus
spinner
heartbeat
reconnect
provider ACK
passive observation
inferred consent
original request event replay
```

## Approval binding

The generated receipt embeds the approval shape already used by `PreActionEvidenceBundle`:

```text
approval_id
kind = action_specific
scope_bound = true
subject_id
operation
action_scope
authority_scope
target_binding_hash
issued_at
valid_until
one_shot = true
content_hash
```

The embedded `content_hash` uses recursively key-sorted compact JSON with SHA-256, excluding only `content_hash` itself, matching the existing reusable pre-action identity convention.

The outer FCL receipt preserves request, permit, coordination and human-event provenance.

## Temporal boundary

A valid chain requires:

```text
request.requested_at
<= coordination.issued_at
<= ActionPermit.issued_at
<= approval_event.occurred_at
<= approval_receipt.issued_at
< approval_binding.valid_until
```

Approval may never extend the permit or availability horizon:

```text
approval.valid_until <= ActionPermit.expires_at
approval.valid_until <= ActionPermit.availability_valid_until
```

At approval time the permit must remain:

```text
one_shot = true
consumed = false
execute_revalidation_required = true
```

## Positive result

A successful `FCLActionSpecificApprovalReceipt` may assert only bounded observable facts:

```text
explicit_approval_recorded = true
permit_preexisted_approval = true
permit_unconsumed_at_approval = true
approval_required_before_authorize = true
```

Its next safe action is only:

```text
ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE
```

It does not itself create that bundle.

## Non-effects

Every approval receipt fixes false for:

```text
request_reinterpreted_as_approval
authority_created
authority_expanded
coordination_created
action_permit_created
action_permit_consumed
execution_authorized
execution_admitted
pre_action_bundle_created
lifecycle_authorize_admitted
lifecycle_execute_ready
interrupt_completed
continuation_receipt_created
successor_run_created
runtime_state_transitioned
approval_reusable
approval_generalized
future_action_permission_created
general_authority_created
legal_authority_established
universal_authority_established
legal_effect_established
truth_certified
causality_proven
liability_established
private_reasoning_included
```

Therefore:

```text
Approval Recorded != Permit Consumed
Approval Recorded != Authorize Admitted
Approval Recorded != Execute Ready
Approval Recorded != Requested Effect Completed
```

## CLI

```text
action-specific-approval.js validate <input.json|->
action-specific-approval.js receipt <input.json|->
```

The CLI has no `permit`, `consume`, `execute`, `interrupt`, `resume`, `send`, `switch`, `activate`, `create-successor` or `grant` command.

## Conformance

The test suite covers positive interrupt and successor approval, deterministic approval hash/fingerprint, exact request/permit identity, permit revalidation, event provenance, event replay rejection, timing and expiry bounds, target/coordination/permit hash substitution, one-shot/non-consumed constraints, output overclaim rejection and no-effect CLI behavior.

Dedicated CI additionally re-runs unchanged:

- FCL User Control Request;
- reconciled FCL CoordinationReceipt;
- FCL Core ActionPermit #554;
- Core v0.1;
- PreActionEvidenceBundle;
- AuthorizeAdmission.

It independently recomputes both approval identities and fails if this slice modifies any protected predecessor path.

## Deliberately out of scope

No ActionPermit creation or mutation, no permit consumption, no PreActionEvidenceBundle creation, no lifecycle authorize/execute transition, no real interrupt, no successor/ContinuationReceipt creation, no provider/model/actuator call, no production UI/runtime mutation, no Authority Root/Grant mutation, no KONTUR activation, no release/tag and no merge.
