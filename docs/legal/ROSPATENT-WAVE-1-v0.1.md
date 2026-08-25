# Rospatent Wave 1 — UU-AAP Core validator registration preparation v0.1

Status: **PRE-FILING / PATENT_SCREEN / DEPOSIT_FROZEN**  
Legal snapshot: **2026-08-25**  
Canonical repository: `https://github.com/Matawaka/uu-aap`

## 1. Registration object

Russian filing title — use exactly this spelling in the application, abstract, title sheet and deposited materials:

**«Валидатор цепочек квитанций UU-AAP Core v0.1»**

English identification only:

**UU-AAP Core v0.1 Receipt Chain Validator**

Wave 1 concerns one concrete program for computers. It does not claim exclusive copyright in abstract UU-AAP ideas, the seven-layer architecture as an idea, CCRP, KONTUR, PoAI, future applications or unrelated implementations.

## 2. Rights-cleared and frozen frontier

Rights-cleared / deposit-freeze frontier:

`8aec7684a54e2570c285720a22d30d99f958131a`

Origin of the selected Core surface:

- issue #303 — pre-implementation stable-core requirements;
- PR #320 — Core v0.1 implementation;
- origin merge `fd3a3fa7e84c11a80d2af5ff389fe10979720ef9`;
- earliest known public disclosure `2026-08-24T19:01:17+05:00`.

Human-authorship/right-holder evidence was resolved through the private-evidence pipeline and is bound publicly by the retained declaration digest rather than by publishing private personal material.

Private declaration digest:

`sha256:51997e3a1d8d4e3ff9673e4564fd5a47bcda6e1556c8d314f6a69aab81788e8b`

Classification:

`AI_ASSISTED_HUMAN_CREATION`

## 3. Exact deposit boundary

### Program source

- `protocols/core/v0.1/validate-core.js`

### Identifying/support materials

- `protocols/core/v0.1/receipt-envelope.schema.json`
- `protocols/core/v0.1/end-to-end.fixture.json`

### Excluded from the registered program object

- `README.md` and repository documentation as specification/provenance context;
- workflows and CI infrastructure;
- unrelated protocol families and applications;
- abstract architecture, methods, policies and legal/philosophical prose;
- separate technical patent candidates tracked in issue #492.

## 4. Frozen cryptographic manifest

Canonical manifest:

`schemas/ip/v0.1/examples/uu-aap-core-deposit-freeze.json`

Reproducible builder:

`schemas/ip/v0.1/build_wave1_deposit_manifest.py`

Canonicalization profile:

`UU-AAP-DEPOSIT-INVENTORY-v0.1`

Package digest:

`sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8`

| Path | Role | Bytes | Git blob SHA-1 | SHA-256 |
| --- | --- | ---: | --- | --- |
| `protocols/core/v0.1/validate-core.js` | program source | 15144 | `19b8cc90f34ad2eb3819d02d6335f584c65caa46` | `4315bc0661698de4946a0f24478c8f98dcdfadca7289178a04e436232acd5fd7` |
| `protocols/core/v0.1/receipt-envelope.schema.json` | identifying schema | 2579 | `38d2d439ad6a1065da96cc9e5f2190734fd2cd7b` | `1e8c38e31975617ac4ce89bda39347423f0cc56c346abd1350980663ddba3f65` |
| `protocols/core/v0.1/end-to-end.fixture.json` | conformance fixture | 9661 | `9ed65bfae43f157f6fb051bf6460ebaec13ea480` | `1f570095355dbef1b87a33edd11c69ec9a6a58ac2756420df7b0e022fa8e3fc5` |

Program source volume for the Rospatent abstract: **15144 bytes**.

Identifying/support-material volume: **12240 bytes**.

Total frozen three-file evidence surface: **27384 bytes**.

Programming language: **JavaScript (Node.js)**.

The package digest binds path, role, byte size and per-file SHA-256 in lexicographic path order. It is intentionally independent of archive timestamps and filesystem metadata.

## 5. Functional identity

The selected validator checks machine-readable UU-AAP Core v0.1 receipt chains, including:

- allowed receipt types and required envelope fields;
- exact `non_effects` boundaries;
- SHA-256 content-hash validation;
- predecessor existence and ordering;
- subject/frontier continuity;
- required predecessor receipt-type relationships;
- shared predecessor frontier at bounded action gates;
- prohibition of implicit authority/permission expansion;
- action/outcome/successor ordering and state consistency;
- positive and negative conformance vectors.

