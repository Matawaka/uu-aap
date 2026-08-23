# UU-AAP Integration v0.1 — CausalClaimQualification

**Status:** experimental integration layer  
**Scope:** policy-relative qualification of typed causal predicates over already bounded causal/intervention evidence, without universal causal truth, responsibility adjudication, legal liability or moral blame.

## Architectural position

```text
ContextFrame
  -> IntentArtifact
  -> ResponsibilityHandoff
  -> Authority / ExecutionAdmission / PreMaterialization
  -> CommitDecision
  -> CommitReceipt
  -> ObservationReceipt
  -> CanonicalizationReceipt
  -> ProvenanceClosureReceipt
  -> ProvenanceCompletionReceipt
  -> OutcomeObservationReceipt
  -> ResponsibilityTrace
  -> CausalAttributionAssessment
  -> CounterfactualInterventionAssessment
  -> CausalClaimQualification
```

## Why qualification is a separate layer

The predecessor layers answer different questions:

- `CausalAttributionAssessment`: which causal hypotheses are supported by the evidence horizon?
- `CounterfactualInterventionAssessment`: how does a declared structural model respond to explicit interventions?
- `CausalClaimQualification`: which typed causal predicates may actually be asserted under a specific qualification policy and scope?

These are deliberately not collapsed.

```text
evidence
!= hypothesis support
!= intervention sensitivity
!= qualified causal predicate
!= universal causal truth
!= responsibility adjudication
!= legal liability
!= moral blame
```

A qualification is therefore not a free-form sentence. It is a typed, policy-bound decision.

## Versioned qualification policy

v0.1 introduces:

```text
UU-AAPCausalQualificationPolicy
```

Canonical live policy:

```text
protocols/integration/v0.1/policies/
  exact-local-git-transition.causal-qualification-policy.json
```

Policy identity:

```text
policy_id = urn:uu-aap:causal-qualification-policy:exact-local-git-transition:1
policy_version = 1
qualification_scope = urn:uu-aap:causal-qualification-scope:exact-local-git-transition-v0.1
```

The qualification receipt binds the exact policy bytes using RFC 8785 JCS + SHA-256.

Therefore:

```text
same policy_id text
!= same policy bytes
```

A verifier compares the qualification's policy digest with the canonical policy supplied for verification.

## Policy-relative semantics

The policy applies only to:

```text
predecessor = CounterfactualInterventionAssessment@0.1
model_scope = exact_local_git_transition_mechanism
effect_scope = exact_local_git_transition_effect
```

A positive decision inside this scope does not become a universal statement about external reality.

```text
policy-relative qualified predicate
!= universally true causal proposition
```

## Predicate vocabulary

v0.1 requires exactly seven predicates.

### 1. `originating_execution_contributed_to_exact_transition`

Status in the live evidence chain:

```text
qualified
establishes_predicate = true
```

Required evidence includes:

- supported `originating_execution_contributed` causal hypothesis;
- exact transition effect binding;
- exact `ResponsibilityTrace` that remains `traceable_not_adjudicated`.

This is intentionally narrower than generalized causality.

### 2. `model_relative_intervention_sensitivity`

Status:

```text
qualified
establishes_predicate = true
```

The suppression intervention must be:

```text
test_status = structurally_evaluated
comparison_result = effect_removed
relation_status = sensitivity_supported
```

The interpretation remains:

```text
structural_counterfactual_not_real_world_causal_proof
```

and model completeness remains false.

### 3. `necessary_cause`

Status:

```text
deferred
establishes_predicate = false
```

Current blockers:

- alternative reproduction remains unresolved;
- model completeness is not established.

### 4. `sufficient_cause`

Status:

```text
deferred
establishes_predicate = false
```

Current blocker:

```text
sufficiency_not_tested
```

### 5. `exclusive_cause`

Status:

```text
deferred
establishes_predicate = false
```

Current blockers:

- alternative reproduction remains unresolved;
- competing mechanisms are not excluded.

### 6. `counterfactual_causal_proof`

Status:

```text
not_qualified
establishes_predicate = false
```

Structural model sensitivity is not executed counterfactual proof.

### 7. `generalized_external_consequence_causality`

Status:

```text
out_of_scope
establishes_predicate = false
```

No external consequence model exists in the current chain.

## Fixed decision set

`CausalClaimQualification` contains exactly one decision for every policy predicate.

