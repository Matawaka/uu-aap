# IP Wave 1 — Applicant Decision Gate v0.1

Status: **AWAIT_LIVE_EPGU_SIGNATURE_METHOD**  
Legal snapshot: **2026-08-25**

This gate exists between the public official-field map and completion of the private filing packet.

It prevents the repository from silently choosing legally or personally significant filing options on behalf of the applicant.

## 1. Already resolved

Wave 1 already has:

- rights-cleared software scope;
- deterministic frozen deposit;
- separate patent track;
- exact Russian title and abstract;
- official public-field map;
- privacy-safe private filing worksheet;
- filing-readiness fail-closed state machine.

The registration state remains `PATENT_SCREEN` and the filing-readiness state remains `PRIVATE_PACKET_IN_PROGRESS`.

## 2. Filing route — resolved

Selected route: **EPGU**.

The applicant explicitly chose self-filing through the Unified Portal of State and Municipal Services.

Public search of official government sources found documented EPGU/SMEV and ESIA integration interfaces for connected information systems, but no supported public citizen API for arbitrary external submission of this Rospatent program-registration application.

Operational boundary:

`PREPARE_AND_VALIDATE_LOCALLY -> HUMAN_SUBMISSION_THROUGH_EPGU_UI`

The actual authentication/signature method must still be confirmed in the live EPGU flow immediately before filing.

## 3. Representation — resolved

Selected representation: **SELF**.

No representative or power of attorney is expected unless the filing circumstances change.

## 4. Author identity and publication — resolved

The applicant supplied both a legal author identity and a publication pseudonym.

These are intentionally modeled as different layers:

- legal author identity: **PRIVATE_OFF_REPOSITORY**;
- publication mode: **PSEUDONYM**;
- public pseudonym: **MATAWAKA**.

The legal name is not copied into the public repository. It is to be entered privately in the live EPGU/Rospatent filing materials.

This matches the current Rospatent form model: the author's legal identity is supplied in the filing materials, while the author may separately request publication under a pseudonym. Current register guidance states that when an author is published under a pseudonym, the pseudonym is recorded alongside the corresponding author information in the register/publication handling.

Because the author remains identified in the filing materials and requests pseudonym publication, applicable author/personal-data consent remains required and is retained privately.

Invariant:

`LEGAL_AUTHOR_IDENTITY != PUBLICATION_NAME`.

`PSEUDONYM_PUBLICATION != ABSENCE_OF_IDENTIFIED_AUTHOR`.

## 5. First publication / release — resolved

The applicant explicitly instructed the filing record to use:

- publication classification: **YES**;
- country: **Russia / RU**;
- year: **2026**.

This is an applicant-confirmed filing value, not an inference from GitHub hosting, server geography, IP location, or residence.

The selected Core was publicly accessible in the canonical GitHub repository from `2026-08-24`; that disclosure remains separately preserved in the evidence chain.

## 6. Gate completion

Completed applicant-controlled decisions:

1. filing route: `EPGU`;
2. representation: `SELF`;
3. author publication mode: `PSEUDONYM`;
4. author public pseudonym: `MATAWAKA`;
5. legal author identity retention: `PRIVATE_OFF_REPOSITORY`;
6. first-publication classification: `YES`;
7. first-publication country/year: `RU / 2026`.

Only one decision-gate item remains:

1. the actual authentication/signature method shown by the live EPGU filing flow.

After that live value is confirmed, the applicant-decision gate may become `MAY_COMPLETE_PRIVATE_PACKET`. That does not itself mean `READY_TO_FILE`: private identifiers, required consents, fee readiness, exact-form consistency and the final private-packet digest must also be complete.

## 7. API boundary

Official public search found integration APIs for registered/connected information systems, including ESIA/SMEV surfaces, but not a documented public citizen API for arbitrary natural-person filing of this application.

Invariant:

`PUBLICLY_DOCUMENTED_INTEGRATION_INTERFACE != PUBLIC_CITIZEN_SUBMISSION_API`.

No endpoint probing, reverse engineering, session extraction, or reuse of undocumented browser APIs is part of Wave 1.

## 8. Non-effects

This gate does not:

- submit an application;
- publish the legal author identity;
- call internal EPGU endpoints;
- mark `READY_TO_FILE`;
- mark `FILED`;
- alter patent-track issue #492.
