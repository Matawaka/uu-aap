# PoAI Level 4.0c — Persistent local signer key continuity

Status: **experimental research extension**.

Tracking:
- RFC: Issue #84
- implementation: Issue #85
- live acceptance: Issue #86

## Purpose

Level 4.0b proves that a specific Ed25519 public key verifies a signature over a deterministic statement bound to a PoAI artifact. Its first browser experiment intentionally uses an ephemeral key, so a later signature cannot yet demonstrate that the same cryptographic key actor was reused across sessions.

Level 4.0c adds **browser-origin-local key continuity** while preserving the distinction between key possession, identity and authority.

Core boundary:

`valid signature != persistent key continuity != verified identity != signer authority != materialization authority`

and:

`same key over time != same human proven`

## Browser storage model

The experiment uses WebCrypto Ed25519 and IndexedDB:

1. `SubtleCrypto.generateKey({name: "Ed25519"}, false, ["sign", "verify"])` creates a non-extractable private key. Under the WebCrypto Ed25519 key-generation algorithm the public key remains extractable while the private key follows the requested extractability flag.
2. The `CryptoKey` objects are stored directly in IndexedDB using structured clone; raw private key bytes are not exported into application JSON.
3. The public key is exported as an OKP/Ed25519 JWK.
4. An RFC 7638 SHA-256 JWK thumbprint becomes the stable local continuity identifier.
5. A continuity epoch begins at 1. Explicit key rotation creates a new key/thumbprint and increments the epoch.

The storage scope is explicitly `browser_origin_local`. Browser storage can be cleared, evicted or unavailable. Loss of local storage means loss of this local continuity evidence; it does not prove key revocation or identity discontinuity.

Relevant platform references:
- Web Cryptography API / Ed25519: https://www.w3.org/TR/WebCryptoAPI/
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- CryptoKey storage: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- structured clone supports `CryptoKey`: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm

## Continuity signature envelope

The browser experiment emits a separate `PoAIContinuitySignatureEnvelope` rather than silently upgrading the Level 4.0b envelope.

The signed statement contains:
- deterministic Level 4.0a binding metadata;
- public Ed25519 JWK and RFC 7638 thumbprint;
- local continuity key id;
- continuity epoch;
- browser-origin-local storage scope;
- key creation time;
- previous key thumbprint after explicit rotation;
- `private_key_extractable: false`.

The envelope establishes only a narrow local fact:

`local_key_continuity_established: true`

It still requires all of the following to remain false:
- `signer_identity_verified`;
- `signer_authority_verified`;
- `materialization_authority_verified`;
- `truth_certified`;
- `responsibility_determined`;
- `legal_effect_established`;
- `canonical_successor_established`;
- `poai_v_conformance_established`.

## Three independent verification axes

The Level 4.0c UI deliberately renders three independent checks:

1. `SIGNATURE VALID / INVALID`
2. `ARTIFACT MATCH / MISMATCH`
3. `ACTIVE KEY MATCH / MISMATCH`

Examples:

- semantic artifact edit: `SIGNATURE VALID · ARTIFACT MISMATCH · ACTIVE KEY MATCH`;
- signature tamper: `SIGNATURE INVALID · ARTIFACT MATCH · ACTIVE KEY MATCH`;
- explicit local key rotation while checking an old envelope: `SIGNATURE VALID · ARTIFACT MATCH · ACTIVE KEY MISMATCH`.

The last case is essential: rotation does not invalidate historical signatures and does not rewrite their public key. It only means the currently active local signer key is different.

## Rotation semantics

Rotation is an explicit local event. The new key record contains:
- a new RFC 7638 thumbprint;
- incremented continuity epoch;
- the previous active key thumbprint.

This link is **not identity continuity**. It only records that this browser-origin-local application state replaced one active key with another.

Future identity/governance work must decide whether and how a stronger external identity or authority system can attest continuity across rotations.

## Non-goals

Level 4.0c does not establish:
- portable identity;
- human identity;
- organizational identity;
- account ownership;
- signer authority;
- materialization authority;
- hardware-backed key protection;
- revocation semantics;
- truth or causal proof;
- legal effect;
- canonical successor status;
- PoAI/V conformance.

## Next boundary

A later Level 4.0d may introduce **identity evidence bound to the public-key thumbprint / PoAI key id**, while retaining:

`key continuity != identity evidence != verified identity != authority`.
