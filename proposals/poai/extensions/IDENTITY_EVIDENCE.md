# PoAI Level 4.0d — Identity Evidence

Status: **experimental research extension**  
Artifact: `PoAIIdentityEvidenceEnvelope`  
Artifact version: `0.0.1-experimental`  
Tracking: RFC #88, implementation #89, live acceptance #90.

## Purpose

Level 4.0c proves local cryptographic key continuity. It does **not** prove who controls that key in a human, legal, organizational, or institutional sense.

Level 4.0d adds a deliberately weaker intermediate layer: a persistent key can sign a claim about an external identifier and can name a public location where the exact claim is expected to be published.

Core boundary:

```text
persistent key continuity
    !=
signed identity claim
    !=
account / repository control evidence
    !=
verified human or legal identity
    !=
authority
```

For the first implementation the external identifier namespace is `github`.

## Artifact model

A `PoAIIdentityEvidenceEnvelope` contains:

- a self-asserted external identifier claim;
- the persistent Level 4.0c key ID and RFC 7638 thumbprint;
- the public Ed25519 JWK only;
- continuity epoch metadata;
- an expected public GitHub raw publication URL;
- a domain-separated signed statement;
- an Ed25519 signature;
- explicit negative claims preventing identity/authority escalation.

The private key is never serialized into the envelope.

## Signed claim

The first claim profile is conceptually:

```json
{
  "namespace": "github",
  "identifier": "Matawaka",
  "canonical_identifier": "github:Matawaka",
  "account_url": "https://github.com/Matawaka",
  "claim_status": "self_asserted"
}
```

A valid signature means only that the persistent private key signed this claim.

It does not prove that the GitHub identifier corresponds to a particular human or legal person.

## Publication evidence

The signed statement also includes an expected publication target such as:

```text
https://raw.githubusercontent.com/Matawaka/uu-aap/main/
  proposals/poai/identity-evidence/github/Matawaka.poai-identity.json
```

The browser verifier may fetch that URL and compare the published JSON with the locally loaded envelope using RFC 8785 canonical equality.

The UI reports publication separately from signature validity and active-key continuity:

```text
SIGNED CLAIM VALID / INVALID
ACTIVE KEY MATCH / MISMATCH / NOT CHECKED
PUBLICATION MATCH / MISMATCH / NOT CHECKED
```

If all of the following are true:

1. the claim signature is valid;
2. the publication URL owner matches the claimed GitHub identifier;
3. the fetched public artifact canonically matches the signed envelope;

then the verifier may display:

```text
ACCOUNT-CONTROL EVIDENCE OBSERVED
```

This is an observation by the verifier. The immutable envelope itself keeps:

```json
"account_control_evidence_established": false
```

because an envelope cannot pre-certify its own future public publication.

## Non-escalation claims

Even after a live publication match, the 4.0d envelope must keep these stronger claims false or unknown:

```json
{
  "human_identity_verified": false,
  "organization_identity_verified": false,
  "signer_identity_verified": false,
  "signer_authority_verified": false,
  "materialization_authority_verified": false,
  "truth_certified": false,
  "responsibility_determined": false,
  "legal_effect_established": false,
  "canonical_successor_established": false,
  "poai_v_conformance_established": false
}
```

## Why repository publication is evidence, not identity proof

A file appearing in a public repository can be evidence that a repository/account control process accepted that exact signed claim. It does not establish:

- that one natural person exclusively controls the account;
- that the account name is a government/legal identity;
- that the account controller has authority for a particular organization, decision, or materialization action;
- that the claim is factually true beyond the observed publication/control relationship.

## Standards alignment

This extension is informed by, but does not claim conformance to:

- W3C Verifiable Credentials Data Model v2.0 — claims, subjects, issuers/holders/verifiers, evidence and verifier-specific validation;
- W3C DID Core v1.0 — separation of verification material from controller/subject semantics;
- W3C Verifiable Credential Data Integrity v1.0 — cryptographic authenticity/integrity without automatic semantic truth.

No DID document or Verifiable Credential is emitted by Level 4.0d.

## Privacy

Long-lived external identifiers are correlatable. The UI should make the identifier and intended publication target explicit before signing. Users should not publish identifiers they do not want publicly associated with the persistent PoAI key.

## Non-goals

Level 4.0d does not implement:

- KYC or government identity verification;
- biometric proof;
- organization employment/role verification;
- signer or materialization authority;
- portable key recovery;
- hardware-backed identity;
- automatic successor materialization;
- PoAI/V conformance.

## First live acceptance

The first live acceptance vector is:

```text
persistent key
    -> signed github:Matawaka claim
    -> export Identity Evidence Envelope
    -> publish exact envelope in Matawaka/uu-aap main
    -> fetch raw public artifact
    -> SIGNED CLAIM VALID
    -> PUBLICATION MATCH
    -> ACCOUNT-CONTROL EVIDENCE OBSERVED
```

while:

```text
human identity verified = false
authority verified = false
PoAI/V = false
```