Its direct runtime imports are Node.js built-ins `crypto`, `fs` and `path`.

## 6. Patent/public-disclosure separation

Wave 1 is a software-registration filing, not a patent filing.

The selected Core surface was already public on 2026-08-24. Federal Law No. 296-FZ, signed 2026-08-04 and effective 2027-01-01, changes the Russian patent-law treatment of programmable means / IT solutions. Therefore Wave 1 does not label underlying technical UU-AAP mechanisms as globally non-patentable.

Separate patent review is tracked in issue #492.

Current Russian Civil Code Article 1350 provides a twelve-month grace period for qualifying own disclosure of invention information, subject to the applicant proving the statutory conditions. The date `2027-08-24` is recorded only as a conservative Russian outer date associated with the known 2026-08-24 disclosure; it is not a guarantee of patentability and is not assumed to preserve foreign patent rights.

Machine status:

`SEPARATE_PATENT_TRACK`

## 7. Final Russian abstract

The following abstract is frozen with the manifest and is **685 characters**, below the current 900-character limit:

> Валидатор цепочек квитанций UU-AAP Core v0.1 предназначен для проверки машиночитаемых цепочек квитанций протокола UU-AAP Core. Программа проверяет структуру квитанций, типы семи протокольных примитивов, связи с предшествующими квитанциями, контрольные хэши, утверждения и явно заданные non-effects, а также fail-closed условия переходов от состояния через возможность, намерение, полномочия/ответственность, координацию и действие к результату и последующему состоянию. Область применения: системы provenance, accountability и доказуемого взаимодействия человека, искусственного интеллекта и цифровых сервисов. Язык программирования: JavaScript (Node.js). Объем программы: 15144 байта.

If any deposited program-source bytes change, this abstract, byte count and manifest must be regenerated rather than edited independently.

## 8. Current machine state

`PATENT_SCREEN`

The patent/public-disclosure boundary is now resolved for the software-registration path and the deposit content is frozen. `FILED` remains false.

The next transition is permitted only after the private filing packet is completed and reviewed:

`PATENT_SCREEN → READY_TO_FILE`

Then, only after actual external submission and receipt:

`READY_TO_FILE → FILED`

## 9. Remaining private filing packet

Keep the following outside the public repository:

- applicant/right-holder legal identity fields required by the official form;
- author identity fields required by the official form;
- address/place-of-residence data;
- personal-data consent;
- author-information consent;
- signature or qualified electronic signature material;
- representative power of attorney if used;
- payment details/evidence.

Do not commit passport details, addresses, signatures, portal credentials, unredacted contracts or payment data.

## 10. Official filing checklist

Before `READY_TO_FILE`:

- [x] one coherent program selected;
- [x] human-authorship/AI-assistance boundary evidenced;
- [x] right-holder basis cleared;
- [x] employment/customer/assignment/coauthor boundary cleared;
- [x] third-party source-expression boundary cleared;
- [x] public-disclosure/patent-path separation recorded;
- [x] separate patent track created (#492);
- [x] exact deposit frontier frozen;
- [x] per-file SHA-256 values computed;
- [x] canonical package digest computed;
- [x] programming language fixed;
- [x] program byte volume fixed;
- [x] <=900-character abstract fixed;
- [ ] private official applicant/right-holder fields completed;
- [ ] private author fields/consents completed;
- [ ] final human comparison of official form title/abstract/deposit against this manifest;
- [ ] state fee paid or lawful exemption recorded;
- [ ] authorized applicant/representative signs and submits.

After actual submission only:

- [ ] capture application number;
- [ ] capture filing date;
- [ ] retain external receipt/reference;
- [ ] change machine state to `FILED`;
- [ ] track office actions;
- [ ] record registration number/certificate or terminal outcome.

## 11. Fee and route

Current state-fee baseline for consideration of one program/database registration application and decision: **5,000 RUB**.

Preferred electronic route: official FIPS/Rospatent service or the Unified Portal of State and Municipal Services where applicable.

Actual submission is an external legal act and is not performed by repository CI.

## 12. Successor applications

This Wave 1 registration does not cover future UU-AAP applications. Independently valuable CCRP, KONTUR, PoAI and other executable products require their own evidence records and filing decisions.

For a portfolio exceeding ten releasable applications per year, evidence anchoring remains continuous per release while government filings may be batched administratively.
