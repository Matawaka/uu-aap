# ResponsibilityEventSuccessorAppend v0.1

## Status

Experimental integration protocol for **generic typed successor growth** after the durable genesis append established by `ResponsibilityEventAppendLedger v0.1`.

Canonical predecessor at introduction:

- main commit `45df91e7af277a76310df5723a0d5a43c7dea53f`
- durable ledger genesis entry sequence `0`
- responsibility-event head sequence `6`

KONTUR is outside this profile.

## Architectural boundary

```text
ResponsibilityEventChain events 0..5
        |
ResponsibilityEventAppendReceipt event 6
        |
ResponsibilityEventAppendLedgerEntry sequence 0
        |
ResponsibilityEventAppendLedgerReobservationReceipt
        |
ResponsibilityEventSuccessorAppendReceipt event 7
        |
ResponsibilityEventSuccessorLedgerEntry sequence 1
        |
ResponsibilityEventAppendLedgerReobservationReceipt
        |
ResponsibilityEventSuccessorAppendReceipt event 8
        |
ResponsibilityEventSuccessorLedgerEntry sequence 2
        |
        ...
```

The protocol separates:

```text
durable persistence/recovery
!=
generic indefinite successor semantics
```

The first guarantee was introduced by the predecessor ledger. This layer adds the second while preserving the first.

## ResponsibilityEventSuccessorPolicy

Reference policy:

`urn:uu-aap:responsibility-event-successor-policy:local-ledger:1`

It does not reinterpret the predecessor storage policy. Instead it references the exact predecessor policy identity and requires an exact binding to those policy bytes in every successor artifact.

Core invariants:

- typed source required;
- exact predecessor ledger entry required;
- exact predecessor event head required;
- successor sequence increment exactly `+1`;
- semantic binding immutable;
- effect frontier immutable;
- source binding exact;
- source stage time monotonic;
- assurance evolution monotonic and adapter-defined;
- deterministic event and receipt identity;
- no scalar responsibility/probability score.

## Typed source adapters

A successor cannot be created from arbitrary JSON.

v0.1 allows exactly one adapter:

`responsibility_event_append_ledger_reobservation_v0.1`

It consumes:

`ResponsibilityEventAppendLedgerReobservationReceipt v0.1`

The receipt is produced only after replay of immutable committed ledger entries. It binds:

- exact storage policy;
- exact successor policy;
- exact current head entry;
- exact authoritative successor head;
- entry count;
- recovered accepted append/event identity sets;
- a digest of the reobserved ledger history frontier;
- observation time later than the current head commit.

This source is a maintenance observation. It explicitly does **not** establish a new external consequence.

Future source adapters may consume a real typed `ConsequenceObservationReceipt` or another independently specified source without changing the core predecessor/sequence/digest rules.

## Generic successor event

For predecessor event head `n >= 6`, the next event is always:

```text
sequence = n + 1
predecessor_event_digest = exact digest of event n
```

For the v0.1 ledger-reobservation adapter:

```text
event_kind = responsibility_event_append_ledger_reobserved
stage_time = source receipt observed_at
```

The event inherits the exact predecessor:

- semantic binding;
- effect frontier;
- established assurance snapshot.

The only new positive assurance flag added by this adapter is:

`durable_ledger_head_reobserved = true`

No previously false causal, legal, moral, truth, external-consequence, global replay or distributed-consensus claim may become true.

## Durable successor ledger entries

Historical genesis remains:

`ResponsibilityEventAppendLedgerEntry v0.1`, sequence `0`.

All subsequent entries are:

`ResponsibilityEventSuccessorLedgerEntry v0.1`, sequence `1+`.

Recovery therefore validates a heterogeneous but strictly typed history:

1. entry `0` with the original #239 validator;
2. every later entry with the successor validator;
3. exact previous entry digest continuity;
4. exact predecessor event head continuity;
5. exact policy and base-chain continuity;
6. unique accepted append receipt identity;
7. unique event ID and event digest;
8. contiguous ledger sequence;
9. contiguous event sequence.

The physical storage protocol remains:

```text
writer lock
-> temporary create/write
-> fsync(file)
-> atomic rename
-> fsync(entries directory)
-> full recovery validation
```

There is no authoritative mutable `HEAD.json`.

The authoritative head is derived only by replay of immutable committed entry files.

## Stale observation versus stale commit

A reobservation receipt may remain a valid historical observation after a later successor is committed.

It cannot become a valid fork:

- successor receipt binds its predecessor entry/head;
- successor ledger commit acquires the writer lock;
- the ledger is replayed again under that lock;
- the candidate predecessor must equal the newly recovered current head;
- a stale candidate therefore fails closed.

Thus:

```text
historical observation validity
!=
current append admissibility
```

## CI profile

The reference test proves:

1. frozen six-event chain;
2. predecessor event `6` and durable genesis ledger entry `0`;
3. disk reobservation;
4. generic event `7` and durable entry `1`;
5. separate-process recovery to event `7`;
6. second disk reobservation;
7. generic event `8` and durable entry `2`;
8. separate-process recovery to event `8`;
9. exact event `7 -> 8` predecessor digest linkage;
10. replay/fork/corruption fail-closed behavior.

The test intentionally creates no fictional external consequence.

## Assurance boundary

This layer may establish:

- generic typed successor append semantics;
- sequential growth beyond event `6`;
- exact predecessor-linked event lineage;
- durable multi-entry local replay protection;
- recovered authoritative local successor head;
- typed source adapter enforcement.

It does **not** establish:

- global replay protection;
- distributed consensus;
- a new external consequence;
- generalized external consequence causality;
- causal proof;
- responsibility adjudication;
- legal liability or legal effect;
- moral blame or moral correctness;
- truth certification;
- PoAI MaterializationEvent;
- universal canonicality.

## Continuation

After this protocol is merged, a future real `ConsequenceObservationReceipt` can be introduced as a new typed source adapter **only when an actual consequence becomes observable**.

The generic successor machinery should not fabricate such a consequence merely to advance the chain.
