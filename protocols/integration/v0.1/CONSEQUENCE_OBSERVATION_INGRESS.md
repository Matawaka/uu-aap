# UU-AAP Integration v0.1 — ConsequenceObservationIngress

**Status:** experimental integration layer  
**Scope:** intake and exact binding of downstream consequence observation claims without certifying consequence existence, causality, responsibility, law, morality, truth or canonicality.

## Position

```text
ResponsibilityEventChain
  -> ResponsibilityEventAppendLedger
  -> ResponsibilityEventSuccessorAppend (7+)
  -> ConsequenceObservationSourceEvidence
  -> ConsequenceObservationClaim
  -> ConsequenceObservationIngressReceipt
  -> ConsequenceObservationSuccessorAdapter (blocked in v0.1)
  -> [future] source-specific consequence adapter / assessment
```

KONTUR is outside this layer and remains frozen.

## Core distinction

```text
ingress capability
  != consequence observed

source bytes bound
  != source semantics trusted

claim accepted
  != consequence established as fact

claim accepted
  != successor adapter authorized

observation
  != causal attribution
  != responsibility attribution
  != adjudication
  != legal liability
  != moral blame
  != truth
```

The generic ingress is intentionally non-certifying.

## Why this is separate from OutcomeObservationReceipt

`OutcomeObservationReceipt` observes the exact local Git transition effect already present in the execution lineage. It does not establish downstream organizational, economic, physical, human, legal or other consequences.

That earlier artifact is not widened. A later downstream observation must enter through this separate boundary.

## ConsequenceObservationSourceEvidence v0.1

A claim with `claimed_status = observed` must provide exact source bytes through a typed wrapper containing:

- producer ID;
- producer artifact type/version/ref;
- capture time;
- `observation_present`;
- `test_fixture_only`;
- source payload;
- RFC8785-JCS / SHA-256 digest of the exact payload.

The wrapper establishes only that the supplied bytes are bound to the declared producer metadata. It does **not** establish that the producer is authoritative or that the payload is true.

```text
source_bytes_digest_bound = true
producer_identity_declared = true
external_consequence_certified = false
causal_proof_certified = false
responsibility_for_consequence_attributed = false
legal_liability_established = false
moral_blame_assigned = false
truth_certified = false
```

Payload mutation or digest substitution invalidates the wrapper.

## ConsequenceObservationClaim v0.1

The claim records:

- environment: `live | test_fixture`;
- claimant declaration: `self_declared | undisclosed`;
- consequence class and subject reference;
- claimed status;
- claim / observation / evidence-cutoff times;
- observation method;
- evidence references;
- optional exact source-evidence binding;
- exact responsibility-event head;
- exact semantic frontier;
- exact effect frontier.

For `claimed_status = observed`:

- observation time is mandatory;
- at least one evidence ref is mandatory;
- exact `ConsequenceObservationSourceEvidence` bytes are mandatory;
- `observation_present` must be true;
- the exact producer artifact ref must occur in `evidence_refs`;
- a live claim cannot use a `test_fixture_only` source.

For `not_observed`, `not_yet_observable` or `indeterminate`, source-evidence binding must be null.

The claim itself cannot contain positive causal, responsibility, legal, moral or truth conclusions.

## Exact frontier binding

The ingress derives the current event context from the authoritative ledger entry and requires exact equality of:

- sequence;
- event ID;
- event digest;
- semantic binding;
- effect frontier.

The ingress receipt separately digest-binds the exact ledger entry, claim and source evidence when present.

A claim cannot be moved to another semantic target, effect or event head by changing only a reference.

## ConsequenceObservationIngressReceipt v0.1

A successful receipt establishes only bounded intake facts:

```text
consequence_observation_claim_well_formed = true
claim_provenance_bound = true
source_bytes_bound_if_present = true
observation_horizon_bound = true
responsibility_event_frontier_bound = true
ingress_accepted = true
successor_adapter_eligibility_evaluated = true
```

It always preserves:

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
global_replay_protection_established = false
distributed_consensus_established = false
poai_materialization_event_recorded = false
universal_canonicality_established = false
```

## Adapter boundary

`ConsequenceObservationSuccessorAdapter v0.1` is deliberately fail-closed.

The generic ingress policy does **not** register any source-specific adapter. Therefore every v0.1 ingress receipt must have:

```text
eligible_for_successor_adapter = false
```

with one of these reasons:

- `no_observation`;
- `test_fixture_only`;
- `source_specific_adapter_not_registered`.

The runtime adapter checks this boundary and refuses successor append.

This is intentional: a future real source requires its own versioned adapter policy/validator before it can become a `ResponsibilityEventSuccessorAppendReceipt` source.

## Test fixture boundary

CI exercises one `test_fixture` observed claim using a real canonical JSON payload and SHA-256 binding. This exists only to validate source-byte, chronology and schema behavior.

It is never appended to the responsibility-event ledger and is explicitly blocked with:

```text
adapter_eligibility.reason = test_fixture_only
eligible_for_successor_adapter = false
new_external_consequence_observed = false
```

The live capability-only cases remain `not_yet_observable` and `indeterminate`.

## Fail closed

The layer rejects, among other cases:

- observed claim without source bytes;
- payload/digest/source-ID substitution;
- fixture source used by a live observed claim;
- source ref absent from evidence refs;
- observed claim without observation time/evidence;
- future observation time;
- evidence cutoff after claim;
- unsupported class/status/method;
- responsibility-event head substitution;
- semantic/effect frontier drift;
- claim/claimant identity substitution;
- policy/claim/frontier/source binding substitution;
- generic adapter-eligibility escalation;
- receipt chronology inversion;
- causal/responsibility/legal/moral/truth/global-replay overclaims;
- scalar probability/confidence/responsibility fields.

## Next layer

When a genuine new consequence source becomes available, the next layer should introduce a **source-specific consequence adapter policy and validator**. It must bind exact source bytes and exact current responsibility-event frontier, then explicitly authorize a successor adapter without modifying historical successor-policy meaning.

Only that separate layer may convert a qualified observation into a new successor event.

No fictional consequence is introduced here. No automatic policy widening occurs here.
