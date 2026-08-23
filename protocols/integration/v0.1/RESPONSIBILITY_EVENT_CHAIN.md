# UU-AAP Integration v0.1 — ResponsibilityEventChain

**Status:** experimental integration layer  
**Scope:** append-only, digest-linked preservation of successive responsibility-relevant machine events without collapsing the sequence into causal proof, probability, legal liability or moral blame.

## Architectural position

```text
OutcomeObservationReceipt
  -> ResponsibilityTrace
  -> CausalAttributionAssessment
  -> CounterfactualInterventionAssessment
  -> CausalClaimQualification
  -> ResponsibilityAttributionAssessment
  -> ResponsibilityEventChain
```

The chain does not replace any predecessor artifact. It preserves them as independently digest-bound historical events.

## Why a chain is a separate artifact

The preceding layers answer progressively different questions:

- what exact transition was observed;
- whether an accepted responsibility chain can be traced;
- what bounded causal hypotheses are supported;
- what a declared structural intervention model shows;
- which causal predicates may be qualified;
- whether a qualified causal contribution falls inside accepted responsibility scope.

A later answer does not rewrite an earlier answer.

```text
later evidence
!= retroactive upgrade of earlier assurance
```

`ResponsibilityEventChain` makes that monotonicity machine-verifiable.

## Reference v0.1 event sequence

The reference chain contains six already-existing typed events. It deliberately does **not** invent a fictional future consequence merely to demonstrate append behavior.

| Sequence | Event kind | Exact source artifact |
| ---: | --- | --- |
| 0 | `exact_transition_observed` | `OutcomeObservationReceipt` |
| 1 | `responsibility_chain_traced` | `ResponsibilityTrace` |
| 2 | `bounded_causal_association_assessed` | `CausalAttributionAssessment` |
| 3 | `counterfactual_intervention_assessed` | `CounterfactualInterventionAssessment` |
| 4 | `causal_predicates_qualified` | `CausalClaimQualification` |
| 5 | `bounded_responsibility_attributed` | `ResponsibilityAttributionAssessment` |

Each source artifact is bound using RFC 8785 JCS + SHA-256.

## Event record

Every event records:

```text
sequence
event_id
event_kind
stage_time
source_binding
semantic_binding
effect_frontier
predecessor_event_digest
assurance_snapshot
event_digest
```

The event digest is computed over the complete event payload except `event_digest` itself.

The genesis event has:

```text
predecessor_event_digest = null
```

Every later event must contain the exact digest of the immediately preceding event.

Therefore changing a historical event invalidates:

1. that event's digest;
2. the next event's predecessor digest;
3. transitively the chain head;
4. the chain digest.

This is the append-only property of v0.1.

## Exact shared frontier

All six events must preserve one exact semantic tuple:

```text
action
target
operation_ref
base_revision
responsible_party_id
executor_implementation_id
```

They also preserve one exact transition-effect frontier:

```text
scope = exact_local_git_transition_effect
relation = exact_state_transition_effect
revision
commit_sha
tree_sha
changed_paths
effect_objects
```

The chain re-verifies the predecessor bindings already present among the six artifacts rather than trusting coincidentally equal copied fields.

## Historical assurance snapshots

Each event receives a common assurance vocabulary. Positive knowledge grows only when the corresponding typed predecessor stage exists.

### Event 0 — observation

```text
outcome_observed = true
responsibility_chain_traceable = false
bounded_causal_association_supported = false
model_relative_intervention_sensitivity_assessed = false
bounded_causal_predicates_qualified = false
policy_relative_responsibility_attribution_established = false
```

### Event 1 — responsibility trace

Adds only:

```text
responsibility_chain_traceable = true
```

It remains `traceable_not_adjudicated`.

### Event 2 — bounded causal assessment

Adds:

```text
bounded_causal_association_supported = true
```

It does not establish necessary, sufficient, exclusive or universal causality.

### Event 3 — counterfactual intervention assessment

Adds:

```text
model_relative_intervention_sensitivity_assessed = true
```

The structural model remains incomplete and is not real-world causal proof.

### Event 4 — causal qualification

Adds:

```text
bounded_causal_predicates_qualified = true
```

