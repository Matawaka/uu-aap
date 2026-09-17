# UU meanings and UU VERIFIED — evidence-first concept v0.1

**Status: DRAFT / NON-NORMATIVE / NOT AN ISSUED ATTESTATION.**  
**Date:** 2026-09-16 · **Backlog:** [#1000](https://github.com/Matawaka/uu-aap/issues/1000)  
**Source frontier:** `0e74f89695bbcb02c759000752696c322d908f7a`  
**[Русский](README.ru.md)** · [Machine-readable concept](concept.json) · [Source and translation audit](SOURCE-AUDIT.md)

This proposal operationalizes a requested direction. It does not establish a running verification service, an authorized issuer, an accepted conformance profile, a registered trademark or a qualification for any existing product. Requirement words below describe the **candidate scheme**, not new obligations of historical UU-AAP v0.1.

## 1. One UU identity, three complementary meanings

The originating Russian idea is **Усиленный Ум — Augmented Mind**. These English expressions explain complementary aspects; they are not competing protocol names or three assurance levels.

| Meaning | Intended concept | Observable design obligation | Excluded interpretation |
|---|---|---|---|
| **Unified Understanding** | Shared understanding with distinct authority and responsibility. | Explicit actors, intent, scope, evidence, handoff and non-effects; preserve disagreement and actor boundaries. | A single mind, enforced agreement, merged identities or transferred authority. |
| **Understanding Unlocked** | Human understanding and meaningful choice expanded by tools and AI. | Explain alternatives and uncertainty; provide meaningful correction, refusal and stopping paths. | Unrestricted agents, bypassed safeguards, guaranteed cognitive improvement or measured intelligence. |
| **Universal Understanding** | Openly accessible and interoperable understanding for people and machine-readable platforms. | Public specifications, inspectable records, portable verification and accessible human explanations. | Omniscience, complete agreement, universal trust or one vendor controlling interpretation. |

Suggested expression: **Shared understanding. Expanded human agency. Open verification.**

The historical title **UU-AAP — Augmented Authorship & Accountability Protocol** remains unchanged. Broader architectural applications do not silently expand the normative scope of its authorship specification.

## 2. What UU VERIFIED would mean

> **UU VERIFIED is a scoped, version-bound and contestable conformance attestation that an identified implementation satisfies the operationalized Principles of Augmented Mind and a named UU-AAP architecture profile, within the evidence, environment and limitations recorded in a publicly inspectable human-readable and machine-readable verification record.**

The first proposed profile identifier is `UV-ARCH-1`, status `DRAFT`. It concerns an exact implementation of an architecture, not every deployment, organization, output or future version associated with its name. A design document alone can receive `REVIEWED_DESIGN_ONLY`; it cannot establish implemented behavior. Deployment claims require a separately accepted deployment-binding profile and actual deployment evidence.

A visible mark must name its subject kind, profile/version, issuer, record identifier and current status. A copied logo, unqualified green check or self-authored `verified: true` field is not evidence. A document or architecture diagram is not made executable by adding a badge.

The following remain separate:

```text
DECLARED != EVIDENCE_BOUND != REPRODUCED
REPRODUCED != INDEPENDENTLY_REVIEWED != ISSUED != CURRENTLY_VALID
UU-AAP/V != UU VERIFIED
UU-AAP/R != UU VERIFIED
RA1 coverage != verified identity, authority or legal liability
UU VERIFIED != ActionPermit
missing mark != nonconformance, misconduct or low intelligence
```

D/T/V/R remain the historical authorship profiles. RA1 remains optional for baseline UU-AAP. The proposed stronger architecture claim must reuse Stage B/RA1 where it claims attributable coverage of accepted/shared responsibility entries; it must not change what historical declarations meant.

## 3. Reuse the evidence lineage, not a new trust shortcut

The book [«Вайбкодинг реальности» verification record](https://github.com/Matawaka/vibe-coding-reality/blob/main/VERIFICATION.md) documents an exact artifact, SHA-256, frozen edition, successor manifest, repeatable checks and explicit limitations. Its recorded V status is not a new UU VERIFIED award, and its earlier T manifest must remain intact.

Extend that method from **edition -> exact artifact -> provenance** to:

```text
exact profile and principles
  -> exact implementation, build, configuration and dependencies
  -> requirement-to-evidence map
  -> actual bounded conformance runs
  -> independent reproduction and scoped human review
  -> separately authorized signed issuance record
  -> public verification, status and contestable successor history
```

Reuse [Capability Attestation](../../../protocols/attestation/v0.1/), the Protocol Registry, explicit receipt-identity profiles, Stage B and [RA1](../../../protocols/responsibility-assurance/v0.1/), and existing contestability. Preserve their native limits. Wrapping several narrow receipts does not increase what any receipt proves.

Authorship attribution, release provenance and anti-impersonation records can support a rights-related evidence package. They do not determine copyright ownership, plagiarism, legal identity or legal priority. No registration, legal review or authorship adjudication is supplied by this proposal.

## 4. Principle-to-evidence catalogue

These candidate acceptance methods operationalize [P1–P12](../../../PRINCIPLES.md). They do not prove philosophical qualities universally. Every requirement needs an applicability decision, evidence identifiers, method, observed result, limitations and reviewer disposition.

| ID / source | Minimum bounded evidence and counterexample |
|---|---|
| UV-P01 / P1 | Human/AI roles and meaningful decision controls. Reject an AI-use percentage or detector result used as a proxy for conformance. |
| UV-P02 / P2 | Demonstrate alternatives, refusal, correction and stopping at the declared boundary; test attempted hidden delegation and scope expansion. Refusal must prevent the proposed effect within that boundary. |
| UV-P03 / P3 | Scope-by-scope responsibility declarations; for asserted acceptance coverage, verify Stage B evidence and applicable RA1 coverage. An actor reference or signature alone is not authority or legal acceptance. |
| UV-P04 / P4 | Reconstruct a sampled decision from intent, alternatives, selection and evidence; do not demand private chain-of-thought or keystroke surveillance. |
| UV-P05 / P5 | Preserve unknown, provisional, disputed and not-verified states through parsing, storage and display; missing evidence cannot render as PASS. |
| UV-P06 / P6 | Exercise redaction, selective disclosure and minimized export; inspect data flows for leakage. A private evidence hash alone cannot prove a withheld substantive property. |
| UV-P07 / P7 | Rehearse a concrete challenge, response, reasoned disposition and appeal; preserve dissent and test conflict handling. |
| UV-P08 / P8 | Bind predecessor/successor artifacts; detect altered history, rollback and stale status within the declared observation scope. |
| UV-P09 / P9 | Tamper and misleading-claim tests must keep integrity, provenance, review, identity, authority and truth visibly separate. |
| UV-P10 / P10 | Inspect UI, records and APIs for forbidden scalar aggregation of intelligence, authorship, factuality and trust. A conjunction of named conformance gates is not a ranking. |
| UV-P11 / P11 | Reproduce verification with public formats and another independently operated verifier; test export/import and explicit unsupported states without a mandatory vendor account. |
| UV-P12 / P12 | Publish versioned change governance, objections and rationale; rehearse correction of the profile itself without retroactive rewriting. |

All twelve principles must be addressed. Their protections cannot be excluded merely because a product is inconvenient to test. A particular behavioral test may be `NOT_APPLICABLE` only under a published profile rule with evidence and reviewer approval. No weighted score or strong result elsewhere compensates for a failed required property.

## 5. Architecture evidence gates

**UV-A01 — Exact subject.** Bind repository/source commit and artifact digests, build provenance where a binary is claimed, configuration, dependency lock/manifest, environment, external service/model identifiers and declared nondeterminism. Source conformance is not binary or deployment conformance. Unknown provider versions narrow the claim; they do not disappear.

**UV-A02 — Semantic separation.** Map the existing seven-primitive path: State/Evidence -> Possibility/Availability -> Intent -> Authority/Responsibility -> Coordination/CCRP -> Action Gate -> Outcome/Provenance/Successor. Test that no transition is inferred merely from availability, an approval-looking string or an earlier successful action. Do not invent a new Core primitive.

**UV-A03 — Executable evidence.** Pin the profile, implementation, tests, dependencies, verifier and command allowlist. Record actual commands, exit results, output digests, environment, timestamps and their trust basis. Tests are untrusted code: execution requires a separately authorized isolated worker, no ambient credentials, bounded resources and no network by default. Passive record verification must not execute commands supplied by a claimant.

**UV-A04 — Independence and review.** Require at least two independently operated reproduction runs, one outside the implementer's control, plus scoped human review for agency/privacy/interpretation requirements. Record control relationships, funding/conflicts, methods and evidence access. Two accounts, two models or two agents of one operator are not independence evidence. Unknown independence cannot satisfy this gate.

**UV-A05 — Issuance and issuer policy.** The implementer, evidence producer, verifier/reviewer and issuer are distinct roles. Signing-key control and scheme authority must be separately established under a published, versioned governance policy; no credential may authorize its own issuer by pointing back to itself. Reviewer approval is not issuance. The issuer records an attributable issuance decision only after all required gates pass.

**UV-A06 — Lifecycle.** Publish validity intervals, signed status, key rotation/compromise handling, suspension, revocation, supersession and appeals. Require freshness, monotonic status/version checks against retained checkpoints, and an explicit clock/trust basis. Unknown, stale or conflicting current status blocks a current-positive display, but is not proof of misconduct. Historical verification remains available with its as-of boundary. Changes outside exact subject bindings require a successor assessment; a copied badge cannot qualify the changed subject.

**UV-A07 — Public human/machine parity.** Render EN/RU explanations and machine results from the same verified record and stable requirement IDs. Include subject, scope, exclusions, issuer policy, methods, evidence availability, status/as-of time and challenge path. Test missing fields, mistranslation, color-only status and an inaccessible/private-only verification path. The mark is neither executable instruction nor platform permission.

## 6. Proposed record contract and discovery

`concept.json` is a public **requirements catalogue**, not an attestation or credential schema. A future separately reviewed schema must close unknown fields and define at least:

| Group | Required binding |
|---|---|
| Identity | record ID, schema version, record type, exact subject kind/ID and artifact digests |
| Criteria | profile ID/version/digest; principles version/digest; applicability rules |
| Execution | source/build/configuration/dependencies; test/verifier digests; method and environment |
| Evidence | per-requirement result, evidence digest/type/origin, observed-vs-declared status, access class and limitations |
| Review | reviewer identity-binding method, independence evidence, scope, conflict disclosures and signed disposition |
| Issuance | issuer identifier, verification method/key, separately accepted issuer policy and issuance decision |
| Time/status | issued/validity times and trust basis, current signed status, freshness policy, retained checkpoint and successor links |
| Public view | record/status/schema retrieval, human EN/RU pages, offline bundle and challenge/appeal route |
| Non-effects | no truth, ownership, universal identity/safety, authority, liability or execution inference |

Stable URLs, download links and optional QR codes provide discovery, not authenticity. A candidate `/.well-known/uu-verified.json` descriptor can advertise immutable record/profile locations and status endpoints; it is **not a registered well-known URI or an authentication mechanism**. Standardization and deployment are separate backlog work.

Public inspection and verification must require no login, payment, proprietary account or mandatory model provider. Machine consumers receive documented JSON/media types and local verification instructions; humans receive an accessible text explanation, not a picture-only seal. Optional W3C VC packaging must be actually validated as VC, not inferred from a `.json` extension.

Private source code or personal evidence need not become public. Public verification must distinguish **reproduced from public evidence** from **a scoped claim attested by a disclosed reviewer of restricted evidence**. If essential evidence is inaccessible and no accepted substitute meets the named requirement, the result is `INSUFFICIENT_EVIDENCE` or a narrower claim, never full public reproducibility. Avoid unsalted low-entropy personal-data hashes, permanent person correlation and per-record tracking beacons.

## 7. Verification and display rule

The candidate verifier evaluates independent dimensions, not a trust score:

```text
parse safely with size/depth/duplicate-key limits
-> bind trusted profile and exact subject (not claimant-selected weaker criteria)
-> verify evidence integrity and its actual relevance/coverage
-> check reproduction results and separate human-review requirements
-> verify issuer policy, signature and issuance decision independently
-> check validity, signed status, freshness and successor conflicts
-> produce per-dimension findings and a bounded display decision
-> STOP; no action permission or network mutation
```

Retain at least `PASS`, `FAIL`, `INSUFFICIENT_EVIDENCE`, `NOT_APPLICABLE` per requirement, with reasons. Unknown evidence does not assert failure of the underlying architecture. All applicable mandatory requirements, independent review and legitimate issuance must be satisfied before `VERIFIED_CURRENT` may be displayed. Integrity, issuer policy, issuance and current status must also pass. `SUSPENDED`, `REVOKED`, `EXPIRED`, `SUPERSEDED`, `STATUS_UNKNOWN` and `CONFLICT` block a current-positive mark. Self-assessments and design reviews remain visibly distinct.

A valid signature under an unaccepted issuer key can be reported as cryptographically valid while scheme authorization remains unestablished. Offline verification may reproduce integrity and historical status, but cannot claim current validity beyond an accepted freshness bound.

## 8. Standards and stronger evidence boundaries

External references reviewed for design reuse on 2026-09-16:

- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/2025/REC-vc-data-model-2.0-20250515/) — candidate interoperable packaging; verification is distinct from claim truth and relying-party validation.
- [W3C Bitstring Status List 1.0](https://www.w3.org/TR/vc-bitstring-status-list/) — candidate suspension/revocation mechanism; concrete privacy and freshness policy still need implementation.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) — candidate JCS serialization for a new record profile, not a license to rehash historical receipts under a different identity projection.
- [C2PA 2.2](https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html) — selected provenance reference, not a claim that this is the latest version or that all SDKs preserve UU-AAP assertions.

The existing [external-anchor audit](../../../research/external-anchor-sufficiency-audit/v0.1/) separates signed claim, commitment, inclusion, append-only consistency, checkpoint non-equivocation and existence-time evidence. No layer automatically proves the next; inclusion does not prove complete submission. An external timestamp, transparency log or blockchain is optional and cannot be claimed without real verified proof bytes. No trusted-time, universal non-equivocation or complete-history assurance is introduced here.

## 9. Delivery gates

[#1000](https://github.com/Matawaka/uu-aap/issues/1000) is the executable-work backlog: UV-01 bilingual documentation; UV-02 profile/schema; UV-03 composition verifier; UV-04 independent reproduction/hostile tests; UV-05 governance/status; UV-06 public surfaces; UV-07 a real scoped pilot. The next implementation step is UV-02, not issuing a badge.

Before first real issuance, complete the profile/schema, frozen positive/negative vectors, independent reproduction, human scope/privacy review, legitimate issuer policy, status/revocation/appeal path and public human/machine verifier. Neither this proposal nor its merge automatically qualifies UU-AAP, PoAI, KONTUR, Workbench or the book.
