# UU-AAP Latent Evidentiary Knowledge v0.1

**Status:** experimental reusable privacy/evidence-activation profile  
**Issue:** #393

## Purpose

Keep evidence, relations and identification capability latent until a purpose-bounded and authority-backed request satisfies the complete activation sequence.

```text
available evidence / stored relations
  -> Purpose
  -> Authority
  -> Identity Need
  -> Minimal Challenge
  -> Proof Sufficiency
  -> Scope
  -> Disclosure
  != automatic profiling
  != automatic correlation
  != unlimited inspection
```

## Normative separations

- `Available Evidence != Active Knowledge`
- `Possible Identification != Performed Identification`
- `Stored Relation != Permitted Correlation`
- `Proof Availability != Right to Inspect`
- `Identity Verification != Unlimited Disclosure`
- `Knowledge of Fact != Attribution of Responsibility`

## Activation rule

A conforming decision remains `latent` unless all seven stages are explicit and satisfied. Identity resolution MUST be necessary for the declared purpose, the challenge MUST be minimal for that need, proof MUST be sufficient for the requested scope, and disclosure MUST remain within that scope.

Cross-context correlation is separately controlled. Evidence may exist and relations may be stored without permission to join contexts or construct a profile.

## Fail-closed conditions

Activation is denied when purpose or authority is absent, identity is unnecessary, challenge exceeds the minimum, proof is insufficient, scope expands beyond authority, correlation is not authorized, or disclosure exceeds the approved fields/audience.

## Non-effects

This profile performs no identity lookup, profile construction, cross-context join, external evidence acquisition, disclosure, actuator invocation, KONTUR mutation, authority transfer, release or publication. A valid record is only an evidence-activation assessment.

## Conformance

`validate-latent-evidentiary-knowledge.js` validates the positive fixture and rejects missing activation stages, over-broad challenges, insufficient proof, unauthorized correlation, scope/disclosure expansion, responsibility attribution, and external-effect claims.

CI is read-only.