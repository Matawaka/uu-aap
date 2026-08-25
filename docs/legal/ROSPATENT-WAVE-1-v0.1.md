# Rospatent Wave 1 — UU-AAP Core validator registration preparation v0.1

Status: **PRE-FILING / RIGHTS_REVIEW**  
Legal snapshot: **2026-08-25**  
Canonical repository: `https://github.com/Matawaka/uu-aap`

## 1. Filing objective

Prepare the first Russian state-registration filing for one coherent **program for computers** from the UU-AAP reusable core.

Wave 1 is deliberately narrower than the whole UU-AAP/PoAI/CCRP/KONTUR repository. The filing must identify a concrete software expression and must not attempt to claim exclusive copyright in abstract UU-AAP architecture, concepts, principles, protocol methods or future applications.

Selected working title:

**«Валидатор цепочек квитанций UU-AAP Core v0.1»**  
English identification: **UU-AAP Core v0.1 Receipt Chain Validator**

Final title must remain identical across the application, abstract, title sheet and deposit materials.

## 2. Current evidence frontier

Post-#487 canonical `main` frontier used for this narrowed Wave 1 audit:

`68588d0db347f168f6b3a6a13dbd5b479a49e6eb`

Origin of the selected Core v0.1 surface:

- PR #320 — `Add UU-AAP Core v0.1 reusable protocol stack`;
- origin merge commit `fd3a3fa7e84c11a80d2af5ff389fe10979720ef9`;
- earliest known public repository timestamp: `2026-08-24T19:01:17+05:00`.

The observed `main` SHA is an **evidence frontier**, not yet the final deposit-package digest.

The final filing package must bind to a later explicit frozen filing checkpoint after:

1. authorship/right-holder review is complete;
2. third-party-only and unresolved material is excluded or correctly represented;
3. the already-public patent/public-disclosure screen is resolved;
4. the exact deposit archive is hashed.

`observed main != final filing deposit`

## 3. Selected legal/software object boundary

### Executable program

- `protocols/core/v0.1/validate-core.js`

### Identifying/deposit-support material

- `protocols/core/v0.1/receipt-envelope.schema.json`
- `protocols/core/v0.1/end-to-end.fixture.json`

### Context/provenance material, currently outside the claimed executable deposit scope

- `protocols/core/v0.1/README.md`
- `.github/workflows/core-protocol-v0.1-validation.yml`
- PR #320 and its merge history.

The earlier broad candidate spanning `schema/`, `schemas/` and `proposals/poai/` is superseded for Wave 1. There is no `tools/` directory in the current repository root; it must not appear in a reproducible deposit definition.

### Not claimed as the registered software object

- the abstract idea of UU-AAP;
- the seven-layer architectural sequence as a concept;
- general principles, methods, rules, processes or systems as such;
- legal/philosophical concepts stated only in prose;
- CCRP, KONTUR, PoAI or unrelated protocol families;
- future applications that do not yet exist as the same registered software object;
- third-party material for which the applicant lacks the required rights;
- contributor-owned material for which the project has only an open inbound license unless the filing accurately reflects the relevant authors/right holders and legal basis.

## 4. Functional identity of the selected program

The selected Node.js command-line validator checks machine-readable UU-AAP Core v0.1 receipt chains. Its current semantics include:

- allowed receipt types and required envelope fields;
- exact required `non_effects`;
- SHA-256 content-hash validation;
- predecessor hash existence and ordering;
- subject continuity;
- required predecessor receipt-type relationships;
- shared predecessor frontier at bounded action gates;
- prohibition of implicit authority/permission expansion;
- action/outcome/successor ordering and frontier consistency;
- positive and negative conformance vectors.

The selected executable directly imports only Node.js built-in modules `crypto`, `fs` and `path`. No package-manager runtime dependency is required by this candidate program surface.

This technical dependency finding does not by itself complete third-party legal clearance.

## 5. Current file anchors

At post-#487 frontier `68588d0db347f168f6b3a6a13dbd5b479a49e6eb`:

