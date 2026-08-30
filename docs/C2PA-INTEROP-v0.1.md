# C2PA 2.4 × UU-AAP — Semantic Boundary & Interoperability Profile v0.1

**Status:** Non-normative, evidence-informed interoperability profile  
**Repository scope:** Additive documentation only  
**C2PA baseline:** Technical Specification 2.4  
**Primary execution roadmap:** #778 — CAI/C2PA common interfaces and public-benefit interoperability  
**Related mapping review:** #4 — Map UU-AAP claims to C2PA 2.4  
**Evidence frontier incorporated:** P0.1–P0.5 through `f29c0412aa61d5cb9feb0a0b17eb2aad98bf61e5`

> C2PA artifact provenance, PoAI decision-time availability, and UU-AAP authority/responsibility are complementary evidence layers. They may reference one another, but none is allowed to silently promote the semantics of another.

## 0. Scope and coordination boundary

This document is intentionally **non-normative and collision-safe**.

It does not modify `SPEC.md`, `PRINCIPLES.md`, `REFERENCES.md`, schemas, UU-AAP Core conformance, C2PA conformance, C2PA trust infrastructure, cryptographic implementation, identity infrastructure, or Profile V requirements.

Issue #778 is now the primary executable interoperability workstream. Issue #4 remains useful for broader C2PA mapping review. The evidence summarized here comes from isolated runnable surfaces rather than from a claim that UU-AAP owns or replaces C2PA functionality.

The objective is narrow:

> Reuse established provenance interfaces where they already solve the artifact problem, while preventing provenance facts from being inflated into authorship, truth, decision-time availability, authority, responsibility, or historical use without separate evidence.

## 1. Layering model

Recommended composition:

```text
Digital asset / released artifact
        │
        ▼
C2PA
artifact provenance • assertions • signatures • bindings
AI disclosure • ingredients • actions • repository receipts
        │
        ▼
PoAI (when decision-time availability matters)
discoverability • reachability • authorization • temporal fit
context sufficiency • execution capability • delivery • consideration
        │
        ▼
UU-AAP
governance of meaning • intent • authority • scoped responsibility
uncertainty • contestability • successor records
        │
        ▼
Decision / publication / action / reviewed outcome
```

The arrows mean **evidence may be referenced across layers**. They do not mean that a lower layer automatically establishes a higher-layer claim.

## 2. Core semantic invariants

These invariants were proposed before the executable work and remain intact after P0.1–P0.5.

### I1. C2PA signer ≠ UU-AAP author ≠ approver ≠ authority ≠ responsible actor

A signer fact MUST NOT, by itself, be interpreted as proof that the signer:

- originated the work;
- governed intent;
- selected a concept;
- approved editorial meaning;
- authorized publication;
- accepted factual, legal, editorial, or other responsibility.

UU-AAP responsibility remains explicitly scoped and separately evidenced.

### I2. C2PA action ≠ UU-AAP decision

A C2PA action may provide evidence that an operation occurred. It does not, by itself, prove:

- why the operation was chosen;
- which alternatives were considered or rejected;
- who held decision authority;
- whether an output was accepted, relied on, or rejected;
- which uncertainty remained.

A `c2pa.actions` record MAY support a decision trace. It MUST NOT replace decision provenance when decision provenance is material.

### I3. C2PA ingredient ≠ UU-AAP concept origin

An ingredient describes an artifact/provenance relationship. A concept-origin record describes intellectual genealogy.

Ingredient evidence MAY support a concept-origin claim, but artifact lineage MUST NOT be automatically converted into concept lineage. The absence of an ingredient also MUST NOT be treated as proof that no external idea or source influenced the work.

### I4. C2PA AI disclosure ≠ decision authority or responsibility

C2PA AI-disclosure and human-oversight information may be useful process evidence. They MUST NOT be lossily promoted into UU-AAP authorship, decision authority, publication authority, or responsibility scopes.

A statement that an output was human validated does not, by itself, identify who:

- governed intent;
- selected concepts;
- verified facts;
- approved structure or wording;
- authorized publication;
- accepted a defined responsibility scope.

