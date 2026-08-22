# UU-AAP — Augmented Authorship & Accountability Protocol

**Version:** 0.1 Public Draft  
**Status:** Request for Public Comment  
**Publication date:** 2026-08-22  
**Review closes:** 2026-10-06  
**Normative language:** English  
**Specification prose license:** proposed CC BY 4.0  
**Reference code/schema license:** proposed Apache-2.0

> **Core idea:** UU-AAP records the governance of meaning: who held decision authority, how AI participated, what evidence supports material claims, how uncertainty is represented, and who accepts responsibility in defined scopes.

## 0. Status of this document

This is an experimental public draft. It is not a legal certification, copyright determination, industry standard, proof of truth, proof of originality, or guarantee that all AI use has been disclosed.

The purpose of v0.1 is to establish a reviewable data model and governance model for long-form intellectual works created through human–AI collaboration.

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative requirements.

`PRINCIPLES.md` is a normative design constraint. If the specification and principles appear to conflict, the conflict MUST be raised for public disposition rather than silently resolved by an implementation.

## 1. Problem

Existing content-provenance systems can bind signed assertions to digital assets. Publishing policies can require AI disclosure. Those mechanisms do not by themselves answer the authorship-governance questions most relevant to AI-augmented intellectual work:

- Who formulated the governing intent?
- Who had authority to choose among alternatives?
- Which important concepts were proposed, adopted, transformed or rejected?
- Who reviewed factual claims?
- Which uncertainties remained at publication?
- Who authorized the release?
- Which party is responsible for which part of that process?

UU-AAP treats these questions as provenance objects.

## 2. Design principles

### 2.1 Agency over purity

A conforming implementation MUST NOT treat less AI involvement as inherently more authentic or more trustworthy.

### 2.2 Role-based AI disclosure

AI participation MUST be disclosed by role and materiality where known. Implementations MUST NOT require a percentage such as “40% human / 60% AI” as a general measure of authorship.

### 2.3 Scoped responsibility

Responsibility MUST be assignable to specific scopes. A protocol implementation MUST NOT imply that a visible author has accepted responsibility for model training, platform infrastructure, third-party sources or other layers not declared in the manifest.

### 2.4 Selective disclosure and privacy

Conformance MUST NOT require complete prompt logs, private conversations, confidential sources, continuous screen recordings, biometric typing traces or proprietary model context.

Evidence MAY be public, redacted, hash-bound, privately escrowed or attested by a reviewer.

### 2.5 No linguistic AI detection as provenance proof

UU-AAP MUST NOT claim that linguistic-style classifiers can establish undeclared AI use or authorship identity.

### 2.6 Uncertainty is representable

Claims MAY be marked `asserted`, `provisional`, `speculative`, `disputed`, `unknown`, or `not_verified`. Interfaces MUST NOT erase these distinctions.

### 2.7 Contestability

Material provenance claims SHOULD expose a dispute path. Published corrections SHOULD create successor records rather than silently overwrite history.

### 2.8 Interoperability before invention

Implementations SHOULD reuse established standards for identifiers, signatures, credentials, timestamps, artifact binding and archival publication.

### 2.9 No scalar trust score

A conforming implementation MUST NOT present a single protocol-defined score that collapses AI involvement, provenance integrity, factual review and authorship responsibility.

## 3. Scope

UU-AAP v0.1 is designed primarily for:

- books and ebooks;
- essays and long-form articles;
- research reports and white papers;
- educational materials;
- scripts and other authored text;
- mixed text-and-image publications.

It MAY be applied to other intellectual works.

## 4. Non-goals

UU-AAP does not determine:

1. copyright ownership;
2. legal authorship in any jurisdiction;
3. originality or plagiarism;
4. factual truth;
5. model training provenance;
6. whether undisclosed AI was used;
7. moral or artistic value;
8. whether a source is trustworthy merely because it is listed;
9. whether a person deserves reputational credit beyond the declared scopes.

## 5. Actors

A manifest MAY contain multiple actors.

### 5.1 Human Actor

A natural person who participates in one or more creation, governance, verification or publication scopes.

### 5.2 Organization Actor

A legal or institutional entity with one or more declared scopes.

### 5.3 Contributor

A human or organization that contributes work without exercising final authority in the relevant scope.

### 5.4 AI System Actor

A model, service, agent or AI-enabled workflow used during creation.

