# External Checkpoint Anchor Pilot v0.1

Status: **additive executable interoperability evidence for #929; not C2PA adoption, not producer/global non-equivocation, not trusted time, not Stable Core**.

Exact UU-AAP predecessor:

`f7d5149254892803b84bb31bdc127751c418b544` (merged #928).

Exact external source frontier:

`MarkovianProtocol/tlog-bitcoin-anchor@b75d339e9ed5cce5ef4c2cee1cfa78c3e1e1abf1`.

## Why this pilot exists

Merged #928 separated six evidence layers and refused to admit an external-anchor receipt from proposal/README text alone. The public external repository now exposes concrete checkpoint, conformance and OpenTimestamps proof bytes.

This pilot independently checks a **single opaque historical leaf** against the same checkpoint that carries the external root commitment. It deliberately chooses leaf index `0` because it is inside the externally anchored tree size `1387`.

A later example at leaf `7235` is **not** used here because it cannot be spliced into checkpoint size `1387`.

## Exact technical chain

```text
public opaque leaf/0 bytes
        ↓ SHA-256(0x00 || leaf)
RFC 9162 inclusion path, size 1387
        ↓ independent fold
checkpoint root
GmLAFnmcIf8WgSfpWt7xBleQE+zgSZx8x9zuSOYw+vA=
        ↓
rootcommit/v1 preimage
(origin + size + verbatim root + wallet)
        ↓ SHA-256
4d1cc236c3872701bb27f9e27fad315e153eeb43a767a2cae958a3bb4014e771
        ↓
exact published OpenTimestamps proof bytes
        ↓
binding verification
        ↓
optional independent pinned OTS reference-verifier confirmation
```

The pilot's Python verifier is newly implemented in this repository. It does **not** import or count the external project's verifier as proof.

## External verifier gap

The external `interop/hawkins-agent-payment/verify_claim_leaf.py` correctly recomputes RFC inclusion math, but its checkpoint parsing merely collects names from signed-note signature lines. It does not cryptographically verify the named log/witness signatures before describing the checkpoint as witnessed.

Therefore this pilot preserves:

```text
Witness Line Present != Witness Signature Verified
Signer Name Parsed != Cryptographic Cosignature Proof
```

The checkpoint anti-rewrite leg used here is the external root commitment / OTS proof, not the presence of witness names.

## Bitcoin confirmation boundary

The proof parser independently verifies:

- detached-proof magic/version/hash-op;
- exact SHA-256 digest committed by the proof;
- equality of that digest to the independently reconstructed rootcommit preimage;
- presence/absence of a Bitcoin attestation structure.

A Bitcoin attestation tag **alone is not chain confirmation**.

The workflow separately attempts a pinned reference OpenTimestamps verifier. The result is injected only as one of:

```text
VERIFIED_BY_PINNED_REFERENCE_VERIFIER
NOT_ESTABLISHED
```

If the reference verifier cannot establish the chain leg, the strongest allowed result is:

`OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_NOT_ESTABLISHED`.

## First independent executable result

GitHub Actions run `33957485515`, job `101283330453`, executed the complete read-only pilot against the public external frontier.

Observed live evidence:

```text
opaque leaf index                    0
opaque leaf bytes                    132
opaque leaf SHA-256                  c65767dfaf98f6b3fb439feab33932ebc14fc5a2434f04f4cb65dfdeb2bfaeee
inclusion proof nodes                11
inclusion proof text SHA-256         cc4ed9f45b36f0ac9cb51c71ef3fbd861715baedbd231ddaccc8bbb6db172220
computed checkpoint root             GmLAFnmcIf8WgSfpWt7xBleQE+zgSZx8x9zuSOYw+vA=
rootcommit preimage SHA-256          4d1cc236c3872701bb27f9e27fad315e153eeb43a767a2cae958a3bb4014e771
OTS proof SHA-256                    676b61280ba00b4fb6ef364f7e42558c2d6d2b35719cecc5d5c677ab17291cb6
OTS committed digest                 4d1cc236c3872701bb27f9e27fad315e153eeb43a767a2cae958a3bb4014e771
Bitcoin attestation structure        present
BitcoinBlockHeaderAttestation height 958802
reference Bitcoin-node confirmation  NOT_ESTABLISHED
```

The pinned `opentimestamps-client==0.7.2` parser independently exposed a Bitcoin transaction path and `BitcoinBlockHeaderAttestation(958802)`, but `ots verify` could not connect to a Bitcoin node because the GitHub runner had no Bitcoin Core cookie/configuration. The pilot therefore deliberately **did not** promote the attestation structure into independently established chain confirmation.

Qualified frozen result:

```text
OPAQUE_LEAF_INCLUDED_ANCHOR_BINDING_VERIFIED_BITCOIN_CONFIRMATION_NOT_ESTABLISHED
```

Receipt fingerprint:

`60c91b97b7c5308cf6832803b1f399682b579ecb18680a4829a09920d64c71ef`

Artifact ID: `9966830130`.
Artifact ZIP SHA-256: `15fb51bc5585530a7eb8fa12a1f1af262df955a531ce91b4ce0b3cf8aac69bdd`.

This is a **partial technical proof**, not a failed pilot:

```text
real opaque-leaf inclusion              VERIFIED
same-checkpoint rootcommit binding       VERIFIED
exact OTS committed-digest binding       VERIFIED
Bitcoin attestation structure            OBSERVED
Bitcoin chain confirmation               NOT_ESTABLISHED
```

## Evidence layers after this pilot

At the accepted frozen result:

- `SIGNED_CLAIM = NOT_IN_SCOPE_OPAQUE_LEAF`;
- `CLAIM_COMMITMENT = OPAQUE_LEAF_BYTES_HASHED_ONLY`;
- `LOG_INCLUSION = VERIFIED`;
- `LOG_APPEND_ONLY_CONSISTENCY = NOT_VERIFIED_SINGLE_CHECKPOINT_ONLY`;
- `CHECKPOINT_NON_EQUIVOCATION = EXTERNAL_ANCHOR_BINDING_VERIFIED` for this exact checkpoint binding only;
- `EXISTENCE_TIME_EVIDENCE = OTS_BITCOIN_ATTESTATION_PRESENT_CHAIN_CONFIRMATION_NOT_ESTABLISHED`.

The phrase `CHECKPOINT_NON_EQUIVOCATION = EXTERNAL_ANCHOR_BINDING_VERIFIED` is deliberately bounded to independently verified external commitment of the exact checkpoint root. It does not establish complete log history, producer submission completeness, or global non-equivocation.

## Mandatory non-claims

Always false:

```text
c2pa_manifest_inclusion_proven
producer_non_equivocation_proven
global_non_equivocation_proven
complete_history_proven
all_manifests_submitted_proven
selective_submission_absent_proven
collision_semantics_established
trusted_time_proven
truth_certified
authority_created
canonical_branch_selected
malicious_behavior_proven
remediation_triggered
```

Thus:

```text
Opaque Leaf Inclusion != C2PA Manifest Inclusion
One Anchored Checkpoint != Complete Log History
Checkpoint Anchor != Proof Every Manifest Was Submitted
One Leaf + One Checkpoint != Producer Non-Equivocation
Bitcoin-set Evidence != Universal Trusted Time
Wallet Address Binding != Authority
```

## Hostile coverage

`test_pilot.py` contains 27 positive/negative/hostile checks including:

- independent RFC inclusion math;
- short/long/malformed inclusion paths;
- rootcommit preimage reproduction;
- OTS magic/version/hash-op and committed-digest parsing;
- root/wallet substitution;
- leaf 7235→checkpoint 1387 splice rejection;
- manufactured collision semantics;
- C2PA claim promotion;
- global non-equivocation / complete history promotion;
- append-only consistency promotion from one checkpoint;
- Bitcoin-attestation-tag → chain-confirmation promotion;
- automatic action/external mutation/scalar score injection;
- receipt fingerprint mutation.

## Runtime evidence

CI performs only read operations:

- clone/fetch exact external Git commit;
- HTTPS GET of `/leaf/0` and the size-1387 inclusion path;
- local verification;
- optional reference-verifier network reads required to confirm an already-existing OTS proof.

CI never:

- appends to the log;
- submits an OTS timestamp;
- creates a Bitcoin transaction;
- comments upstream;
- creates an external assertion;
- chooses a canonical branch;
- alerts/remediates;
- creates authority or an ActionPermit.

`current-receipt.json` is frozen from the first independent Actions artifact. Every final qualification run must reproduce that exact receipt; any external evidence drift, including a newly available Bitcoin-chain confirmation, requires a successor rather than silently rewriting v0.1.
