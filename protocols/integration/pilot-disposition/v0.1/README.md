# Product Pilot Human Disposition v0.1

Status: experimental Phase E integration boundary.

Origin frontier:

```text
392adeab56dba9ad69f9f0999f194597cab83fec
```

Origin tree:

```text
facfa1654af8552b925a9c1c01f9e946ca30580b
```

Issue: #603.

## Purpose

This profile records a bounded human review disposition after `Product Pilot Admission Profile v0.1` without turning that review into permission to run a pilot.

The chain is:

```text
canonical Product Pilot Admission candidate
-> re-run merged admission runtime
-> re-run exact admission receipt/candidate binding
-> human-supplied disposition assertion
-> ProductPilotHumanDispositionReceipt
-> STOP
```

The runtime does not accept an unverified `admission_passed=true` flag and does not trust a supplied receipt hash. It loads the canonical committed admission candidate, re-derives its preflight receipt and re-runs the merged source-binding API before evaluating the disposition.

## Invariants

```text
Human Decision Recorded != Reviewer Identity Verified
Human Decision Recorded != Reviewer Authority Verified
Human Approval != PilotPermit
Human Approval != Pilot Start
Human Approval != ActionPermit
Human Approval != Execution Admission
Product-Owner Approval != Data-Protection Approval
Data-Protection Review Required != Consent Recorded
Reject or Defer != Sanction or Global Prohibition
Disposition Receipt != Successor Authority
```

A reviewer reference is deliberately opaque. The runtime records it but does not resolve identity, organizational role, legal standing, responsibility or authority.

A later pilot-permit layer must establish any authority needed for reliance independently.

## Supported product profiles

v0.1 binds exactly two merged admission candidates:

```text
Маркетолог Пессимиста
protocols/integration/pilot-admission/v0.1/examples/marketer-pessimist-real-non-personal.candidate.json

Честный найм
protocols/integration/pilot-admission/v0.1/examples/honest-hiring-real-personal.candidate.json
```

The runtime does not infer product identity from the review text. The candidate path and expected product id must agree with the closed profile registry.

## Human decision vocabulary

```text
APPROVE
DEFER
REJECT
```

The input also declares a decision context:

```text
synthetic_conformance
human_supplied
```

`synthetic_conformance` may only use `DEFER`. This prevents committed fixtures from pretending that a real approval or rejection occurred.

The repository therefore commits only canonical `DEFER` fixtures for both products.

Tests exercise `human_supplied` approval/rejection semantics as conformance assertions, not as claims that a real reviewer approved or rejected a pilot.

## Derived statuses

### Marketer Pessimist approval path

Upstream admission status:

```text
READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW
```

A `human_supplied + APPROVE` assertion derives:

```text
HUMAN_ADMISSION_APPROVED_PERMIT_NOT_CREATED
```

Next safe action:

```text
SEPARATE_AUTHORITY_BOUND_PILOT_PERMIT_REVIEW_REQUIRED
```

This does not verify reviewer authority and does not create a permit.

### Honest Hiring approval path

Upstream admission status:

```text
DATA_PROTECTION_REVIEW_REQUIRED
```

A `human_supplied + APPROVE` assertion derives:

```text
PRODUCT_REVIEW_APPROVED_DATA_PROTECTION_STILL_REQUIRED
```

Next safe action:

```text
SEPARATE_DATA_PROTECTION_CONSENT_AND_AUTHORITY_REVIEW_REQUIRED
```

The receipt keeps all of the following false:

```text
data_protection_approved
participant_consent_recorded
reviewer_authority_verified
pilot_permit_created
real_pilot_started
```

Product review cannot override the data-protection boundary.

### Defer

Any supported upstream positive review state plus `DEFER` derives:

```text
HUMAN_REVIEW_DEFERRED
```

Next safe action:

```text
NO_PILOT_ACTION_UNTIL_NEW_HUMAN_REVIEW
```

### Reject

`REJECT` derives:

```text
HUMAN_REVIEW_REJECTED
```

Next safe action:

```text
STOP_THIS_PILOT_CANDIDATE_WITHOUT_SANCTION
```

Rejection is a bounded disposition for this candidate. It is not a blacklist, sanction, diagnosis, global prohibition or successor authority.

### Unsatisfied admission boundary

`APPROVE` is fail-closed if an upstream admission receipt is `PILOT_BOUNDARY_UNSATISFIED`.

The canonical v0.1 profiles are pinned to their current merged positive-review statuses, so any drift of those upstream statuses also fails closed during predecessor revalidation.

## Receipt provenance

`ProductPilotHumanDispositionReceipt` binds:

- exact disposition input id and content hash;
- exact canonical admission candidate path, id and content hash;
- exact re-derived admission preflight receipt id and content hash;
- exact upstream admission status and data/consent gates;
- product id/profile/version;
- the human-supplied decision assertion;
- explicit identity/authority non-verification;
- required follow-up gates;
- mandatory non-effects.

`receipt-binding.js` re-derives the whole receipt from the disposition input and requires canonical equality.

Thus a structurally valid receipt with a substituted reviewer reference, source hash or admission-preflight hash does not become provenance-valid.

## Claims

Always true:

```text
exact_admission_candidate_revalidated
exact_admission_preflight_revalidated
human_decision_recorded
```

Decision-specific:

```text
human_approval_recorded
human_deferral_recorded
human_rejection_recorded
```

Exactly one of those three corresponds to the supplied decision.

Always false:

```text
reviewer_identity_verified
reviewer_authority_verified
product_owner_authority_verified
pilot_admitted
pilot_permit_created
real_pilot_started
participant_consent_recorded
data_protection_approved
external_effect_authorized
external_effect_performed
real_world_decision_authorized
account_mutation_authorized
network_delivery_performed
provider_invoked
authority_created
responsibility_accepted
action_permit_created
execution_admitted
stable_core_promotion_established
successor_authority_created
```

## CLI / SDK

Only read-only commands exist:

```text
node protocols/integration/pilot-disposition/v0.1/pilot-disposition.js validate <file|->
node protocols/integration/pilot-disposition/v0.1/pilot-disposition.js inspect <file|->
node protocols/integration/pilot-disposition/v0.1/pilot-disposition.js help
```

There is no `approve`, `admit`, `permit`, `start`, `run`, `execute`, `send`, `hire`, `reject`, `campaign`, `mutate` or provider command. Decisions are data inside a validated input document, not imperative CLI actions.

The production runtime performs local file reads only. It has no provider client, network transport, subprocess execution or filesystem-write surface.

## Canonical fixtures

```text
examples/marketer-pessimist-defer.disposition.json
examples/honest-hiring-defer.disposition.json
```

Both are synthetic conformance fixtures with `DEFER`.

They do not establish a real human decision.

## What v0.1 does not do

It does not:

- collect real participant/applicant data;
- verify reviewer identity;
- verify reviewer authority;
- accept responsibility;
- approve data protection;
- record participant consent;
- create `PilotPermit`;
- create `ActionPermit`;
- start a pilot;
- call a provider;
- send a campaign;
- make an employment decision;
- mutate an account;
- authorize or perform an external effect;
- create successor authority;
- promote anything into Stable Core.

## Next boundary

A future real pilot requires at least a separate authority-bound permit review. Honest Hiring additionally requires separate data-protection and consent evidence before any permit can be considered.

This profile intentionally stops before that boundary.
