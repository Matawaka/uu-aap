# UU-AAP Integration v0.1 — CounterfactualInterventionAssessment

**Status:** experimental integration layer  
**Scope:** explicit intervention/counterfactual scenarios over an already bounded causal assessment, without upgrading structural sensitivity into necessary, sufficient, exclusive, legal or moral causation.

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
```

## Why this layer exists

`CausalAttributionAssessment` can compare causal explanations and preserve uncertainty, but it still does not perform an intervention.

The next question is different:

> What does the model say would change if a specific part of the transition mechanism were intervened on while declared invariants were held fixed?

That question must not be collapsed into:

```text
hypothesis supported
  == necessary cause
  == sufficient cause
  == exclusive cause
  == causal proof
```

The counterfactual layer therefore separates **intervention sensitivity** from stronger causal predicates.

## Immutable predecessor

The assessment binds, using RFC 8785 JCS + SHA-256:

- `CausalAttributionAssessment`;
- `ResponsibilityTrace`;
- `OutcomeObservationReceipt`.

It verifies the predecessor causal assessment against the exact responsibility trace and outcome observation already used by that assessment.

The previous causal assessment remains immutable. Its:

- evidence horizon;
- hypotheses;
- support states;
- uncertainty;
- non-certifying claims

are not rewritten by later counterfactual reasoning.

## Semantic frontier

The following tuple remains exact:

```text
action
target
operation_ref
base_revision
responsible_party_id
executor_implementation_id
```

The exact effect under assessment also remains unchanged:

```text
scope = exact_local_git_transition_effect
relation = exact_state_transition_effect
revision
commit_sha
tree_sha
changed_paths
effect_objects
```

Each scenario binds the RFC 8785 JCS + SHA-256 digest of this exact effect.

## Counterfactual model boundary

v0.1 declares:

```text
model_scope = exact_local_git_transition_mechanism
interpretation = structural_counterfactual_not_real_world_causal_proof
external_consequence_model_present = false
model_completeness_established = false
```

This is deliberately narrow.

The model reasons about the exact repository transition mechanism. It does not claim to model every human, organizational, network, legal, economic or physical path that could produce a later consequence.

## Evidence horizon

The intervention assessment has its own epistemic frontier:

```text
scenario.evaluated_at <= evidence_cutoff <= assessed_at
later_evidence_admitted = false
```

Later intervention evidence requires a successor assessment.

## Required scenarios

v0.1 requires exactly three scenario kinds.

### 1. factual_baseline

The observed predecessor outcome is retained as the factual comparison point.

```text
intervention.variable = none
intervention.operation = none
intervention.value = factual

test_status = observed_factual
comparison_result = effect_preserved
relation_status = factual_observed
```

This scenario does not introduce a counterfactual claim. It freezes what was actually observed.

### 2. suppress_originating_execution

The structural model sets the originating execution occurrence to absent while holding the declared predecessor state and non-intervened semantics fixed.

```text
intervention.variable = originating_execution_occurrence
intervention.operation = set_absent
intervention.value = absent

test_status = structurally_evaluated
comparison_result = effect_removed
relation_status = sensitivity_supported
```

The required assumptions include:

```text
predecessor_state_held_fixed
no_alternative_transition_operator_invoked
```

The result is **model-relative structural sensitivity**.

It does not establish real-world necessity because the assumption explicitly excludes alternative transition operators inside this scenario.

### 3. alternative_reproduction_mechanism

This scenario asks whether another local mechanism could reproduce the same exact effect without relying on the originating execution identity.

```text
intervention.variable = transition_mechanism_identity
intervention.operation = replace_with_alternative
intervention.value = independent_local_mechanism

