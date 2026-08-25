# IP Wave 1 — Official Rospatent Field Map v0.1

**Status:** public prefill complete / private official fields required  
**Legal snapshot:** 2026-08-25

## 1. Purpose

Map the frozen Wave 1 software object into the current Rospatent program-for-computers application fields without placing personal identifiers in the public repository.

The live official EPGU form controls if any field differs at submission time.

## 2. Public fixed fields

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

The final Russian abstract remains the frozen 685-character abstract in the deposit manifest.

## 3. Applicant decisions recorded

The applicant explicitly selected:

- filing route: `EPGU`;
- representation: `SELF`;
- first-publication classification for the filing field: `YES`;
- first-publication country: `Russia / RU`;
- first-publication year: `2026`.

`RU / 2026` is recorded as an applicant-confirmed filing value. It is not inferred from GitHub server location, hosting jurisdiction, IP geolocation, or applicant residence.

## 4. Public API / integration search

A public search of official government sources on 2026-08-25 found machine interfaces in the electronic-government infrastructure, including:

- SMEV information types used to exchange EPGU applications with connected agency systems;
- ESIA REST/API functions available within registered information-system integration;
- Rospatent SMEV integration namespaces for specific state services;
- official EPGU user-facing submission for program/database registration.

No supported public citizen API was found that allows an arbitrary external client to submit this Rospatent program-registration application on behalf of a natural person.

Therefore the Wave 1 route is:

`PREPARE_AND_VALIDATE_LOCALLY -> SELF_SUBMIT_THROUGH_EPGU_UI`

and not use of undocumented/internal portal endpoints.

Invariant:

`PUBLICLY_DOCUMENTED_INTEGRATION_INTERFACE != PUBLIC_CITIZEN_SUBMISSION_API`.

## 5. Private applicant/right-holder fields

Keep outside GitHub and fill in the live EPGU flow/private worksheet:

- full legal name;
- country/citizenship or country-of-residence values required by the live form;
- residence/postal address;
- INN;
- identity-document series and number;
- SNILS if available;
- correspondence/contact fields not populated automatically by ESIA;
- any additional live-route fields.

## 6. Private author fields and visibility

If the author is named or otherwise represented in the live form, keep outside GitHub as applicable:

- full legal name;
- residence/country details;
- INN;
- SNILS if available;
- author-visibility choice;
- required consent documents.

Still unresolved applicant choice:

- `NAMED`;
- `PSEUDONYM`;
- `NON_MENTION`.

## 7. EPGU signature/authentication

The applicant will file personally through EPGU. The exact authentication/signature method remains intentionally unresolved until the live EPGU flow displays the applicable requirement.

Do not infer or emulate this by calling browser-internal endpoints.

## 8. Fee

Current published state fee baseline for consideration of one program/database registration application and decision:

`5000 RUB`

Payment evidence remains private. The public checkpoint may record only privacy-safe status/digest.

## 9. Current transition boundary

Main IP state:

`PATENT_SCREEN`

Filing readiness:

`PRIVATE_PACKET_IN_PROGRESS`

Applicant decision state after the recorded choices:

- `EPGU`: resolved;
- `SELF`: resolved;
- first publication `RU / 2026`: resolved by applicant instruction;
- author visibility: unresolved;
- live EPGU signature/authentication method: unresolved.

Only after those remaining items and the private identity/consent/fee fields are complete may the packet advance to `READY_TO_FILE`.

`READY_TO_FILE != FILED`

## 10. Privacy boundary

Do not publish passport data, INN, SNILS, home address, signatures, portal credentials, payment details, unredacted contracts, or completed private filing forms.
