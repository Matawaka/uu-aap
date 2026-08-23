# KONTUR Responsibility Ledger Read-Only Replica v0.1

**Status:** experimental continuity layer  
**Scope:** non-authoritative, hash-sealed replication of an already committed KONTUR Responsibility Ledger chain.

## Purpose

The KONTUR Responsibility Ledger already derives authority only from the complete validated immutable entry chain. A continuity replica must preserve those bytes without becoming another writer or another authority source.

This layer therefore implements:

```text
validated source entry chain
        |
        v
read-only revalidation without source directory creation or writer lock
        |
        v
exact committed entry-byte copy
        |
        v
source stability re-check
        |
        v
independent replica-chain revalidation
        |
        v
hash-sealed replica manifest
        |
        v
atomic publication into replica storage
```

## Source boundary

The replica tool does not call the normal `recoverLedger()` path against the source because that function may ensure/create ledger directories. Instead it reads only `entries/`, validates each committed entry with `validateLedgerEntry()`, validates sequence/predecessor/nonces, and computes exact file hashes.

It does not:

- acquire the source writer lock;
- create source directories;
- create source temporary files;
- write a source `HEAD`;
- append responsibility events;
- invoke the Responsibility Kernel;
- invoke activation/preflight/executor paths.

If the validated source entry set changes between the pre-copy and post-copy observation, capture fails closed and the temporary replica is discarded.

## Replica layout

A published snapshot is stored under:

```text
<replica-root>/snapshots/<snapshot-id>/
  NON_AUTHORITATIVE_REPLICA
  ledger-policy.json
  replica-manifest.json
  entries/
    <exact committed entry files>
```

The snapshot ID binds the ledger ID, source sequence/head, exact entry-set hash and ledger-policy file hash.

The manifest binds:

- ledger ID;
- entry count;
- source/recovered head digest;
- every entry filename, byte size and SHA-256;
- exact ledger-policy file bytes;
- entry-set SHA-256;
- self digest using RFC8785-JCS + SHA-256;
- explicit non-authority claims.

## Authority boundary

A positive replica verification may establish only:

- source committed entry chain validated at capture time;
- exact committed entry bytes copied;
- source remained stable across the copy window;
- copied chain independently revalidated;
- replica head matches captured source head;
- replica manifest/file hashes are internally consistent.

It must keep false:

```text
replica_authoritative
execution_authority_granted
distributed_consensus_established
kontur_activated
canonical_successor_created
legal_effect_established
truth_certified
```

Core invariant:

```text
replica preserved
!= responsibility authority duplicated
!= second KONTUR instance activated
!= consensus established
```

`hash-sealed` here means content-addressed and hash-verified. It does not claim filesystem immutability, tamper-proof hardware, legal custody, or remote consensus.

## CLI

Create a snapshot:

```bash
node server/kontur/v0.1/responsibility-ledger-replica.js create \
  <source-ledger-root> \
  server/kontur/v0.1/policies/reference-server.responsibility-ledger-policy.json \
  <replica-root>
```

Verify an existing snapshot:

```bash
node server/kontur/v0.1/responsibility-ledger-replica.js verify \
  <replica-root>/snapshots/<snapshot-id>
```

Before future live activation, at least one replica should reside in a failure domain independent of the live ledger host. This document does not activate that requirement automatically and does not start KONTUR.
