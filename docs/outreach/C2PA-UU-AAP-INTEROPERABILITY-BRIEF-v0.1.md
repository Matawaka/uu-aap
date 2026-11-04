# UU-AAP × C2PA — Independent Interoperability Brief v0.1

**Date:** 2026-11-04  
**Status:** non-normative, project-authored external review invitation; NOT a C2PA specification proposal, conformance certificate, or claim of independent validation.  
**Ownership:** UU-AAP is an independent open protocol. C2PA is a separate standard reused for artifact provenance and cryptographic binding.

## The bounded problem

Cryptographic content provenance does not by itself answer who governed a decision, which evidence was available *before* it, who relied on it, who held scoped authority, and whether a later action was permitted. UU-AAP records authorship/decision governance and responsibility; the adjacent PoAI proposal describes decision-time availability and consideration. This is a **complementary application-level integration**, not a replacement for C2PA.

**One-sentence testable claim:** A C2PA-valid asset can remain semantically insufficient evidence for the consumer claim 'the signer authorized publication'; an application must reject that inference unless an independent, applicable authority record supports it.

## Minimal interface

1. An ordinary signed C2PA asset carries a standard *gathered* `c2pa.external-reference` assertion. Its hashed location identifies the exact external JSON record bytes; do not invent a UU-AAP-specific C2PA assertion namespace.
2. An application verifies the C2PA asset using a real C2PA validator and separately checks the external resource's exact-byte digest, size, media type and reference fields where applicable. A valid C2PA claim does not automatically prove the external resource has been retrieved or verified.
3. A UU-AAP/PoAI consumer interprets the record only in the scopes it independently supports (authorship governance, availability, consideration, authority, responsibility, contestability). It does **not** turn C2PA signature, actions, ingredients, disclosure, or repository receipt into a stronger assertion.
4. A decision/action gate remains fail-closed when independent evidence of applicable authority is missing. No issuer authority or production action is created by this example.

```text
signed digital asset
  -> C2PA provenance, validation status, standard gathered external-reference
  -> optional external record retrieval + exact-byte reference check
  -> UU-AAP / PoAI scoped interpretation (separate evidence requirements)
  -> permitted or refused consumer inference; action authority never inherited
```

## Why this can help the C2PA ecosystem

- **Avoid provenance-to-permission escalation:** applications can present valid Content Credentials without falsely reporting author, approver, trusted fact, or authorized publisher.
- **Privacy-preserving separation:** detailed decision records remain outside the media asset, and resource retrieval can be optional.
- **Concrete interoperability test:** a normal C2PA-valid fixture can trigger a deliberately unsafe consumer inference that the independent semantic-boundary rubric rejects.
- **No standards collision:** standard `c2pa.external-reference` first; no registered namespace, new trust root, mandatory C2PA profile or C2PA 2.5 upgrade is presumed.

These general concepts are not claimed as inventions unique to UU-AAP; the candidate contribution is the reproducible *composition and bounded evaluation* across provenance, decision-time availability, consideration, authority/responsibility, action admission and outcome evidence.

## Evidence already published (do not inflate)

- C2PA 2.4 external-reference behavior: [official specification §18.24](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html#external_reference) and [validation §15.10](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html). Its optional external retrieval is distinct from ordinary manifest validation.
- [Interop profile v0.1](https://github.com/Matawaka/uu-aap/blob/main/docs/C2PA-INTEROP-v0.1.md): semantic invariants and P0.1–P0.5 research evidence, explicitly non-normative.
- [Semantic-boundary runnable harness](https://github.com/Matawaka/uu-aap/blob/main/scripts/c2pa-semantic-boundary/README.md): seven unsafe-inference controls; the application-level result is NOT C2PA conformance.
- [Hashed external-reference fixture](https://github.com/Matawaka/uu-aap/blob/main/scripts/c2pa-external-reference/README.md): SHA-256 signed-asset integration, intentionally using a development signer.
- [C2PA 2.5 representation follow-up](https://github.com/Matawaka/uu-aap/blob/main/scripts/c2pa-external-reference-v25/README.md): bounded offline representation and path-specific SDK observations; C2PA 2.4 remains the design baseline.
- [Open PR #1019](https://github.com/Matawaka/uu-aap/pull/1019): project-reported signed SHA-256/384/512 matrix on pinned `c2patool v0.28.4`, exact head `6aa8d33672a096b0ebd18400387259c442c2ade1`, [CI run 41391876265](https://github.com/Matawaka/uu-aap/actions/runs/41391876265); **unmerged, internal tests, not independent SDK or full 2.5 conformance**.
- [Issue #1009](https://github.com/Matawaka/uu-aap/issues/1009): separate portable external-review gate for a more elaborate witnessed-checkpoint profile. Its evidence must not be silently merged into this simpler demo.

## Explicit gaps and non-effects

Swift/Android generic-field and cross-SDK preservation are not blanket PASS; a public SDK may normalize or lose a tested field. No independent reviewer is yet established by this brief. No live network retrieval, production issuer, trusted signer, legal identity, certification, adoption by C2PA, ActionPermit, or runtime integration is established. `c2pa-org/specifications#130` live-video genesis is a **separate non-blocking watch**, not a dependency for this external-reference case.

**Requested feedback:** Can an independent reader reproduce (a) the valid C2PA/hashed-reference case and (b) rejection of a signer→publication-authority inference, while preserving both validation results separately? Which exact spec/SDK interface or consumer assumption prevents this composition, if any?

**Review path:** [bounded replay and failure-case guide](./C2PA-UU-AAP-REPLAY-GUIDE-v0.1.md). **Participation:** [public review intake](https://github.com/Matawaka/uu-aap/issues/422) or [interop mapping question](https://github.com/Matawaka/uu-aap/issues/4). Independent feedback does not itself certify protocol conformance.