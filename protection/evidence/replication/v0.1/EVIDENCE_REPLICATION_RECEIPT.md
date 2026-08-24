# Evidence Replication Receipt v0.1

## Purpose

`EvidenceReplicationReceipt v0.1` records a bounded observation that two explicitly described evidence sets are byte-equivalent.

It is designed for transfers between declared carriers after the bytes already exist. It does **not** copy files, create storage, open provider accounts, choose custodians, or grant authority.

## Core invariant

```text
byte-equivalent replicated evidence set
!= origin
!= canonical successor
!= authority transfer
!= custody transfer
!= truth certification
!= legal liability
!= physical independence proof
```

A positive receipt proves only that the two supplied, locally validated descriptor sets match exactly by canonical path, role, byte length, and SHA-256 and that their independently recomputed file-set digests are identical.

## Inputs

Each side is a `EvidenceFileSetSnapshot` with:

- a declared `snapshot_ref`;
- a declared `carrier_ref`;
- an ordered file descriptor set;
- a declared RFC8785/JCS SHA-256 digest over that exact descriptor set.

Each file descriptor contains:

- canonical relative `path`;
- bounded `role`;
- exact `bytes` length;
- lowercase hexadecimal SHA-256.

The receipt builder rejects:

- absolute paths;
- `.` / `..` components;
- backslash paths;
- duplicate paths;
- non-canonical ordering;
- malformed digests;
- descriptor-set digest mismatch;
- source/destination descriptor mismatch;
- identical source and destination snapshot refs;
- identical declared carrier refs.

Distinct carrier refs are only declarations. They are **not** evidence of physical or administrative independence.

## Positive result

A positive receipt has:

```text
result = byte_equivalent_set_verified
claims.byte_equivalent_set_verified = true
claims.source_destination_descriptor_sets_match = true
claims.distinct_carrier_refs_declared = true
```

All stronger claims remain false, including:

- `physical_independence_proven`;
- `origin_established`;
- `canonical_successor_established`;
- `authority_transferred`;
- `custody_transferred`;
- `evidence_truth_certified`;
- `legal_liability_determined`;
- `rescue_authorized`;
- `kontur_readiness_established`;
- `kontur_activation_authorized`;
- `kontur_activated`.

## Local-only contract

The builder/verifier performs no network or process execution. It does not read or write the evidence files themselves; it evaluates explicit descriptors and their cryptographic bindings.

A higher layer may construct the descriptors from locally read bytes, for example from an Evidence Availability Manifest, but this receipt deliberately remains independent of any particular storage provider or manifest implementation.

## Replication versus succession

A byte-equivalent copy does not acquire the authority, origin status, canonicality, or responsibility state of its source merely because bytes match.

```text
replica == byte-equivalent evidence carrier
replica != canonical origin
replica != canonical successor
replica != execution authority
```

## Audit isolation

This protocol lives under `protection/evidence/replication/v0.1/**` and has no import or execution edge into `server/kontur/**`, Human Activation Review, Activation Preflight, Activation Executor, Responsibility Kernel, or Durable Responsibility Ledger.

**Epistemic status:** `bounded / byte-equivalence / declared-carrier / non-authoritative`
