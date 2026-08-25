# UU-AAP IP Wave 1 — Core Rights & Deposit Audit v0.1

**Status:** evidence-gathering / not yet `RIGHTS_CLEARED`  
**Jurisdiction route:** RU / Rospatent program-for-computers registration  
**Observed post-merge frontier:** `68588d0db347f168f6b3a6a13dbd5b479a49e6eb`  
**Origin PR:** #320 — `Add UU-AAP Core v0.1 reusable protocol stack`  
**Origin merge commit:** `fd3a3fa7e84c11a80d2af5ff389fe10979720ef9`

## 1. Audit purpose

This audit narrows Wave 1 from the earlier broad phrase "UU-AAP reference implementation and validation stack" to one coherent executable program candidate that can be evidenced, deposited and reviewed independently.

The audit does not adjudicate legal authorship or exclusive ownership from repository control alone.

`repository control != authorship`

`PR submission != authorship`

`merge != assignment`

`public provenance != exclusive-right adjudication`

## 2. Recommended Wave 1 software object

Working title:

**UU-AAP Core v0.1 Receipt Chain Validator**  
**RU working title:** **«Валидатор цепочек квитанций UU-AAP Core v0.1»**

Executable program:

- `protocols/core/v0.1/validate-core.js`

Identifying/deposit-support materials bound to the program:

- `protocols/core/v0.1/receipt-envelope.schema.json`
- `protocols/core/v0.1/end-to-end.fixture.json`

Context/provenance evidence, not presently part of the claimed executable deposit scope:

- `protocols/core/v0.1/README.md`
- `.github/workflows/core-protocol-v0.1-validation.yml`
- PR #320 and merge commit `fd3a3fa7e84c11a80d2af5ff389fe10979720ef9`

The earlier candidate paths `schema/`, `schemas/`, `proposals/poai/` and the obsolete/nonexistent `tools/` concept are too broad for this first program filing and must not be used as one undifferentiated deposit scope.

## 3. Functional boundary

`validate-core.js` is a standalone Node.js command-line validator for the UU-AAP Core v0.1 typed-receipt chain.

It validates, among other things:

- allowed receipt types;
- required envelope fields;
- exact `non_effects` requirements;
- SHA-256 content-hash integrity;
- predecessor-receipt references;
- subject continuity;
- required predecessor receipt types;
- shared predecessor frontier at bounded action gates;
- prohibition of implicit authority/permission expansion;
- action/outcome/successor ordering and frontier consistency;
- positive and negative conformance vectors.

The program does not itself execute external actions, contact a network service, mutate a repository, grant authority, or establish factual/legal truth.

## 4. Dependency and third-party preliminary review

Direct runtime imports observed in `validate-core.js`:

- Node.js built-in `crypto`;
- Node.js built-in `fs`;
- Node.js built-in `path`.

No package-manager dependency or copied third-party runtime library is required by this candidate executable surface.

This is a **preliminary source-boundary finding**, not yet a complete legal third-party clearance. Before `RIGHTS_CLEARED`, the audit must still confirm that the selected source/schema/fixture do not contain incorporated third-party creative material requiring separate treatment.

## 5. Provenance evidence

The selected Core v0.1 surface entered the canonical repository together through PR #320 and merge commit:

`fd3a3fa7e84c11a80d2af5ff389fe10979720ef9`

Known public origin timestamp from repository history:

`2026-08-24T19:01:17+05:00`

PR #320 was submitted through the canonical `Matawaka` repository account. That is evidence of repository provenance and submission authority only; it is not sufficient by itself to prove the natural-person author, creative contribution share, employee-work status, commissioned-work status, or exclusive-right ownership.

## 6. Current file anchors at the post-#487 frontier

At observed `main` frontier `68588d0db347f168f6b3a6a13dbd5b479a49e6eb`:

