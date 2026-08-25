# IP Wave 1 — Private Filing Worksheet v0.1

**DO NOT COMMIT A COMPLETED COPY TO THE PUBLIC REPOSITORY.**

Use this blank worksheet locally only. The live Rospatent form/portal controls if any field differs from this worksheet.

Object: **«Валидатор цепочек квитанций UU-AAP Core v0.1»**  
Frozen package digest: `sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8`

## A. Applicant / right holder

- Applicant type: `[individual / legal entity / multiple holders]`
- Full legal name / legal entity name: `[PRIVATE]`
- Residence/location/address required by live form: `[PRIVATE]`
- Country / identifiers required by live form: `[PRIVATE]`
- Contact/correspondence data required by live form: `[PRIVATE]`
- Exclusive-right basis: `[AUTHOR_OWNED / other verified basis]`
- Matches Wave 1 rights-cleared private declaration: `[YES/NO]`

## B. Author

- Author will be mentioned: `[YES/NO — verify live legal/form option]`
- Full legal name: `[PRIVATE]`
- Address/residence data required by live form: `[PRIVATE]`
- Actual creative contribution scope matches Wave 1 declaration: `[YES/NO]`
- Author consent completed if required: `[YES/NO/NOT_APPLICABLE]`
- Personal-data consent completed: `[YES/NO]`

## C. Representative

- Filing mode: `[SELF / REPRESENTATIVE]`
- Representative details: `[PRIVATE / NOT_APPLICABLE]`
- Power of attorney required: `[YES/NO]`
- Power of attorney completed: `[YES/NO/NOT_APPLICABLE]`

## D. Filing route and signature

- Route: `[FIPS / EPGU / PAPER]`
- Authentication/signature method required by selected route: `[PRIVATE/TECHNICAL]`
- Method available and tested: `[YES/NO]`

## E. Software-identification fields

These values are frozen unless a new deposit freeze is intentionally created.

- Program title: `Валидатор цепочек квитанций UU-AAP Core v0.1`
- Program type: `программа для ЭВМ`
- Programming language: `JavaScript (Node.js)`
- Program volume: `15144 байт`
- Frozen selected surface: `27384 байт`
- Deposit package digest: `sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8`

## F. Frozen Russian abstract

Use the exact abstract from `schemas/ip/v0.1/examples/uu-aap-core-deposit-freeze.json`.

Before submission verify:

- `[ ]` exact title match;
- `[ ]` exact abstract match;
- `[ ]` language match;
- `[ ]` program-size match;
- `[ ]` deposit digest match;
- `[ ]` no personal-data disclosure is present in deposited source/material unless intentionally disclosed and reflected in the abstract as required;
- `[ ]` live Rospatent form revision rechecked.

## G. State fee

Current legal snapshot amount: `5000 RUB` for consideration of one program/database registration application and decision.

- Status: `[NOT_READY / PAYMENT_READY / PAID / EXEMPT]`
- Payment/exemption evidence retained privately: `[YES/NO/NOT_APPLICABLE]`
- Evidence SHA-256: `[PRIVATE DIGEST ONLY MAY BE PUBLISHED]`

## H. Private packet hashing

After all private documents are final:

1. place them in a local directory that is not inside a public Git working tree;
2. run the repository utility `schemas/ip/v0.1/hash_private_filing_packet.py <directory>`;
3. retain the generated manifest privately;
4. publish only the root `package_digest` and individual document digests needed by the public checkpoint;
5. never paste private document contents into an issue/PR to prove the hash.

## I. Final local declaration

- `[ ]` I reviewed the live official Rospatent form immediately before filing.
- `[ ]` Applicant/right-holder identity is correct.
- `[ ]` Author information/mention choice is correct.
- `[ ]` Required consent documents are complete.
- `[ ]` Representative/POA state is coherent.
- `[ ]` Filing route/signature method is available.
- `[ ]` Fee state is ready for the selected route.
- `[ ]` Frozen title, abstract and deposit match exactly.
- `[ ]` The private packet is hashed and retained outside the public repository.

Local completion date: `[PRIVATE]`