### I5. Repository receipt ≠ truth, review, or authorization

A repository receipt may support a durable provenance/publication fact. It MUST NOT be interpreted as proof that:

- the content is factually true;
- all declarations are complete;
- an independent reviewer checked the claims;
- publication authority was valid;
- no dispute exists.

Repository presence is not a universal trust verdict.

### I6. Cryptographic integrity ≠ epistemic truth

Cryptographic validation and epistemic status remain separate dimensions.

A correctly bound or signed assertion may still correspond to a claim that is `provisional`, `speculative`, `disputed`, `unknown`, or `not_verified`.

### I7. Artifact existence/provenance ≠ decision-time availability

A C2PA-bound or otherwise provenance-bearing resource may establish artifact existence or provenance. It does not establish that the resource was actually available for a specific historical decision.

When PoAI is used, availability remains multidimensional, including the existing Genesis dimensions:

```text
identity
 discoverability
 reachability
 authorization
 temporal_fit
 context_sufficiency
 execution_capability
 delivery
```

Availability also remains distinct from consideration and reliance.

## 3. Executable evidence incorporated into this profile

The current profile is no longer based only on hypothetical mapping. P0.1–P0.5 produced the following bounded observations.

### 3.1 P0.1 — semantic-boundary rubric (#779)

Merged frontier: `e3972ad78e99f0efa1a1e252805e70e477dc97a2`.

The executable rubric demonstrated that a C2PA-valid asset can still be interpreted unsafely by a consumer. In particular, the consumer-side inference:

```text
C2PA signer -> UU-AAP author
```

is rejected even when the C2PA artifact-validation surface succeeds.

This establishes a reusable distinction:

```text
artifact validation PASS != application semantic interpretation PASS
```

### 3.2 P0.2 — standard external-reference binding (#780)

Merged frontier: `4387d95046ac16264e05d0c14012501cef466dfd`.

The first executable UU-AAP external-record binding did **not** require a dedicated UU-AAP C2PA assertion namespace.

The tested path used the standard C2PA 2.4 `c2pa.external-reference` hashed variant:

```text
external UU-AAP record bytes
        -> SHA-256
        -> standard C2PA external reference
        -> signed asset
        -> re-validation
        -> digest match
```

A one-byte mutation of the external record fails the binding check. Signer identity remains separate from UU-AAP governance semantics.

**Current v0.1 recommendation:** prefer the standard external-reference mechanism for the first interoperable binding path. Do not introduce a custom UU-AAP assertion namespace unless a concrete, documented requirement cannot be satisfied by established C2PA mechanisms.

### 3.3 P0.3 — cross-SDK preservation frontier (#783)

Merged frontier: `22c656f39003cbdfff939516e6a3d9acca13d9c4`.

P0.3 deliberately remains **`INCOMPLETE`**. The result is a causal compatibility matrix, not a score.

At the pinned evidence frontiers:

```text
Swift unknown-field source contract -> PASS
Swift external consumer round-trip  -> BLOCKED
Android external-reference re-encode -> INCOMPATIBLE
Android unknown modeled field        -> LOSSY
```

The important interoperability rule is:

```text
ignore unknown != preserve unknown
```

A consumer or adapter MUST NOT treat tolerant parsing as proof of lossless intermediary behavior.

For the tested JSON fixtures, whitespace and object-key order are non-semantic, while values, JSON types, nesting, array order, and field presence are semantic. This equivalence rule does not redefine C2PA JUMBF/binary canonicalization.

**Adapter rule:** a bounded adapter may bridge representation gaps, but it must expose loss/rejection explicitly and must not manufacture trust, authority, authorship, or responsibility to compensate for incompatibility.

### 3.4 P0.4 — C2PA MCP -> PoAI -> UU-AAP agent composition (#784)

Merged frontier: `9ff804a01c045601e3f5517dd9e3c919ba0b5674`.

The executable composition intentionally returned three different answers:

```text
C2PA   -> CREDENTIALS_PRESENT
PoAI   -> UNAVAILABLE_BEFORE_CUTOFF
UU-AAP -> HUMAN_PUBLICATION_AUTHORITY
```

