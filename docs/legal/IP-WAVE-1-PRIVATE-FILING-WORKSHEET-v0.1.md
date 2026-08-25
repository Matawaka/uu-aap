# IP Wave 1 — Private Filing Worksheet v0.1

**DO NOT COMMIT A COMPLETED COPY TO THE PUBLIC REPOSITORY.**

Use this blank worksheet locally only. The live Rospatent form/EPGU flow controls if any field differs from this worksheet.

Object: **«Валидатор цепочек квитанций UU-AAP Core v0.1»**  
Frozen package digest: `sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8`

## A. Applicant / right holder — private

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

## B. Author — private

Current Wave 1 rights evidence expects one natural-person author for the bounded human creative contribution.

- Full legal name: `[PRIVATE]`
- Country / country code: `[PRIVATE]`
- Residence address required by live form: `[PRIVATE]`
- INN: `[PRIVATE]`
- SNILS if available: `[PRIVATE / NOT_AVAILABLE]`
- Number of authors: `[1]`
- Same natural person as applicant/right holder: `[YES/NO]`
- Actual creative contribution scope matches Wave 1 declaration: `[YES/NO]`

### Author mention/publication choice

Select the option actually available and intended in the live form:

- `[ ]` mention/publish under legal name;
- `[ ]` use an allowed pseudonym option;
- `[ ]` lawful non-mention/non-publication option.

- Personal-data consent completed: `[YES/NO]`
- Author-information consent completed if author is named: `[YES/NO/NOT_APPLICABLE]`

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

### First publication / release

Known public repository disclosure: `2026-08-24`.

- First-publication year if the live form treats that disclosure as publication/release: `[2026]`
- First-publication country: `[CONFIRM IN LIVE FORM / FACTUAL CIRCUMSTANCES]`

Do not invent a country solely from the location of the repository owner, GitHub infrastructure or current residence.

## D. Representative

- Filing mode: `[SELF / REPRESENTATIVE]`
- If `SELF`: power of attorney: `[NOT_APPLICABLE]`
- If `REPRESENTATIVE`: representative details: `[PRIVATE]`
- Power of attorney required/completed: `[YES/NO/NOT_APPLICABLE]`

## E. Filing route and signature

Operational recommendation: `EPGU`, because current Rospatent guidance supports EPGU electronic filing and indicates that applicant data may be populated from ESIA; notifications and fee handling are integrated into the electronic-service flow.

- Route actually selected: `[EPGU / FIPS / PAPER]`
- Live route opened/rechecked immediately before filing: `[YES/NO]`
- Authentication/signature method shown by live route: `[PRIVATE/TECHNICAL]`
- Method available and tested: `[YES/NO]`

Do not guess signature requirements from an older instruction if the live route displays a different current requirement.

## F. Frozen Russian abstract

Use the exact abstract from `schemas/ip/v0.1/examples/uu-aap-core-deposit-freeze.json`.

Before submission verify:

- `[ ]` exact title match;
- `[ ]` exact abstract match;
- `[ ]` language match;
- `[ ]` program-size match;
- `[ ]` deposit digest match;
- `[ ]` right-holder identity matches the rights-cleared private declaration;
- `[ ]` author identity/mention choice matches the private author evidence;
- `[ ]` no unintended personal data is present in deposited source/material;
- `[ ]` live Rospatent form revision rechecked.

## G. State fee

Current legal snapshot amount: `5000 RUB` for consideration of one program/database registration application and decision.

- Status: `[NOT_READY / PAYMENT_READY / PAID / EXEMPT]`
- Payment/exemption evidence retained privately: `[YES/NO/NOT_APPLICABLE]`
- Evidence SHA-256: `[PRIVATE DIGEST ONLY MAY BE PUBLISHED]`

## H. Private packet contents

Recommended private directory contents after finalization:

1. saved/exported application form or portal-generated application copy;
2. personal-data consent evidence/document;
3. author-information consent or retained evidence of the lawful non-mention choice;
4. representative/POA material if applicable;
5. fee/payment or exemption evidence;
6. private operator note recording route, signature method, first-publication treatment and final consistency check.

The frozen source/deposit package may be retained in the same private archive or in a linked immutable archive, but its public digest must remain the already frozen value above.

## I. Private packet hashing

After all private documents are final:

1. place them in a local directory that is not inside a public Git working tree;
2. run `schemas/ip/v0.1/hash_private_filing_packet.py <directory>`;
3. retain the generated manifest privately;
4. publish only the root `package_digest` and individual document digests needed by the public checkpoint;
5. never paste private document contents into an issue/PR to prove the hash.

## J. Final local declaration

- `[ ]` I reviewed the live official Rospatent form/EPGU flow immediately before filing.
- `[ ]` Applicant/right-holder identity is correct.
- `[ ]` Applicant identifiers and address are complete locally.
- `[ ]` Author information/mention choice is correct.
- `[ ]` Required consent documents are complete.
- `[ ]` First-publication country/year treatment is factually correct.
- `[ ]` Representative/POA state is coherent.
- `[ ]` Filing route/signature method is available.
- `[ ]` Fee state is ready for the selected route.
- `[ ]` Frozen title, 685-character abstract, 15144-byte program size and deposit digest match exactly.
- `[ ]` The private packet is hashed and retained outside the public repository.

Local completion date: `[PRIVATE]`