Each decision records:

```text
predicate
status
qualification_scope
reason_codes[]
evidence_refs[]
establishes_predicate
```

The order and set are fixed by the v0.1 schema.

This prevents two common provenance failures:

1. omitting an inconvenient causal predicate from a report;
2. silently adding a stronger causal predicate that the policy never defined.

## Exact predecessor chain

The qualifier binds using RFC 8785 JCS + SHA-256:

- `CounterfactualInterventionAssessment`;
- `CausalAttributionAssessment`;
- `ResponsibilityTrace`;
- `UU-AAPCausalQualificationPolicy`.

It also re-verifies the cross-links already present between those artifacts.

The same semantic frontier is preserved:

```text
action
target
operation_ref
base_revision
responsible_party_id
executor_implementation_id
```

The exact effect frontier is also preserved.

## Qualification result

The live v0.1 result is:

```text
status = bounded_predicates_qualified_stronger_claims_withheld
policy_relative = true
qualified_predicate_count = 2
withheld_predicate_count = 5
uncertainty_status = material_uncertainty_preserved
universal_causal_truth_established = false
```

The two positive predicates are intentionally bounded:

```text
originating_execution_contributed_to_exact_transition
model_relative_intervention_sensitivity
```

Neither is an alias for necessity, sufficiency, exclusivity, external causality or legal responsibility.

## Monotonic assurance

The qualifier may narrow what can be asserted, but it may not rewrite predecessor assurance.

```text
CausalAttributionAssessment.causal_proof_established = false
CounterfactualInterventionAssessment.causal_proof_established = false
```

remain historically true facts about those predecessor artifacts.

A later policy cannot mutate them. It can only create a successor qualification with a different decision set supported by later evidence.

## No scalar causal score

v0.1 continues to prohibit fields such as:

```text
probability
score
percentage
likelihood
confidence_score
causal_score
responsibility_score
```

Qualification is a typed gate, not an uncalibrated probability meter.

## What this layer does establish

A positive live qualification may establish:

```text
exact qualification policy applied
predecessor evidence verified
typed causal predicates evaluated
bounded execution contribution qualified
model-relative intervention sensitivity qualified
stronger causal predicates withheld
policy/scope relativity explicit
uncertainty preserved
```

## What this layer does not establish

It must keep false:

```text
necessary cause established
sufficient cause established
exclusive cause established
counterfactual causal proof certified
generalized external-consequence causality established
universal causal truth established
responsibility for outcome adjudicated
legal responsibility determined
legal effect established
moral blame assigned
moral correctness established
truth certified
remote branch/ref canonicality established
PoAI MaterializationEvent recorded
universal canonicality established
PoAI/V conformance established
```

## Why responsibility is still separate

A qualified causal predicate answers a causal question inside a declared model and scope.

It does not yet answer:

> Does this qualified causal relation fall within the responsibility that a party actually accepted for this outcome?

That requires combining:

- accepted responsibility scope;
- causal qualification;
- effect/outcome identity;
- attribution rules.

Doing that inside the causal qualifier would collapse causal evidence into normative responsibility.

## Fail-closed behavior

The live suite rejects, among other cases:

- policy ID/version/scope substitution;
- policy digest substitution;
- policy rule substitution;
- predecessor ref/digest substitution;
- semantic/effect frontier drift;
- unsupported originating-execution hypothesis;
- invalid suppression sensitivity;
- false resolution of alternative reproduction;
- sufficiency upgrade while still untested;
- counterfactual proof upgrade from structural evidence;
- external causality upgrade without an external model;
- missing/duplicate/reordered predicate decisions;
- reason-code substitution;
- necessary/sufficient/exclusive predicate qualification;
- universal causal truth overclaim;
- responsibility/legal/moral/truth overclaims;
- scalar score/probability injection.

## Continuation invariant

The next integration layer is:

```text
ResponsibilityAttributionAssessment
```

It should consume:

- exact `CausalClaimQualification`;
- exact `ResponsibilityTrace` and accepted responsibility scope;
- exact observed effect/outcome identity.

Its purpose is to determine whether the **qualified bounded causal relation** falls inside an accepted responsibility scope and under what attribution status.

It must still preserve:

```text
responsibility attribution
!= legal adjudication
!= legal liability
!= moral blame
```

No auto-merge. Human squash merge remains final.
