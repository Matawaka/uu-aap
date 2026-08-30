# P1.8 Scoped Attestation Bridge v0.1

P1.8 consumes **external validation receipts**, not raw credential cryptography.

Supported reference observations:

- CAWG Identity Assertion 1.3 validation: `TRUSTED | WELL_FORMED | REVOKED | INVALID | NETWORK_REQUIRED`;
- W3C VC 2.0 scoped review-attestation validation: `VALID | INVALID | UNKNOWN`.

It produces a separate bridge result containing CAWG identity candidates plus auxiliary CAWG role and W3C review-attestation observations.

```text
credential validity != claim truth
CAWG role != UU-AAP authority
CAWG role != UU-AAP responsibility
review attestation != factual truth
review attestation != responsibility acceptance
named actor != signature authority
```

P1.8 deliberately does not modify the historical P1.4 adapter registry or P1.5 materializer. Identity candidates remain unmaterialized until a later generic candidate-acceptance successor is explicitly designed.

The public `/verifier/attest/` reference surface is browser-local and does not perform DID resolution, wallet access, credential-status/revocation lookup, model calls, analytics or backend requests.

CAWG source frontier is pinned to Identity Assertion 1.3 ratified 17 Aug 2026 at upstream commit `8851770a46221729b4e0d92cbfcad484b245cc71`. The stable W3C basis is Verifiable Credentials Data Model 2.0, Recommendation 15 May 2025; VCDM 2.1 is observed as a Working Draft but not consumed by this increment.

EN/RU localization covers static shell labels only. Actor names, CAWG roles, issuer/subject identifiers, review scopes/limitations, machine status tokens, validator messages and evidence payloads remain canonical.
