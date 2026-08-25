# IP Wave 1 — Filing Readiness Gate v0.1

Status: **PRE-FILING / PRIVATE PACKET REQUIRED**  
Legal snapshot: **2026-08-25**  
Object: **«Валидатор цепочек квитанций UU-AAP Core v0.1»**

## 1. Purpose

This gate separates public, reproducible evidence from private filing materials containing personal data.

The public repository may prove that the software object, rights basis, patent/public-disclosure boundary and frozen deposit are ready. It must not publish home addresses, signatures, personal identifiers, portal credentials or unredacted official forms merely to prove filing readiness.

Pipeline:

`PATENT_SCREEN → Private Filing Packet → Public Digest Checkpoint → Form/Deposit Consistency → READY_TO_FILE → External Submission → FILED`

## 2. Current official filing basis

As of the legal snapshot above, the Rospatent state service for registration of a program for computers or database requires, as applicable:

1. application for state registration naming the right holder and the author unless the author declines mention where permitted;
2. deposited identifying materials, including the abstract;
3. confirmation of consent to personal-data processing for persons named in the application;
4. document confirming the author's consent to the author information stated in the application;
5. power of attorney when a representative is used;
6. state-fee payment evidence may be supplied on the applicant's initiative.

Electronic filing is available through FIPS and the Unified Portal of State and Municipal Services (EPGU). The current state fee for consideration of one application and decision is 5,000 RUB. The published baseline service term is 62 working days from receipt of the application.

The forms currently published by Rospatent are associated with Ministry of Economic Development Order No. 211, as amended. The official live forms, not a repository copy, control at the moment of filing.

## 3. Frozen public inputs

Rights-cleared deposit frontier:

`8aec7684a54e2570c285720a22d30d99f958131a`

Frozen package digest:

`sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8`

Program source:

- `protocols/core/v0.1/validate-core.js`
- JavaScript (Node.js)
- 15,144 bytes

Identifying/support materials:

- `protocols/core/v0.1/receipt-envelope.schema.json`
- `protocols/core/v0.1/end-to-end.fixture.json`
- 12,240 bytes total

Total frozen selected surface: 27,384 bytes.

The final Russian abstract is already frozen in the deposit manifest and is 685 characters. The official application and deposited abstract must use the same program title.

## 4. Two-contour privacy model

### Private contour

Keep outside the public repository:

- completed application form or portal draft/export;
- applicant/right-holder legal identity and address data;
- author legal identity/address data required by the form;
- personal-data consent;
- author consent or evidence of lawful non-mention choice;
- power of attorney if applicable;
- signature material;
- payment document or exemption evidence;
- portal receipts containing protected personal data.

### Public contour

The repository may retain only:

- completion statuses;
- SHA-256 digests of private documents/package;
- selected filing route;
- confirmation that a signature method is available;
- fee readiness/payment status without banking details;
- exact-match assertions for title, abstract and frozen deposit;
- links to public Rospatent legal/form sources;
- later filing number/date and a privacy-safe receipt reference.

`private evidence availability != right to publish private evidence`

## 5. Private packet minimum set

The private packet should contain at least:

- `application-form` — completed final form or final portal representation before submission;
- `personal-data-consent` — completed consent for each required subject;
- `author-consent` — completed author-consent document when the author is mentioned;
- `power-of-attorney` — only if a representative is used;
- `fee-evidence` — payment document, lawful exemption evidence, or a controlled payment-ready instruction depending on the filing route;
- `private-packet-manifest` — local list of files and their SHA-256 digests.

Do not place private file contents in GitHub issues, pull requests, Actions logs or commit messages.

## 6. Filing consistency checks

Before `READY_TO_FILE`, verify all of the following:

- exact application title = **«Валидатор цепочек квитанций UU-AAP Core v0.1»**;
- abstract exactly matches the frozen 685-character abstract;
- declared language = `JavaScript (Node.js)` unless the live form requires a normalized wording that does not alter the technical fact;
- declared machine-readable program volume = `15144` bytes;
- selected deposited files match the frozen package digest;
- named applicant/right holder matches the cleared rights basis;
- author information matches the private authorship/right-holder declaration and chosen mention status;
- representative status is internally consistent with the presence/absence of a power of attorney;
- no private filing field introduces a different legal object or broader claim than the frozen Wave 1 program;
- live Rospatent form revision is checked again immediately before submission.

## 7. Machine checkpoint

Public readiness is represented by:

`schemas/ip/v0.1/filing-readiness-checkpoint.schema.json`

Wave 1 instance:

`schemas/ip/v0.1/examples/uu-aap-core-filing-readiness-checkpoint.json`

The checkpoint deliberately begins as `PRIVATE_PACKET_IN_PROGRESS` and contains no personal data.

`COMPLETE` is allowed only when:

- a private packet SHA-256 is present;
- the application form is final and hashed;
- required consent evidence is complete and hashed, or author non-mention is explicitly selected where lawful;
- representative/POA state is coherent;
- filing route is selected;
- signature method is confirmed;
- fee is at least payment-ready, paid or lawfully exempt according to the selected route;
- all title/abstract/deposit/right-holder/author consistency checks pass.

## 8. READY_TO_FILE semantics

`READY_TO_FILE` means the repository has evidence that no known pre-submission preparation gate remains.

It does **not** mean:

- the application has been submitted;
- Rospatent accepted the application;
- the fee has necessarily been matched by Rospatent;
- registration was granted;
- a patent application was filed.

`READY_TO_FILE != FILED`

Only an actual external application number/date/receipt can advance the record to `FILED`.

## 9. Current Wave 1 state

After #493:

- rights: `CLEARED`;
- patent/public-disclosure boundary: `SEPARATE_PATENT_TRACK`;
- deposit: frozen and reproducible;
- public abstract: frozen;
- machine state: `PATENT_SCREEN`;
- private filing packet: not yet complete.

Therefore `READY_TO_FILE` must remain false until the private checkpoint is completed and bound by digest.
