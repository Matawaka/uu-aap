# PoAI Level 4.0a — Deterministic Binding

Status: experimental successor research after the frozen Genesis/Machine-Layer checkpoint.

Tracking: RFC #73, implementation #74, live acceptance #76.

## Purpose

Level 3.1 can preserve decision, review, appeal, adjudication, execution, verification, outcome and successor-proposal provenance, but those artifacts are still ordinary JSON documents. Level 4 begins by making an artifact's bytes reproducibly bindable before any signature, signer identity or institutional authority is introduced.

Core separation:

`canonical bytes != digest != signature != signer identity != signer authority != materialization authority != canonical successor`

and:

`cryptographic verification != truth certification`

## 4.0a scope

The first experiment implements only:

`JSON object -> RFC 8785 JCS canonical form -> UTF-8 bytes -> SHA-256 digest`

The browser can download a separate `PoAIBindingReceipt` containing the digest metadata and a minimal descriptor of the bound artifact. The original JSON is not copied into the receipt and is not modified.

The receipt is intentionally outside the Genesis PoAI decision-record schema.

## Canonicalization profile

The experiment follows the JSON Canonicalization Scheme described by RFC 8785:

- object property names are sorted recursively by raw UTF-16 code units;
- array order is preserved;
- JSON primitives use ECMAScript-compatible serialization;
- output is encoded as UTF-8;
- non-finite numbers are rejected;
- invalid/unpaired Unicode surrogate sequences are rejected;
- negative zero is rejected in line with the verified RFC 8785 security erratum because ECMAScript serialization would otherwise collapse `-0` to `0`.

RFC 8785 is an Informational RFC rather than an IETF Standards Track specification. PoAI references it for deterministic interoperability, not as an assertion of IETF endorsement.

## Binding Receipt

Experimental artifact type:

`PoAIBindingReceipt` `0.0.1-experimental`

The receipt contains:

- `bound_artifact.artifact_type`;
- `bound_artifact.artifact_id` when discoverable;
- optional PoAI profile descriptor;
- canonicalization identifier `RFC8785-JCS`;
- digest algorithm `SHA-256`;
- lowercase hexadecimal digest;
- canonical UTF-8 byte length;
- explicit statement that the signature layer is absent.

The digest is independently reproducible from the original JSON artifact.

## What the digest does establish

A verifier that possesses both the source artifact and receipt can recompute the same canonical bytes and SHA-256 value and determine whether the artifact matches the digest recorded in the receipt.

This is deterministic content binding only.

## What the digest does not establish

4.0a does not establish:

- who created the artifact;
- who computed the digest;
- who possessed a private key;
- a valid digital signature;
- signer identity;
- signer authority;
- authority to materialize or publish a successor;
- factual truth;
- causal proof;
- responsibility;
- legal effect;
- canonical successor status;
- PoAI/V conformance.

The binding receipt itself is unsigned in 4.0a and therefore must be treated as recomputable metadata, not a trusted attestation.

## Reproducibility requirements

Machine tests require that:

1. semantically identical JSON with different whitespace/property order yields identical canonical bytes and digest;
2. changing a semantic value changes the digest;
3. RFC 8785 UTF-16 property ordering is respected;
4. invalid numbers/Unicode are rejected;
5. Node SHA-256 over canonical UTF-8 bytes matches the receipt digest;
6. the receipt verifies against reordered equivalent JSON;
7. the Genesis validator rejects the receipt as a decision record.

## Next layer

Level 4.0b may add an interoperable signature envelope/cryptosuite only after 4.0a survives CI and live field acceptance.

Candidate interoperability families under RFC #73 include W3C Verifiable Credential Data Integrity / EdDSA and JOSE/JWS. A future signature proof must retain the separation:

`valid signature != verified authority != truth`.
