# PoAI Level 4.0e — Scoped Authority Evidence

Status: experimental research extension. This document does not change Genesis PoAI semantics and does not establish PoAI/V conformance.

## Boundary

`account-control evidence != authority evidence != verified authority != materialization authority`

`valid delegation signature != issuer entitled to delegate`

`scope match != canonical successor authorization`

## Purpose

Level 4.0e records a signed authority claim with explicit scope, target, validity window and delegation mode. The artifact can show that authority evidence exists and can be cryptographically/publicly observed, while leaving the actual authorization decision to a later policy layer.

## Artifact

`PoAIAuthorityEvidenceEnvelope` `0.0.1-experimental`.

Required semantics:

- issuer and subject key are distinct fields even if the first scenario is self-issued;
- authority scope/action is explicit;
- target resource/namespace is explicit;
- validity window is explicit through `valid_from` and optional `valid_until`;
- delegation mode is explicit (`non_delegable` in this increment);
- issuer public key / RFC 7638 thumbprint is part of the signed statement;
- subject key thumbprint is part of the signed statement;
- publication evidence is a separate observable fact;
- signature validity, active subject-key match, temporal validity and publication match are independent checks.

## Claims that remain false

The envelope does not by itself establish:

- `authority_verified`;
- `issuer_entitlement_verified`;
- `materialization_authority_verified`;
- factual truth;
- responsibility;
- legal effect;
- canonical successor status;
- PoAI/V conformance.

## First live scenario

Issuer claim: `github:Matawaka`.

Subject key: active Level 4.0c persistent Ed25519 key.

Scope: `poai.successor.materialization.propose`.

Target: `github:Matawaka/uu-aap`.

Delegation mode: `non_delegable`.

The exact envelope is intended to be published at a stable raw GitHub path and compared through RFC8785-JCS canonical equality. Publication plus a valid signature is evidence that the scoped claim exists in the observed repository context; it is not proof that the issuer was entitled to grant the scope.

## Standards alignment

The design follows the issuer/subject/verifier separation of W3C Verifiable Credentials Data Model 2.0, while reusing PoAI RFC8785-JCS + Ed25519 primitives. It does not claim VC or Data Integrity conformance.
