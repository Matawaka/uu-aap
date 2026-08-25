# IP Wave 1 — Private Filing Worksheet v0.1

**DO NOT COMMIT A COMPLETED COPY TO THE PUBLIC REPOSITORY.**

Use this worksheet locally only. The live Rospatent/EPGU form controls if any field differs from this worksheet.

Object: **«Валидатор цепочек квитанций UU-AAP Core v0.1»**  
Frozen package digest: `sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8`

## A. Applicant / right holder — private

Applicant decisions already fixed:

- Filing route: `EPGU`
- Filing mode: `SELF`
- First publication country/year for filing field: `Russia / 2026`

Current Wave 1 model expects one individual applicant/right holder.

- Applicant type: `[INDIVIDUAL]`
- Full legal name: `[PRIVATE]`
- Country / country code: `[PRIVATE]`
- Full residence/postal address required by live form: `[PRIVATE]`
- INN: `[PRIVATE]`
- Identity-document series and number: `[PRIVATE]`
- SNILS if available: `[PRIVATE / NOT_AVAILABLE]`
- Correspondence address/contact required by live route: `[PRIVATE]`
- Other route-required contact data: `[PRIVATE / NOT_REQUIRED]`
- Exclusive-right basis: `[AUTHOR_OWNED]`
- Applicant is the same natural person as `private-party:wave1-declarant-01`: `[YES/NO]`
- Number of applicants/right holders: `[1]`

Do not paste INN, document details, SNILS, address, signature or portal credentials into ChatGPT, GitHub, an issue or a PR merely to prove completion.

## B. Author — private legal identity / public pseudonym

Current Wave 1 rights evidence expects one natural-person author for the bounded human creative contribution.

Publication choice already fixed:

- Legal author identity: `[PRIVATE_OFF_REPOSITORY]`
- Publication mode: `[PSEUDONYM]`
- Public pseudonym: `MATAWAKA`

Fill locally in EPGU as applicable:

- Full legal name: `[PRIVATE]`
- Country / country code: `[PRIVATE]`
- Residence address required by live form: `[PRIVATE]`
- INN: `[PRIVATE]`
- SNILS if available: `[PRIVATE / NOT_AVAILABLE]`
- Number of authors: `[1]`
- Same natural person as applicant/right holder: `[YES/NO]`
- Actual creative contribution scope matches Wave 1 declaration: `[YES/NO]`
- Personal-data consent completed: `[YES/NO]`
- Author-information consent completed if required by live form: `[YES/NO/NOT_APPLICABLE]`
- Publication pseudonym shown exactly as: `MATAWAKA`

Do not copy the completed legal identity block into GitHub. The public repository records only the pseudonym and privacy-safe state.

## C. Program bibliographic fields

These public values are evidence-bound:

- Object type: `программа для ЭВМ`
- Program title: `Валидатор цепочек квитанций UU-AAP Core v0.1`
- Creation year: `2026`
- Programming language: `JavaScript (Node.js)`
- Program volume: `15144 байт`
- Frozen selected surface: `27384 байт`
- Deposit package digest: `sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8`
- GIS component: `NO`
- First-publication classification for filing field: `YES`
- First-publication country: `Russia / RU`
- First-publication year: `2026`
- Author publication mode: `PSEUDONYM`
- Public author pseudonym: `MATAWAKA`

`RU / 2026` is an applicant-confirmed filing value, not an inference from GitHub infrastructure.

## D. Representative

Selected filing mode: `SELF`.

- Representative details: `NOT_APPLICABLE`
- Power of attorney: `NOT_APPLICABLE`

If filing circumstances later change, reopen this branch rather than silently using the SELF assumption.

## E. Filing route and signature

Selected route: `EPGU`.

Official public search found documented EPGU/SMEV and ESIA integration interfaces for connected information systems, but no supported public citizen API for arbitrary external submission of this Rospatent application.

Therefore:

`PREPARE_AND_VALIDATE_LOCALLY -> SELF_SUBMIT_THROUGH_EPGU_UI`

- Live EPGU route opened/rechecked immediately before filing: `[YES/NO]`
- Authentication/signature method shown by live route: `[PRIVATE/TECHNICAL]`
- Method available and tested: `[YES/NO]`

Do not use undocumented/internal browser endpoints to automate filing.

## F. Frozen Russian abstract

Use the exact abstract from `schemas/ip/v0.1/examples/uu-aap-core-deposit-freeze.json`.

Before submission verify:

- `[ ]` exact title match;
- `[ ]` exact abstract match;
- `[ ]` language match;
- `[ ]` program-size match;
- `[ ]` deposit digest match;
- `[ ]` first-publication field shows Russia / 2026;
- `[ ]` right-holder identity matches the rights-cleared private declaration;
- `[ ]` legal author identity matches the private author evidence;
- `[ ]` publication mode is pseudonym and pseudonym is exactly `MATAWAKA`;
- `[ ]` no unintended personal data is present in deposited source/material;
- `[ ]` live Rospatent/EPGU form revision rechecked.

## G. State fee

Current legal snapshot amount: `5000 RUB` for consideration of one program/database registration application and decision.

- Status: `[NOT_READY / PAYMENT_READY / PAID / EXEMPT]`
- Payment/exemption evidence retained privately: `[YES/NO/NOT_APPLICABLE]`
- Evidence SHA-256: `[PRIVATE DIGEST ONLY MAY BE PUBLISHED]`

## H. Private packet contents

Recommended private directory contents after finalization:

1. saved/exported application form or portal-generated application copy;
2. personal-data consent evidence/document;
3. author-information consent if required by the live form;
4. fee/payment or exemption evidence;
5. private operator note recording EPGU, SELF, Russia/2026, pseudonym `MATAWAKA`, the live signature method and final consistency check.

The frozen source/deposit package may be retained in the same private archive or in a linked immutable archive, but its public digest must remain the already frozen value above.

## I. Private packet hashing

After all private documents are final:

1. place them in a local directory that is not inside a public Git working tree;
2. run `schemas/ip/v0.1/hash_private_filing_packet.py <directory>`;
3. retain the generated manifest privately;
4. publish only the root `package_digest` and individual document digests needed by the public checkpoint;
5. never paste private document contents into an issue/PR to prove the hash.

## J. Final local declaration

- `[ ]` I reviewed the live official Rospatent/EPGU flow immediately before filing.
- `[ ]` Applicant/right-holder identity is correct.
- `[ ]` Applicant identifiers and address are complete locally.
- `[x]` Author publication mode selected as `PSEUDONYM / MATAWAKA`.
- `[ ]` Legal author identity is complete locally.
- `[ ]` Required consent documents are complete.
- `[x]` First-publication filing value selected as Russia / 2026.
- `[x]` Representative/POA branch selected as SELF / NOT_APPLICABLE.
- `[x]` Filing route selected as EPGU.
- `[ ]` Live EPGU signature/authentication method confirmed.
- `[ ]` Fee state is ready for the selected route.
- `[ ]` Frozen title, 685-character abstract, 15144-byte program size and deposit digest match exactly.
- `[ ]` The private packet is hashed and retained outside the public repository.

Local completion date: `[PRIVATE]`
