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

## 2. Filing route

Operational recommendation: **EPGU**.

Rationale:

- Rospatent exposes EPGU as an electronic filing path for program/database registration;
- current Rospatent service documentation indicates that information about the filing person may be populated from ESIA;
- electronic notifications and fee handling are integrated into the government-service flow.

This is a recommendation, not an applicant decision.

The actual authentication/signature method must be confirmed in the live route immediately before filing and must not be invented in advance.

Decision values:

- `EPGU`
- `FIPS`
- `PAPER`

## 3. Representation

If the right holder personally submits the application, `SELF` is operationally simplest and requires no representative power of attorney.

If another person files, select `REPRESENTATIVE` and retain the required authority/POA evidence privately.

No representative is inferred from repository roles.

## 4. Author visibility

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

## 5. First publication / release

Rospatent Rule 17 for application field 5 asks for country and year of first publication (release) under Article 1268 of the Civil Code if such publication occurred before filing.

Article 1268 distinguishes:

- **obnarodovanie / making the work available to the public** — broad first public availability by publication or other means;
- **publication / release** — release into circulation of copies in a quantity sufficient for reasonable public needs considering the nature of the work.

Therefore:

`PUBLIC_GITHUB_DISCLOSURE != AUTOMATICLY_PROVED_ARTICLE_1268_PUBLICATION_COUNTRY`

Known evidence:

- the selected Core was publicly accessible in the canonical GitHub repository from `2026-08-24`;
- this proves public disclosure for the UU-AAP evidence chain;
- it does not by itself establish which country must be entered in Rospatent field 5.

Do not infer the publication country from:

- GitHub server location;
- repository hosting jurisdiction;
- IP geolocation;
- applicant residence alone.

If field 5 is used, the applicant must factually support the country/year characterization applied in the live form.

## 6. Gate completion

The applicant-decision gate may advance only after:

1. filing route selected;
2. `SELF` or `REPRESENTATIVE` selected;
3. author visibility selected;
4. first-publication classification resolved for Article 1268 purposes;
5. if publication is classified `YES`, country and year are supplied on a factual basis;
6. live route signature/authentication method is confirmed when the filing flow is opened.

Only then may the private filing packet be finalized and hashed.

## 7. Non-effects

This gate does not:

- submit an application;
- select personal preferences on behalf of the applicant;
- publish applicant identifiers;
- determine a publication country from GitHub;
- mark `READY_TO_FILE`;
- mark `FILED`;
- alter patent-track issue #492.