The qualified predicates remain policy- and scope-relative.

### Event 5 — responsibility attribution

Adds:

```text
policy_relative_responsibility_attribution_established = true
```

This still does not establish legal liability, adjudicated responsibility or moral blame.

## Strong false invariants at every event

The common assurance snapshot keeps false throughout the chain:

```text
generalized_external_consequence_causality_established
causal_proof_certified
responsibility_adjudicated
legal_liability_established
moral_blame_assigned
truth_certified
```

A later event cannot flip one of these fields in an earlier event.

## Chain head and chain digest

The chain records:

```text
head.sequence
head.event_id
head.event_digest
chain_digest
```

`chain_digest` binds:

- chain profile;
- chain build time;
- exact semantic frontier;
- exact effect frontier;
- ordered sequence of event IDs and event digests.

This makes omission, reordering and in-place rewriting independently detectable.

## Temporal semantics

The reference six-stage sequence enforces strict local stage order:

```text
OutcomeObservation.observed_at
  < ResponsibilityTrace.traced_at
  < CausalAttribution.assessed_at
  < CounterfactualIntervention.assessed_at
  < CausalClaimQualification.qualified_at
  < ResponsibilityAttribution.assessed_at
  < ResponsibilityEventChain.built_at
```

This is **logical/local stage chronology** for the reference integration harness.

It is not evidence of complete global wall-clock chronology across every earlier synthetic or external event.

Therefore:

```text
local_stage_order_established = true
complete_global_wall_clock_chronology_established = false
```

## No probability or blame score

v0.1 rejects scalar fields such as:

```text
probability
likelihood
percentage
confidence_score
causal_score
responsibility_score
blame_score
weight
rating
```

Sequence numbers and event counts are deterministic structural metadata, not probability or responsibility scores.

The chain therefore supports a future probability model without pretending that an uncalibrated numeric value is already justified.

## Chain-level claims

A passing reference chain may establish:

```text
multi_event_responsibility_trace_established = true
append_only_digest_chain_established = true
exact_transition_effect_frontier_preserved = true
historical_assurance_snapshots_preserved = true
local_stage_order_established = true
```

It must keep false:

```text
complete_global_wall_clock_chronology_established
generalized_external_consequence_causality_established
universal_causal_truth_established
causal_proof_certified
responsibility_for_outcome_adjudicated
legal_responsibility_determined
legal_liability_established
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

## What append-only means in v0.1

The current schema intentionally freezes the canonical reference sequence at six real events. It proves the hash-linked chain primitive without fabricating a seventh event.

A later protocol layer may extend the chain only through an explicit successor artifact such as:

```text
ResponsibilityEventAppendReceipt
```

or a genuinely new typed observation such as:

```text
ConsequenceObservationReceipt
```

That successor must bind the previous chain head/digest and the exact new source artifact. It must not mutate the v0.1 chain snapshot in place.

Thus:

```text
append-only evolution
!= mutable log append
```

The old chain remains an immutable historical snapshot; the successor proves extension from it.

## Fail-closed behavior

The reference test rejects, among other cases:

- missing events;
- duplicated or reordered event kinds;
- sequence-index substitution;
- predecessor digest discontinuity;
- source artifact ref/digest substitution;
- semantic/effect frontier drift;
- source stage-time substitution;
- local temporal inversion;
- retroactive assurance upgrade;
- event digest substitution;
- chain head substitution;
- chain digest or chain ID substitution;
- historical event mutation without downstream rechaining;
- causal proof escalation;
- responsibility adjudication escalation;
- legal liability or moral blame escalation;
- scalar probability/responsibility/blame fields.

## KONTUR boundary

This layer is part of the main integration protocol line only.

```text
ResponsibilityEventChain work
!= KONTUR activation work
```

The KONTUR implementation remains frozen. No `server/kontur/**` mutation is part of this layer.

## Continuation invariant

After the reference append-only primitive is merged, the next main-line step should add a typed successor-extension mechanism for genuinely new events, with a strong preference for:

```text
ResponsibilityEventAppendReceipt
```

combined with a new observed consequence source rather than a synthetic duplicate assessment.

No auto-merge. Human squash merge remains final.
