# C2PA 2.4 × UU-AAP — Semantic Boundary & Interoperability Profile v0.1

**Status:** Non-normative interoperability draft  
**Repository scope:** Additive documentation only  
**C2PA baseline:** Technical Specification 2.4  
**Related UU-AAP issue:** #4 — Review: Map UU-AAP claims to C2PA 2.4  

> C2PA can prove artifact provenance and the integrity of signed assertions. UU-AAP describes governance of meaning: intent, decision authority, scoped responsibility, decision trace, uncertainty and contestability. PoAI can additionally describe which intelligence was actually available before a decision. These layers should compose without being collapsed into one another.

## 0. Coordination and parallel-work boundary

This document is intentionally **collision-safe**.

It does not modify `SPEC.md`, `PRINCIPLES.md`, `REFERENCES.md`, schemas, Core conformance, C2PA assertion registration, cryptographic implementation, or Profile V requirements. It is designed to remain useful if another branch, PR, agent or external contributor is simultaneously implementing C2PA support.

If parallel C2PA work exists, this file SHOULD be treated as a **semantic-boundary proposal**, not as ownership of the implementation path. A later integration pass may reference, replace, split or supersede implementation-specific parts without silently weakening the distinctions recorded here.

The purpose is to reduce one specific interoperability risk: importing cryptographically valid C2PA facts into UU-AAP with stronger semantics than those facts actually prove.

## 1. Layering model

Recommended composition:

```text
Digital asset / released artifact
        │
        ▼
C2PA 2.4
artifact provenance • assertions • signatures • bindings
AI disclosure • ingredients • actions • repository receipts
        │
        ▼
PoAI (when applicable)
decision-time availability • knowledge cutoff • alternatives
        │
        ▼
UU-AAP
governance of meaning • authority • responsibility
concept lineage • decision trace • uncertainty • contestability
        │
        ▼
Publication / successor record / reviewed outcome
```

The layers are complementary rather than hierarchical claims of truth. A valid lower-layer proof may support a higher-layer claim, but it does not automatically establish that claim.

## 2. Core semantic invariants

### I1. C2PA signer ≠ UU-AAP author ≠ approver ≠ authority ≠ responsible actor

A signer proves that a credential/key authorized a C2PA claim under the applicable trust model. That fact MUST NOT, by itself, be interpreted as proof that the signer:

- originated the work;
- held `intent_governance` authority;
- selected a concept;
- approved editorial meaning;
- authorized publication;
- accepted factual, legal or other responsibility.

UU-AAP responsibility remains explicitly scoped and separately declared or attested.

### I2. C2PA action ≠ UU-AAP decision

A C2PA action can provide evidence that an operation occurred in the provenance of an asset. It does not, by itself, prove:

- why the operation was chosen;
- which alternatives were considered or rejected;
- who had decision authority;
- whether the operation was accepted as meaningful rather than merely generated;
- which uncertainty remained after the operation.

A `c2pa.actions` record MAY be evidence referenced by a UU-AAP decision trace. It MUST NOT replace the decision trace when decision provenance is material.

### I3. C2PA ingredient ≠ UU-AAP concept origin

A C2PA ingredient describes an asset relationship in provenance. A UU-AAP concept-origin record describes intellectual genealogy.

An ingredient MAY support evidence for `source_derived` or another concept-origin declaration, but artifact lineage MUST NOT be automatically converted into concept lineage.

The absence of a C2PA ingredient also MUST NOT be treated as proof that no external idea, source, conversation or prior concept influenced the work.

### I4. C2PA AI disclosure ≠ decision authority or responsibility

C2PA `c2pa.ai-disclosure` and its human-oversight information are useful process evidence. They are intentionally coarser than the UU-AAP responsibility model.

For example, a C2PA-level statement that an output was human validated does not establish which human:

- governed intent;
- selected concepts;
- verified facts;
- approved structure or wording;
- authorized publication;
- accepted a defined responsibility scope.

Therefore C2PA AI-disclosure values SHOULD be preserved as external provenance observations and MUST NOT be lossily promoted into UU-AAP responsibility or authority scopes.

### I5. Repository receipt ≠ truth, review or authorization

A C2PA repository receipt can support durable evidence that a manifest was accepted by a repository under the relevant receipt mechanism.

That receipt MUST NOT be interpreted as proof that:

- the manifest is factually true;
- all declarations are complete;
- a reviewer independently checked the claims;
- publication authority was valid;
- a dispute does not exist.

Repository presence is a transparency/provenance fact, not a universal trust verdict.

### I6. Cryptographic integrity ≠ epistemic truth

C2PA validation and UU-AAP epistemic status remain separate dimensions.

A signed and correctly bound assertion MAY still correspond to a UU-AAP claim that is `provisional`, `speculative`, `disputed`, `unknown` or `not_verified`.

Interfaces SHOULD report these dimensions separately.

### I7. Artifact existence/provenance ≠ decision-time availability

When PoAI is used, a C2PA-bound resource MAY establish that a particular artifact existed with a particular provenance. It does not establish that the resource was:

