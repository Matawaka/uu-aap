# MarketCloser Minimized Real Review Bridge v0.1

**Status:** experimental Phase E application-to-analysis bridge  
**Issue:** #611  
**Origin frontier:** `b82b16a170c6e8d250735c51f430a39cf3663558`  
**Origin tree:** `aa969eb468831e020252132b08409e28b8f000b5`

## Purpose

This layer is the first explicit bridge from the live-application side of MarketCloser into the reusable **Маркетолог Пессимиста** analysis boundary.

It does not send raw review content into the analytical core. It accepts only a human-reviewed minimized representation and preserves all upstream uncertainty.

```text
MarketCloser Deployment Observation input
-> exact Deployment Observation revalidation
-> DEPLOYMENT_BINDING_INSUFFICIENT preserved
-> human minimization assertion
-> minimized claim/evidence/decision representation
-> exact Marketer Pessimist Real Review Intake derivation
-> exact Marketer Pessimist Real Review Candidate derivation
-> MarketCloserMinimizedRealReviewBridgeReceipt
-> STOP
```

No boolean such as `observation_passed=true`, `minimized=true` or `candidate_ready=true` is trusted.

## Why this boundary exists

The MarketCloser application may encounter public review text that contains names, order details, platform identifiers or other personal data. Public visibility does not make that raw material automatically suitable for the Marketer Pessimist core.

```text
Raw Review != Minimized Claim
Public Review != Non-Personal Data
```

The bridge therefore owns a privacy/minimization firewall rather than weakening `MarketerPessimistRealReviewIntake v0.1`.

## Human minimization is not independent verification

The bridge requires:

```text
human_minimization_reviewed = true
```

but simultaneously fixes:

```text
independent_privacy_verification = false
```

and requires the transferred representation itself to contain no raw review text, raw reviewer identity, personal data, sensitive personal data, protected-attribute data, psychological-vulnerability data or cross-context identifiers.

```text
Human Minimization Review != Independent Privacy Verification
Minimized Non-Personal Packet != Source Identity
```

The bridge records a bounded human assertion about the payload being transferred. It does not certify the original source as globally non-personal.

## Deployment provenance stays unresolved

The predecessor Deployment Observation receipt remains intentionally limited:

```text
binding_status = DEPLOYMENT_BINDING_INSUFFICIENT
```

The bridge must preserve that status.

```text
Deployment Observation != Deployment Provenance
Deployment Binding Insufficient != Permission to Repair Provenance by Inference
```

A minimized case can therefore become analytically usable while the separate question “did this exact artifact originate from this exact deployment?” remains unresolved.

## Pressure firewall

Application-side operational context may include platform dependency, reserve horizon, case age or similar urgency signals.

Those fields may remain available for triage but are never serialized into the Marketer Pessimist claim/evidence/decision packet.

```text
Business Pressure != Epistemic Weight
Triage Context != Marketer Evidence
```

The synthetic fixture deliberately contains a fictional pressure context and tests that it does not appear in the derived Marketer intake.

## Evidence quality firewall

Bridge evidence carries both:

- `source_epistemic_status` — application-side knowledge about how the evidence reference was obtained;
- `quality` — the quality vocabulary that will cross into Marketer Pessimist.

Allowed source statuses:

```text
synthetic_conformance
user_asserted_evidence_reference
independently_verified
```

Only `independently_verified` may be projected as `quality=verified`.

```text
User-Asserted Evidence Reference != Independently Verified Evidence
```

The application-only `source_epistemic_status` field is stripped at the boundary after it has constrained the allowed quality. It is not silently reinterpreted by the analytical core.

## Source modes

Repository conformance commits only:

```text
synthetic_conformance
```

A future locally supplied pilot packet may use:

```text
real_non_personal
```

only when its embedded Deployment Observation uses `manual_operator_sharing` and the minimization assertions are satisfied.

The real-shape path is exercised only in memory by tests. No real deployment address, audit payload, audit digest, review text or developer feedback is committed here.

## Exact predecessor reuse

The bridge imports and executes the merged runtimes directly:

```text
MARKETCLOSER-DEPLOYMENT-OBSERVATION v0.1
MARKETER-PESSIMIST-REAL-REVIEW-INTAKE v0.1
```

The generated Marketer intake is not a parallel approximation. It is validated by the real Marketer intake validator and then passed to `deriveCandidate()`.

For a real-non-personal shape the farthest machine state is:

```text
REAL_MINIMIZED_REVIEW_CANDIDATE_READY
-> Marketer candidate: REAL_REVIEW_CANDIDATE_READY
```

This still means:

```text
stress_test_run = false
stress_test_receipt_created = false
response_candidate_created = false
human_disposition_recorded = false
PilotPermit = false
ActionPermit = false
execution = false
external_effect = false
```

## Typed receipt

`MarketCloserMinimizedRealReviewBridgeReceipt` binds:

- exact bridge input hash;
- exact re-derived Deployment Observation receipt hash;
- preserved deployment binding status;
- human minimization assertion;
- exact derived Marketer intake hash;
- exact derived Marketer candidate hash/state;
- explicit zero-transfer boundary for raw/private/pressure data;
- explicit non-effects and next safe action.

`receipt-binding.js` re-derives the entire receipt from the exact input.

```text
Receipt Self-Consistency != Exact Bridge + Predecessor Binding
```

## Schema ownership

Bridge-owned objects use closed key sets. Predecessor-owned objects are deliberately not copied into a second normative schema:

- `deployment_observation` is closed by the merged Deployment Observation validator;
- `claim_package` and `decision_constraints` are closed by the merged Marketer Real Review Intake validator after projection.

This avoids schema duplication and successor drift.

## CLI

Allowed:

```text
validate
receipt
help
```

Forbidden action-like commands include `analyze`, `stress-test`, `respond`, `approve`, `publish`, `send`, `permit`, `run`, `execute` and `mutate`.

## Next safe action

```text
REAL_REVIEW_RUN_AUTHORITY_GATE_REQUIRED
```

The next layer may decide whether one exact real review candidate is authorized to enter a local stress-test run. This bridge does not make that decision.

## Non-effects

```text
Raw Review != Minimized Claim
Public Review != Non-Personal Data
Human Minimization Review != Independent Privacy Verification
Minimized Non-Personal Packet != Source Identity
Deployment Observation != Deployment Provenance
Deployment Binding Insufficient != Permission to Repair Provenance by Inference
Business Pressure != Epistemic Weight
Triage Context != Marketer Evidence
User-Asserted Evidence Reference != Independently Verified Evidence
Minimized Bridge != Stress-Test Run
Marketer Real Review Candidate != Response Candidate
Marketer Real Review Candidate != PilotPermit
Marketer Real Review Candidate != ActionPermit
Marketer Real Review Candidate != Execution
```
