# OAP Phase 0 — human architecture-lead decision register

Date 2026-11-19. Status: `DRAFT_FOR_HUMAN_REVIEW`. A draft PR or checked-in research note does **not** itself resolve pending decisions.

| ID | Decision | State | Proposed default / why | Who approves |
| --- | --- | --- | --- | --- |
| D00 | Independent protocol, not a silent UU-AAP Core rename | **APPROVED IN CONVERSATION 2026-11-19** | publish as separate specification once qualified; UU-AAP remains predecessor/reference | Human architecture lead |
| D01 | Public protocol name, acronym, trademark/namespace | **PENDING** | keep `Open Authorization Protocol (OAP)` provisional due to existing OAP uses | Human architecture lead, legal check if needed |
| D02 | Functional difference from existing standards | **PENDING** | portable authorization-to-effect evidence binding as testable hypothesis | Human architecture lead after comparison / external evidence |
| D03 | Baseline trust model and issuer entitlement | **PENDING** | externally configured trust roots; never self-authorize | Human architecture lead + security review |
| D04 | Credential/wire profiles and mandatory cryptography | **PENDING** | versioned profile; prefer established encodings/key-bound patterns | Human architecture lead + independent crypto reviewer |
| D05 | Whether a permit is mandatory in every OAP claim | **PENDING** | mandatory for claimed protected external effects, optional for read-only informational claims | Human architecture lead |
| D06 | Offline/failure/revocation behavior | **PENDING** | fail closed for external effects; evidence verifier may return unknown | Human architecture lead + safety/security |
| D07 | First reference implementation and adapters | **PENDING** | minimal offline issuer, verifier, gate simulator; no live KONTUR dependency | Human architecture lead |
| D08 | New repository/org versus temporary research staging | **PENDING** | stage 0 in UU-AAP draft only; later independent repository if approved | Human architecture lead |
| D09 | OAP text/code licensing, provenance and IPR | **PENDING** | assess CC BY 4.0 documentation, Apache-2.0 code, inbound contributions; do not assume automatic transfer of third-party rights | Human architecture lead + legal |
| D10 | Governance, standards venue and release qualification | **PENDING** | open draft reviews; independent implementation and security proof before any standards claim | Human architecture lead |
| D11 | Whether Personal Anchor becomes an optional profile | **PENDING** | keep separate; synthetic history must not become de facto identity proof | Human architecture lead |
| D12 | Whether to publish v0.1 spec / register public claims | **PENDING** | no publication before frozen negative tests, interoperability evidence and explicit decision | Human architecture lead |

## Gate for phase 1

Do not start security-sensitive or normative implementation work until D01, D02, D03, D05 and D06 have either explicit decisions or narrow test-only provisional assumptions with stated non-effects. Technical experiments may continue without claiming normative release if human decisions are not yet taken.

## Working arrangements

The human architecture lead controls material objectives, public naming, external action/deployment, identity/privacy policy, normative security guarantees, licensing/IPR, governance and release decisions. Technical research may propose alternatives, maintain adversarial tests, record evidence and open **draft** PRs for review, but may not silently infer those approvals from access to GitHub.

`design review eligibility != decision approval != merge approval != release authority`.