The same artifact can therefore have readable Content Credentials now while the corresponding evidence was unavailable before a historical decision cutoff. An agent may retrieve and analyze that evidence without acquiring publication authority.

This demonstrates:

```text
provenance observation != historical availability
availability != authority
agent recommendation != decision authority
```

No aggregate trust/reputation score is introduced.

### 3.5 P0.5 — field-evidence public-interest timeline (#785)

Merged frontier: `f29c0412aa61d5cb9feb0a0b17eb2aad98bf61e5`.

The pilot pinned a real external capture/provenance workflow frontier:

```text
guardianproject/proofmode-android
b7588b9d6b5e0df892cc929bf7d76ca03d9f5c07
README Git blob ab0309c2084e3daf00ec62b729d7e49e9fd2ad3d
```

The pinned README states C2PA support against specification release **2.3**. This profile does not promote that external implementation into a C2PA 2.4 conformance claim.

The synthetic public-interest decision timeline produced four separate states:

```text
capture A -> PROVENANCE_EXISTS_NOT_AVAILABLE
capture B -> AVAILABLE_NOT_USED
agent C   -> USED_WITHOUT_DECISION_AUTHORITY
UU-AAP    -> HUMAN_EDITOR authority/responsibility
truth     -> NOT_ESTABLISHED
```

This directly demonstrates:

```text
existence != availability
availability != use
use != authority
proof != truth
```

Late evidence may support a successor review, but MUST NOT be backfilled as historical availability or consideration.

## 4. Current v0.1 binding profile

### 4.1 Preferred binding path

For the first interoperable profile, prefer:

```text
released asset
   + C2PA manifest
       + standard c2pa.external-reference
           -> digest/reference to external UU-AAP/PoAI record
```

The external record remains independently retrievable/verifiable according to its own publication and privacy policy.

The purpose of the C2PA binding is to answer:

> Which external governance/availability record is cryptographically associated with this released artifact?

It is not to copy the entire governance process into the asset.

### 4.2 What should normally remain external

The following SHOULD normally remain in UU-AAP/PoAI records, private evidence stores, transparency registries, or separately signed attestations rather than be embedded wholesale:

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
- protected dispute evidence;
- redacted evidence contents.

A digest, URI/reference, selective-disclosure proof, or reviewer attestation MAY bind protected evidence without making the protected content public.

### 4.3 What may be useful to expose publicly

Subject to the chosen profile and privacy policy, a public external record may expose stable identifiers and verification-oriented metadata such as:

- protocol/version declaration;
- stable work/edition identifiers;
- public record URI;
- digest algorithm and digest;
- public verification instructions;
- public contestability/successor-record endpoint;
- public AI-system identifiers when intentionally disclosed.

These are UU-AAP/PoAI record design choices. They are **not** a new C2PA assertion schema in v0.1.

## 5. AI disclosure, actions, and ingredients bridges

### 5.1 AI disclosure bridge

Recommended rule:

1. Preserve C2PA AI-disclosure information as C2PA evidence.
2. Reuse compatible public identifiers where useful and intentionally disclosed.
3. Do not infer UU-AAP authorship, concept origin, authority, or responsibility from a C2PA oversight category.
4. Keep richer UU-AAP role/authority structures separate.
5. If records conflict, report the conflict; do not silently normalize one into the other.

Conceptually:

```text
C2PA AI disclosure
  -> evidence/reference for AI participation
  -/> automatic authority/responsibility
```

### 5.2 Actions bridge

A C2PA action MAY be referenced as evidence for a provenance dimension and MAY participate in a decision trace.

```text
C2PA action
   -> operation-provenance evidence
      -> may support UU-AAP provenance
         -> may participate in a decision trace
```

The reverse inference is not automatic: a UU-AAP decision does not prove that a particular technical operation occurred unless corresponding evidence exists.

### 5.3 Ingredient bridge

A C2PA ingredient MAY be referenced from:

- a source/evidence reference;
- a concept-lineage evidence record;
- a released-artifact lineage record.

The original C2PA identifier/manifest relationship SHOULD be preserved rather than restated in a lossy local form.

