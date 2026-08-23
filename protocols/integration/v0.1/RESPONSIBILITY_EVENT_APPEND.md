# UU-AAP Integration v0.1 — ResponsibilityEventChain Reobservation and Append

**Status:** experimental integration layer  
**Scope:** first successor extension of the immutable `ResponsibilityEventChain v0.1` without rewriting the six-event base snapshot.

## Architectural position

```text
ResponsibilityAttributionAssessment
  -> ResponsibilityEventChain
  -> ResponsibilityEventChainReobservationReceipt
  -> ResponsibilityEventAppendReceipt
```

KONTUR is not part of this profile.

## Why the first appended event is reobservation

The project does not invent a later external consequence merely to demonstrate append mechanics. The first genuinely new machine fact available after a chain exists is a later serialized readback and full revalidation of that exact chain.

Therefore event 7 is:

```text
sequence = 6
event_kind = responsibility_event_chain_reobserved
source = ResponsibilityEventChainReobservationReceipt
```

This means only that the already-created responsibility-event chain was re-read and remained internally valid.

```text
chain reobservation
!= new external consequence
!= causal proof
!= responsibility adjudication
!= legal liability
!= moral blame
```

## Frozen base chain

`ResponsibilityEventChain v0.1` remains exactly six events with head sequence `5`.

The append layer does **not** emit a replacement seven-event `ResponsibilityEventChain` and does not edit the original artifact. Instead it binds the entire base-chain artifact and its exact head, then proves one successor event.

```text
immutable base chain + successor receipt
!= mutable log append
```

## ResponsibilityEventChainReobservationReceipt

The reobservation API accepts serialized JSON bytes, parses them into a new object and then reruns the canonical `validateResponsibilityEventChain` verifier against all six exact predecessor source artifacts.

A valid receipt binds:

- exact base-chain artifact bytes using RFC 8785 JCS + SHA-256;
- exact chain ID;
- exact internal chain digest;
- exact head sequence/event ID/event digest;
- exact semantic frontier;
- exact transition-effect frontier.

It requires:

```text
ResponsibilityEventChain.built_at < ReobservationReceipt.observed_at
```

A positive receipt may establish only:

```text
responsibility_event_chain_reobserved = true
chain_integrity_reverified = true
```

It explicitly keeps false new external consequence observation, generalized causality, causal proof, adjudicated responsibility, legal liability, moral blame, truth and stronger canonicality/PoAI claims.

## ResponsibilityEventAppendReceipt

The append receipt binds exact bytes of:

1. the immutable base `ResponsibilityEventChain`;
2. the exact `ResponsibilityEventChainReobservationReceipt`.

It then derives exactly one appended event:

```text
sequence = 6
event_kind = responsibility_event_chain_reobserved
stage_time = ReobservationReceipt.observed_at
predecessor_event_digest = baseChain.head.event_digest
```

The new event preserves the complete assurance snapshot from base event 5 and adds only:

```text
chain_integrity_reobserved = true
```

All strong false invariants stay false.

## Extension identity

The appended event has its own canonical event digest. The receipt records:

```text
base_chain_binding
base_head
source_reobservation_binding
appended_event
extended_head
extension_digest
append_receipt_id
```

The extension digest binds the base artifact, base head, source receipt and appended event identity/digest. Mutation of any predecessor or appended payload invalidates the extension.

## Replay semantics

v0.1 deliberately does not claim a distributed replay ledger.

Instead:

```text
mode = deterministic_idempotent_same_inputs
distinct_duplicate_identity_permitted = false
global_replay_protection_established = false
```

With identical base chain, reobservation and append time, rebuilding the append produces the same receipt identity and extension digest. A later globally unique append ledger may add stronger replay guarantees.

## Temporal boundary

The local logical order is:

```text
baseChain.built_at
  < reobservation.observed_at
  < appendReceipt.appended_at
```

This does not establish complete global wall-clock chronology across all historical or external events.

## No scalar probability/blame model

The reobservation and append layers reject uncalibrated fields including:

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

Sequence `6` is structural metadata, not a probability or responsibility score.

## Strong non-claims

Both artifacts keep false:

- new external consequence observed;
- generalized external consequence causality;
- universal causal truth;
- causal proof;
- responsibility adjudication;
- legal responsibility/liability/effect;
- moral blame/correctness;
- truth certification;
- complete global wall-clock chronology;
- remote branch/ref canonicality;
- PoAI MaterializationEvent;
- PoAI successor identity inference;
- universal canonicality;
- PoAI/V conformance.

## What this proves

After this layer, the architecture has demonstrated two different immutability properties:

1. historical events inside the six-event chain cannot be edited without invalidating the chain;
2. evolution beyond that snapshot can occur through a separately digest-bound successor receipt without mutating the base chain.

This is the primitive required for an indefinitely growing responsibility/consequence trace.

## Next stage

The next main-line layer should introduce `ConsequenceObservationReceipt v0.1` only for a genuinely new observed consequence. Once such an observation exists, it can be appended through the same successor mechanism rather than changing earlier history.
