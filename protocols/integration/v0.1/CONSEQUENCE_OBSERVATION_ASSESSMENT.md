# ConsequenceObservationAssessment v0.1

## Purpose

`ConsequenceObservationAssessment v0.1` is the policy-bound admissibility layer after the non-certifying consequence observation ingress.

Canonical implementation base:

- repository: `Matawaka/uu-aap`
- base `main`: `be735d6dfabdd9179524d3ad57f7a202916e9695`
- base tree: `bf905d1301920d6461dd72ec42a67fed3fe2c765`
- base parent: `df84e173b4e058d58e4ad1137dcbab9e5c151646`
- base merge: PR #243

KONTUR is intentionally outside this layer. No `server/kontur/**` state, policy, readiness, activation or responsibility semantics are modified.

## Architectural position

```text
ResponsibilityEventSuccessorLedgerEntry
  -> ConsequenceObservationSourceEvidence
  -> ConsequenceObservationClaim
  -> ConsequenceObservationIngressReceipt
  -> ConsequenceObservationAssessment
  -> [future explicit source-specific adapter policy/migration]
```

The core distinction is:

```text
claim accepted
!= source admissible
!= observation qualified
!= consequence truth
!= causality
!= responsibility attribution
!= adjudication
```

The assessment evaluates a declared observation package under an exact policy. It does not turn evidence into truth and it does not append anything to the responsibility-event ledger.

## Reference assessment policy

The reference policy is:

`urn:uu-aap:consequence-observation-assessment-policy:bounded-source-admissibility:1`

Scope:

`urn:uu-aap:consequence-observation-assessment-scope:bounded-source-admissibility-v0.1`

Policy bytes are bound with RFC8785 JCS + SHA-256.

The reference policy deliberately has:

```json
"registered_live_source_profiles": []
```

and fixes:

- `live_observation_qualification_allowed = false`
- `test_fixture_live_qualification_allowed = false`
- `successor_adapter_authorization_allowed = false`
- `assessment_is_policy_relative = true`
- `scalar_scores_allowed = false`

Therefore v0.1 cannot emit a qualified live external observation, even if a caller presents structurally valid observed source bytes. A later explicit policy version must register a bounded producer/source semantic profile first.

## Exact input bindings

Every assessment binds the exact bytes of:

1. `ConsequenceObservationAssessmentPolicy`
2. the predecessor `ConsequenceObservationIngressPolicy`
3. `ConsequenceObservationIngressReceipt`
4. `ConsequenceObservationClaim`
5. `ConsequenceObservationSourceEvidence`, when present
6. the authoritative responsibility-event frontier entry

The assessment also preserves and re-verifies:

- compact responsibility-event head: sequence, event ID, event digest
- semantic frontier from the authoritative embedded event
- effect frontier from the authoritative embedded event

This keeps the compact head separate from semantic/effect context while binding both to the exact ledger entry bytes.

## Gate model

The policy defines exactly ten gates:

1. `ingress_package_exact`
2. `source_bytes_exact`
3. `producer_profile_recognized`
4. `producer_artifact_identity_exact`
5. `observation_present`
6. `observation_chronology_valid`
7. `observation_horizon_valid`
8. `frontier_exact`
9. `fixture_excluded_from_live_qualification`
10. `source_semantics_profile_satisfied`

Gate statuses are typed and non-scalar:

- `qualified`
- `not_qualified`
- `deferred`
- `out_of_scope`

Each gate decision carries reason codes and evidence refs. No probability, confidence, likelihood, causal score, responsibility score, blame score, percentage, weight or rating is accepted.

## Current reference outcomes

The current repository intentionally exercises only bounded non-live-positive outcomes.

### No observation

For `not_yet_observable`, `not_observed` or `indeterminate` claims without source observation bytes:

`status = not_qualified_no_observation`

The ingress package and frontier can still be exact, but the observation gate is not qualified.

### Test fixture observation

A digest-bound `test_fixture` source with `claimed_status=observed` can be structurally assessed:

`status = not_qualified_test_fixture`

The fixture proves source-byte, chronology and frontier machinery. It cannot become a live observation and cannot become successor-adapter eligible.

### Hypothetical live observed package

A live observed package with exact source bytes but no registered source-specific profile resolves to:

`status = deferred_source_profile_required`

This status is a machine-readable refusal to infer source semantics from byte integrity alone.

## Assessment result boundary

Every v0.1 assessment fixes:

- `policy_relative = true`
- `observation_qualified = false`
- `source_profile_registered = false`
- `source_specific_adapter_required = true`
- `successor_adapter_eligible = false`
- `successor_append_may_proceed = false`

The assessment may establish only that:

- the assessment policy was applied;
- the exact ingress package was revalidated;
- exact source bytes were revalidated if present;
- the authoritative responsibility-event frontier was reverified;
- observation admissibility was assessed;
- stronger claims were withheld.

It never establishes:

- a new external consequence;
- consequence truth;
- generalized external-consequence causality;
- causal proof;
- responsibility for the consequence;
- responsibility adjudication;
- legal liability or legal effect;
- moral blame;
- truth;
- successor adapter authorization;
- successor append permission;
- global replay protection;
- distributed consensus;
- PoAI materialization;
- universal canonicality.

## Existing successor adapter remains blocked

`consequence-observation-successor-adapter.js` remains the currently applicable generic adapter boundary. It still returns a blocked decision and cannot be opened by a `ConsequenceObservationAssessment v0.1` artifact.

This is intentional:

```text
assessment completed != source adapter registered != successor append permitted
```

A future source-specific adapter must have its own versioned policy and validator, and it must explicitly consume a qualified live observation under a future assessment policy that actually registers that source profile.

## Temporal semantics

The assessment has its own policy-valid `assessed_at` frontier. It must occur after:

- the ingress receipt;
- the claim;
- source capture when source evidence exists.

Historical source/ingress timestamps are not rewritten merely because the assessment occurs later.

This is local typed chronology, not proof of complete global wall-clock chronology.

## Fail-closed behavior

The implementation rejects at least:

- policy ID/version/scope/rule drift;
- injected live source profiles in v0.1;
- policy attempts to enable live qualification or successor authorization;
- assessment/ingress-policy/ingress-receipt/claim/source/frontier binding substitution;
- source payload digest substitution;
- source observation removal;
- event-head, semantic-frontier or effect-frontier drift;
- fixture relabelling as live;
- chronology or observation-horizon inversion;
- forged gate decisions;
- forged source-profile registration;
- observation qualification escalation;
- successor adapter/append escalation;
- causal/responsibility/legal/moral/truth overclaims;
- scalar scoring fields.

## Continuation

The next legitimate strengthening is **not** to flip `observation_qualified` to true in this policy.

It is to introduce a separate, versioned **source-specific consequence adapter policy** for a genuinely available producer, with explicit semantic expectations and exact source identity. Only that migration can create a path from a future qualified live consequence observation to `ResponsibilityEventSuccessorAppend`.

No fictional consequence. No silent policy upgrade. Human-controlled merge remains final.
