# GitHub Actions source-specific consequence adapter v0.1

## Purpose

This layer is the first explicit migration from the generic, deliberately non-qualifying `ConsequenceObservationAssessment v0.1` to a **registered source-specific observation profile**.

Canonical implementation base:

- repository: `Matawaka/uu-aap`
- base `main`: `b8d6d343c32ff9aaa40621357b7f96c45420c9de`
- base tree: `d5ea71cd312be87a15c43153923ab2fddaa5cb7f`
- base parent: `be735d6dfabdd9179524d3ad57f7a202916e9695`
- base merge: PR #247

KONTUR is outside this layer. No `server/kontur/**` semantics are changed.

## Architectural position

```text
ResponsibilityEventSuccessorLedgerEntry
  -> ConsequenceObservationSourceEvidence
  -> ConsequenceObservationClaim
  -> ConsequenceObservationIngressReceipt
  -> ConsequenceObservationAssessment v0.1
       status = deferred_source_profile_required
  -> ConsequenceObservationSourceAdapterPolicy
  -> GitHubActionsRuntimeObservation
  -> ConsequenceObservationSourceAdapterReceipt
  -> [future separate ResponsibilityEventSuccessorAppend]
```

The governing distinctions are:

```text
runtime context observed
!= provider identity cryptographically attested
!= GitHub remote truth
!= external consequence truth
!= causality
!= responsibility attribution
!= adjudication
```

and:

```text
source-specific observation semantics qualified
!= successor append permission
!= successor append execution
```

## Why GitHub Actions is the first producer

The source is not fictional. The validation workflow already runs inside GitHub Actions and receives a concrete machine runtime context from the runner.

The registered producer is exactly:

- producer ID: `urn:uu-aap:producer:github-actions-runtime`
- producer artifact type: `GitHubActionsRuntimeObservation`
- producer artifact version: `0.1`
- repository: `Matawaka/uu-aap`
- workflow: `ConsequenceObservation Source Adapter validation`
- observation method: `system_record`
- consequence class: `other`

The adapter does **not** request OIDC, secrets, repository write permission, or any authority beyond the existing read-only checkout needed by validation.

## GitHubActionsRuntimeObservation v0.1

The producer records only non-secret runtime context:

- exact repository;
- exact workflow name;
- event name;
- run ID, number and attempt;
- exact `GITHUB_SHA`;
- exact `GITHUB_REF`;
- head/base refs when present;
- GitHub server URL;
- SHA-256 of the exact raw event payload bytes;
- observation timestamp.

The event/ref relation is fail-closed:

- `pull_request` -> `refs/pull/<n>/merge` -> `candidate_pull_request`;
- `push` -> `refs/heads/main` -> `main_push`.

A PR merge ref is never relabelled as a main-bound observation.

The runtime observation explicitly keeps false:

- cryptographic provider identity attestation;
- GitHub remote truth certification;
- external consequence certification;
- causal proof;
- responsibility attribution;
- legal liability;
- moral blame;
- truth certification;
- remote/universal canonicality.

## Relationship to generic assessment v0.1

`ConsequenceObservationAssessment v0.1` remains immutable and still returns:

```text
status = deferred_source_profile_required
observation_qualified = false
source_profile_registered = false
successor_adapter_eligible = false
successor_append_may_proceed = false
```

for a live observed source.

This is not an error and is not rewritten by the new layer.

The source-specific adapter consumes that exact deferred assessment and proves only that a later, explicit policy now recognizes the exact producer profile.

This preserves historical assurance:

```text
earlier generic assessment remains deferred
+ later source-specific policy matches producer
= source-specific qualification added in a new artifact
```

not:

```text
earlier assessment silently upgraded
```

## Source adapter policy

Policy ID:

`urn:uu-aap:consequence-observation-source-adapter-policy:github-actions-runtime:1`

Scope:

`urn:uu-aap:consequence-observation-source-adapter-scope:github-actions-runtime-v0.1`

Policy bytes are bound with RFC8785 JCS + SHA-256.

The policy registers exactly one producer profile. It requires a live, observed, digest-bound source wrapper and the exact predecessor assessment state `deferred_source_profile_required`.

The policy permits only:

`typed_successor_source_eligibility_allowed = true`

while fixing:

- `successor_append_execution_allowed = false`
- `successor_append_permission_allowed = false`
- `fixture_source_allowed = false`
- `policy_relative_only = true`
- `scalar_scores_allowed = false`

## Source adapter receipt

A passing `ConsequenceObservationSourceAdapterReceipt v0.1` digest-binds exact bytes of:

1. source adapter policy;
2. generic consequence observation assessment;
3. ingress receipt;
4. claim;
5. source evidence wrapper;
6. GitHub Actions runtime observation;
7. authoritative responsibility-event frontier entry.

It also re-verifies:

- exact responsibility-event head;
- semantic frontier;
- effect frontier;
- source payload equals exact producer observation bytes at the structured-artifact level;
- producer ID/type/version/ref;
- repository/workflow/event/ref semantics;
- chronology.

A successful decision is:

`eligible_as_typed_successor_source`

with:

- `source_specific_observation_semantics_qualified = true`
- `typed_successor_source_eligible = true`
- `successor_append_may_proceed = false`
- `successor_append_executed = false`

The positive qualification is narrowly policy-relative: the runner-exposed runtime record matches the declared source profile. It is not a universal statement about GitHub, the world, or causality.

## Candidate vs post-merge main evidence

Pull-request workflow runs produce:

`context_class = candidate_pull_request`

They bind the synthetic PR merge SHA/ref and are candidate evidence only.

After human squash merge, the push-to-main workflow may produce:

`context_class = main_push`

with the exact post-merge `main` SHA and `refs/heads/main`.

The two artifacts are not interchangeable. A later successor append must consume an exact source-adapter receipt chosen for the intended frontier. No silent refresh or candidate-to-main substitution is allowed.

## No automatic append

This layer intentionally stops at source eligibility.

It does not call `ResponsibilityEventSuccessorAppend`, does not mutate the ledger, and does not create a successor event.

The next layer must be a separate explicit append operation consuming one exact source-adapter receipt and revalidating its source, policy, frontier and runtime context.

## No scalar shortcuts

Probability, confidence, likelihood, causal/responsibility/blame scores, percentage, weight and rating fields are rejected. The only numerical-looking values are structural identifiers such as run number/attempt and event sequence metadata.

## Assurance summary

The strongest new statement in this layer is:

```text
exact GitHub Actions runner-exposed runtime context
+ exact registered source profile
+ exact deferred generic assessment
+ exact source/claim/ingress/frontier bindings
=> policy-relative eligibility as a typed successor source
```

It does not establish:

```text
external consequence truth
causal proof
responsibility for consequence
legal liability
moral blame
universal truth
PoAI materialization
universal canonicality
successor append permission or execution
```

Human squash merge remains final. No auto-merge.
