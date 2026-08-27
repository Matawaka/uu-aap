# FCL Authority Evaluation v0.1

**Status:** experimental bounded read-only profile  
**Issue:** #544  
**Predecessor:** FCL Current-State Request Evaluation Gate v0.1 (#543)  
**Authority source:** PoAI Authority Root / Grant / Verification  
**Next boundary:** later Core `AuthorityReceipt` binding adapter

## Purpose

This profile consumes a still-current FCL human request together with an already-produced `PoAIAuthorityVerificationResult` and decides whether the verification result proves pre-existing authority for the exact FCL request scope, effect actor and run/epoch target.

```text
CurrentStateRequestEvaluationReceipt
  + PoAIAuthorityVerificationResult
  + effect_actor_subject
  -> FCLAuthorityEvaluationReceipt
  -> later Core AuthorityReceipt adapter
  != ActionPermit
  != execute
```

It does not create Authority Roots, Authority Grants, Core AuthorityReceipts or ActionPermits.

## Reused authority model

The profile imports the existing PoAI `validateVerificationResult` assurance boundary. It does not define a parallel grant chain.

PoAI verification already separates a generic established issuer-entitlement chain from specialized materialization/policy-control claims. FCL consumes the generic exact-scope result and preserves all legal/truth/canonicality non-claims.

## FCL action scopes

```text
REQUEST_INTERRUPT -> fcl.run.interrupt
REQUEST_SUCCESSOR -> fcl.run.successor.create
```

These are required action-scope names inside the existing PoAI AuthorityGrant model. Naming a scope does not grant it.

The live `Matawaka.uu-aap` Authority Root currently accepts only:

```text
poai.successor.materialization.execute
poai.materialization.policy.control
```

Therefore it does not implicitly authorize either FCL action. Conformance tests fail if the live root begins to be interpreted as granting those scopes without an explicit authority-root/grant change.

## Exact request target

v0.1 derives authority target from the revalidated execution context:

```text
urn:uu-aap:fcl:run:<current_run_id>:epoch:<current_run_epoch>
```

No wildcard, broader resource, different run or different epoch may substitute for it.

## Freshness

An authority result is current for this boundary only when:

```text
CurrentStateRequestEvaluationReceipt.evaluated_at
  <= PoAIAuthorityVerificationResult.verified_at
  <= FCLAuthorityEvaluationReceipt.evaluated_at
```

This prevents an old authority observation from being silently reused after the request-state revalidation.

## Classifications

- `PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED`
- `REQUEST_NOT_CURRENT`
- `AUTHORITY_NOT_ESTABLISHED`
- `AUTHORITY_SCOPE_MISMATCH`
- `AUTHORITY_TARGET_MISMATCH`
- `AUTHORITY_SUBJECT_MISMATCH`
- `AUTHORITY_EVIDENCE_TOO_OLD`
- `AUTHORITY_EVIDENCE_TIME_INVALID`

Only `PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED` may set `forwardable_to_core_authority_adapter=true`.

## Positive evidence

A positive receipt establishes only that a valid PoAI verification result is established for the exact effect actor, FCL scope and run/epoch target after current-state revalidation.

```text
preexisting_request_scoped_authority_observed = true
forwardable_to_core_authority_adapter = true
next_safe_action = BIND_CORE_AUTHORITY_RECEIPT
```

This is observation/binding of pre-existing authority, not a grant.

## Fixed non-effects

Every result fixes false:

```text
authority_granted_by_evaluator
authority_expanded_by_evaluator
core_authority_receipt_created
request_effect_authorized
action_permit_established
execution_admitted
interrupt_completed
continuation_receipt_created
successor_run_created
runtime_state_transitioned
progress_created
liveness_proven
legal_identity_verified
legal_authority_established
universal_authority_established
legal_effect_established
truth_certified
causal_proof_certified
legal_responsibility_determined
liability_established
private_reasoning_included
```

Thus:

```text
Current Request != Authority
Authority Evidence != New Grant
Authority Evaluation != Core AuthorityReceipt
Authority Evaluation != ActionPermit
Scoped Authority != Legal Authority
Scoped Authority != Universal Authority
```

## Assurance boundary

For FCL scopes, PoAI specialized claims must remain false:

```text
materialization_authority_established = false
policy_control_authority_established = false
```

The FCL scopes must not borrow `poai.successor.materialization.execute` or `poai.materialization.policy.control` merely because those scopes already exist.

## CLI

```text
node authority-evaluation.js validate <input.json|->
node authority-evaluation.js evaluate <input.json|->
```

The CLI deliberately has no `grant`, `permit`, `interrupt`, `execute`, `resume`, `send`, `switch`, `activate` or `create-successor` command.

## Conformance

`test-authority-evaluation.js` covers positive interrupt/successor evidence, deterministic scope/target mapping, stale request rejection, missing authority, cross-control scope mismatch, materialization/policy scope reuse rejection, run/epoch/wildcard target mismatch, subject mismatch, stale/future verification, prohibited specialized/legal claims, tampered predecessor receipt, fixed non-effects, output overclaim rejection, live-root non-expansion and read-only CLI behavior.

The dedicated CI also reruns all FCL predecessors, PoAI Authority Root semantic vectors, UU-AAP Core validation, and the Pre-Action Authorize Admission profile. No actuator is invoked.