An AI System Actor is recorded as a technical participant. UU-AAP does not assign moral or legal personhood to it.

### 5.5 Operator / Provider

An organization operating or providing an AI system or supporting service. Provider responsibility MUST NOT be inferred solely from the system being listed.

### 5.6 Reviewer

A person or organization that independently checks a declared subset of claims.

### 5.7 Publisher

The actor authorizing or executing release and distribution.

## 6. Responsibility scopes

Responsibility is represented as a matrix rather than one blanket declaration.

Recommended scopes:

- `intent_governance` — purpose, thesis, desired effect;
- `concept_selection` — adoption and naming of material concepts;
- `structure_approval` — architecture and ordering;
- `source_selection` — choice of evidence and references;
- `factual_verification` — checking factual claims, calculations, dates and citations;
- `editorial_approval` — acceptance of final wording and presentation;
- `publication_authorization` — decision to release the edition;
- `legal_compliance` — declared legal/compliance review scope;
- `technical_binding` — generation of hashes, signatures and provenance package;
- `review_attestation` — independent review statement.

Each responsibility entry MUST identify an actor, a scope, and an acceptance status.

Acceptance status is one of:

- `accepted`;
- `shared`;
- `limited`;
- `declined`;
- `unknown`.

A manifest claiming **Augmented Mind / human-governed authorship** MUST identify at least one human actor with `accepted` or `shared` responsibility for `intent_governance`, `concept_selection` or `editorial_approval`, and MUST identify a human or organization for `publication_authorization`.

## 7. Provenance dimensions

UU-AAP records participation across separate dimensions. A system MUST NOT collapse them into one score.

Recommended dimensions:

- `intent`;
- `concepts`;
- `research`;
- `structure`;
- `drafting`;
- `editing`;
- `verification`;
- `visuals`;
- `translation`;
- `publication`.

Each dimension MAY contain one or more participation records describing actors, tools, decision authority and materiality.

## 8. Origin classes

For important concepts or components, the following origin classes are RECOMMENDED:

- `human_originated` — first introduced by a human participant;
- `ai_suggested` — first proposed by an AI system and adopted or transformed through human judgment;
- `co_developed` — emerged through iterative human–AI interaction where separating origin would be misleading;
- `source_derived` — adapted from an identified external source;
- `collective_human` — originated through multiple human contributors;
- `unknown` — origin cannot be responsibly established.

Origin class is a declaration, not metaphysical proof.

## 9. Decision trace

The protocol distinguishes generation from acceptance.

For material contributions, a trace SHOULD be able to represent:

- the problem or decision being addressed;
- alternatives considered;
- alternatives rejected;
- material transformations;
- reasons for selecting an outcome;
- verification performed;
- unresolved uncertainty.

A decision trace MAY be public text, redacted summary, hash-linked private record or reviewer attestation.

A protocol implementation MUST NOT require every micro-edit to be recorded.

## 10. Epistemic status

A provenance or factual claim MAY declare an epistemic status:

- `asserted` — the responsible actor currently stands behind the claim;
- `provisional` — accepted for the edition but expected to require further review;
- `speculative` — intentionally exploratory or hypothetical;
- `disputed` — challenged by a recorded party;
- `unknown` — no responsible determination is available;
- `not_verified` — verification has not been performed.

Epistemic status MUST remain distinct from cryptographic validity.

## 11. Evidence classes

Evidence is classified without requiring disclosure of confidential content.

- `E0 declaration` — self-declaration only;
- `E1 artifact` — source file, revision, prompt excerpt, note or source snapshot exists;
- `E2 hash_bound` — evidence is represented by a cryptographic digest;
- `E3 signed` — evidence or manifest is digitally signed;
- `E4 third_party` — an independent reviewer or service has attested to a defined claim.

An implementation MUST display evidence class instead of implying that all evidence has equal strength.

Evidence class MUST NOT be interpreted as factual truth.

## 12. Conformance profiles

### UU-AAP/D — Disclosed

Required:

- work identifier and edition;
- actor list;
- AI participation roles;
- responsibility matrix;
- publication date;
- self-report status.

### UU-AAP/T — Traceable

Required in addition to D:

- version lineage;
- provenance dimensions;
- material concept-origin records where applicable;
- decision-trace summaries for material AI contributions;
- source-verification declaration;
- contestability channel or explicit statement that none exists.

