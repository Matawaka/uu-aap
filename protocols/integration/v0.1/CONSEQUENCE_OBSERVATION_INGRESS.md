# UU-AAP Integration v0.1 — ConsequenceObservationIngress

**Status:** experimental integration layer  
**Scope:** intake and exact binding of downstream consequence observation claims without certifying the consequence, causality, responsibility, law, morality, truth or canonicality.

## Position

```text
ResponsibilityEventChain
  -> ResponsibilityEventAppendLedger
  -> ResponsibilityEventSuccessorAppend (7+)
  -> ConsequenceObservationClaim
  -> ConsequenceObservationIngressReceipt
  -> [future] ConsequenceObservationAssessment
```

KONTUR is outside this layer and remains frozen.

## Why this is separate from OutcomeObservationReceipt

`OutcomeObservationReceipt` observes the exact local Git transition effect already present in the execution lineage. It deliberately does not establish downstream external consequences.

The older `PoAIObservedOutcomeSidecar` is also non-certifying and keeps its observed-outcome claims false.

Therefore neither artifact is silently widened. A later organizational, economic, physical, legal, human or other downstream observation first enters through this new claim boundary.

## Core invariant

```text
claim accepted
  != consequence observed as established fact
  != admissible consequence evidence
  != causal attribution
  != responsibility attribution
  != adjudication
```

`claimed_status = observed` means only that the claimant declares an observation.

The ingress receipt always keeps:

```text
new_external_consequence_observed = false
consequence_truth_certified = false
generalized_external_consequence_causality_established = false
causal_proof_certified = false
responsibility_for_consequence_attributed = false
responsibility_for_outcome_adjudicated = false
legal_liability_established = false
legal_effect_established = false
moral_blame_assigned = false
truth_certified = false
```

## ConsequenceObservationClaim v0.1

The claim records:

- environment: `live | test_fixture`;
- claimant declaration: `self_declared | undisclosed`;
- consequence class;
- consequence subject reference;
- claimed status;
- claim time;
- optional observation time;
- evidence cutoff;
- observation method;
- evidence references;
- the exact responsibility-event head that the claim concerns.

For `claimed_status = observed`, an observation time and at least one evidence reference are mandatory.

The claim itself cannot contain positive causal, responsibility, legal, moral or truth conclusions.

## Exact frontier binding

The claim copies the exact current responsibility-event head:

- sequence;
- event ID;
- event digest;
- semantic binding;
- effect frontier.

The ingress also digest-binds the exact frontier ledger entry. A claim about a different semantic target or effect cannot be accepted by simply reusing a similar event number.

## ConsequenceObservationIngressReceipt v0.1

A successful ingress establishes only:

```text
consequence_observation_claim_well_formed = true
claim_provenance_bound = true
observation_horizon_bound = true
responsibility_event_frontier_bound = true
ingress_accepted = true
```

It does not become a successor event source in this version.

## Test fixture boundary

CI includes a clearly marked `test_fixture` claim with `claimed_status = observed` only to exercise mandatory evidence and chronology rules. That fixture is never appended to the responsibility-event ledger and its ingress receipt still has `new_external_consequence_observed = false`.

The live positive profile uses `not_yet_observable` and `indeterminate` claims.

## Fail closed

The layer rejects:

- observed claims without evidence or observation time;
- future observation time relative to claim;
- evidence cutoff after claim;
- duplicate evidence references;
- unsupported class/status/method;
- responsibility-event head substitution;
- semantic/effect frontier drift;
- claim/claimant identity substitution;
- policy/claim/frontier binding substitution;
- receipt chronology inversion;
- causal/responsibility/legal/moral/truth/global-replay overclaims;
- scalar probability/confidence/responsibility fields.

## Next layer

`ConsequenceObservationAssessment` should evaluate an accepted ingress claim against a versioned admissibility policy and exact evidence bindings. Only a separately qualified assessment may later become a typed source adapter for a successor-policy version or migration.

No automatic policy widening occurs here.
