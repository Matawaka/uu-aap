# UU-AAP Integration v0.1 — Outcome / ResponsibilityTrace

**Status:** experimental integration layer  
**Scope:** exact post-provenance transition-effect observation and responsibility-chain traceability without causal, legal or moral adjudication.

## Why this layer exists

After `ProvenanceCompletionReceipt`, the integration chain can prove the declared machine-semantic origin and preserve exact upstream evidence bytes. That still does not answer a later question:

> What was observed after the completed chain, and through which accepted responsibility context can that observation be traced?

This layer answers that narrow question without converting chronology or provenance into generalized causality.

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
```

## Existing PoAI invariant preserved

The repository's earlier experimental `PoAIObservedOutcomeSidecar` established the distinction:

```text
verification report != outcome observation != causal attribution != responsibility
```

It also uses non-certifying causal states such as `associated_not_proven`.

The integration layer preserves that separation. It does not replace or silently upgrade the sidecar. Instead it adds exact RFC 8785 JCS + SHA-256 lineage to the completed integration evidence chain.

## OutcomeObservationReceipt

The v0.1 observation is intentionally narrow. It performs a later independent readback from the local Git object database after provenance completion.

It verifies:

- the exact completed provenance receipt;
- the exact predecessor CommitReceipt and ObservationReceipt;
- exact action / target / operation / responsible party / executor continuity;
- exact successor revision, commit and tree;
- exact changed paths;
- object identity for every changed path at the successor commit;
- that the observation time is after provenance completion.

Its positive relation is:

```text
effect_relation = exact_state_transition_effect
```

This means only that the observed local successor contains the exact state-transition effect already identified by the execution lineage.

It does **not** mean that every later external event was caused by that action.

Therefore:

```text
exact transition effect observed = true
external consequence causality established = false
causal proof certified = false
```

## Why exact transition effect is not generalized causality

For a Git state transition, it is possible to establish a narrow identity relation:

```text
approved transition
  -> concrete successor commit/tree
  -> concrete changed path/object
```

That relation is stronger than mere temporal association for those exact repository bytes.

But it is still bounded. It says nothing by itself about downstream human, organizational, economic, legal or physical consequences.

The causal boundary is therefore explicit:

```text
causal_status = not_assessed_beyond_transition
alternative causes assessed = false
```

## ResponsibilityTrace

`ResponsibilityTrace` binds:

- the exact ProvenanceCompletionReceipt;
- the exact OutcomeObservationReceipt;
- the exact same-execution ResponsibilityHandoffResult;
- the exact ResponsibilityHandoffOffer;
- the exact ResponsibilityHandoffAcceptance.

It then checks that:

- all three responsibility artifacts match the digests already preserved by provenance completion;
- the responsible party is unchanged;
- the executor is unchanged;
- action and target are unchanged;
- the accepted responsibility scope is unchanged;
- the originating action is actually present in that accepted scope.

A positive trace may establish:

```text
responsibility_chain_traceable = true
responsible_party_execution_context_bound = true
accepted_responsibility_scope_preserved = true
```

The attribution status remains:

```text
responsibility_attribution_status = traceable_not_adjudicated
```

This is a traceability claim, not a finding of blame or liability.

## Scope intersection

The v0.1 trace only makes one positive responsibility-scope intersection:

```text
scope_intersection = [originating action]
```

It does not silently expand accepted responsibility from the action to every consequence that may later be associated with the event.

This prevents:

```text
responsibility for executing action
  != responsibility for every downstream consequence
```

## Assurance boundary

A successful trace MUST keep false:

```text
external_consequence_causality_established
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

Core invariant:

```text
observed exact effect
  != generalized causality
  != adjudicated responsibility
  != legal liability
  != moral blame
  != truth
```

## Fail-closed behavior

The live suite rejects:

- provenance-completion substitution;
- predecessor ObservationReceipt / CommitReceipt substitution;
- successor revision/tree/effect substitution;
- observation before provenance completion;
- handoff ref/digest substitution;
- responsible-party, executor, action, target or operation substitution;
- responsibility-scope substitution;
- causal overclaim;
- inherited legal overclaim.

The JSON Schema independently rejects attempts to set causal, legal, moral, remote, PoAI or universal-canonicality claims to true.

## Relationship to future consequence tracing

This layer deliberately begins with an exact local transition effect because it has a deterministic evidence boundary.

Future layers may accept external consequence observations, but they must preserve the distinction between:

- direct machine transition effect;
- temporal association;
- statistical association;
- causal hypothesis;
- causal proof;
- responsibility adjudication.

## Continuation invariant

The next layer is **`CausalAttributionAssessment`**.

It should model competing causal hypotheses, supporting and contradicting evidence, alternative causes, evidence horizon and uncertainty without turning an assessment score or association into certified causality, legal liability or moral blame.
