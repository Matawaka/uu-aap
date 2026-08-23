# UU-AAP Integration v0.1 — CausalAttributionAssessment

**Status:** experimental integration layer  
**Scope:** competing causal hypotheses over an already observed exact transition effect, with explicit evidence horizon and uncertainty, without causal certification or responsibility adjudication.

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
```

## Why this layer exists

`ResponsibilityTrace` can establish two narrow facts at once:

1. an exact local Git transition effect was observed;
2. that effect is traceable through an accepted responsibility chain.

Neither fact, alone or together, proves a generalized causal claim.

```text
observed effect
!= causal explanation
!= exclusive cause
!= responsibility adjudication
!= legal liability
!= moral blame
```

`CausalAttributionAssessment` introduces a place where causal explanations can be compared without silently upgrading the evidence.

## Predecessor boundary

The assessment MUST consume the exact `ResponsibilityTrace` as its causal-predecessor frontier. It also binds the exact `OutcomeObservationReceipt` and `CommitReceipt` used for the bounded transition mechanism.

This prevents a causal assessment from bypassing the responsibility trace or reconstructing a different execution history.

All three predecessors are bound with RFC 8785 JCS + SHA-256.

## Semantic frontier

The following tuple is preserved exactly:

```text
action
target
operation_ref
base_revision
responsible_party_id
executor_implementation_id
```

For `CommitReceipt`, `base_revision` is normalized from `predecessor.revision`. Later artifacts carry the same frontier explicitly as `base_revision`.

This normalization changes representation, not meaning.

## Effect under assessment

v0.1 deliberately assesses only the exact local Git transition already observed by `OutcomeObservationReceipt`:

```text
scope    = exact_local_git_transition_effect
relation = exact_state_transition_effect
```

The assessment repeats the exact:

- successor revision;
- commit SHA;
- tree SHA;
- changed paths;
- changed-path Git object identities.

A causal hypothesis cannot substitute a different effect while retaining the predecessor trace.

## Evidence horizon

Every assessment has:

```text
assessed_at
evidence_cutoff
later_evidence_admitted = false
```

Every evidence item has its own `observed_at`, and:

```text
evidence.observed_at <= evidence_cutoff <= assessed_at
```

This preserves the epistemic frontier of the assessment. Later facts require a successor assessment rather than retroactive mutation.

## Evidence catalog

The live v0.1 harness binds five predecessor-derived propositions:

1. `approved_execution_created_successor_transition`;
2. `exact_local_transition_effect_observed`;
3. `accepted_responsibility_chain_is_traceable_not_adjudicated`;
4. `alternative_causes_remain_unassessed_beyond_transition`;
5. `no_external_consequence_is_established_by_predecessor_observation`.

Each evidence item binds its source artifact digest but keeps:

```text
truth_certified = false
```

The assessment classifies evidence; it does not magically certify the source proposition as universal truth.

## Competing hypotheses

v0.1 requires three explicit hypothesis kinds:

### 1. `originating_execution_contributed`

The approved execution lineage contributed to the exact observed local transition effect.

The live harness marks this:

```text
support_status = supported
```

because execution evidence and exact-effect observation both exist.

This support is bounded to the transition mechanism. It is not an exclusive-cause claim.

### 2. `alternative_local_cause_contributed`

Another local mechanism could have contributed to or reproduced the observed effect.

The live harness marks this:

```text
support_status = insufficient
```

because alternatives were not previously assessed, but no independent alternative mechanism is evidenced.

### 3. `insufficient_evidence_for_broader_causality`

Available evidence is insufficient to infer consequences beyond the exact local transition.

The live harness marks this:

```text
support_status = supported
```

because the predecessor explicitly contains no external-consequence observation/model and no counterfactual evidence.

## Non-scalar support vocabulary

v0.1 intentionally permits only:

```text
supported
contradicted
mixed
insufficient
not_tested
```

It prohibits fields such as:

```text
probability
score
percentage
weight
likelihood
confidence_score
```

Why: the current evidence model does not justify calibrated numerical causal probabilities. Adding a number now would create precision without a validated statistical semantics.

## Deterministic support-state rule

The evaluator derives the categorical state from the declared evidence relations:

```text
supporting + contradicting -> mixed
supporting only            -> supported
contradicting only         -> contradicted
context/alternative/gaps   -> insufficient
no evidence + explicit state -> not_tested
```

A caller cannot simply relabel a hypothesis from `supported` to `insufficient` without changing its evidence relation set.

## Result boundary

A passing assessment reports:

```text
status = bounded_association_supported_with_unresolved_alternatives
causal_scope = bounded_transition_mechanism_only
alternatives_considered = true
winner_selected = false
uncertainty_status = material_uncertainty_preserved
causal_proof_established = false
```

Positive claims are limited to:

- predecessor ResponsibilityTrace verified;
- competing hypotheses evaluated;
- evidence horizon fixed;
- evidence classified;
- alternatives explicitly considered;
- bounded transition-mechanism association supported;
- uncertainty explicitly preserved.

## What remains false

A passing assessment MUST keep false:

```text
generalized_external_consequence_causality_established
causal_proof_certified
exclusive_cause_established
necessary_cause_established
sufficient_cause_established
counterfactual_causality_established
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

Core invariant:

```text
supported causal hypothesis
!= causal proof
!= exclusive / necessary / sufficient cause
!= counterfactual result
!= adjudicated responsibility
```

## Fail-closed behavior

The live suite rejects, among other vectors:

- assessment at/before ResponsibilityTrace;
- evidence after the cutoff;
- cutoff after assessment time;
- duplicate hypotheses;
- missing alternative hypothesis;
- unknown evidence references;
- support-state substitution;
- predecessor ref/digest substitution;
- semantic frontier drift;
- effect revision/path substitution;
- duplicate evidence IDs;
- injected scalar probability fields;
- causal-proof / exclusive-cause overclaim;
- responsibility adjudication, legal and truth overclaims.

## Relationship to PoAI Observed Outcome

The repository already has the experimental PoAI Outcome Sidecar principle:

```text
outcome observation != causal attribution != responsibility
```

This integration layer does not replace it. It operationalizes the causal-attribution middle term over the exact integration evidence chain.

## Next layer — continuation invariant

The next architectural layer is:

**`CounterfactualInterventionAssessment`**

Its role is to represent explicit counterfactual/intervention scenarios such as:

```text
What evidence would differ if the originating execution had not occurred?
What intervention would distinguish the originating mechanism from an alternative mechanism?
Can necessity or sufficiency even be tested with the available system boundary?
```

That next layer must still keep responsibility adjudication, legal liability and moral blame separate.
