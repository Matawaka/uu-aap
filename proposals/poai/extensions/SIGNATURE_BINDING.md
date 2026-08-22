# PoAI Level 4.0b — Ed25519 Signature Binding

Status: experimental Level 4 successor research after deterministic binding.

Tracking: RFC #80, implementation #81, live acceptance #82.

## Purpose

Level 4.0a makes a JSON artifact deterministically bindable through RFC 8785 JCS and SHA-256. Level 4.0b adds a cryptographic signature over a domain-separated statement that references that binding.

Core separation:

`matching digest != valid signature != signer identity != signer authority != materialization authority != canonical successor`

and:

`cryptographic signature verification != truth certification`.

## 4.0b scope

The experiment uses:

- RFC 8785 JCS for the source artifact binding inherited from Level 4.0a;
- SHA-256 for the artifact digest;
- Ed25519 / EdDSA as specified by RFC 8032;
- a public JWK with `kty: OKP`, `crv: Ed25519` aligned with RFC 8037;
- an RFC 7638 SHA-256 JWK thumbprint as the experimental key identifier;
- a domain-separated PoAI signature statement, itself canonicalized with JCS before Ed25519 signing;
- browser-local ephemeral private key material for the first human-interface experiment.

The exported `PoAISignatureEnvelope` contains only public verification material. The private key is not included in the exported artifact.

## Signed statement

The signature is not applied to a free-standing hexadecimal digest string. The signed statement binds the digest to its interpretation and key metadata, including:

- statement domain;
- signature profile id;
- creation timestamp;
- purpose `artifact_binding`;
- bound artifact descriptor;
- canonicalization and digest algorithms;
- digest and canonical byte length;
- Ed25519 public JWK thumbprint and public JWK.

This reduces algorithm/substitution ambiguity while retaining a small detached-style envelope.

## Two independent verification results

PoAI 4.0b deliberately reports two separate results:

1. **signature validity** — whether the stored statement verifies under the stored public key;
2. **artifact binding match** — whether the currently supplied JSON canonicalizes and hashes to the digest referenced by the signed statement.

A changed source artifact can therefore produce:

`signature VALID + artifact MISMATCH`.

This is expected. The signature can remain cryptographically valid for the historical signed statement while the currently presented artifact is no longer the artifact that statement bound.

## Key handling boundary

The first browser experiment generates an ephemeral Ed25519 key pair in WebCrypto. The exported envelope contains only the public JWK.

4.0b does not define:

- durable key custody;
- recovery or rotation;
- hardware-backed keys;
- DID/controller documents;
- signer identity proof;
- organizational role binding;
- materialization authority.

Those belong to later layers.

## W3C relationship

W3C Data Integrity EdDSA Cryptosuites v1.0 became a Recommendation on 2025-05-15 and defines `eddsa-jcs-2022`, which uses RFC 8785, SHA-256, and Ed25519.

The PoAI 4.0b experiment is intentionally **aligned with the primitive choices** of `eddsa-jcs-2022`, but it does **not** claim W3C Data Integrity conformance. In particular, it does not yet implement the complete Data Integrity proof configuration, proof hashing, Multikey verification method, or proof serialization rules.

A later interoperability decision may either:

- adopt the full `eddsa-jcs-2022` proof model; or
- retain the simpler PoAI signature envelope with an explicit mapping to standard proof formats.

## What a valid 4.0b signature establishes

Given the envelope and public key, a verifier can determine whether the Ed25519 signature is valid for the stored deterministic statement.

Given the original artifact as well, a verifier can also independently recompute the Level 4.0a binding and determine whether that artifact matches the signed digest.

## What it does not establish

Even after successful cryptographic verification, 4.0b does not establish:

- the civil or organizational identity of the key holder;
- signer authority;
- authority to publish/materialize a successor;
- factual truth;
- causal proof;
- responsibility;
- legal effect;
- canonical successor status;
- PoAI/V conformance.

The envelope therefore keeps these claims explicitly false or unknown.

## Required machine tests

1. RFC 8037 / RFC 7638 Ed25519 JWK thumbprint vector matches.
2. A generated signature verifies with the module and independently with Node Ed25519 verification.
3. Reordered/whitespace-equivalent source JSON still matches the signed binding.
4. A semantic source change yields `signature valid` but `artifact binding mismatch`.
5. A signature-byte change fails signature verification while the source binding still matches.
6. No private JWK parameter `d` appears in the exported envelope.
7. Identity/authority/materialization/PoAI-V claims remain false or unknown.
8. The Genesis validator rejects the signature envelope as a decision record.

## Next layer

Level 4.0c should address signer identity/key continuity evidence separately from cryptographic signature validity. Identity evidence must not automatically imply institutional authority.
