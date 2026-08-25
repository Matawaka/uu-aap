# IP Wave 1 — Applicant Decision Gate v0.1

Status: **AWAIT_APPLICANT_DECISIONS**  
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

## 2. Filing route — applicant decision recorded

Selected route: **EPGU**.

The applicant explicitly chose self-filing through the Unified Portal of State and Municipal Services.

Public search of official government sources on 2026-08-25 found documented EPGU/SMEV and ESIA integration interfaces for connected government/institutional information systems, including registered SMEV information types and REST/OpenAPI surfaces of specific subsystems. No supported public citizen API was found that allows an arbitrary external client to submit this Rospatent program-registration application on behalf of a natural person.

Therefore the operational boundary is:

`PREPARE_AND_VALIDATE_LOCALLY -> HUMAN_SUBMISSION_THROUGH_EPGU_UI`

and not:

`UNSUPPORTED_CALL_TO_INTERNAL_EPGU_ENDPOINTS`.

The actual authentication/signature method must still be confirmed in the live EPGU flow immediately before filing.

## 3. Representation — applicant decision recorded

Selected representation: **SELF**.

The applicant will personally submit the application. No representative or power of attorney is expected for this route unless the live filing circumstances change.

## 4. Author visibility — still unresolved

Current Rospatent rules allow the author to be included in the application or to refuse being mentioned as author.

Rospatent guidance also distinguishes refusal to be mentioned from anonymous publication:

- if the author refuses to be mentioned, the separate personal-data consent for that author is not required;
- if author information is supplied/anonymous publication is used, applicable personal-data documentation remains required.

The repository must not decide the author's visibility preference automatically.

Supported decision states:

- `NAMED`
- `PSEUDONYM`
- `NON_MENTION`

The live form controls the exact representation if a pseudonym is selected.

## 5. First publication / release — applicant value recorded

Rospatent Rule 17 for application field 5 asks for country and year of first publication (release) under Article 1268 of the Civil Code if such publication occurred before filing.

Article 1268 distinguishes broad public disclosure from publication/release as circulation of copies. The repository therefore did not infer a country from GitHub hosting, server location, IP geolocation, or applicant residence.

The applicant has now explicitly instructed the filing record to use:

- country: **Russia / RU**;
- year: **2026**;
- publication classification for the filing field: **YES**.

This is recorded as an applicant-confirmed filing value, not as an independent adjudication by GitHub, the repository, or CI.

Known evidence also remains preserved separately:

- the selected Core was publicly accessible in the canonical GitHub repository from `2026-08-24`;
- this proves public disclosure for the UU-AAP evidence chain.

## 6. Gate completion

Already completed by explicit applicant decision:

1. filing route: `EPGU`;
2. representation: `SELF`;
3. first-publication classification: `YES`;
4. first-publication country/year: `RU / 2026`.

Still required:

1. author visibility: `NAMED`, `PSEUDONYM`, or `NON_MENTION`;
2. live EPGU signature/authentication method confirmed when the actual filing flow is opened.

Only after those remaining decisions/evidence may the private filing packet be finalized and hashed.

## 7. API boundary

Official public search found machine interfaces in the electronic-government infrastructure, but they are integration surfaces for registered/connected information systems rather than a documented public API for arbitrary natural-person filing.

Examples include:

- SMEV information types for EPGU-to-agency application exchange;
- ESIA REST/API functions requiring registered information-system participation/access;
- Rospatent SMEV integration namespaces for specific state services;
- the official EPGU user-facing route for program/database registration.

Invariant:

`PUBLICLY_DOCUMENTED_INTEGRATION_INTERFACE != PUBLIC_CITIZEN_SUBMISSION_API`.

No endpoint probing, reverse engineering, session extraction, or reuse of internal browser APIs is authorized by this Wave 1 process.

## 8. Non-effects

This gate does not:

- submit an application;
- publish applicant identifiers;
- call internal EPGU endpoints;
- mark `READY_TO_FILE`;
- mark `FILED`;
- alter patent-track issue #492.
