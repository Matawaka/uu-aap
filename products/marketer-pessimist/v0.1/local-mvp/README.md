# Маркетолог Пессимиста Local Stress-Test MVP v0.1

**Status:** experimental runnable local no-effect product MVP  
**Issue:** #593  
**Origin frontier:** `a9e948af070fb2606051476cb6b6fdcb744a74fb`  
**Origin tree:** `b98838424ef71d30671cff3c09efe2a7715c166c`  
**Canonical Product Contract hash:** `sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6`

## Purpose

This is the first runnable Phase D product slice for **Маркетолог Пессимиста**.

The canonical Product Contract already defines the product as an evidence-first local stress-test system. This successor makes the six contract analysis effects executable as a deterministic local program:

```text
claim-decomposition
counterargument-map
causal-alternative-map
falsifier-map
missing-evidence-map
bounded-recommendation-candidate
```

The runtime stops before the Product Contract's human `analysis-disposition-gate`.

```text
MarketerPessimistStressTestReceipt
!=
MarketerPessimistDispositionReceipt
```

## Historical contract boundary

The predecessor `products/marketer-pessimist/v0.1/README.ru.md` says `runtime отсутствует` at its original Product Contract frontier.

That predecessor is not rewritten here. It remains historical evidence of the contract-definition state.

This directory is a successor artifact created after that frontier:

```text
Historical Contract Definition
!=
Later Local MVP Runtime

Successor Runtime
!=
Rewrite of Predecessor History
```

The Product Contract JSON and its content hash remain unchanged.

## Runtime model

The MVP is intentionally deterministic and provider-free.

It does not claim to infer truth from arbitrary free text. Instead, the input explicitly declares each material statement as one of:

```text
observed_evidence
interpretation
assumption
hypothesis
declared_objective
```

The runtime validates those declarations, preserves their lineage, and generates bounded stress-test candidates from the structured evidence state.

```text
Declared Classification != Certified Truth
Pessimistic Analysis != Truth
Counterargument != Rejection
```

## Input

`MarketerPessimistStressTestInput` contains four bounded groups.

### Contract and frontier binding

The packet is bound to:

```text
contract_id = marketer-pessimist-product-contract
product_id = marketer-pessimist
product_version = 0.1
contract hash = sha256:83a616...
exact repository revision
exact observation time
```

### Claim package

The claim package contains:

- one exact synthetic claim;
- the review purpose;
- bounded scope;
- material statements;
- explicit statement classifications;
- statement-to-evidence references;
- a falsification probe or an explicit reason why one is unavailable.

### Supporting evidence

Each evidence item carries:

```text
evidence_id
summary
provenance_ref
quality
observed_at
supports_statement_ids
contradicts_statement_ids
```

Allowed quality states are:

```text
verified
unverified
stale
conflicting
```

Missing, stale, unverified and conflicting evidence remain visible. They are not converted into negative facts.

```text
Missing Evidence != Negative Evidence
Stale Evidence != False Evidence
Conflict != Automatic Rejection
```

### Decision constraints

The packet requires:

- at least one objective;
- at least one constraint;
- at least one unacceptable outcome;
- at least one success condition.

This prevents the stress test from becoming context-free criticism.

## Analysis behavior

### Claim decomposition

Every material statement is grouped by its declared classification and receives an evidence-lineage record.

The runtime requires 100% classification coverage for the material statements in the bounded packet.

### Counterargument candidates

The engine creates counterargument **candidates** when, for example:

- a statement is an interpretation/assumption/hypothesis rather than direct observed evidence;
- contradicting evidence is bound to the statement;
- evidence is unverified, stale or conflicting.

Each counterargument is explicitly:

```text
status = candidate
```

It is not a rejection or truth claim.

### Causal alternatives

For interpretations, assumptions and hypotheses, the runtime emits a bounded generic alternative-causality candidate:

```text
necessity not established
sufficiency not established
exclusivity not established
```

The MVP does not claim to discover universal causal structure.

### Falsifiers

Each material statement must carry either:

```text
available -> observation | test + description
```

or:

```text
unavailable -> explicit unavailable_reason
```

This preserves the Product Contract requirement that the recommendation candidate remain falsifiable or explain why falsification is not currently available.

### Missing-evidence map

The runtime records explicit gaps for:

```text
NO_SUPPORTING_EVIDENCE
UNVERIFIED_EVIDENCE
STALE_EVIDENCE
CONFLICTING_EVIDENCE
```

Unknown references fail closed rather than being silently ignored.

## Runtime states

The local MVP may establish only:

```text
UNKNOWN
CONFLICT
INSUFFICIENT_EVIDENCE
CANDIDATE_READY
```

It cannot establish:

```text
REJECTED
ACCEPTED_FOR_HUMAN_USE
```

Those are human disposition states from the predecessor Product Contract.

Primary state precedence in v0.1 is:

```text
CONFLICT
-> INSUFFICIENT_EVIDENCE
-> CANDIDATE_READY
```

`UNKNOWN` is also preserved in `uncertainty_states` when a non-observed claim lacks verified supporting evidence.

## Recommendation candidate

The engine may output only one of:

```text
HUMAN_RECONCILIATION_REQUIRED
REQUEST_MORE_EVIDENCE_CANDIDATE
READY_FOR_HUMAN_DISPOSITION_CANDIDATE
```

