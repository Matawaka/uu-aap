# IP Wave 1 — Official Rospatent Field Map v0.1

**Status:** public prefill complete / private official fields required  
**Legal snapshot:** 2026-08-25  
**Current main after #494:** `663fe9a65dc17196e1b8496b9d9df8984cfa2e60`

## 1. Purpose

Map the frozen Wave 1 software object into the current Rospatent program-for-computers application fields without placing personal identifiers in the public repository.

This document is a field map and operator aid. The live official form/EPGU flow controls if any field differs at submission time.

## 2. Official source boundary

Current public Rospatent sources checked on 2026-08-25:

- state service page for registration of a program for computers/database;
- application form family approved under Ministry of Economic Development Order No. 211;
- current Rospatent forms page;
- current electronic-service guidance for EPGU.

The current rules require an application identifying the right holder and, unless the author declines mention, the author; identifying deposited materials including an abstract; personal-data consent for Russian applicants; author-information consent when author data is included; and representative authority where applicable.

For a Russian natural-person applicant, the current rules identify as applicant identifiers:

- INN;
- series and number of the identity document;
- SNILS, if available.

The application also requires the natural person's residence/postal address and country information. For an author who is identified in the application, current rules require name, residence/country information and, for Russian citizens, INN and SNILS if available.

These values are **PRIVATE_OFF_REPOSITORY**.

## 3. Wave 1 public fixed fields

The following values are already evidence-bound and may be prefilled without private data:

| Field | Frozen value |
| --- | --- |
| Object type | Program for computers / программа для ЭВМ |
| Russian title | `Валидатор цепочек квитанций UU-AAP Core v0.1` |
| Creation year | `2026` |
| Programming language | `JavaScript (Node.js)` |
| Program size | `15144 bytes` |
| Number of applicants/right holders | `1` |
| Number of authors | `1` |
| GIS component | `No` |
| Frozen package digest | `sha256:228e5d5f142fecb6ed8bfa0010f07b562fdb28db4ba15ae5e1ceb723fa8a8de8` |
| Patent path | `SEPARATE_PATENT_TRACK` / issue #492 |

The final Russian abstract remains exactly the 685-character abstract stored in the frozen deposit manifest.

## 4. Applicant/right-holder private fields

For the Wave 1 individual applicant/right holder, fill locally in the official live form or private worksheet:

- full legal name;
- country code / country of residence;
- full residence/postal address required by the form;
- INN;
- identity-document series and number;
- SNILS if available;
- correspondence contact/address if requested by the selected route;
- any route-required telephone/e-mail fields;
- confirmation that the applicant is the rights-cleared `private-party:wave1-declarant-01`.

Do not place these values in GitHub issues, PRs or public artifacts.

## 5. Author private fields and publication choice

Fill locally:

- full legal name;
- country code / residence;
- residence address;
- INN;
- SNILS if available;
- author publication choice allowed by the live form;
- personal-data consent;
- author-information consent if author details are included.

Current rules allow an author not to be mentioned as author in the application/publication flow. If an author is named, the live form also provides publication/mention handling, including publication under the author's name or pseudonym where applicable.

The public UU-AAP record must store only the resulting non-sensitive status and digest, not the underlying identifiers.

## 6. First-publication field remains intentionally unresolved

The selected Core has a proven public repository disclosure on 2026-08-24, but the application field asks for the **country and year of first publication (release)** if publication took place before filing.

Do not automatically equate `public GitHub disclosure` with a particular country of first publication without reviewing the live form/rules and the factual publication circumstances.

Current safe state:

`first_publication_year = 2026`

`first_publication_country = TO_CONFIRM_IN_LIVE_FORM`

This unresolved bibliographic field does not change the frozen software object or its rights state.

## 7. Recommended electronic route

Operational default recommendation for an individual applicant: **EPGU**.

Reasons:

- Rospatent currently supports electronic submission through EPGU;
- current EPGU guidance indicates applicant data may be populated from ESIA;
- EPGU supports notifications and fee handling in the electronic service flow;
- this minimizes manual duplication of private identity data into local public-facing artifacts.

This is a recommendation, not an executed applicant choice.

Authentication/signature requirements must be confirmed in the live EPGU flow immediately before submission. Current Rospatent regulations permit the electronic-signature class required by the applicable technical requirements; the repository must not guess that requirement in advance.

## 8. Representative default

If the applicant files personally:

`representative.mode = SELF`

`power_of_attorney_status = NOT_APPLICABLE`

If a representative is actually used, do not use that default; complete the representative/POA branch instead.

## 9. Fee

Current published state fee for consideration of one program/database registration application and decision:

`5000 RUB`

The fee evidence remains private. The public checkpoint may record only:

`PAYMENT_READY | PAID | EXEMPT`

plus a SHA-256 evidence digest where used.

## 10. Current transition boundary

The main IP record remains:

`PATENT_SCREEN`

The public filing-readiness checkpoint remains:

`PRIVATE_PACKET_IN_PROGRESS`

Before `READY_TO_FILE`, complete the remaining private/live-form decisions:

1. applicant/right-holder identity fields;
2. author identity and publication/mention choice;
3. personal-data and author consents;
4. filing route selection;
5. route-specific authentication/signature confirmation;
6. representative/POA branch;
7. first-publication country treatment in the live form;
8. fee readiness/payment/exemption;
9. final live-form consistency check;
10. private packet SHA-256.

`public prefill complete != private form complete`

`READY_TO_FILE != FILED`

## 11. Reusable rule for successor applications

For later UU-AAP products, automatically prefill only non-sensitive fields proved by the release/deposit record. Identity-document data, residence addresses, tax/social identifiers, signatures, portal credentials, consents and payment evidence remain private.

This lets the portfolio pipeline scale without turning the public repository into a personal-data registry.