| Path | Git blob SHA | Current size / role |
| --- | --- | --- |
| `protocols/core/v0.1/validate-core.js` | `19b8cc90f34ad2eb3819d02d6335f584c65caa46` | 15144 bytes; executable JavaScript |
| `protocols/core/v0.1/receipt-envelope.schema.json` | `38d2d439ad6a1065da96cc9e5f2190734fd2cd7b` | 2579 bytes; identifying schema |
| `protocols/core/v0.1/end-to-end.fixture.json` | `9ed65bfae43f157f6fb051bf6460ebaec13ea480` | 9661 bytes; conformance/identifying fixture |
| `protocols/core/v0.1/README.md` | `290483f9704704160337d5c06800f3e66d32e05a` | 7573 bytes; provenance/specification context |

These Git blob SHAs are evidence anchors. They are not the final Rospatent archive digest.

## 6. Mandatory rights audit before filing

For the selected program expression establish:

- natural-person creative author(s), where legally relevant;
- actual contribution scope of every author/coauthor;
- proposed right holder(s);
- exclusive-right basis;
- whether authorship/right ownership could be affected by employment duties, employer assignment, customer commission or another contract;
- whether any assignment exists;
- whether only a license exists for any material;
- whether another contributor owns copyright-relevant expression in the selected surface;
- whether any third-party creative material was incorporated;
- how AI assistance/generated material relates to the factual basis for any human-authorship statement;
- whether the complete selected material can be truthfully presented under one filing.

A repository account, PR submitter, commit author field, merge right or maintainer role is useful provenance evidence but must not be treated alone as conclusive proof of natural-person creative authorship or exclusive ownership.

`PR submitter != author`

`repository owner != exclusive right holder`

`merge != assignment`

## 7. Applicant/author fields — currently blocked

Do **not** submit until these facts are explicitly verified.

### Applicant / right holder

- full legal name or legal-entity name;
- applicant type: individual / legal entity / multiple right holders;
- address/place of residence or location required by the application;
- country/state identifiers required by the form;
- legal basis for holding the exclusive right to the complete deposited software scope;
- whether an employment, commissioning, collaboration or assignment agreement affects ownership.

### Author(s)

For each author to be named:

- full legal name;
- authorship basis and actual creative contribution scope;
- required address/residence information;
- consent to personal-data processing;
- consent to publication/mention of author details as required by the filing process;
- decision whether the author will be mentioned where the law permits refusal to be mentioned.

`TO_BE_VERIFIED` must never be converted to a guessed name in a filing form.

## 8. AI-assistance evidence boundary

Because UU-AAP itself distinguishes provenance, authority and authorship, the filing evidence must not equate an AI-generated code fragment with a natural-person author merely because a person requested, selected or merged it.

Before naming a human author, preserve enough evidence to support the claimed creative contribution, which may include human-originated architecture choices, constraints, selection, editing, integration, debugging and other protectable expression where applicable.

The public repository should record the conclusion and evidence references, not unnecessary private prompt history.

## 9. Draft abstract for Rospatent

Working draft for the narrowed object:

> «Валидатор цепочек квитанций UU-AAP Core v0.1 предназначен для проверки машиночитаемых цепочек доказательных квитанций протокола UU-AAP Core. Программа контролирует структуру записей, SHA-256 хэши, связи с предшествующими квитанциями, непрерывность субъекта и состояния, обязательные ограничения non-effects, допустимость переходов полномочий, координации, действия, результата и следующего состояния; при несоответствии применяется fail-closed отказ. Область применения: проверка provenance и доказуемых протокольных переходов. Язык программирования: JavaScript. Объем программы: [УТОЧНИТЬ ПО ФИНАЛЬНОМУ ДЕПОЗИТУ] байт.»

Before filing verify that the abstract:

- uses the exact filing title;
- is no longer than the applicable 900-character limit;
- states purpose, application area and functionality;
- identifies every programming language represented in the final deposited source;
- states machine-readable program size under the filing convention selected for the final package;
- discloses personal-data presence if applicable;
- does not accidentally claim patent scope or ownership of abstract ideas.