### UU-AAP/V — Verifiable

Required in addition to T:

- SHA-256 digest or standards-based equivalent for the released artifact;
- signed manifest or signed Content Credential;
- transparency/registry receipt or equivalent durable publication record;
- verification instructions.

### UU-AAP/R — Reviewed

Required in addition to V:

- reviewer identity or verifiable pseudonymous reviewer key;
- review scope;
- review date;
- signed review attestation;
- explicit limitations and unresolved disagreements.

A product MUST NOT present profiles D, T or V as “certified”. The term **certified** SHOULD be reserved for a future governance scheme with defined accreditation and appeals.

## 13. Manifest model

A conforming manifest MUST contain:

```json
{
  "protocol": "UU-AAP",
  "protocol_version": "0.1",
  "profile": "T",
  "work": {},
  "actors": [],
  "responsibility": [],
  "ai_participation": [],
  "provenance": {},
  "verification": {},
  "privacy": {},
  "contestability": {},
  "versioning": {}
}
```

The JSON Schema in this release defines the machine-readable draft.

## 14. Work identity

`work` MUST contain:

- `title`;
- `work_id` — stable identifier controlled by publisher, author or registry;
- `edition_id`;
- `language`;
- `publication_date`.

It SHOULD contain persistent external identifiers when available, such as ISBN, DOI or another URI.

The protocol MUST NOT require a blockchain token.

## 15. AI participation record

Each materially used AI system SHOULD be recorded with:

- provider/operator where known;
- system/model name where known;
- model/version/date identifier where available;
- roles performed;
- whether outputs were directly incorporated;
- whether retrieval, tools or external actions were enabled;
- materiality (`minor`, `material`, `substantial`, `unknown`);
- disclosure notes.

If exact model identity is unavailable, it MAY be `unknown`, but known AI use MUST still be disclosed where required by the selected profile.

## 16. Concept lineage

A long-form work MAY publish a `concepts` collection.

Each concept SHOULD contain:

- stable concept ID;
- public label;
- origin class;
- first recorded version or approximate date;
- adoption/decision note;
- related source identifiers where relevant;
- evidence references;
- epistemic status where useful.

Concept lineage is intended to preserve intellectual genealogy without requiring publication of every private conversation.

## 17. Source verification

The manifest SHOULD state how factual sources were checked.

Permitted edition-level statuses:

- `not_applicable`;
- `author_reviewed`;
- `independent_review`;
- `automated_only`;
- `mixed`;
- `not_verified`.

Claim-level records MAY override the edition-level status.

Citation presence MUST NOT be presented as proof that a source is true.

## 18. Privacy, proportionality and redaction

A manifest MUST contain a privacy declaration.

Redaction is allowed for:

- personal information;
- confidential business information;
- unpublished research;
- security-sensitive information;
- third-party copyrighted material;
- contractual restrictions;
- source protection;
- safety of contributors.

A redaction SHOULD state its category without revealing protected material.

A verifier MUST NOT treat a declared redaction as evidence of misconduct.

Implementations SHOULD collect the least evidence necessary for the chosen profile.

## 19. Cryptographic binding

UU-AAP v0.1 RECOMMENDS SHA-256 for artifact digests where a standards-based format does not already define the binding.

For EPUB, PDF, HTML and other supported assets, implementations SHOULD use C2PA Content Credentials where practical rather than define a competing embedding system.

A UU-AAP manifest MAY be:

1. represented as or referenced by a C2PA assertion;
2. referenced by a C2PA manifest;
3. stored externally and hash-bound to the released artifact;
4. independently signed when C2PA embedding is unavailable.

A future version MAY define a registered C2PA assertion namespace.

## 20. Verifiable attestations

Independent review, publisher approval or organizational responsibility MAY be represented using W3C Verifiable Credentials or another interoperable signed-claims mechanism.

The protocol MUST NOT require one identity provider.

## 21. Transparency record

Profile V SHOULD place the signed manifest, manifest digest or standards-based repository receipt in a durable public record.

Possible mechanisms include:

- a provenance registry;
- append-only transparency log;
- C2PA repository receipt;
- DOI-backed archival release;
- signed repository release.

Blockchain is optional, not required.

## 22. Verification result

A verifier SHOULD report separate results:

- schema validity;
- artifact binding;
- signature validity;
- registry/transparency presence;
- declared conformance profile;
- responsibility scopes;
- review-attestation status;
- dispute status;
- unresolved warnings.

