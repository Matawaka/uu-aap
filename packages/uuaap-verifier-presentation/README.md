# UU-AAP Verifier Presentation Package v0.6

This package is the reusable implementation surface for P1.1 layered verifier presentation, P1.3 explicit input, P1.4 bounded evidence adapters, P1.5 explicit candidate acceptance/materialization, P1.7 contestability and P1.8 scoped attestation bridging.

The canonical verifier dimensions remain exactly:

```text
integrity
identity
provenance
availability
authority
responsibility
truth
```

Contestability and attestation observations are auxiliary surfaces, not extra verifier dimensions. The package does not produce aggregate trust/truth/reputation/confidence/reliability scores or an umbrella verified verdict.

P1.8 API:

```python
from uuaap_verifier_presentation import (
    bridge_attestations,
    validate_attestation_input,
    validate_attestation_result,
)
```

P1.8 consumes documented external validation receipts only. It does not perform DID resolution, wallet operations, VC/C2PA cryptography, revocation/status-list lookup or trust-registry queries.

CAWG Identity Assertion 1.3 receipts may emit **identity candidates** for `TRUSTED`, `WELL_FORMED` and `REVOKED`. `INVALID` and `NETWORK_REQUIRED` remain visible evidence/warnings without a candidate. CAWG role strings are auxiliary role attestations and never become UU-AAP authority or responsibility.

W3C VC 2.0 review-attestation receipts are auxiliary review observations only. Even a `VALID` receipt does not become identity, authority, responsibility or factual truth. VCDM 2.1 is not consumed by P1.8 v0.1.

P1.8 identity candidates are not auto-materialized into P1.3. P1.4 and P1.5 historical contracts remain unchanged; a future successor may define a generic candidate-acceptance bridge across candidate sources.

Opaque external payload fields remain data. Names such as `verified`, `trust_score`, `authority`, signer, role or issuer do not gain UU-AAP semantics merely because an external payload contains them.

The historical P1.1 CLI paths remain compatibility shims to this reusable package. The repository package is not published to PyPI by P1.8.