## 10. Deposit-material construction

After `RIGHTS_CLEARED`, create an immutable directory/archive containing only the frozen filing scope.

Required internal manifest fields:

- filing candidate title;
- canonical repository;
- canonical commit SHA;
- selected paths/blobs;
- exclusions and reasons;
- author/right-holder mapping per material group;
- third-party inventory;
- source-language list;
- total machine-readable size;
- SHA-256 for every included file;
- root SHA-256 for the filing package;
- generation timestamp;
- tool/script version used to generate the package.

For official deposited identifying materials, select full source or source fragments sufficient to identify the program. Preserve the full frozen source package privately even if the submitted identifying material is smaller.

## 11. Official filing package checklist

Current Rospatent route requires, as applicable:

- application for state registration of a program for computers;
- right-holder/applicant information;
- author information unless an author lawfully declines mention;
- deposited materials identifying the software;
- abstract;
- consent to personal-data processing for persons identified in the application;
- author consent concerning author information;
- representative power of attorney if a representative is used;
- state-fee payment evidence or applicable exemption basis;
- electronic-signature/portal authorization requirements of the selected filing channel.

Current state fee for consideration of one program/database registration application and decision is **5,000 RUB**. One application must relate to one program for computers or one database.

## 12. Filing route

Preferred digital paths:

1. electronic filing through the FIPS/Rospatent service; or
2. the Russian Unified Portal of State and Municipal Services where available for the filing.

External portal submission is an irreversible legal act relative to this repository preparation process and requires the authorized applicant/representative to review and sign the final package.

## 13. Expected processing state

Baseline official service term for registration/issuance of a certificate is currently stated as **62 working days from acceptance of the application**, subject to extension when corrected/additional materials, fee processing or applicant motions are required.

Model the office interaction as:

`READY_TO_FILE → FILED → [OFFICE_ACTION ↔ RESPONSE] → REGISTERED | REFUSED | WITHDRAWN`

Every external receipt must be preserved in the IP record.

## 14. Wave 1 completion criteria

Current progress:

- [x] narrow candidate program selected;
- [x] origin PR/merge provenance located;
- [x] current file/blob boundary recorded;
- [x] direct runtime dependency surface preliminarily reviewed;
- [ ] natural-person author list verified;
- [ ] AI-assistance/human creative contribution boundary evidenced;
- [ ] right-holder/applicant list and legal bases verified;
- [ ] employment/commission/assignment conflicts resolved or excluded;
- [ ] coauthor/contributor rights resolved or excluded;
- [ ] third-party/licensed-only material legally cleared or excluded;
- [ ] patent-sensitive/public-disclosure review completed;
- [ ] final deposit checkpoint/tag frozen;
- [ ] reproducible deposit archive created;
- [ ] per-file hashes and package hash computed;
- [ ] final programming-language/size declaration calculated;
- [ ] final <=900-character abstract verified;
- [ ] official application fields completed;
- [ ] personal-data/author consents completed;
- [ ] 5,000 RUB state fee paid or exemption documented;
- [ ] authorized applicant/representative signs and files;
- [ ] filing/application receipt captured;
- [ ] Rospatent correspondence captured;
- [ ] registration number/certificate or terminal outcome captured;
- [ ] successor-state record committed without publishing protected personal data.

## 15. Privacy boundary

Do not commit passport data, home addresses, signatures, portal credentials, payment details, powers of attorney containing unnecessary personal data, or unredacted official filing forms to the public repository.

Public repository records should contain only non-sensitive evidence needed to establish object identity, provenance, filing state and successor linkage.

Private filing artifacts must be retained outside the public repository, with digests bound into the public evidence chain where useful.

## 16. Successor applications

Wave 1 does not cover every future application. CCRP, KONTUR, PoAI executable packages and other independently valuable applications should receive separate IP records and filing decisions.

For a planned rate above 10 applications/year, government filings may be batched administratively while evidence anchoring remains continuous per release.