test_status = not_executed
comparison_result = unknown
relation_status = unresolved
```

In v0.1 this scenario is intentionally unresolved.

That unresolved alternative blocks stronger predicates.

## Held-fixed invariants

Every scenario must explicitly name at least two held-fixed invariants.

The global model preserves, at minimum:

```text
base_revision
target
operation_ref
responsible_party_id
executor_implementation_id
non_intervened_semantics
```

This prevents a counterfactual from silently changing both the intervention and unrelated context at the same time.

## Predicate-test boundary

The assessment records four separate tests.

### Necessity

```text
status = blocked_by_unresolved_alternative
model_relative_sensitivity_supported = true
establishes_predicate = false
```

Structural suppression sensitivity is not enough for necessity.

### Sufficiency

```text
status = not_tested
establishes_predicate = false
```

No intervention has shown that the originating mechanism alone is sufficient across an adequate model class.

### Exclusivity

```text
status = blocked_by_unresolved_alternative
establishes_predicate = false
```

The unresolved alternative reproduction scenario prevents exclusivity.

### Counterfactual causal proof

```text
status = not_certified
establishes_proof = false
```

No v0.1 scenario can certify counterfactual causal proof.

## Result

A successful v0.1 assessment reports:

```text
status = structural_intervention_sensitivity_with_unresolved_reproduction
intervention_scope = bounded_transition_mechanism_only
factual_baseline_verified = true
structural_suppression_evaluated = true
alternative_reproduction_resolved = false
model_relative_sensitivity_status = sensitivity_supported
causal_predicate_qualification_status = deferred
uncertainty_status = material_uncertainty_preserved
causal_proof_established = false
```

The key distinction is:

```text
structural sensitivity supported
!= necessary cause established
!= sufficient cause established
!= exclusive cause established
!= causal proof certified
```

## Positive claims

The layer may establish only that:

- the predecessor causal assessment is exact;
- explicit counterfactual scenarios exist;
- the factual baseline is bound;
- intervention assumptions are explicit;
- one structural suppression comparison was evaluated;
- an alternative reproduction scenario is explicitly represented;
- model-relative sensitivity was assessed;
- unresolved alternatives and uncertainty remain preserved.

## Claims that remain false

v0.1 keeps false:

```text
necessary_cause_established
sufficient_cause_established
exclusive_cause_established
counterfactual_causal_proof_certified
generalized_external_consequence_causality_established
causal_proof_certified
responsibility_for_outcome_adjudicated
legal_responsibility_determined
legal_effect_established
moral_blame_assigned
moral_correctness_established
truth_certified
remote_branch_or_ref_canonicality_established
poai_materialization_event_recorded
poai_successor_record_identity_inferred
universal_canonicality_established
poai_v_conformance_established
```

## No scalar probability in v0.1

As in `CausalAttributionAssessment`, the counterfactual layer rejects fields such as:

```text
probability
score
percentage
likelihood
confidence_score
```

The intervention model is not yet a calibrated statistical causal model. Numeric confidence would create false precision.

## Fail-closed behavior

The live suite rejects, among other cases:

- substituted causal/trace/outcome bindings;
- semantic or effect frontier drift;
- predecessor causal overclaims;
- inverted assessment time;
- evidence-cutoff violations;
- scenarios evaluated after the cutoff;
- duplicate scenario IDs;
- missing or duplicate required scenario kinds;
- counterfactual scenarios without held-fixed invariants;
- substituted factual baseline;
- suppression promoted beyond structural sensitivity;
- unresolved alternative promoted as executed/resolved;
- substituted comparison-effect digest;
- later evidence silently admitted;
- model completeness or external consequence model overclaims;
- qualification of necessity/sufficiency/exclusivity inside v0.1;
- scalar probability injection;
- responsibility, legal, moral, truth, remote, PoAI or universal-canonicality overclaims.

## Continuation invariant

The next layer is:

# CausalClaimQualification

That layer should act as an explicit gate over intervention evidence and determine which typed causal predicates, if any, are actually warranted under a declared model and scope.

It should distinguish at least:

```text
contribution_supported
necessity_qualified
sufficiency_qualified
exclusivity_qualified
counterfactual_proof_qualified
```

A qualification must fail closed whenever required interventions are absent, alternatives remain unresolved, the model scope is insufficient, or the evidence horizon is incomplete.

Even a future positive causal qualification remains separate from:

```text
responsibility adjudication
legal liability
moral blame
truth certification
```
