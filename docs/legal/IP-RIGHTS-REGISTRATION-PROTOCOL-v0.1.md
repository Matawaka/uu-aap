# UU-AAP IP Rights Registration Protocol v0.1

Status: **operational draft**  
Legal snapshot: **2026-08-25 (Russian Federation baseline; international filing requires jurisdiction-specific review)**

## 1. Purpose

This protocol turns intellectual-property registration into a repeatable evidentiary process for UU-AAP, its reference stack, applications, databases, documentation, diagrams, brands and potentially patentable technical solutions.

It is designed for a development rate of **10+ independently releasable applications per year** without turning every commit into a separate legal filing.

The protocol is evidence-first and fail-closed:

`State/Evidence Anchor → IP Object Classification → Authorship/Rights Proof → Patentability Gate → Registration Intent → Filing Package → Filing Receipt → Registration Outcome → Successor State`

## 2. Core legal boundary

For Russian-law filings, use the legally precise distinction between **authorship**, **exclusive right**, and **state registration**.

Copyright arises from creation of a protectable expression; registration is generally not required. Programs for computers and databases may be registered voluntarily with Rospatent. Ideas, concepts, principles, methods, processes, systems and solutions of organizational or other tasks are not protected by copyright as such.

Therefore UU-AAP must not attempt to register "the architecture" as an abstract idea. Protection is layered:

- specification prose, diagrams and explanatory materials → copyright in the concrete expression;
- source code, executable tooling, validators, schemas where they constitute implementation content, SDK/CLI/runtime components and software complexes → copyright + optional Rospatent registration as a program for computers;
- qualifying databases → copyright and/or database rights + optional Rospatent registration where applicable;
- genuinely technical solutions that are not merely a computer program, rule, method of intellectual/economic activity or presentation of information "as such" → patentability review before public disclosure;
- project/product names and logos used for individualization → trademark strategy;
- third-party material → only the rights actually granted by its owner.

## 3. Invariants

The following invariants are mandatory:

- `Architecture Concept != Copyright Object`
- `Proof of Creation != Proof of Exclusive Ownership`
- `Canonical Lineage != Legal Ownership Adjudication`
- `Open License != Abandonment of Copyright`
- `Permission to Reuse != Transfer of Ownership`
- `Merge != Assignment of Exclusive Rights`
- `Registration != Conclusive Authorship Adjudication`
- `Registration of Core != Registration of Future Applications`
- `Contribution Acceptance != Sole Authorship of Maintainer`
- `AI Assistance != Automatic Transfer of Authorship or Rights`
- `Public Repository != Patent-Safe Disclosure`
- `Patentability Review != Patent Grant`
- `Software Registration != Patent Protection`

No filing package may contradict repository provenance merely to simplify ownership claims.

## 4. IP object classes

Each candidate release must be classified into one or more of these classes:

1. `COPYRIGHT_EXPRESSION`
   - specification prose;
   - diagrams;
   - explanatory graphics;
   - documentation;
   - authored test vectors or narrative examples.

2. `SOFTWARE`
   - source code;
   - executable tooling;
   - validators;
   - reference implementations;
   - SDK/CLI/runtime software;
   - a sufficiently coherent software complex.

3. `DATABASE`
   - systematic collections of independent materials capable of computer search/processing;
   - evidence/event registries where the legally relevant database criteria are actually met.

4. `TECHNICAL_SOLUTION`
   - a candidate invention or other patentable technical result requiring a separate patentability assessment.

5. `TRADEMARK_CANDIDATE`
   - UU-AAP and application/product names or logos used to distinguish goods/services.

6. `THIRD_PARTY_OR_RESTRICTED`
   - material not owned by the proposed applicant, including externally licensed content and contributions for which only a license—not assignment—has been obtained.

7. `NON_PROTECTABLE_ABSTRACTION`
   - idea, concept, principle, method, rule, process, system abstraction or organizational solution as such.

## 5. Evidence Anchor

Every registration candidate must bind to an immutable or reproducible evidence anchor containing at minimum:

- canonical repository identifier;
- commit SHA;
- release/tag when available;
- object title and version;
- repository paths included in the object;
- cryptographic digest(s) of the filing/deposit package;
- date of creation/release claimed in the filing;
- first-public-disclosure timestamp when known;
- author list and contribution provenance;
- proposed right holder(s);
- legal basis for each right holder's authority;
- applicable repository license and file-specific overrides;
- third-party dependency/material inventory;
- known AI-assistance provenance relevant to authorship claims.

A filing package must remain reproducible from this anchor or from a preserved content-addressed archive.

## 6. Rights/Authority Proof

For every human contribution included in a filing, record one of the following rights bases:

- `AUTHOR_OWNED`
- `COAUTHORED`
- `EMPLOYEE_WORK`
- `COMMISSIONED_WITH_EXCLUSIVE_RIGHT`
- `ASSIGNED_EXCLUSIVE_RIGHT`
- `LICENSED_ONLY`
- `PUBLIC_DOMAIN_OR_NO_COPYRIGHT`
- `THIRD_PARTY`
- `UNKNOWN`

`LICENSED_ONLY`, `THIRD_PARTY`, or `UNKNOWN` material must not be represented as exclusively owned by the applicant.

Where repository contribution rules grant only an inbound license, that license does not silently become an assignment of exclusive rights.

### Fail-closed ownership gate

The candidate cannot enter `READY_TO_FILE` if:

- the filing would name a sole right holder but unresolved coauthorship or ownership exists;
- material is included under `UNKNOWN` rights basis;
- third-party material would be presented as applicant-owned;
- author identity is guessed from merge authority, commit control, or project governance;
- the requested filing scope is broader than the actual rights evidence.

