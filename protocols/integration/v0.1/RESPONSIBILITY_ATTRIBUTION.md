# UU-AAP Integration v0.1 — ResponsibilityAttributionAssessment

**Status:** experimental integration layer  
**Scope:** policy-relative attribution of an already-qualified bounded causal contribution to an already-accepted responsibility scope for the same exact observed transition.

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
  -> ResponsibilityAttributionAssessment
```

## Why this is a separate layer

The predecessor chain already establishes three different facts:

1. `ResponsibilityTrace` — a party accepted responsibility for a declared action scope and the originating action lies inside that scope.
2. `CausalClaimQualification` — the originating execution is qualified as contributing to the exact local Git transition under a bounded causal policy.
3. `OutcomeObservationReceipt` — that exact transition effect was independently observed.

None of those facts alone establishes responsibility attribution for the effect.

```text
accepted responsibility scope
!= qualified causal contribution
!= policy-relative responsibility attribution
!= responsibility adjudication
!= legal liability
!= moral blame
```

`ResponsibilityAttributionAssessment` joins these three evidence axes without upgrading them into an institutional or legal verdict.

## Versioned attribution policy

v0.1 introduces:

```text
UU-AAPResponsibilityAttributionPolicy
```

Canonical policy:

```text
protocols/integration/v0.1/policies/
  exact-local-git-transition.responsibility-attribution-policy.json
```

Policy identity:

```text
policy_id = urn:uu-aap:responsibility-attribution-policy:exact-local-git-transition:1
policy_version = 1
attribution_scope = urn:uu-aap:responsibility-attribution-scope:exact-local-git-transition-v0.1
```

The assessment binds the exact policy bytes with RFC 8785 JCS + SHA-256.

Therefore:

```text
same policy_id != same policy bytes
```

and:

```text
policy-relative responsibility attribution != universal responsibility
```

## Exact predecessor binding

The assessment binds exact bytes of:

- `CausalClaimQualification`;
- `ResponsibilityTrace`;
- `OutcomeObservationReceipt`;
- `UU-AAPResponsibilityAttributionPolicy`.

It re-verifies the shared semantic tuple:

```text
action
target
operation_ref
base_revision
responsible_party_id
executor_implementation_id
```

It also re-verifies that the effect under causal qualification is the same effect observed by `OutcomeObservationReceipt`.

## Responsibility basis

The bounded responsibility basis is imported from the exact `ResponsibilityTrace`:

```text
trace_status = traceable_not_adjudicated
originating_action in accepted_responsibility_scope
scope_intersection = [originating_action]
responsible_party_id exact
accepted_scope_preserved = true
```

This does not invent a new scope after the outcome is known.

## Causal basis

Only one causal predicate is admissible as the positive responsibility-attribution basis in v0.1:

```text
originating_execution_contributed_to_exact_transition
```

It must already be:

```text
status = qualified
establishes_predicate = true
```

under the exact `CausalClaimQualification`.

The following stronger causal predicates remain unusable as an attribution basis:

```text
necessary_cause
sufficient_cause
exclusive_cause
counterfactual_causal_proof
generalized_external_consequence_causality
```

## Fixed responsibility predicate set

v0.1 evaluates exactly six predicates.

### 1. `accepted_action_responsibility_applies`

```text
status = attributed
establishes_predicate = true
```

This means only that the originating action is inside the responsibility scope the same party actually accepted.

### 2. `exact_transition_responsibility_attribution`

```text
status = attributed
establishes_predicate = true
```

This requires all of:

- accepted-action responsibility applies;
- originating execution contribution is causally qualified;
- exact transition effect identity is bound;
- exact outcome observation is bound.

Its meaning is deliberately narrow:

> Under this policy, the accepted responsibility scope applies to the same party's qualified contribution to this exact observed local transition.

It is not a legal judgment.

### 3. `external_consequence_responsibility`

```text
status = out_of_scope
establishes_predicate = false
```

The current chain establishes neither an external consequence nor generalized external causality.

### 4. `responsibility_adjudication`

```text
status = not_adjudicated
establishes_predicate = false
```

No institutional responsibility-adjudication protocol has been applied.

### 5. `legal_liability`

```text
status = not_adjudicated
establishes_predicate = false
```

No jurisdiction or legal standard is applied by this integration layer.

### 6. `moral_blame`

```text
status = not_adjudicated
establishes_predicate = false
```

A causal and scoped-responsibility relation is not a moral evaluation.

## Live v0.1 result

The reference test chain produces:

```text
status = bounded_responsibility_attribution_supported_stronger_claims_withheld
policy_relative = true
attributed_predicate_count = 2
withheld_predicate_count = 4
uncertainty_status = material_uncertainty_preserved
responsibility_adjudicated = false
external_consequence_responsibility_established = false
legal_liability_established = false
moral_blame_assigned = false
```

## Temporal semantics

The assessment enforces local logical stage order:

```text
assessed_at > CausalClaimQualification.qualified_at
assessed_at > ResponsibilityTrace.traced_at
assessed_at > OutcomeObservationReceipt.observed_at
```

This is not a claim that every synthetic timestamp in the entire integration harness forms a globally monotonic wall-clock history.

```text
logical stage order != globally proven wall-clock chronology
```

## No scalar responsibility score

v0.1 rejects uncalibrated scalar fields including:

```text
responsibility_score
blame_score
probability
percentage
likelihood
confidence_score
causal_score
weight
rating
```

Responsibility is represented as typed relations and explicit scopes, not a reputation or blame score.

## Assurance boundary

A positive assessment may establish:

```text
exact attribution policy applied
accepted responsibility scope applies to originating action
qualified causal contribution bound to same exact observed effect
policy-relative exact-transition responsibility attribution established
```

It must keep false:

```text
external consequence responsibility established
responsibility for outcome adjudicated
responsibility adjudication completed
legal responsibility determined
legal liability established
legal effect established
moral blame assigned
moral correctness established
universal responsibility established
universal causality established
truth certified
remote branch/ref canonicality established
PoAI MaterializationEvent recorded
PoAI successor record identity inferred
universal canonicality established
PoAI/V conformance established
```

## Continuation invariant

The next useful layer should stop treating one assessment as the whole story and instead preserve responsibility through multiple causally related events.

Working direction:

```text
ResponsibilityEventChain
```

or an equivalent append-only consequence-chain artifact that can bind successive:

- observed events;
- responsibility scopes;
- causal qualifications;
- responsibility attributions;
- unresolved alternatives and later corrections.

The chain must preserve each historical assessment rather than recomputing one final blame value.

```text
responsibility event chain != scalar responsibility score
responsibility history != legal verdict
```

No auto-merge. Human squash merge remains final.