## 6. Repository receipts and durable publication

C2PA repository receipts remain a promising candidate interface for durable-publication evidence in a future UU-AAP/V integration.

A verifier may eventually report separate facts such as:

```text
Artifact binding: valid
C2PA signature: valid
Repository receipt: present
UU-AAP external record digest: matches
UU-AAP profile: declared
Publication authority: actor/scope declared
Independent review: absent / present / disputed
Epistemic status: asserted / mixed / disputed
PoAI availability: not evaluated / evaluated separately
```

No receipt or combined display should be collapsed into a protocol-defined truth or trust score.

Repository-receipt requirements are **not made normative by this document**.

## 7. Contestability and successor records

C2PA provenance and UU-AAP contestability should compose without mutating history.

Recommended pattern:

```text
Asset A + C2PA Manifest A + UU-AAP/PoAI Record A
                     │
                 challenge
                     │
                     ▼
              dispute record
                     │
              correction/review
                     │
                     ▼
Asset/Manifest/Record successor B
```

A correction SHOULD create a successor record rather than silently rewrite the prior decision-time state.

P0.5 adds an important temporal rule:

> Evidence arriving after a historical knowledge cutoff may justify a successor review, but it does not become retroactively available or considered in the predecessor decision.

## 8. Privacy and proportional disclosure

Interoperability MUST NOT turn C2PA embedding into a reason to expose more human process data than UU-AAP otherwise requires.

Preserve:

- selective disclosure;
- least evidence necessary for the chosen profile;
- hash-bound/private evidence where appropriate;
- no mandatory complete prompt history;
- no mandatory continuous screen recording;
- no biometric typing evidence for ordinary conformance;
- no inference of misconduct merely because evidence is redacted.

A public C2PA asset should normally carry or bind enough information to locate and verify the relevant external record, not a surveillance archive of the creative process.

## 9. Failure cases the interoperability layer must resist

### F1. Responsibility laundering through signer identity

**Bad inference:** “The publisher's C2PA certificate signed the artifact; therefore the publisher accepts all factual responsibility.”  
**Required behavior:** signer identity and UU-AAP responsibility scopes remain separate.

### F2. Human-validation laundering

**Bad inference:** “C2PA says human validated; therefore the work is human-authored or human-responsible under UU-AAP.”  
**Required behavior:** retain the C2PA observation and require separate UU-AAP role/authority/responsibility evidence.

### F3. Action laundering

**Bad inference:** “The provenance history says edited; therefore a human meaningfully reviewed the claim.”  
**Required behavior:** operation provenance is not decision provenance.

### F4. Ingredient laundering

**Bad inference:** “Source X is an ingredient; therefore concept Y originated from X.”  
**Required behavior:** require an explicit concept-origin relation/evidence claim.

### F5. Receipt-as-trust-badge

**Bad inference:** “Repository receipt present; content is trustworthy/true.”  
**Required behavior:** expose receipt/integrity separately from factual review, responsibility, epistemic status, and disputes.

### F6. Hindsight injection into PoAI

**Bad inference:** “The source existed before the event; therefore it was available to the decision-maker.”  
**Required behavior:** evaluate actual decision-time availability against the Decision Boundary / Knowledge Cutoff and access/delivery conditions.

### F7. Availability-as-use

**Bad inference:** “The source was available before the cutoff; therefore it was considered.”  
**Required behavior:** consideration/reliance requires separate evidence.

### F8. Use-as-authority

**Bad inference:** “The AI analysis was considered; therefore the AI had decision authority.”  
**Required behavior:** authority remains explicitly scoped and independent of use.

### F9. SDK-tolerance-as-preservation

**Bad inference:** “The SDK accepted an unknown field; therefore it will preserve that field on re-encode.”  
**Required behavior:** distinguish accepted, preserved, lossy, blocked, and incompatible surfaces.

### F10. External-version promotion

**Bad inference:** “A capture workflow supports C2PA, therefore it conforms to the C2PA 2.4 baseline used by this profile.”  
**Required behavior:** preserve the actual pinned implementation/version claim. Do not upgrade it by association.