| Path | Git blob SHA | Size / role |
| --- | --- | --- |
| `protocols/core/v0.1/validate-core.js` | `19b8cc90f34ad2eb3819d02d6335f584c65caa46` | 15144 bytes; executable JavaScript |
| `protocols/core/v0.1/receipt-envelope.schema.json` | `38d2d439ad6a1065da96cc9e5f2190734fd2cd7b` | 2579 bytes; identifying schema |
| `protocols/core/v0.1/end-to-end.fixture.json` | `9ed65bfae43f157f6fb051bf6460ebaec13ea480` | 9661 bytes; identifying/conformance fixture |
| `protocols/core/v0.1/README.md` | `290483f9704704160337d5c06800f3e66d32e05a` | 7573 bytes; specification/provenance context |

These blob identities are evidence anchors. They are not yet the final Rospatent deposit-package digest.

## 7. Rights questions still blocking `RIGHTS_CLEARED`

The following must be established with evidence outside or inside the repository as appropriate:

1. **Natural-person authorship** — identify the human creative author(s) of the selected program expression and their contribution scopes.
2. **AI-assistance boundary** — distinguish human-authored creative expression, AI-assisted/generated material, selection/editing/integration decisions and any material for which human copyright authorship is uncertain.
3. **Exclusive-right basis** — determine whether rights are author-owned, coauthored, employee-work, assigned, commissioned with exclusive-right transfer, or another supported basis.
4. **Employment/commissioning boundary** — confirm whether creation occurred within any employment duty, employer assignment, customer commission or other agreement that could allocate exclusive rights elsewhere.
5. **Third-party material** — confirm that no selected source/schema/fixture contains material whose exclusive rights are held by another party or only licensed inbound.
6. **Coauthor/contributor boundary** — verify whether any person other than the proposed applicant made a copyright-relevant contribution to the selected deposit surface.

Until these are resolved, the machine record must remain `RIGHTS_REVIEW`.

## 8. Evidence acceptable for the next gate

Useful evidence may include:

- Git history and PR #320 timeline;
- retained prompts/drafts/decision records where they show human creative choices without exposing unnecessary private content;
- local source history or signed/hash-bound archives predating publication;
- a signed author declaration describing authorship and AI-assistance boundaries;
- employment/contract documents or a scoped declaration sufficient to establish that the work is not subject to another right holder;
- written assignments/agreements from any coauthor or contributor when exclusive rights are to be consolidated;
- third-party inventory and license review.

Private contracts, passport details, signatures, addresses and portal credentials must not be committed to the public repository. Public records should bind private evidence by digest/reference where useful.

## 9. Patent/public-disclosure boundary

This Wave 1 object is being prepared for software registration, not as a patent claim over the abstract seven-layer architecture.

The Core surface is already public. Any separate technical solution considered for patent protection must receive its own novelty/public-disclosure analysis and must not inherit a patentability conclusion from this software-registration audit.

## 10. Proposed filing description boundary

The future filing should describe the program as a validator that verifies machine-readable UU-AAP Core receipt chains and rejects invalid integrity, predecessor, authority, coordination, action-gate and successor-state transitions according to a fail-closed semantic model.

It must not claim that registration grants exclusive rights over:

- the abstract idea of evidence-based protocols;
- the seven conceptual primitives as ideas;
- CCRP, KONTUR, PoAI or unrelated implementations not included in the selected program;
- future applications that do not yet exist;
- third-party implementations independently written from the public specification.

## 11. State transition decision

Current state remains:

`RIGHTS_REVIEW`

The next allowed transition is:

`RIGHTS_REVIEW -> RIGHTS_CLEARED`

only when the authorship/right-holder/third-party questions above are evidenced strongly enough to support a filing representation.

After that:

`RIGHTS_CLEARED -> PATENT_SCREEN -> READY_TO_FILE -> FILED -> REGISTERED | REFUSED | WITHDRAWN`

No filing receipt or registration outcome is asserted by this audit.
