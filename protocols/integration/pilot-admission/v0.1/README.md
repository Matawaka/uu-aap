# Product Pilot Admission Profile v0.1

**Status:** experimental Phase E pre-admission specialization  
**Issue:** #601  
**Origin frontier:** `48843187400e3c2cf561a53659a0a1ef48e65a32`  
**Origin tree:** `d3f9382fbd241bd03f038489519831823f8d120b`

## Purpose

Phase D ends with runnable local no-effect scenarios. Phase E begins only after a separate boundary decides whether a proposed real pilot is even eligible for human admission review.

This profile prevents the transition:

```text
local synthetic MVP passed
-> therefore run a real pilot
```

The correct transition is:

```text
canonical local MVP evidence
+ exact product contract
+ proposed real pilot candidate
+ data/effect/retention boundary
+ existing run-admission invariants
-> ProductPilotAdmissionPreflightReceipt
-> human/data-protection gates
-> STOP
```

No receipt in this profile admits or starts a pilot.

## Existing predecessor reused

The profile specializes the fail-closed semantics already present in:

```text
pilots/core-pilot-002/run-admission/
```

Preserved distinctions:

```text
Synthetic fixture != Real participant evidence
Admission != Disposition
No eligible input != Permission to fabricate one
Observed source != Identity / authority / standing
```

Product specialization adds:

```text
Local MVP Success != Pilot Admission
Admission Candidate != PilotPermit
Admission Candidate != Pilot Start
```

The original Core Pilot 002 gate remains independent and unchanged.

## Two canonical product consumers

### Маркетолог Пессимиста

Exact product binding:

```text
product_id = marketer-pessimist
version = 0.1
contract_hash = sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6
```

The profile re-runs the committed local MVP source:

```text
products/marketer-pessimist/v0.1/local-mvp/examples/synthetic-onboarding.input.json
```

through:

```text
Marketer.validateInput()
Marketer.analyze()
MarketerBinding.validateReceiptAgainstInput()
```

The canonical proposed Phase E candidate uses real but non-personal business evidence, no external effect, no network/provider/account mutation and session-bounded retention.

Machine result:

```text
READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW
```

This means only that the candidate is coherent enough for a human admission review.

### Честный найм

Exact product binding:

```text
product_id = honest-hiring
version = 0.1
contract_hash = sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae
```

The profile re-runs:

```text
products/honest-hiring/v0.1/local-mvp/examples/synthetic-sap-data-platform-architect.input.json
```

through:

```text
HonestHiring.validateInput()
HonestHiring.deriveResult()
HonestHiringBinding.validateResultAgainstInput()
```

The canonical proposed Phase E candidate explicitly declares future real personal applicant data while preserving zero employment effect.

Machine result:

```text
DATA_PROTECTION_REVIEW_REQUIRED
```

The result does **not** mean that data-protection review passed, participant consent exists, or the pilot is admitted.

## Allowed machine statuses

Only:

```text
READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW
DATA_PROTECTION_REVIEW_REQUIRED
PILOT_BOUNDARY_UNSATISFIED
```

No `APPROVED`, `ADMITTED`, `RUNNING`, `PERMITTED` or equivalent state exists.

## Boundary evaluation

A candidate becomes `PILOT_BOUNDARY_UNSATISFIED` if any v0.1 forbidden condition is present, including:

- sensitive personal data;
- external effect request;
- irreversible effect request;
- real-world decision in scope;
- required network access;
- required provider invocation;
- required account mutation;
- missing correction path;
- missing deletion path;
- missing human product-owner review;
- missing required consent/data-protection boundary for personal data.

Personal data by itself is not a negative judgment. When the required review/consent boundaries are declared, it produces:

```text
DATA_PROTECTION_REVIEW_REQUIRED
```

not rejection.

## Human/data-protection gates

Every receipt keeps:

```text
human_product_owner_review_required = true
pilot_admission_disposition_required = true
```

For real personal data:

```text
data_protection_review_required = true
participant_consent_required = true
```

But the machine claims remain:

```text
data_protection_approved = false
participant_consent_recorded = false
product_owner_approved = false
pilot_admitted = false
```

## Local MVP predecessor evidence

The preflight does not accept a user-supplied boolean such as `mvp_passed=true`.

For the selected product profile it loads the canonical committed synthetic source and reproduces the local MVP output with the product's existing source-aware binding API.

The receipt records:

- canonical local MVP source path;
- predecessor source hash;
- predecessor artifact type/id;
- predecessor output hash;
- predecessor frontier;
- `local_mvp_revalidated=true`.

```text
Predecessor Artifact Exists != Predecessor Revalidated
Predecessor Revalidated != Pilot Admission
```

## Exact receipt/source binding

`receipt-binding.js` performs:

```text
validate exact admission candidate
+ validate receipt
+ re-run canonical local MVP predecessor
+ re-derive expected preflight receipt
+ require canonical equality
```

Therefore:

```text
Receipt Self-Consistency != Exact Admission Candidate Binding
```

A self-consistent substituted status or predecessor hash fails the source-aware binding test.

## Required false claims

Every preflight receipt fixes false:

```text
pilot_admitted
pilot_permit_created
real_pilot_started
participant_consent_recorded
data_protection_approved
product_owner_approved
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

## CLI

Allowed read-only commands:

```text
validate
inspect
help
```

Forbidden action families include:

```text
admit
approve
start
run
execute
send
publish
hire
reject
campaign
mutate
permit
```

The production implementation has no network, provider, subprocess or filesystem-write surface. Explicit validation may read the admission JSON and canonical local-MVP source files.

## Relationship to Phase E

This profile is **pre-admission**, not the bounded real pilot itself.

The ladder remains:

```text
Product Contract
-> deterministic synthetic conformance
-> runnable local no-effect MVP
-> product pilot admission preflight
-> separate human/data-protection/consent disposition
-> bounded real pilot
-> execution/outcome receipt if applicable
-> post-run assessment
```

A future merge of this profile does not authorize the next rung automatically.

## Non-effects

This artifact does not collect real applicant/participant data, contact anyone, record consent, approve data processing, authorize a campaign/employment decision, call a provider, mutate an account, create an ActionPermit, start a pilot, create successor authority, promote Stable-Core status, tag a release or merge itself.
