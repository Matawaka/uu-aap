# FREESHIELD Local Protective Assessment MVP v0.1

**Status:** experimental runnable local no-effect product MVP  
**Issue:** #595  
**Origin frontier:** `2622d451c3ce49bc56072a5847b13b0dff390bf1`  
**Origin tree:** `75f3d887d39fc09f505411ef0bbb3d046403d7b3`  
**Canonical FREESHIELD Product Contract hash:** `sha256:355ad149846745c6009dcf22a1ce059c47460bcdc49a9a9009620372282c8295`

## Purpose

This successor materializes the six local analysis effects already defined by the canonical FREESHIELD Product Contract:

```text
candidate-envelope-inspection
contract-authority-consistency-check
evidence-sufficiency-assessment
scope-risk-hypothesis-map
protective-outcome-candidate
protective-reconciliation-candidate
```

It is a deterministic local protective assessment program. It is not an actuator, policy enforcement service, provider runtime, sanction mechanism or authority source.

```text
exact candidate
+ exact consumer Product Contract binding
+ authority lineage
+ constraints / explicit non-effects
+ bounded evidence
+ frontier observation
-> local protective assessment
-> one protective outcome candidate
-> FreeShieldProtectiveAssessmentReceipt
-> HUMAN_PROTECTIVE_DISPOSITION_REQUIRED
-> STOP
```

The runtime never emits `FreeShieldDispositionReceipt`.

## Historical boundary

The predecessor FREESHIELD README says `runtime отсутствует` at its original contract frontier. That statement is preserved as historical evidence.

This runtime is added only under:

```text
products/freeshield/v0.1/local-mvp/
```

```text
Successor Runtime != Rewrite of Predecessor History
```

## Product-neutral runtime, consumer-driven fixture

The runtime does not hard-code Honest Hiring semantics. `consumer_binding` accepts a generic external product identity and requires:

```text
authority_transfer = false
responsibility_transfer = false
```

The canonical example is deliberately driven by `Честный найм`, because that Product Contract requires a separately bound FREESHIELD assessment before its comparison disposition gate.

Canonical fixture binding:

```text
consumer product = honest-hiring v0.1
consumer contract hash = sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae
real applicant data = none
external effect requested = false
```

This makes FREESHIELD usable by the next Hiring increment without turning Honest Hiring into a reverse dependency of the protective runtime.

## Input boundary

`FreeShieldProtectiveAssessmentInput` contains only:

- exact FREESHIELD contract identity;
- exact consumer Product Contract identity;
- exact repository evaluation frontier;
- one candidate envelope;
- declared authority scope and lineage state;
- exact evidence references and provenance;
- constraints with explicit disposition hints;
- one frontier observation;
- closed local-only runtime controls;
- deterministic content hash.

Allowed FREESHIELD data classes are only the classes defined by the Product Contract:

```text
candidate-envelope
contract-authority-bundle
constraint-bundle
frontier-state
```

The local MVP rejects additional profile/sensitive/personality/proxy classes rather than trying to minimize them silently.

## Deterministic assessment

The runtime does not infer truth or legal/safety status from arbitrary text. It evaluates explicit structured boundary facts.

Priority is fail-closed and bounded:

```text
external effect or block-effect constraint
-> BLOCK_EFFECT

conflicting evidence/frontier or human-review constraint
-> HUMAN_REVIEW

incomplete authority lineage, stale/unverified evidence or evidence constraint
-> REQUIRE_EVIDENCE

scope outside supplied authority or narrow-scope constraint
-> NARROW_SCOPE

otherwise
-> ALLOW_ANALYSIS
```

The machine state remains one of:

```text
UNKNOWN
CONFLICT
INSUFFICIENT_EVIDENCE
SCOPE_UNBOUND
ASSESSMENT_READY
```

It cannot establish:

```text
REJECTED
ACCEPTED_PROTECTIVE_ASSESSMENT
```

## Protective outcomes

### ALLOW_ANALYSIS

Means only that this exact candidate may continue local analysis under the supplied boundary.

```text
ALLOW_ANALYSIS != Execution Admission
```

The canonical Honest Hiring fixture produces this outcome.

### NARROW_SCOPE

Means the candidate scope is broader than the supplied authority or an applicable constraint explicitly requires narrowing.

The runtime does not rewrite the candidate.

### REQUIRE_EVIDENCE

Means required authority/evidence is incomplete, stale or unverified.

```text
Missing Evidence != Proof of Safety or Harm
```

### HUMAN_REVIEW

