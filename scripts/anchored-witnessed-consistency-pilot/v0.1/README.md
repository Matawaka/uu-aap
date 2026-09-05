# Anchored-to-Witnessed Checkpoint Consistency Pilot v0.1

Status: **additive executable interoperability evidence for #933; not C2PA adoption, not global non-equivocation, not complete history, not trusted time, not Stable Core**.

Exact UU-AAP predecessor:

`ea67703f99617d82e8cc1ca214273f83521d8b12` (merged #932).

## Why this exists

#932 established one real historical chain:

```text
opaque leaf/0
→ RFC inclusion under tree size 1387
→ exact root
→ rootcommit/v1 binding
→ exact OTS proof bytes
```

but intentionally left:

```text
LOG_APPEND_ONLY_CONSISTENCY = NOT_VERIFIED_SINGLE_CHECKPOINT_ONLY
```

A bounded search found no second Bitcoin/rootcommit checkpoint for the same `markovianprotocol.com/log` origin. This pilot therefore does **not** invent one.

Instead it asks a narrower question: does the later public witnessed checkpoint cryptographically authenticate, and does an independently recomputed RFC consistency proof show that it extends the exact anchored root at size 1387?

## Evidence chain

```text
accepted #932 old root, size 1387
        ↓
public consistency proof 1387 → N
        ↓ independent RFC 6962 verification
later witnessed checkpoint root N
        ↓
log Ed25519 signature verification
        +
unique pinned witness cosignature/v1 verification
        ↓ quorum >= 4
observed append-only extension
```

## Key-provenance boundary

The key pins are byte-bound to:

`MarkovianProtocol/log-monitor@6cbde9d44da084770c2bb09c6b66bf0e3245e5f6`

with exact config blob:

`9880c48c5ac46b0d4a56be3720d9897cf9f2ef29`.

That source explicitly describes the witness keys as site-published pins cited to witness-operator pages. This pilot verifies the **cryptography** against those pins, but does not independently re-fetch quorum-many witness-owned pages. Therefore:

```text
Verified Witness Signature != Independently Proven Witness Identity
Operator-Curated Key Pin != Independent Key Provenance
```

The maximum admitted key-provenance assurance in v0.1 is:

`OPERATOR_CURATED_PINS_NOT_INDEPENDENTLY_REPROVEN`.

## Expected strongest bounded verdict

```text
OBSERVED_APPEND_ONLY_EXTENSION_VERIFIED_LATER_CHECKPOINT_KEY_PROVENANCE_NOT_INDEPENDENTLY_ESTABLISHED
```

This means only that one later observed/authenticated checkpoint is cryptographically consistent with the exact historical anchored root.

It does **not** mean:

```text
all checkpoints were observed
all readers saw the same later checkpoint
the operator never served another fork elsewhere
all records/manifests were submitted
producer non-equivocation
C2PA manifest inclusion
semantic collision binding
truth or authority
```

## Frozen-run model

The public witnessed tip moves. Therefore the first independent Actions run captures:

- exact later checkpoint bytes;
- exact `1387 → later_size` consistency proof bytes;
- machine receipt.

A final qualified head freezes those bytes in this package and re-verifies the frozen pair. Final CI may also re-fetch the historical consistency proof for the same fixed sizes, but it must not require the live tip to remain unchanged.

## Mandatory non-claims

Always false:

- `second_bitcoin_anchor_proven`;
- `complete_history_proven`;
- `all_views_non_equivocating_proven`;
- `producer_non_equivocation_proven`;
- `global_non_equivocation_proven`;
- `all_manifests_submitted_proven`;
- `selective_submission_absent_proven`;
- `c2pa_manifest_inclusion_proven`;
- `collision_semantics_established`;
- `trusted_time_proven`;
- `truth_certified`;
- `authority_created`;
- `canonical_branch_selected`;
- `malicious_behavior_proven`;
- `automatic_remediation_triggered`.

## Hostile coverage

The package rejects or refuses to count:

- origin mismatch / rollback / same-size different-root;
- malformed log signature;
- witness keyhash mismatch;
- invalid Ed25519 cosignature;
- duplicate witness quorum inflation;
- unknown witness quorum inflation;
- non-Ed25519/PQ blobs counted as Ed25519 cosignatures;
- fewer than four verified witnesses promoted to authenticated quorum;
- malformed, short, long, or wrong-old-root consistency proofs;
- operator-curated key pins promoted to independent identity evidence;
- invented second Bitcoin anchor;
- C2PA/global/completeness/truth/authority/canonicality/fraud/score promotion.

## Non-effects

CI is read-only. It never appends to the log, submits an OpenTimestamp, creates a Bitcoin transaction, posts upstream, modifies Registry/Core/SPEC, creates authority, selects a canonical branch, triggers remediation, releases or tags.
