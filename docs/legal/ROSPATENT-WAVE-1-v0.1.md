# Rospatent Wave 1 — UU-AAP software registration preparation v0.1

Status: **PRE-FILING / RIGHTS_REVIEW**  
Legal snapshot: **2026-08-25**  
Canonical repository: `https://github.com/Matawaka/uu-aap`

## 1. Filing objective

Prepare the first Russian state-registration filing for a **program for computers** representing a coherent, rights-cleared portion of the UU-AAP reference implementation and validation stack.

The filing must identify software expression, not attempt to claim exclusive copyright in the abstract UU-AAP architecture, concepts, principles, protocol methods or future applications.

Candidate public title:

**«Программный комплекс UU-AAP — эталонная реализация и стек валидации»**  
Alternative English identification: **UU-AAP Reference Implementation and Validation Stack**

Final title must remain identical across the application, abstract, title sheet and deposit materials.

## 2. Current evidence frontier

Observed canonical `main` frontier used to open this preparation wave:

`b33920794af1c8f603871392fbd1ae26f630adcb`

This is an **observation anchor**, not yet the final deposit anchor.

The final filing package must bind to a later explicit frozen filing checkpoint after:

1. deposit scope is selected;
2. authorship/right-holder review is complete;
3. third-party-only and unresolved material is excluded or correctly represented;
4. patent-sensitive material is handled;
5. the exact deposit archive is hashed.

`observed main != final filing deposit`

## 3. Legal object boundary

### Included candidate subject matter

A coherent program for computers may include rights-cleared implementation material such as:

- machine-readable schemas that function as implementation definitions;
- validation and assessment code;
- builders/materializers that produce protocol records or checkpoints;
- fail-closed validation logic;
- executable reference-implementation components;
- preparation materials and generated visual output only where useful to identify the software.

### Not claimed as the registered software object

- the abstract idea of UU-AAP;
- the seven-layer architectural sequence as a concept;
- general principles, methods, rules, processes or systems as such;
- legal/philosophical concepts stated only in prose;
- future applications that do not yet exist as the same registered software object;
- third-party material for which the applicant lacks the required rights;
- contributor-owned material for which the project has only an open inbound license unless the filing accurately reflects the relevant authors/right holders and legal basis.

## 4. Mandatory rights audit before filing

For every selected deposit fragment, establish:

- path and blob/commit provenance;
- human creative author(s), where legally relevant;
- whether authorship is individual or joint;
- proposed right holder(s);
- exclusive-right basis;
- whether the work could be an employee-created work or subject to contractual allocation;
- whether any assignment exists;
- whether only a license exists;
- third-party dependencies or copied/generated material;
- whether AI assistance affects the factual basis for a human-authorship statement;
- whether the selected material can be truthfully presented under a single filing.

A repository account, commit author field, merge right or maintainer role is evidence but must not be treated alone as conclusive proof of creative authorship or exclusive ownership.

## 5. Applicant/author fields — currently blocked

Do **not** submit until these facts are explicitly verified:

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

## 6. Draft abstract for Rospatent

The abstract must be finalized only after the deposit scope, programming languages and size are frozen. Working draft:

> «Программный комплекс UU-AAP предназначен для формирования, проверки и воспроизводимой валидации машиночитаемых записей протокола доказуемого управления авторством, доступной информацией, полномочиями, координацией и результатами действий. Программа обеспечивает проверку структур данных, связей состояний и доказательных квитанций, применение fail-closed правил и формирование контрольных состояний. Область применения: системы provenance, accountability и доказуемого взаимодействия человека, ИИ и цифровых сервисов. Языки программирования: [УТОЧНИТЬ]. Объем программы: [УТОЧНИТЬ] байт.»

Before filing verify that the abstract:

- uses the exact filing title;
- is no longer than the applicable 900-character limit;
- states purpose, application area and functionality;
- identifies all programming languages represented in the deposited source;
- states machine-readable program size;
- discloses personal-data presence if applicable;
- does not accidentally claim patent scope or ownership of abstract ideas.

## 7. Deposit-material construction

Create an immutable directory/archive containing only the frozen filing scope.

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

For the official deposited identifying materials, select full source or source fragments sufficient to identify the program. Prefer a compact, coherent identifying set rather than dumping the entire repository. Preserve the full frozen source package privately even if the submitted identifying material is smaller.

## 8. Official filing package checklist

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

## 9. Filing route

Preferred digital paths:

1. electronic filing through the FIPS/Rospatent service; or
2. the Russian Unified Portal of State and Municipal Services where available for the filing.

External portal submission is an irreversible legal act relative to this repository preparation process and requires the authorized applicant/representative to review and sign the final package.

## 10. Expected processing state

Baseline official service term for registration/issuance of a certificate is currently stated as **62 working days from acceptance of the application**, subject to extension when corrected/additional materials, fee processing or applicant motions are required.

Model the office interaction as:

`READY_TO_FILE → FILED → [OFFICE_ACTION ↔ RESPONSE] → REGISTERED | REFUSED | WITHDRAWN`

Every external receipt must be preserved in the IP record.

## 11. Wave 1 completion criteria

Wave 1 is complete only when all of the following exist:

- [ ] exact software object boundary;
- [ ] rights map for every deposited material group;
- [ ] verified author list;
- [ ] verified right-holder/applicant list and legal bases;
- [ ] employment/commission/assignment conflicts resolved or excluded;
- [ ] third-party/licensed-only material resolved or excluded;
- [ ] patent-sensitive/public-disclosure review completed;
- [ ] frozen deposit checkpoint/tag;
- [ ] reproducible deposit archive;
- [ ] file hashes and package hash;
- [ ] programming languages and package size calculated;
- [ ] final <=900-character abstract;
- [ ] official application fields completed;
- [ ] personal-data/author consents completed;
- [ ] 5,000 RUB state fee paid or exemption documented;
- [ ] authorized applicant/representative signs and files;
- [ ] filing/application receipt captured;
- [ ] Rospatent correspondence captured;
- [ ] registration number/certificate or terminal outcome captured;
- [ ] successor-state record committed without publishing protected personal data.

## 12. Privacy boundary

Do not commit passport data, home addresses, signatures, portal credentials, payment details, powers of attorney containing unnecessary personal data, or unredacted official filing forms to the public repository.

Public repository records should contain only:

- object identifier;
- filing/registration number where safe and useful;
- filing/decision dates;
- non-sensitive right-holder/author information already intended for public registry publication;
- digests of private filing evidence;
- status and successor linkage.

Private filing artifacts must be retained outside the public repository with their digests bound into the public evidence chain where appropriate.

## 13. Successor applications

This Wave 1 registration does not cover every future application. For each independent application, instantiate a new IP registration record and decide whether it is:

- merely a version under an existing evidentiary lineage;
- a materially independent program for computers worth registering separately;
- a database candidate;
- a patent-sensitive technical solution;
- a trademark candidate;
- or a non-filed object preserved only by automatic provenance.

For a planned rate above 10 applications/year, government filings should be batched administratively while evidence anchoring remains continuous per release.
