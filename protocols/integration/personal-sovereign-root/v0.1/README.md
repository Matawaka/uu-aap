# Personal Sovereign Root / Personal Evidence Fabric v0.1

**Status:** experimental / provider-neutral / non-actuating  
**Issue:** #447  
**Origin frontier:** `75c150a192db68d0c167d2408bd436e54b71d475`

## Purpose

Personal Sovereign Root (PSR) models evidentiary continuity without reducing a person to one private key, credential, biometric, document, account, device, or identifier.

Personal Evidence Fabric (PEF) is the plurality of independently originated commitments, provenance links, witness receipts, bounded evidence packages, recovery factors, and successor-state links that can support continuity over time.

```text
plural evidence sources
  -> bounded commitments + provenance
  -> continuity assessment
  -> sovereign root state
  -> rotation | recovery | migration
  -> successor root state
```

Cryptography anchors evidence and transitions. It does not create human uniqueness, personhood, legal identity, intent, authority, responsibility, or liability.

## Core invariants

`Person != Key`

`Personal Sovereign Root != Single Secret`

`Evidence Fabric != Centralized Identity Database`

`Cryptographic Commitment != Creation of Human Uniqueness`

`Evidence Presence != Right to Inspect`

`Control of Root != Ownership of Every Evidence Source`

`Key Loss != Loss of Personhood`

`Key Compromise != Automatic Loss of Evidentiary Continuity`

`Root Rotation != New Person`

`Continuity Evidence != Unlimited Identification Authority`

`Possible Identification != Performed Identification`

`Proof of Continuity != Proof of Intent, Action, Responsibility or Liability`

`One Evidence Source != Sufficient Universal Identity Proof`

## Root versus fabric

A PSR is a continuity state, not an identity database and not an immortal credential. It may refer to active control keys, but those keys are replaceable components.

A PEF preserves evidence-source plurality. Each source keeps its own provenance reference and independence group. The profile deliberately avoids collapsing the fabric into a single opaque trust score.

A source may be weak in isolation and still contribute to a stronger continuity assessment when combined with independently originated evidence. The combination does not convert any source into universal identity authority.

## Rotation and recovery

A successor root may be accepted only under an explicit continuity policy with a bound predecessor, a distinct successor state, and sufficient continuity evidence from more than one independence group.

The profile supports:

- key rotation;
- loss or replacement of a credential/device;
- addition of independent evidence;
- deprecation of obsolete evidence while retaining provenance;
- recovery from multiple bounded factors;
- migration to a new root implementation without declaring a new person.

Recovery is evidence-based. It must not depend on the fiction that one permanent secret is the person.

## Minimal evidence, not total history

PSR/PEF composes with Event-Hash Minimalism. Commitments and provenance references may be sufficient; a conforming implementation must not require a full surveillance log or total low-level action history by default.

`Continuity Commitment != Total Life History`

## Latent evidence and disclosure

PSR/PEF composes with Latent Evidentiary Knowledge. Evidence may exist without activating identification, correlation, profiling, or disclosure.

Cross-context correlation is denied by default. Root control does not grant a blanket right to inspect every underlying evidence source.

`Available Continuity Evidence != Active Personalized Knowledge`

## Claims boundary

The positive fixture establishes only a bounded synthetic continuity claim. It explicitly leaves unestablished:

- legal identity;
- universal identity proof;
- authority;
- intent;
- action;
- authorship;
- responsibility;
- liability;
- unrestricted inspection or correlation rights.

A later purpose-bounded identity verification flow may consume PSR/PEF evidence, but that separate flow must establish its own authority, necessity, proof sufficiency, scope, and disclosure rules.

## Machine-readable package

- `personal-sovereign-root.schema.json` — closed profile schema;
- `fixture.json` — synthetic multi-source root plus key-rotation successor;
- `validate-personal-sovereign-root.js` — deterministic semantic validator and fail-closed mutations.

## Non-effects

This profile performs no identity lookup, biometric processing, profile construction, external correlation, credential issuance, account recovery, legal identity determination, KONTUR mutation/activation, actuator invocation, authority transfer, permission/protection change, release/tag/publication, sanction, force-push, history rewrite, or canonical-origin mutation.
