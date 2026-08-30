# UU-AAP Verifier Presentation Package v0.9

This package is the reusable implementation surface for the P1 verifier line:

- P1.1 layered seven-dimension presentation;
- P1.3 explicit verifier input;
- P1.4 bounded evidence adapters;
- P1.5 historical adapter-candidate acceptance/materialization;
- P1.7 contestability overlay;
- P1.8 scoped CAWG/W3C attestation bridge;
- P1.9 provenance-preserving candidate federation;
- P1.10 explicit federated candidate disposition/materialization;
- P1.11 deterministic P1.10 disposition-result integrity closure.

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

Contestability, role/review attestations, federation metadata, disposition events and integrity receipts are auxiliary/control surfaces, not additional verifier dimensions.

## Candidate source federation

P1.9 combines validated P1.4 and P1.8 candidates while preserving source family, source candidate id, source observation id and the candidate claim unchanged.

```python
from uuaap_verifier_presentation import (
    build_federation_input,
    federate_candidate_sources,
    validate_federation_result,
)
```

Federation does not accept, rank, merge, average or score candidates. Multiple sources do not imply independent witnesses. Source order and source count create no priority or confidence semantics.

## Explicit federated disposition

P1.10 applies the historical P1.5 vocabulary `ACCEPT | REJECT | DEFER` to every P1.9 federated candidate through a separate successor contract:

```python
from uuaap_verifier_presentation import (
    build_federated_disposition_input,
    materialize_federated_disposition,
    validate_federated_disposition_result,
)
```

Every federated candidate must receive exactly one explicit disposition and at most one candidate may be accepted per verifier dimension. Candidate evaluation state, source family, source order and source count never select automatically.

Accepted claims preserve their original `value`, `evaluation`, `source_layer`, explanation and `does_not_establish` semantics. Materialization only appends the P1.10 disposition receipt evidence reference.

`REJECT` and `DEFER` are local selection outcomes, not negative evidence, sanctions, reputation signals or truth claims.

An accepted identity candidate does not create authority or responsibility. An accepted authority candidate does not create responsibility. `actor_ref` on a disposition event is declared metadata only and does not prove identity, standing, authority, authorship, responsibility or legal validity.

Historical P1.5 remains adapter-result only and is not expanded in place. P1.10 consumes P1.9 through its own versioned input/result contract.

## Deterministic disposition integrity closure

P1.11 does not rewrite P1.10. It verifies an externally supplied P1.10 result by validating it with the historical P1.10/P1.3 validators and then rematerializing the canonical P1.10 result from the embedded `federated_candidate_set + disposition_event`.

```python
from uuaap_verifier_presentation import (
    build_disposition_integrity_input,
    verify_disposition_integrity,
    validate_disposition_integrity_result,
)
```

The supplied result is accepted only when it is structurally equal to the deterministic historical rematerialization. This jointly binds redundant top-level disposition state, receipt evidence payloads, related observations, warnings and materialized claims without treating those copies as independent evidence.

P1.11 emits only a bounded integrity receipt. Canonical rematerialization equality does not establish factual truth, actor identity, actor authority, authorship, responsibility acceptance, publication/action authority, source priority, source independence, consensus or reputation.

## Attestation boundary

P1.8 consumes documented external validation receipts only. It does not perform DID resolution, wallet operations, VC/C2PA cryptography, revocation/status-list lookup or trust-registry queries.

CAWG Identity Assertion 1.3 roles remain auxiliary and never become UU-AAP authority/responsibility. W3C VC 2.0 review attestations remain auxiliary and never become factual truth.

## Global non-effects

The package does not produce aggregate trust, truth, reputation, reliability, confidence or compatibility scores and does not create an umbrella verified verdict.

Opaque external evidence payload fields remain data. Names such as `verified`, `trust_score`, `authority`, signer, role or issuer do not gain UU-AAP semantics merely because an external payload contains them.

The historical P1.1 CLI paths remain compatibility shims to this reusable package. This repository package is not published to PyPI by P1.11.
