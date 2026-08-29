# Purpose-Bounded Identity Evidence v0.1

A read-only PSR/PEF consumer profile for bounded identity-match evidence.

This profile does not create a new identity root. It consumes evidence selected for one declared purpose and returns one of:

- `MATCH_SUPPORTED`
- `MATCH_DISPUTED`
- `INSUFFICIENT_EVIDENCE`
- `NOT_ASSESSED`

`MATCH_SUPPORTED` means only that at least two independently originated evidence groups support the bounded match for the declared purpose and no disputing evidence is present in the supplied set.

It does **not** establish legal identity, universal identity, authority, intent, action, responsibility or liability.

The profile denies cross-context correlation by default and rejects biometric requirements and universal/legal identity claims in v0.1.

`PSR Continuity != Identity Verification`

`Account Control != Human Identity`

`Identity Match != Authority`

`Possible Identification != Performed Identification`

`Purpose-Bounded Match != Universal Identity`

No credential issuance, account lookup, KYC, biometric processing, external correlation, disclosure expansion, authority grant, runtime activation or external effect is performed.