It MUST NOT output a protocol-defined single “truth score”.

Recommended display:

```text
UU-AAP/V
Manifest schema: valid
Artifact binding: valid
Signature: valid
Responsibility: scoped declarations present
Independent review: none
Disputes: none recorded
Epistemic status: mixed
Claims: self-declared unless individually attested
```

## 23. Corrections, disputes and appeals

A published manifest MUST NOT be silently overwritten.

Corrections SHOULD create a successor manifest referencing the prior manifest and describing:

- corrected fields;
- reason;
- correcting party;
- correction date;
- whether the correction resolves an existing dispute.

A registry SHOULD permit third parties to file disputes without altering the original historical record.

A dispute record SHOULD identify:

- target manifest or claim;
- challenger;
- challenge basis;
- evidence references;
- response status;
- disposition;
- appeal status.

Disagreement between reviewers MAY remain unresolved and SHOULD remain visible rather than being collapsed into a forced consensus.

## 24. Governance

Version 0.x uses an open-editor model.

Material changes SHOULD be proposed publicly and SHOULD include:

- problem statement;
- proposed normative change;
- compatibility impact;
- privacy/security impact;
- alternative positions;
- disposition rationale.

No single commercial implementation SHOULD control the normative meaning of the standard.

The initial proposer/editor has no permanent veto by virtue of authorship of v0.1.

A future governance body SHOULD include authors, publishers, technologists, researchers, librarians, legal experts, accessibility experts, AI providers and readers.

## 25. Security and coercion considerations

Threats include:

- false self-declarations;
- stolen signing credentials;
- incomplete model disclosure;
- fabricated decision traces;
- private evidence that cannot be independently inspected;
- link rot;
- edition substitution;
- coercive demands for complete prompt disclosure;
- employer or platform use of provenance as worker surveillance;
- reputational penalties based solely on AI involvement.

Implementations SHOULD minimize retained sensitive data and SHOULD separate public provenance from private audit evidence.

## 26. Ethical constraints

Conformance systems SHOULD NOT:

- require biometric proof of human typing;
- rank authors by “human purity”;
- shame authors for disclosed AI use;
- imply legal ownership from technical provenance;
- require publication of private prompts by default;
- create irreversible reputation penalties for corrected declarations;
- hide uncertainty to improve a visual trust indicator;
- treat absence of a UU-AAP record as evidence of wrongdoing.

## 27. Example publication statement

> This edition was produced under UU-AAP/T. AI systems participated in research, ideation, structural alternatives, drafting assistance and editorial revision. Human actors retained declared decision authority over intent, concept selection and final editorial approval. Responsibility for factual verification and publication is identified by scope in the public manifest. The record includes uncertainties and may be challenged through the published dispute process.

## 28. Public review questions

Reviewers are specifically invited to comment on:

1. Are responsibility scopes sufficiently granular?
2. Should `publication_authorization` always require a human or organization?
3. Is concept lineage useful enough to remain in the core protocol?
4. What is the minimum useful disclosure of model identity?
5. Should any full prompt logs ever be mandatory at profile R?
6. Are profiles D/T/V/R understandable to readers?
7. Should third-party review attest to process, claims, or both?
8. Should C2PA binding be the preferred reference implementation while remaining technology-neutral?
9. How should multiple human authors divide responsibility?
10. Which claims should support W3C Verifiable Credentials?
11. How should an appeal differ from a correction?
12. How can the protocol resist coercive use by employers, schools or governments?
13. Should `epistemic_status` be mandatory for speculative works?
14. Which features are too burdensome for individual authors?

## 29. Planned v0.2 topics

- canonical JSON serialization and signature profile;
- C2PA assertion mapping;
- W3C Verifiable Credential examples for reviewer attestations;
- multi-author responsibility matrix;
- institutional reviewer profile;
- registry receipt format;
- formal dispute and appeal objects;
- concept graph interoperability;
- EPUB/PDF interoperability tests;
- accessibility requirements;
- localized human-readable disclosure labels.

## 30. Short public definition

**UU-AAP is an open protocol for transparent and contestable human–AI authorship. It records governance of meaning, AI participation, scoped responsibility, evidence, uncertainty, artifact integrity, version history and review without requiring human-purity scoring or surveillance of the creative process.**
