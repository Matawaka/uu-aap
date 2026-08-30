# P1.9 Candidate Source Federation v0.1

P1.9 composes already validated P1.4 and P1.8 candidate sources without accepting, ranking, merging or scoring them.

```text
P1.4 EvidenceAdapterResult
        +
P1.8 AttestationBridgeResult
        ↓
FederatedCandidateSet v0.1
```

The output has exactly seven candidate buckets:

```text
integrity
identity
provenance
availability
authority
responsibility
truth
```

Every federated candidate preserves:

- source family (`P1.4_ADAPTER` or `P1.8_ATTESTATION`);
- original source candidate id;
- source observation id;
- source result schema;
- dimension;
- the source claim unchanged.

P1.8 CAWG roles and W3C review attestations are copied into `auxiliary_attestations`; they are never inserted into candidate buckets.

## Explicit non-effects

```text
candidate federation != candidate acceptance
source count != confidence
source order != priority
same-dimension plurality != consensus
multiple sources != independent witnesses
identity != authority
role/review attestation != candidate
federation != trust
federation != truth
```

P1.9 does not modify P1.4 adapters, P1.5 acceptance/materialization, P1.8 attestation semantics, Stable Core, SPEC or CONTESTABILITY.

## Reused validators

Canonical Python federation calls the existing `validate_adapter_result` and `validate_attestation_result` functions.

The browser surface loads the existing P1.4 `adapt/app.js` and P1.8 `attest/app.js` validators before `candidates/app.js`. P1.9 therefore does not maintain a second source-result validation contract.

## Local reference surface

The Pages successor adds:

```text
/verifier/candidates/
```

It is browser-local and performs no network, model, analytics or backend call. The EN/RU layer localizes static presentation labels only; candidate values, evaluations, source ids, warnings, roles, review scopes and JSON remain canonical.