These are review-posture candidates, not human gate decisions.

Every result keeps:

```text
human_disposition_required = true
next_safe_action = HUMAN_ANALYSIS_DISPOSITION_GATE_REQUIRED
```

## Synthetic canonical example

`examples/synthetic-onboarding.input.json` is fully fictional.

Claim:

> A new onboarding headline promising setup in five minutes will increase trial activation by 20 percent without increasing support load.

The packet contains exactly one of each statement class:

```text
observed_evidence = 1
interpretation = 1
assumption = 1
hypothesis = 1
declared_objective = 1
```

Its evidence intentionally includes:

```text
verified
unverified
stale
conflicting
```

Expected result:

```text
state = CONFLICT
recommendation = HUMAN_RECONCILIATION_REQUIRED
claim_rejected = false
human_disposition_recorded = false
external_effect_performed = false
```

The example proves that a pessimistic stress test can surface conflict without turning conflict into rejection.

## Receipt

`MarketerPessimistStressTestReceipt` binds:

- exact Product Contract identity;
- exact runtime frontier;
- exact source input identity/hash;
- classification coverage;
- evidence lineage;
- counterargument candidates;
- causal-alternative candidates;
- falsifiers;
- missing-evidence gaps;
- bounded recommendation candidate;
- Product Contract success criteria;
- explicit positive claims and non-effects;
- deterministic content hash.

A separate `receipt-binding.js` validates provenance by rebuilding the deterministic receipt from the supplied source input and requiring canonical equality.

```text
Receipt Self-Consistency != Exact Source Binding
Receipt Hash != Human Disposition
```

## Mandatory false claims

The receipt fixes false:

```text
truth_certified
claim_rejected
automatic_negative_judgment
human_disposition_recorded
publication_authorized
campaign_send_authorized
campaign_sent
advertising_account_accessed
funds_spent
audience_uploaded
personal_targeting_performed
protected_attribute_inferred
psychological_vulnerability_inferred
external_system_mutated
authority_created
responsibility_accepted
action_permit_created
execution_admitted
external_effect_performed
stable_core_promotion_established
successor_authority_created
```

## CLI

### Validate input

```bash
node products/marketer-pessimist/v0.1/local-mvp/stress-test.js validate \
  products/marketer-pessimist/v0.1/local-mvp/examples/synthetic-onboarding.input.json
```

### Run the local stress test

```bash
node products/marketer-pessimist/v0.1/local-mvp/stress-test.js stress-test \
  products/marketer-pessimist/v0.1/local-mvp/examples/synthetic-onboarding.input.json
```

### Inspect the bounded result

```bash
node products/marketer-pessimist/v0.1/local-mvp/stress-test.js inspect \
  products/marketer-pessimist/v0.1/local-mvp/examples/synthetic-onboarding.input.json
```

### Stdin

```bash
cat packet.json | node products/marketer-pessimist/v0.1/local-mvp/stress-test.js stress-test -
```

Allowed commands:

```text
validate
stress-test
inspect
help
```

Forbidden command families include:

```text
publish
send
campaign
spend
target
profile
execute
mutate
reject
accept
```

## Local-only boundary

Production modules:

```text
stress-test.js
receipt-binding.js
```

perform no:

- network access;
- provider invocation;
- subprocess spawn;
- filesystem write;
- campaign operation;
- publication;
- targeting;
- account access;
- external mutation.

Reading an explicit local input file or stdin is the only I/O beyond stdout/stderr.

## Fail-closed coverage

The conformance suite rejects at least:

- content-hash tampering;
- wrong Product Contract identity;
- duplicate statement/evidence IDs;
- missing/unsupported material classification;
- unknown evidence references;
- statement/evidence lineage mismatch;
- invalid support/contradiction overlap;
- missing scope/review purpose;
- missing objectives/constraints;
- forbidden data classes;
- network/provider/publication/campaign/target/profile/write/human-disposition/permit/execution controls;
- every receipt authority/effect/rejection overclaim;
- unknown receipt claims;
- human disposition state in machine output;
- changed next-safe-action;
- source-input/receipt substitution;
- forbidden CLI commands.

## Success criteria

The MVP maps the predecessor Product Contract criteria directly:

```text
material-claim-classification = true
recommendation-falsifiability = true
no-external-effect = true
```

These establish only bounded local runtime success.

```text
Product Success != Stable-Core Requirement
Success != Successor Authority
Failure != Liability
```

## Non-goals

v0.1 does not:

- call an LLM or AI provider;
- infer truth from unstructured text;
- use real marketing or customer data;
- publish a recommendation;
- create or send a campaign;
- access advertising accounts;
- spend funds;
- upload audiences;
- perform personal targeting;
- infer protected attributes or psychological vulnerability;
- record a human disposition;
- create authority, responsibility or ActionPermit;
- admit execution;
- produce an external effect;
- promote any component into Stable Core.

## Successor boundary

A later product increment may add a separate human disposition receipt for synthetic evidence, but must preserve:

```text
Stress-Test Candidate != Human Disposition
Human Acceptance For Local Use != Publication Authority
Human Disposition != Campaign ActionPermit
```

No such successor is authorized by this MVP.
