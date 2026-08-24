# UU-AAP Provider-Neutral Bounded Action End-to-End Conformance v0.1

**Status:** experimental stacked conformance profile  
**Issue:** #375  
**Dependency:** #373 / PR #374

## Purpose

Represent the complete bounded action chain as references to exact already-materialized artifacts. The manifest is an index and verifier, not an issuer.

```text
PreActionEvidenceBundle
 -> AuthorizeAdmission
 -> ExecuteRevalidation
 -> ExecutionInvocationEnvelope
 -> InvocationEvidence ↔ Core ActionReceipt
 -> ObservationEvidence ↔ Core OutcomeReceipt -> SuccessorStateReceipt
 -> BoundedActionLifecycleClosure
```

Capability Selection, Execution Capability Availability and the Core pre-action graph remain transitively mandatory through the PreActionEvidenceBundle.

## Cross-stage invariants

The same target binding, predecessor frontier and ActionPermit must survive all pre-execution stages. Permit/envelope consumption occurs only with execution evidence. `ActionReceipt` stays on predecessor frontier; Outcome/Successor receipts share the independently observed successor frontier. Closure exhausts the original action scope and carries no permission forward.

## Manifest non-effects

The manifest does not mint/refresh receipts, create authority, create future/general permission, prove causality, certify truth or establish liability.

## Conformance

`validate-bounded-action-e2e.js` loads each referenced component fixture, checks exact ID/content-hash linkage and cross-stage target/frontier/permit/consumption/successor/closure invariants, then rejects manifest substitutions and escalation claims.

CI is read-only and performs no actuator or observation action.
