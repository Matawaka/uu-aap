# Evidence Chunk Tree v0.1

## Purpose

`EvidenceChunkTreeManifest v0.1` provides a local, deterministic chunk/Merkle integrity structure for large evidence files.

It is intended to support:

- partial verification of large evidence artifacts;
- detection of localized corruption;
- future selective repair workflows;
- integrity-preserving movement across storage carriers.

It does not establish origin, truth, canonicality, authority, legal responsibility, or KONTUR readiness.

## Hash construction

All hashes use SHA-256 with domain separation:

- leaf: `SHA256(0x00 || chunk_bytes)`;
- internal node: `SHA256(0x01 || left_hash_bytes || right_hash_bytes)`.

For an odd number of nodes at a level, the final node is duplicated before hashing the parent.

A zero-byte file is represented as one empty chunk.

The manifest also records the ordinary whole-file SHA-256 separately. The Merkle root and whole-file hash serve different verification purposes and are not interchangeable.

## Manifest contents

The manifest records:

- opaque `file_ref`;
- exact `file_size`;
- chosen `chunk_size`;
- exact `chunk_count`;
- whole-file SHA-256;
- ordered leaf hashes;
- Merkle root;
- the exact hash-domain and odd-node rules.

## Chunk proofs

A proof binds one explicit chunk index and its domain-separated leaf hash to the manifest root through an ordered sibling path.

A valid chunk proof establishes only that the supplied chunk bytes occupy that index in the byte sequence committed by the trusted manifest root.

```text
chunk proof valid
!= entire file locally re-read
!= evidence true
!= origin established
!= canonical artifact
!= authority
!= legal liability
```

## Bounded claims

A generated manifest may claim:

- `chunk_tree_structure_created=true`;
- `whole_file_sha256_recorded=true`;
- `partial_chunk_verification_supported=true`.

It must keep false:

- `evidence_truth_certified`;
- `origin_established`;
- `canonicality_established`;
- `authority_established`;
- `legal_liability_determined`;
- `rescue_authorized`;
- `kontur_readiness_established`;
- `kontur_activation_authorized`;
- `kontur_activated`.

## Local-only boundary

The library accepts explicit bytes (`Buffer`/`Uint8Array`). It performs no network I/O, process execution, repository mutation, storage provisioning, or KONTUR calls.

A caller may read a local file and pass its bytes to the library, but storage access and custody remain outside this primitive.

## Composition

Future composition may be:

```text
Evidence Availability Manifest
    -> file digest
    -> Evidence Chunk Tree
    -> per-chunk proofs / partial repair evidence
    -> replicated evidence copies
```

No composition step automatically changes authority or canonicality.

**Epistemic status:** `cryptographic-integrity / partial-verification / non-authoritative`
