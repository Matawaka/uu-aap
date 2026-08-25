# UU-AAP Ambient Observability / Non-Identification Boundary v0.1

**Status:** experimental reusable observation-boundary profile  
**Issue:** #389  
**Dependency:** Latent Evidentiary Knowledge Activation Gate v0.1 / PR #388 (merged)

## Purpose

Model bounded observation in shared physical or technical space without turning the fact of observation into permission to identify, correlate, profile, attribute, infer intent/liability, disclose, sanction or retain indefinitely.

```text
Observation
  -> bounded observation evidence
  -> optional later governed identity activation
  != identification
  != attribution
  != intent
  != liability
```

## Normative separations

- `Observation != Identification`
- `Identification != Attribution`
- `Attribution != Intent`
- `Intent != Liability`
- `Being Seen != Permission to Profile`
- `Observed Relation != Permitted Cross-Context Correlation`
- `Observation Evidence != Unlimited Retention`
- `Possible Identification != Performed Identification`

## Default boundary

A conforming observation record binds an observation ID, source class, observation scope, observed-at time, evidence reference and retention horizon. It defaults all personalized actions to unperformed.

Without a separately governed activation basis, the record MUST keep identity resolution, cross-context correlation, profiling, attribution, intent inference, liability inference, responsibility assignment, sanction recommendation and disclosure false.

Observation cannot mint authority. Any later identity activation must reference an external governed predecessor and remain outside this record.

## Retention and disclosure

Retention is bounded by an explicit horizon. The existence of evidence is not permission for indefinite storage or disclosure. Disclosure remains unperformed in v0.1.

## Non-effects

Conformance does not perform identity lookup, correlation, profiling, attribution, intent/liability inference, responsibility assignment, sanction, disclosure, external observation, actuator invocation, authority expansion, KONTUR mutation or publication.

## Conformance

`validate-ambient-observability.js` validates the positive fixture and rejects implicit identity resolution, correlation, profiling, attribution, intent/liability inference, responsibility/sanction escalation, disclosure, unbounded retention and authority laundering.

CI is read-only and performs no external observation or action.
