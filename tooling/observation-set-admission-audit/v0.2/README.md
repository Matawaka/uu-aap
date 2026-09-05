# Observation Set Admission Audit v0.2

**Status:** read-only reusable-component admission assessment  
**Tracking:** #911  
**Origin main:** `552d0f293efaffd6c62c69d415fae17d7c5aff9a`

## Question

Merged #910 proved that two independent adapters — C2PA authority-observability and Public Review external-source observation — directly invoke the same candidate Observation Set Calculus implementation.

This audit asks what that evidence actually admits.

It deliberately does **not** treat the candidate package as one indivisible component.

## Result

```text
ObservationSet
  -> ELIGIBLE_EXPERIMENTAL_INTERFACE_ADMISSION

ObservationSetTransition
  -> DEFER_SECOND_DOMAIN_DIRECT_REUSE

LocalObservationSetChain
  -> DEFER_SECOND_DOMAIN_DIRECT_REUSE

monolithic Observation Set Calculus Candidate
  -> DEFER_SPLIT_REQUIRED

Stable Core
  -> NO_CORE_ADMISSION
```

Overall:

`PARTIAL_ADMISSION_ELIGIBLE_SET_ONLY_NO_CORE_ADMISSION`

## Why Set qualifies

The historical Reusable Component Admission Audit v0.1 requires:

1. at least two genuinely independent current consumer families;
2. no adequate existing reusable interface already covering the same need.

Merged #910 now proves two direct consumers of the same `evaluate_set` implementation bytes and receipt schema:

- C2PA authority-observability;
- Public Review external-source observation.

The set contract also contributes a distinct bounded invariant not supplied by the already accepted observation/provenance substrate:

```text
scope-bound observation multiset identity
+ semantic observation identity distinct from exact source binding
+ deterministic duplicate multiplicity
+ order-independent semantic set fingerprint
+ exact-input fingerprint distinct from semantic set fingerprint
```

Ambient Observability, Circumstantial Provenance and Event-Hash Minimalism remain reusable dependencies/adjacent substrate; they are not replaced.

`Existing Observation Semantics != Deterministic Scoped Observation-Set Identity`.

## Why Transition and Chain do not qualify yet

C2PA directly consumes:

```text
evaluate_set
evaluate_transition
evaluate_chain
```

Public Review currently consumes only:

```text
evaluate_set
```

because there is no second comparable accepted Public Review checkpoint. Merged #910 correctly refused to invent chronology just to exercise syntax.

Therefore:

```text
Two Consumers of Set != Two Consumers of Transition
Two Consumers of Set != Two Consumers of Chain
```

Transition and Chain remain implemented candidates with one proven direct consumer family.

## Why the monolithic package is not admitted

Registering the complete `Observation Set Calculus Candidate v0.1` would silently promote APIs whose independent-demand threshold has not been met.

The safe architecture consequence is to split admission scope:

```text
candidate package
   ├─ ObservationSet                 -> eligible
   ├─ ObservationSetTransition       -> defer
   └─ LocalObservationSetChain       -> defer
```

A later registry successor must expose only the set interface if admission is chosen. It must not imply transition/chain registry status merely because those functions live in the same source file today.

## Registry boundary

Interface Registry v0.2 already establishes that an `experimental` registry entry:

```text
!= published release
!= Stable Core
!= automatic next-interface transition
!= authority creation
```

This audit establishes **eligibility only**. It does not modify any registry file.

Next safe action:

`MATERIALIZE_SET_ONLY_EXPERIMENTAL_INTERFACE_REGISTRY_DELTA`

That is a separate successor and a separate architectural status mutation.

## Validation

The validator:

- validates the closed assessment schema;
- byte-checks ten exact source bindings;
- re-executes merged #910 two-domain proof;
- re-reads the exact #764 admission threshold;
- verifies C2PA direct set/transition/chain use and Public Review set-only use;
- verifies current Interface Registry v0.2 remains experimental/non-Core;
- preserves current Ambient Observability, Circumstantial Provenance and Event-Hash Minimalism semantic markers;
- refuses monolithic, transition or chain overpromotion;
- requires every audit non-effect to remain false.

The hostile suite rejects premature registration, fabricated second consumers, Stable Core escalation, source substitution, automatic registry mutation and external-effect claims.

## Non-effects

No Interface Registry mutation, Stable Core/SPEC/PRINCIPLES mutation, C2PA reclassification, Public Review admission/disposition, KONTUR activation, LSR actuation, ActionPermit, Workbench reactivation, release/tag/publication authority or external effect is created.

`Admission Audit != Admission Mutation`.

`Experimental Eligibility != Stable Core`.