The correct response is to narrow the filing object, add accurate coauthor/right-holder information, or obtain a written assignment/other sufficient rights instrument.

## 7. Patentability Gate

Before a potentially technical solution is publicly merged, released, discussed in sufficient technical detail, or included in a public filing package, classify it as:

- `NOT_PATENT_CANDIDATE`
- `PATENT_CANDIDATE_REVIEW_REQUIRED`
- `PATENT_FILING_FIRST`
- `PATENT_DECLINED_THEN_PUBLISH`
- `ALREADY_PUBLIC_DISCLOSURE_REVIEW_REQUIRED`

Default rule:

`potentially patentable technical solution → patentability decision before public merge`

Russian law currently provides a limited grace period for certain disclosures made by the author/applicant or persons deriving the information from them, but this protocol must not rely on a grace period as the ordinary publication strategy because foreign novelty rules and factual proof of the disclosure chain can differ.

## 8. Registration Intent

A filing is initiated only after an explicit registration intent record states:

- why registration is useful;
- object type;
- applicant/right holder;
- authors to be named;
- filing jurisdiction;
- filing route;
- public-disclosure status;
- whether patent review is complete;
- expected cost class;
- whether this is a new object, major successor version, database, mark, or patent candidate.

`Available filing != Obligation to file`

Registration should be selective enough to avoid administrative noise but systematic enough to preserve major commercial and evidentiary boundaries.

## 9. Rospatent software/database filing package

For each Russian program-for-computers or database filing, preserve at minimum:

- official application form data;
- right holder information;
- author information, unless an author lawfully declines mention where permitted;
- deposited materials sufficient to identify the program/database;
- abstract;
- required personal-data and author-publication consents;
- representative authority if a representative is used;
- state-fee payment evidence or applicable privilege basis;
- package digest;
- filing date and incoming/application number after submission;
- Rospatent requests and responses;
- registration decision and registration number, or refusal/withdrawal outcome.

One Russian filing must relate to one program for computers or one database. Do not treat "all future applications" as one blanket registration.

## 10. High-throughput filing policy for 10+ applications/year

Use three levels.

### Level A — automatic provenance for every release

Every releasable application receives an IP record and evidence anchor whether or not a government filing is planned.

### Level B — Rospatent registration for independently valuable software objects

Default registration candidates:

- UU-AAP reference implementation/validation stack as a coherent software object or software complex;
- each independently distributed application with its own functional identity and release lifecycle;
- substantial successor software where a new filing materially improves evidentiary/commercial clarity;
- qualifying databases with independent value.

Do **not** file every patch, commit, schema edit or internal build as a separate program.

### Level C — patent/trademark portfolio

Run separately:

- patent screening for technical solutions before public disclosure;
- trademark clearance/filing for stable product names and logos with real individualization value.

## 11. Recommended cadence

For 10+ applications/year:

- on every release candidate: automatic evidence anchor + rights classification;
- before first public release of each independent app: patentability gate;
- monthly: rights/third-party audit of new registrable objects;
- quarterly: filing batch for completed software/database candidates;
- annually: portfolio review for obsolete, successor and strategically important registrations;
- before any ownership transfer, investment transaction, entity restructuring, or commercialization deal: reconcile repository provenance with the legal rights register.

## 12. State machine

Allowed states:

- `DISCOVERED`
- `CLASSIFIED`
- `EVIDENCE_ANCHORED`
- `RIGHTS_REVIEW`
- `RIGHTS_CLEARED`
- `PATENT_SCREEN`
- `READY_TO_FILE`
- `FILED`
- `OFFICE_ACTION`
- `REGISTERED`
- `REFUSED`
- `WITHDRAWN`
- `SUPERSEDED`

No direct transition from `DISCOVERED` to `FILED` is conformant.

## 13. Receipts

Each transition should issue a typed receipt with:

- predecessor state;
- successor state;
- actor/authority;
- evidence inputs;
- assertions;
- explicit non-effects;
- timestamp;
- digest;
- external filing reference when available.

Example non-effects:

- `registration receipt does not prove sole authorship`
- `repository provenance receipt does not transfer rights`
- `patent review receipt does not guarantee patentability`
- `license grant does not establish canonical succession`

## 14. Relationship to current UU-AAP licensing

The current repository split-license model remains compatible with registration:

- CC BY 4.0 for non-software content does not erase copyright ownership;
- Apache-2.0 for software permits broad reuse but does not by itself transfer copyright ownership;
- current inbound=outbound contribution practice preserves contributor provenance and does not make the repository editor the sole owner of every contribution.

Accordingly, registration must be limited to rights actually held by the named applicant(s).

A future CLA/assignment policy, if desired, is a separate governance and legal decision and must not be introduced retroactively or silently.

## 15. Wave 1 target

The first operational registration wave should create:

1. a frozen evidence anchor for the current UU-AAP core/reference implementation;
2. a rights map separating original applicant-owned material, coauthored/contributor material, licensed third-party material and unresolved material;
3. a patentability review list for any technical solution whose public disclosure could matter;
4. a Rospatent-ready software filing package for the rights-cleared UU-AAP reference implementation/validation stack;
5. a reusable per-application registration record for all future applications;
6. a separate candidate review for KONTUR and other independently releasable applications rather than silently folding them into the core filing.

## 16. External legal review boundary

This protocol is an engineering/evidence and filing-governance layer, not a substitute for jurisdiction-specific legal advice. Patent claims, contested authorship, employment-created works, international filings, complex assignments and trademark conflicts should be reviewed by a qualified IP professional before irreversible filing or disclosure decisions.