Means evidence/frontier conflict or an explicit bounded constraint requires human reconciliation.

```text
Human Review Requirement != Negative Judgment
```

### BLOCK_EFFECT

Means one exact external-effect candidate is locally non-admissible under this no-effect FREESHIELD profile.

Even here:

```text
actuator_blocked = false
global_prohibition_created = false
sanction_created = false
blacklist_entry_created = false
candidate_rejected = false
external_effect_performed = false
```

```text
BLOCK_EFFECT != Global Prohibition
```

## Risk hypotheses

Risk entries generated by this MVP always carry:

```text
status = bounded_candidate
```

They document boundary mismatches such as external-effect requests or scope mismatch. They are not proof of harm, intent, liability or illegality.

## Receipt

`FreeShieldProtectiveAssessmentReceipt` binds:

- exact source input hash;
- exact FREESHIELD Product Contract;
- exact consumer Product Contract;
- evaluation frontier;
- candidate identity/digest;
- authority lineage and scope findings;
- evidence quality findings;
- bounded risk hypotheses;
- one protective outcome candidate;
- reconciliation candidate;
- explicit claims and non-effects;
- deterministic receipt hash.

Every receipt requires human protective disposition next:

```text
next_safe_action = HUMAN_PROTECTIVE_DISPOSITION_REQUIRED
```

## Exact source binding

`receipt-binding.js` validates:

```text
source input validity
+ receipt self-consistency
+ deterministic rebuild from source input
+ canonical equality
```

Therefore:

```text
Receipt Self-Consistency != Exact Source Binding
```

A self-consistent receipt with changed consumer identity, frontier, candidate digest or outcome fails source-aware validation.

## Required false claims

Every machine receipt fixes false:

```text
truth_certified
harm_proven
intent_inferred
liability_established
global_prohibition_created
sanction_created
blacklist_entry_created
account_blocked
candidate_rejected
employment_decision_made
human_disposition_recorded
actuator_blocked
external_system_mutated
authority_created
authority_expanded
responsibility_accepted
action_permit_created
execution_admitted
provider_invoked
network_delivery_performed
external_effect_performed
stable_core_promotion_established
successor_authority_created
```

## CLI

Allowed commands:

```text
validate
assess
inspect
help
```

Examples:

```bash
node products/freeshield/v0.1/local-mvp/protective-assessment.js validate \
  products/freeshield/v0.1/local-mvp/examples/synthetic-honest-hiring.input.json

node products/freeshield/v0.1/local-mvp/protective-assessment.js assess \
  products/freeshield/v0.1/local-mvp/examples/synthetic-honest-hiring.input.json
```

Forbidden command families include:

```text
block
ban
sanction
blacklist
reject
hire
send
execute
mutate
publish
```

The runtime performs no network access, provider invocation, subprocess spawn or filesystem write.

## Conformance cases

Positive/output cases cover all five outcomes:

- canonical verified local Hiring packet -> `ALLOW_ANALYSIS`;
- overbroad scope -> `NARROW_SCOPE`;
- incomplete authority / stale evidence -> `REQUIRE_EVIDENCE`;
- conflicting evidence -> `HUMAN_REVIEW`;
- external-effect candidate -> `BLOCK_EFFECT` while `actuator_blocked=false`.

Fail-closed vectors reject at minimum:

- input hash tampering;
- FREESHIELD contract substitution;
- consumer authority transfer;
- duplicate evidence IDs;
- undeclared/prohibited data class;
- unknown evidence refs;
- ActionPermit carriage;
- enabled network/provider/actuator controls;
- every prohibited receipt claim;
- unknown receipt claims;
- human disposition states;
- accepted/non-candidate protective outcome;
- next-safe-action substitution;
- exact source-input/receipt substitution;
- actuating CLI commands.

## Non-goals

This MVP does not:

- process real applicant data;
- certify safety, legality or compliance;
- reject or hire a candidate;
- block an account, actuator or organization;
- create sanctions or blacklists;
- infer protected attributes, identity or psychological vulnerability;
- create/expand authority;
- accept responsibility;
- carry/create an ActionPermit;
- admit execution;
- invoke an AI provider;
- perform an external effect;
- promote anything into Stable Core.

## Successor boundary

After human merge, the next consumer-driven step may implement the Honest Hiring local comparison MVP and consume this exact protective assessment receipt as a required predecessor.

That successor must preserve:

```text
FREESHIELD Assessment != Automatic Rejection
Accepted Protective Assessment != Hiring Decision
Hiring Support != Hiring Authority
```