`discoverable -> reachable -> authorized -> contextualized -> callable -> delivered`

for a particular decision before its Decision Boundary / Knowledge Cutoff.

PoAI availability evidence remains a separate relation.

## 3. Recommended interoperability mapping

### 3.1 What C2PA should carry or bind

A future UU-AAP C2PA assertion/profile SHOULD prefer a minimal, public, stable payload. Suitable candidates include:

- `protocol`: `UU-AAP`;
- `protocol_version`;
- declared conformance profile;
- stable `work_id` and `edition_id`;
- URI/reference to the canonical or published UU-AAP manifest;
- digest of the referenced UU-AAP manifest;
- public verification instructions or verifier URI;
- optional public AI-system identifiers when already intentionally disclosed;
- optional pointer to a public contestability endpoint.

The objective is to bind **which UU-AAP record belongs to which released asset**, not to duplicate the entire governance record inside the asset.

### 3.2 What should normally remain external and referenced

The following SHOULD normally remain in a UU-AAP/PoAI record, private evidence store, transparency registry or separately signed attestation rather than be embedded wholesale into the released artifact:

- detailed decision traces;
- rejected alternatives and private deliberation;
- confidential prompt excerpts;
- private conversations;
- reviewer-private evidence;
- personal contact information;
- security-sensitive material;
- confidential sources;
- detailed authority proofs;
- internal organizational responsibility records;
- PoAI availability graphs and contextual access constraints;
- dispute evidence that could expose protected parties;
- redacted evidence contents.

A digest, URI, selective-disclosure proof or reviewer attestation MAY bind such evidence without making the protected content public.

### 3.3 C2PA `c2pa.ai-disclosure` bridge

Recommended rule:

1. Preserve the C2PA AI-disclosure assertion as C2PA evidence.
2. Reuse compatible public identifiers where practical (provider/model identifiers, if intentionally disclosed).
3. Do not infer UU-AAP authorship, concept origin, authority or responsibility from the C2PA oversight category.
4. If UU-AAP provides richer role information, keep that richer structure authoritative for UU-AAP semantics.
5. If the two records conflict, report the conflict; do not silently normalize one into the other.

Possible relationship:

```text
C2PA AI disclosure
  └─ evidence/reference ─> UU-AAP ai_participation[]

UU-AAP ai_participation[]
  └─ does not automatically derive ─> responsibility[]
```

### 3.4 C2PA actions bridge

A C2PA action MAY be referenced as evidence for a UU-AAP provenance dimension, for example drafting, editing, visuals or publication.

Recommended relationship:

```text
C2PA action
   └─ proves/attests operation provenance
        └─ MAY support
             UU-AAP provenance record
                 └─ MAY participate in
                      UU-AAP decision trace
```

The reverse inference is not automatic: a UU-AAP decision does not prove that a particular technical operation occurred unless corresponding evidence exists.

### 3.5 Ingredient bridge

A C2PA ingredient MAY be referenced from:

- a source/evidence reference;
- a concept-lineage evidence record;
- a released-artifact lineage record.

It SHOULD preserve the C2PA identifier/manifest reference rather than re-state provenance in a lossy local form.

## 4. Repository receipts and UU-AAP/V

C2PA 2.4 repository receipts are a strong candidate for one implementation of the durable public record expected by UU-AAP/V.

Recommended interpretation:

```text
UU-AAP manifest digest
       │
       ├── bound/referenced by C2PA manifest
       │
released asset
       │
       ▼
C2PA repository
       │
       ▼
repository receipt
```

A verifier can then report separate facts such as:

```text
Artifact binding: valid
C2PA signature: valid
Repository receipt: present
UU-AAP manifest digest: matches
UU-AAP profile: declared V
Responsibility scopes: present
Independent review: none / present / disputed
Epistemic status: mixed
```

No single result should be collapsed into a protocol-defined “truth score”.

## 5. Contestability and successor records

C2PA provenance and UU-AAP contestability should compose without mutating history.

Recommended pattern:

```text
Asset A + C2PA Manifest A + UU-AAP Manifest A
                     │
                 challenge
                     │
                     ▼
              dispute record
                     │
              correction/review
                     │
                     ▼
Asset/Manifest successor B
```

A correction SHOULD create a successor record rather than silently rewrite the prior UU-AAP record. Where C2PA update/manifest lineage is available, it MAY participate in the successor binding, while the UU-AAP dispute/appeal semantics remain explicit at the governance layer.

## 6. Privacy and proportional disclosure

Interoperability MUST NOT turn C2PA embedding into a reason to expose more human process data than UU-AAP otherwise requires.

The integration should preserve these UU-AAP principles:

- selective disclosure;
- least evidence necessary for the chosen profile;
- hash-bound/private evidence where appropriate;
- no mandatory complete prompt history;
- no mandatory continuous screen recording;
- no biometric typing evidence for ordinary conformance;
- no inference of misconduct merely because evidence is redacted.

A public C2PA asset should normally carry enough information to locate and verify the relevant UU-AAP record, not a surveillance archive of the creative process.

