# UU VERIFIED source and translation audit — 2026-09-16

**Scope:** documentary review for issue [#1000](https://github.com/Matawaka/uu-aap/issues/1000), not a repository-wide implementation/security audit. This report does not rerun historical validators, verify the book PDF bytes, verify signatures or qualify a product.

## Source identity

UU-AAP source commit: `0e74f89695bbcb02c759000752696c322d908f7a`  
Source tree: `beff957c276242a81a44668a970b20757b5585b6`

Git blob SHA-1 identifiers below identify repository objects; they are not presented as SHA-256 artifact digests. Historical source records remain unchanged.

| Source | Inspected Git blob | Used for |
|---|---|---|
| `README.md` | `0f376e8aadf8fb0098419eaf3c32778db313250b` | Historical authorship scope, D/T/V/R, publication/privacy boundaries. |
| `README.ru.md` | `5d7785263a54fb841e06b0ae3f2e5b1afd1e69b7` | Russian entry, seven-primitive mapping, product/non-effect explanations. |
| `PRINCIPLES.md` | `b37f0d0f525c82520cfb336d8167b05a590521d3` | All twelve Augmented Mind principles. |
| `SPEC.md` | `44b91e0e48dee9d928c843bbb304a5c246582da7` | English normative-language/scope/non-goal boundaries; reviewed opening sections, not a new full clause-by-clause conformance run. |
| `SPEC.ru.md` | `90f74208b988f2d7ff5bbafc70deee9f6fafcefe` | Explanatory Russian specification and profile wording. |
| `GOVERNANCE.md` | `a44cd57009741362e7bf2f4d8af4eabff4b8183d` | Open-editor model; repository control and review routing are not independent approval or universal authority. |
| `ROADMAP.md` | `9660fd91bab5b9054cd5e8ba4625c54b253961bd` | Historical reusable-tooling/receipt-identity evidence; selected sections reviewed, not treated as current product status. |
| `docs/ROADMAP-CURRENT.md` | `6063ce07c479c6a59c78091e4212fc5d09c27a04` | Current-marker distinction, accepted Run 001/B+C/RA1 and bounded external-evidence gates; opening 170 lines reviewed. |
| `protocols/attestation/v0.1/README.md` | `48c2ff28039b6512a0a65a63791932a66367b092` | Exact implementation/dependency/test binding and actual re-execution model. |
| `protocols/responsibility-assurance/v0.1/README.md` | `41c887e08fd1309f9f854b886365a9c3b0fe7d12` | Stage B reuse, exact accepted/shared coverage, optional-baseline and non-authority boundaries. |
| `research/external-anchor-sufficiency-audit/v0.1/README.md` | `c6010011e5a646be72102adb8516221c4a60c267` | Signature/inclusion/consistency/checkpoint/time separation and unimplemented stronger-anchor limits. |

The sources are addressable under `https://github.com/Matawaka/uu-aap/blob/0e74f89695bbcb02c759000752696c322d908f7a/` followed by the listed path.

### Book precedent

Repository: `Matawaka/vibe-coding-reality`  
Document: `VERIFICATION.md`  
Inspected blob: `3e5a28401549177c90b58943795817536f936997`  
Work ID: `urn:uu-aap:work:vibe-coding-reality:000001`  
Recorded edition: `2026.1`; recorded release target: `a3dce8a4337a7dead869b2c1cd9a6831aee798d7`  
Recorded artifact SHA-256: `2f2c37406530e2207b7149061e2fe3d849cc66b38cf52e79f0cd49adc35cec97`.

The document records a successor V claim while preserving the earlier T manifest. Its GitHub release immutability observation is historical; CLI attestation verification was explicitly not rerun in that record. No independent factual/legal/identity review or embedded C2PA credential is claimed there. This audit reports those source statements; it does not independently re-establish them as current facts or award UU VERIFIED.

## Findings and proposed corrections / Выводы и исправления

1. **Russian causal-proof overstatement.** `README.ru.md` says «Доказуемая причинность решений», while the source architecture preserves `Observation != Causality Proof`. Replace the slogan with «Проверяемое происхождение решений»; add an explicit non-causality boundary. Это уточнение силы утверждения, а не ослабление проверяемости.
2. **Historical/current navigation.** The Russian entry describes `ROADMAP.md` as current. The inspected current marker explicitly preserves it as historical tooling-convergence evidence. Link `docs/ROADMAP-CURRENT.md` for the current marker; keep historical evidence addressable. Не переименовывать старые результаты в новые.
3. **Pilot 002 stale entry.** The Russian entry describes an open availability boundary without mentioning accepted Run 001. Add the current marker's bounded completion and keep human identity/independence unestablished. Завершённый один run не означает завершённое внешнее подтверждение проекта.
4. **Russian assurance explanation.** `SPEC.ru.md` explains D/T/V/R but does not explicitly separate the proposed mark, Stage B/RA1, issuer authority and copyright/truth claims. Add a clearly dated explanatory section and links, without changing historical normative definitions.
5. **Russian principle coverage.** Add a readable explanatory P1–P12 translation and a stable-ID evidence map. The new translation does not create a competing normative source.
6. **Book lineage ambiguity.** The English entry's first pilot is the preserved T artifact, whereas the separate book repository records a V successor. Explain that distinction rather than changing the original pilot's conformance. Historical V is not UU VERIFIED.
7. **Name continuity.** Use all three UU meanings as complementary explanations. Do not silently replace the historical AAP expansion with a different protocol title.
8. **Mark circularity risk.** Separate the object/evidence/review/issuer/status claims. Neither a passing schema, a project-owned key nor a project-authored certificate establishes independent review or issuer legitimacy.

## Explicitly not audited or changed

No full-repository Russian translation audit is claimed. No runtime, protected Core, historical release, historical receipt, base manifest schema, D/T/V/R definition, RA1 implementation, C2PA acceptance receipt, authority registry or legal filing is changed by the concept package. Product status must be checked against each product's own exact frontier; this review does not resume paused products or reconcile private product branches.

The attached historical merge note is not a source of present merge/activation authority and is not used to issue or qualify anything here.

## New design versus existing evidence

Existing mechanisms are documentary sources for reuse. The P1–P12 operational tests, `UV-ARCH-1` candidate profile, minimum independent-run policy, issuer/status gate, public discovery descriptor and machine catalogue are **new proposals**. The twenty hostile-vector names in `concept.json` are a test-development backlog, not twenty executed tests.

External W3C VC 2.0, Bitstring Status List 1.0, RFC 8785 and selected C2PA 2.2 references are listed in the EN/RU concept. They are design inputs only; no compatibility, adoption, accreditation or implementation PASS is inferred from citing a standard.
