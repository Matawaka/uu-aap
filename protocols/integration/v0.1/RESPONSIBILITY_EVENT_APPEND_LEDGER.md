# UU-AAP Integration v0.1 — ResponsibilityEventAppendLedger

**Status:** experimental integration layer  
**Scope:** locally durable, fail-closed persistence and replay protection for the first `ResponsibilityEventAppendReceipt` successor without changing the immutable base `ResponsibilityEventChain` or claiming distributed/global consensus.

## Architectural position

```text
ResponsibilityAttributionAssessment
  -> ResponsibilityEventChain
  -> ResponsibilityEventChainReobservationReceipt
  -> ResponsibilityEventAppendReceipt
  -> ResponsibilityEventAppendLedger
```

KONTUR is frozen and is not part of this profile.

## Why a durable append ledger is separate

The previous layer proves a deterministic successor event:

```text
base chain head sequence 5
  -> ResponsibilityEventAppendReceipt
  -> extended head sequence 6
```

But that receipt deliberately states:

```text
global_replay_protection_established = false
```

A deterministic receipt identity is not the same as a durable history that survives process restart and remembers which identities were already accepted.

Therefore:

```text
deterministic append identity
!= durable commit
!= recovered authoritative successor head
!= distributed consensus
```

`ResponsibilityEventAppendLedger v0.1` adds only the middle two local guarantees.

## v0.1 boundary: durable genesis append

The current append receipt format is intentionally frozen around the first successor:

```text
base ResponsibilityEventChain head = 5
append event sequence = 6
```

Ledger v0.1 does **not** silently generalize that format while simultaneously introducing persistence semantics.

This version therefore proves:

1. exact append receipt accepted once;
2. append receipt durably committed;
3. process restart can reconstruct the same successor head;
4. replay of the accepted receipt/event identity is rejected;
5. a second append that still points to the stale base head is rejected as a fork.

A later typed successor protocol may generalize event sequences `7, 8, ...` after this persistence primitive is stable.

## Policy-bound persistence

Reference policy:

```text
urn:uu-aap:responsibility-event-append-ledger-policy:local-filesystem:1
```

Reference ledger:

```text
urn:uu-aap:responsibility-event-append-ledger:reference-local-v0.1
```

The policy requires:

```text
storage_scope = local_filesystem_append_ledger
storage_model = immutable_entry_files
atomic_publication = temp_fsync_rename_dir_fsync
head_authority = validated_entry_chain_replay
replay_scope = ledger_local_history
corruption_mode = fail_closed
```

It also requires a writer lock, file fsync, entries-directory fsync, immutable committed files, exact predecessor continuity, duplicate identity rejection and full recovery validation.

## Self-contained historical bytes

The genesis ledger entry embeds the exact bytes needed to revalidate the accepted append after restart:

```text
ledger policy
frozen ResponsibilityEventChain
OutcomeObservationReceipt
ResponsibilityTrace
CausalAttributionAssessment
CounterfactualInterventionAssessment
CausalClaimQualification
ResponsibilityAttributionAssessment
ResponsibilityEventChainReobservationReceipt
ResponsibilityEventAppendReceipt
```

The entry independently re-runs the canonical validators against those embedded bytes.

This prevents future repository changes from silently changing the meaning of an already committed ledger entry.

## Ledger entry

`ResponsibilityEventAppendLedgerEntry v0.1` records:

```text
entry_id
ledger_id
sequence
committed_at
previous_entry_binding
ledger_policy + exact binding
validation_bundle
base_chain_binding
append_receipt_binding
predecessor_event_head
resulting_event_head
claims
entry_digest
```

Genesis uses:

```text
ledger sequence = 0
previous_entry_binding = null
predecessor_event_head.sequence = 5
resulting_event_head.sequence = 6
```

The ledger sequence is structural metadata. It is not a probability, responsibility or blame score.

## Atomic publication

Committed files are published using:

```text
writer lock
  -> create temp file
  -> write exact JSON bytes
  -> fsync(file)
  -> atomic rename into entries/
  -> fsync(entries directory)
  -> full recovery verification
```

The filename binds the sequence and entry digest:

```text
000000000000-<sha256>.json
```

Temporary files are not authoritative.

## No mutable authoritative HEAD

The ledger intentionally has no authoritative mutable `HEAD.json`.

Recovery:

1. enumerates only committed entry filenames in `entries/`;
2. rejects unknown/malformed committed names;
3. reparses every entry;
4. verifies filename/digest agreement;
5. revalidates embedded historical bytes;
6. verifies contiguous ledger sequence;
7. reconstructs accepted append/event identity sets;
8. derives the authoritative successor head from the validated final entry.

A forged `HEAD.json` at ledger root is ignored.

## Local replay protection

A successfully recovered ledger may establish:

```text
ledger_local_durable_replay_protection_established = true
authoritative_successor_head_recovered = true
accepted_append_identity_set_recovered = true
```

The ledger rejects a previously accepted:

- `append_receipt_id`;
- appended `event_id`;
- appended `event_digest`.

It also rejects a successor whose predecessor event head is not the current recovered head.

This is **ledger-local** replay/fork protection.

It is not:

```text
global_replay_protection
distributed_consensus
network consensus
universal canonicality
```

Those claims remain false.

## Corruption semantics

Any malformed or altered committed entry fails recovery closed.

Examples:

- committed JSON corruption;
- filename/digest mismatch;
- policy substitution;
- embedded base-chain mutation;
- append receipt mutation;
- entry digest mutation;
- sequence gap or duplicate;
- stale predecessor head;
- duplicate receipt/event identity.

The ledger does not skip corrupted history in order to continue.

## Assurance boundary

Persistence changes the durability of evidence, not the normative meaning of that evidence.

A positive ledger entry can establish:

```text
local durable commit
historical bytes bound
successor head derivable
ledger-local replay protection
```

It must keep false:

```text
new external consequence observed
global replay protection
distributed consensus
causal proof
responsibility adjudication
legal liability
moral blame
truth certification
universal canonicality
PoAI MaterializationEvent
```

Thus:

```text
durable evidence
!= stronger causal evidence
!= legal judgment
!= truth
```

## No scalar probability/blame model

The ledger recursively rejects fields named:

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
score
```

A future calibrated probability model must be a separate typed layer with explicit statistical semantics.

## CI profile

CI uses a runner-local temporary directory only.

Positive path:

```text
build frozen six-event chain
  -> reobserve chain
  -> build append receipt sequence 6
  -> build ledger entry 0
  -> atomic commit
  -> recover
  -> start separate Node process
  -> recover again
  -> compare exact entry digest and successor head
```

CI also writes a forged mutable `HEAD.json` and an uncommitted temp file and confirms that neither changes the recovered authoritative successor head.

No repository state is created by the test.

## Continuation

After this layer, the next main-line step should be a **generic typed successor append protocol** capable of extending the recovered head from sequence `6` to `7`, `8`, and beyond while binding each new typed source artifact.

Only after that generic successor path exists should a real `ConsequenceObservationReceipt` be appended when a genuinely new consequence becomes observable.

No fictional consequence is introduced by this ledger layer.