## 7. Failure cases the interoperability layer must resist

### F1. Responsibility laundering through signer identity

**Bad inference:** “The publisher's C2PA certificate signed the PDF; therefore the publisher accepts all factual responsibility.”  
**Required behavior:** report signer identity separately from UU-AAP responsibility scopes.

### F2. Human-validation laundering

**Bad inference:** “C2PA says `human_validated`; therefore this is human-authored under UU-AAP.”  
**Required behavior:** retain the C2PA oversight declaration but require independent UU-AAP role/authority/responsibility evidence.

### F3. Action laundering

**Bad inference:** “The action history says `edited`; therefore a human meaningfully reviewed the claim.”  
**Required behavior:** action provenance is not decision provenance.

### F4. Ingredient laundering

**Bad inference:** “Source X is an ingredient, therefore concept Y originated from X.”  
**Required behavior:** require an explicit concept-origin declaration/evidence relation.

### F5. Receipt-as-trust-badge

**Bad inference:** “Repository receipt present; content is trustworthy.”  
**Required behavior:** expose receipt/integrity separately from factual review, responsibility, epistemic status and disputes.

### F6. Hindsight injection into PoAI

**Bad inference:** “The C2PA-bound source existed before the event; therefore it was available to the decision-maker.”  
**Required behavior:** evaluate PoAI availability against the actual Decision Boundary / Knowledge Cutoff and access constraints.

## 8. Proposed minimal assertion shape (illustrative, non-registered)

This is **illustrative only**. It is not a registered C2PA assertion namespace and does not define conformance.

```json
{
  "protocol": "UU-AAP",
  "protocol_version": "0.1",
  "profile": "V",
  "work_id": "urn:example:work:123",
  "edition_id": "2026.1",
  "manifest": {
    "uri": "https://example.org/uu-aap/manifest.json",
    "digest_alg": "sha256",
    "digest": "..."
  },
  "contestability": {
    "uri": "https://example.org/uu-aap/disputes"
  }
}
```

The payload intentionally avoids embedding detailed responsibility records, private evidence or decision traces by default.

## 9. Verification UI boundary

A verifier combining C2PA and UU-AAP SHOULD render independent dimensions rather than a single badge:

| Dimension | Example result |
|---|---|
| C2PA artifact binding | valid |
| C2PA claim signature | valid |
| C2PA repository receipt | present |
| UU-AAP manifest digest | matches |
| UU-AAP profile | V (declared) |
| Intent governance | actor/scope declared |
| Publication authorization | actor/scope declared |
| Independent review | absent / present |
| Epistemic status | asserted / mixed / disputed |
| Contestability | available |
| PoAI availability | not evaluated / evaluated separately |

The UI MUST NOT imply that C2PA validity proves UU-AAP responsibility, that UU-AAP responsibility proves factual truth, or that PoAI availability proves reliance/action.

## 10. Integration strategy for parallel implementation work

To minimize merge conflict with any simultaneous C2PA work:

1. Keep this semantic document additive and isolated.
2. Do not modify existing normative files in the same pass.
3. Allow implementation branches to introduce schemas, examples, C2PA tooling or registered assertion proposals independently.
4. Before normative adoption, re-audit any implementation against invariants I1–I7.
5. If an implementation requires weakening an invariant, open an explicit issue with the counterexample and rationale rather than silently changing semantics.
6. Prefer references to stable C2PA identifiers over copying C2PA semantics into UU-AAP-specific fields.
7. Treat Issue #4 as the coordination point until a dedicated interoperability workstream is explicitly established.

## 11. Open questions for Issue #4

1. Should UU-AAP register a dedicated C2PA assertion namespace, or should v0.1 use a generic external-manifest reference first?
2. Which fields are safe and useful to embed directly versus reference externally?
3. Should `work_id`/`edition_id` be duplicated in the C2PA assertion for offline verification convenience?
4. Which C2PA action classes should map to UU-AAP provenance dimensions, if any mapping is standardized?
5. How should conflicting C2PA AI disclosure and UU-AAP AI-participation declarations be displayed?
6. What receipt requirements, if any, should become normative for a future UU-AAP/V revision?
7. How should EPUB, PDF, HTML and structured-text packaging differences affect the reference profile?
8. How should successor manifests preserve both C2PA lineage and UU-AAP dispute/correction lineage?

## 12. Reference baseline

- C2PA Technical Specification 2.4: https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html
- C2PA Content Credentials guidance: https://spec.c2pa.org/specifications/specifications/2.4/specs/ContentCredentials.html
- UU-AAP `SPEC.md`, especially §§19–23
- UU-AAP `PRINCIPLES.md`, especially Verification is not truth, proportional transparency, durable history and contestability
- PoAI Genesis Principles, especially Existence is not availability, Availability is not use, Use is not authority, Proof is not truth

---

### Compact interoperability rule

> **C2PA proves artifact provenance; UU-AAP describes governance of meaning; PoAI describes decision-time availability. Evidence may cross these boundaries, but semantics must not be silently promoted across them.**