## 10. Verification UI boundary

A verifier combining the layers SHOULD render independent dimensions rather than one badge.

| Dimension | Example result |
|---|---|
| C2PA artifact/claim validation | valid / invalid / not evaluated |
| External UU-AAP record binding | matches / mismatch / unresolved |
| SDK preservation surface | PASS / LOSSY / BLOCKED / INCOMPATIBLE / not evaluated |
| PoAI decision-time availability | available / partial / unavailable / unknown |
| Consideration/reliance | not used / considered / relied upon / unknown |
| Intent governance | actor/scope declared |
| Publication authorization | actor/scope declared |
| Scoped responsibility | actor/scope declared |
| Epistemic status | asserted / mixed / disputed / not verified |
| Contestability | available / unavailable |
| Successor review | none / available / present |

The UI MUST NOT imply that C2PA validity proves UU-AAP responsibility, that UU-AAP responsibility proves factual truth, that PoAI availability proves use, or that use proves authority.

## 11. Resolved and open questions

### Resolved for the current v0.1 path

1. **Dedicated C2PA namespace now?** No for the first binding path. P0.2 demonstrated a standard `c2pa.external-reference` hashed binding. A custom namespace should require a concrete unmet need.
2. **Embed the full governance trace?** No by default. Keep detailed UU-AAP/PoAI evidence external and bind it minimally.
3. **Can artifact existence stand in for PoAI availability?** No. P0.4/P0.5 demonstrate the distinction executably.
4. **Can availability stand in for consideration?** No. P0.5 demonstrates `AVAILABLE_NOT_USED`.
5. **Can considered AI output stand in for decision authority?** No. P0.4/P0.5 keep the agent recommendation-only.
6. **Can tolerant unknown-field parsing be treated as preservation?** No. P0.3 demonstrates explicit LOSSY/INCOMPATIBLE/BLOCKED states.

### Still open

1. Should `work_id` / `edition_id` be duplicated in any offline-oriented public binding surface for convenience?
2. Which C2PA action classes, if any, merit a standardized mapping to UU-AAP provenance dimensions?
3. How should conflicting C2PA AI-disclosure and UU-AAP AI-participation declarations be displayed?
4. What repository-receipt requirements, if any, should become normative for a future UU-AAP/V revision?
5. How should EPUB, PDF, HTML, Markdown, and structured-text packaging differences affect reference resolution?
6. How should successor manifests preserve both C2PA lineage and UU-AAP dispute/correction lineage?
7. Which bounded adapters are acceptable while official SDK preservation frontiers remain incomplete?
8. Which publishing/CMS interface is the best P0.6 reference implementation for publication authorization separate from signer identity, authorship, AI participation, and truth?

## 12. Integration strategy

1. Keep this document non-normative and additive.
2. Use #778 as the executable interoperability roadmap and #4 as the broader mapping-review surface.
3. Prefer established C2PA mechanisms over new UU-AAP-specific provenance infrastructure.
4. Keep private governance evidence external unless embedding is necessary and justified.
5. Bind external records with minimum necessary public data.
6. Re-audit new implementations against I1–I7 and F1–F10.
7. Preserve explicit causal states instead of aggregate compatibility/trust scores.
8. Treat SDK and external implementation versions as pinned evidence frontiers, not timeless capability claims.
9. Keep `protocols/core/**` unchanged unless a separate normative process explicitly authorizes a Core change.

## 13. Reference baseline

- C2PA Technical Specification 2.4
- C2PA Content Credentials guidance
- UU-AAP `SPEC.md`, especially §§19–23
- UU-AAP `PRINCIPLES.md`, especially verification-is-not-truth, proportional transparency, durable history, and contestability
- PoAI Genesis schema/principles, especially Existence is not availability, Availability is not use, Use is not authority, Proof is not truth
- #778 executable evidence surfaces P0.1–P0.5

---

### Compact interoperability rule

> **C2PA describes/proves bounded artifact provenance facts; PoAI describes bounded decision-time availability and use; UU-AAP describes bounded authority and responsibility. Evidence may cross these boundaries, but semantics must not be silently promoted across them.**
