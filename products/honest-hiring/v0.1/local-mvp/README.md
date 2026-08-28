# Честный найм Local Comparison MVP v0.1

**Status:** experimental runnable local no-effect product MVP  
**Issue:** #597  
**Origin frontier:** `239c14f0f0a28469a4cbff5d43fd8a8677f7832f`  
**Origin tree:** `10f2fdd0c546be36ca5d3b7cb18b6a63bef36dca`  
**Canonical Product Contract hash:** `sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae`

## Purpose

This successor turns the existing Honest Hiring Product Contract into a deterministic, fully fictional, local comparison runtime.

The Product Contract remains historically unchanged. The local MVP is added only under this successor directory.

```text
Product Contract != Product Runtime
Successor Runtime != Rewrite of Predecessor History
```

The runtime materializes the first seven no-effect analysis effects already defined by the Product Contract:

```text
role-requirement-normalization
candidate-evidence-lineage
job-relevance-map
uncertainty-missing-evidence-map
bounded-comparison-candidate
freeshield-protective-input
human-review-packet
```

The later `challenge-correction-candidate` remains outside this increment because it requires an exact predecessor comparison/disposition and an explicit candidate challenge.

## Runtime chain

```text
fictional attributable role requirements
+ fictional candidate-supplied job evidence
+ review constraints
-> HonestHiringRequirementReceipt
-> exact FREESHIELD protective source input
-> exact FreeShieldProtectiveAssessmentReceipt
-> FREESHIELD source/receipt binding validation
-> requirement-by-requirement comparison
-> visible uncertainty and missing evidence
-> HonestHiringComparisonReceipt
-> HUMAN_PROTECTIVE_DISPOSITION_REQUIRED
-> later comparison-disposition gate
-> STOP
```

No employment decision is made.

## Real FREESHIELD dependency

The runtime imports the merged FREESHIELD local MVP:

```text
products/freeshield/v0.1/local-mvp/protective-assessment.js
products/freeshield/v0.1/local-mvp/receipt-binding.js
```

It does not accept a string such as `freeshield=ALLOW_ANALYSIS` as sufficient evidence.

The complete pair is required:

```text
FreeShieldProtectiveAssessmentInput
+
FreeShieldProtectiveAssessmentReceipt
```

and the runtime invokes:

```text
FreeShieldBinding.validateReceiptAgainstInput(source, receipt)
```

This means a self-consistent protective receipt from another source input cannot be substituted.

The Hiring runtime additionally binds the FREESHIELD candidate payload digest to the exact canonicalized Hiring tuple:

```text
role
+ candidate
+ review_constraints
```

Therefore:

```text
Valid FREESHIELD Receipt != Valid Receipt For This Hiring Packet
Receipt Hash != Cross-Product Source Binding
```

## FREESHIELD outcome boundary

Only exact `ALLOW_ANALYSIS` can coexist with `COMPARISON_CANDIDATE_READY`.

Other protective outcomes map to bounded machine states without rejecting the candidate:

```text
NARROW_SCOPE
-> UNKNOWN
-> scope reconciliation required

REQUIRE_EVIDENCE
-> INSUFFICIENT_JOB_RELEVANT_EVIDENCE

HUMAN_REVIEW
-> CONFLICT

BLOCK_EFFECT
-> PROHIBITED_FEATURE_RISK / protective stop
```

In every case:

```text
candidate_rejected = false
employment_decision_made = false
```

Even `ALLOW_ANALYSIS` remains only a protective outcome candidate. FREESHIELD itself still requires `HUMAN_PROTECTIVE_DISPOSITION_REQUIRED` before its assessment is treated as a disposition or consumed by the later Hiring human gate.

## Requirement normalization

`HonestHiringRequirementReceipt` is materialized first.

Every material requirement must have:

- exact requirement ID;
- attributable owner;
- current validity frontier;
- job-relevance rationale;
- evidence standard;
- accepted evidence kinds;
- `challengeable=true`.

The local MVP requires 100 percent material requirement attribution coverage.

```text
Requirement Attribution != Universal Lawfulness
Job-Relevance Rationale != Proof of Necessity
Requirement Receipt != Candidate Comparison Authority
```

## Candidate evidence boundary

v0.1 accepts only a fully fictional candidate packet.

Allowed evidence kinds:

```text
work_history
skill
work_sample
certification
candidate_explanation
```

Allowed evidence/claim states:

```text
verified
unverified
unavailable
stale
conflicting
UNKNOWN
```

Every material claim is bound to declared requirements and evidence references, except an explicit `unavailable` or `UNKNOWN` claim, where absence itself remains visible.

```text
Missing Evidence != Negative Evidence
Unverified Evidence != Failure
Unavailable Evidence != Candidate Rejection
```

## Canonical synthetic scenario

The committed example is fully fictional.

Role:

```text
Fictional SAP Data Platform Architect
```

Three material requirements:

1. SAP BW architecture experience;
2. ABAP data-extraction implementation experience;
3. written design / knowledge-transfer evidence.

The fictional candidate packet contains:

```text
SAP BW architecture -> verified work sample
ABAP extraction -> unverified candidate-supplied skill evidence
knowledge transfer -> explicit unavailable evidence
```

Expected requirement-by-requirement findings:

```text
req-sap-bw-architecture       -> EVIDENCED
req-abap-extraction           -> PARTIAL_UNVERIFIED
req-design-knowledge-transfer -> UNAVAILABLE
```

Expected machine state:

```text
COMPARISON_CANDIDATE_READY
```

This does not mean the candidate is suitable, unsuitable, shortlisted, rejected or hired.

It means only that the local comparison packet is structurally ready for the next human-controlled boundaries while uncertainty remains visible.

## No global ranking

The result deliberately has:

```text
global_ranking.created = false
global_ranking.score = null
global_ranking.rank = null
```

There is no aggregate score, employability score, ordinal rank, shortlist order or hidden ordering.

```text
Job-Relevant Comparison != Global Person Ranking
Model Score != Employment Decision
```

## Prohibited feature boundary

The canonical prohibited feature set includes:

```text
protected_attribute
protected_attribute_proxy
personality
emotion
deception
health
disability
psychological_state
social_profile
behavioral_biometrics
interaction_latency
unrelated_personal_history
hidden_third_party_data
cross_context_correlation
```

If one of these markers appears in candidate evidence/context, the runtime emits:

```text
PROHIBITED_FEATURE_RISK
```

It does not infer the protected feature from the marker and does not classify the candidate negatively.

```text
protected_attribute_inferred = false
candidate_rejected = false
```

## HonestHiringComparisonReceipt

The comparison receipt binds:

- exact Product Contract;
- exact source input;
- exact `HonestHiringRequirementReceipt`;
- exact fictional candidate packet;
- exact FREESHIELD input and receipt hashes;
- FREESHIELD machine state and protective outcome;
- requirement-by-requirement evidence findings;
- visible uncertainty;
- prohibited-feature findings;
- explicit absence of global ranking;
- later human-gate requirements.

## Machine states

The runtime can establish only:

```text
UNKNOWN
CONFLICT
INSUFFICIENT_JOB_RELEVANT_EVIDENCE
PROHIBITED_FEATURE_RISK
COMPARISON_CANDIDATE_READY
```

It cannot establish:

```text
REJECTED_ANALYSIS
ACCEPTED_FOR_HUMAN_REVIEW
CHALLENGE_PENDING
CORRECTED_SUCCESSOR_STATE
```

Those states require human or challenge successor boundaries.

## Human gates remain separate

The comparison receipt fixes:

```text
protective_disposition_required = true
comparison_disposition_required = true
challenge_path_preserved = true
```

The runtime does not emit:

```text
HonestHiringDispositionReceipt
HonestHiringChallengeReceipt
FreeShieldDispositionReceipt
```

## Success criteria materialized in this slice

The comparison receipt records the applicable local criteria:

```text
requirement_attribution_coverage
candidate_evidence_lineage_coverage
prohibited_feature_exclusion
no_global_ranking
uncertainty_visibility
zero_external_effect
```

`contestability-closure` is not claimed complete because no actual challenge exists in this first comparison MVP.

## Machine false claims

Every comparison receipt fixes false:

```text
candidate_identity_established
candidate_worth_established
candidate_rejected
candidate_shortlisted
candidate_offered
candidate_hired
employment_decision_made
human_disposition_recorded
global_ranking_created
protected_attribute_inferred
proxy_attribute_inferred
personality_inferred
emotion_inferred
deception_inferred
health_inferred
disability_inferred
psychological_state_inferred
social_profile_scraped
cross_context_correlation_performed
ats_mutated
message_sent
calendar_mutated
background_check_requested
external_system_mutated
authority_created
responsibility_accepted
action_permit_created
execution_admitted
external_effect_performed
stable_core_promotion_established
successor_authority_created
```

## Result provenance

`HonestHiringLocalComparisonResult` carries:

```text
HonestHiringRequirementReceipt
+ exact FreeShieldProtectiveAssessmentReceipt
+ HonestHiringComparisonReceipt
```

`result-binding.js` rebuilds the entire result from the exact source input and requires canonical equality.

```text
Result Self-Consistency != Exact Source Binding
```

## CLI

Allowed:

```text
validate
compare
inspect
help
```

Examples:

```bash
node products/honest-hiring/v0.1/local-mvp/honest-hiring.js validate \
  products/honest-hiring/v0.1/local-mvp/examples/synthetic-sap-data-platform-architect.input.json

node products/honest-hiring/v0.1/local-mvp/honest-hiring.js compare \
  products/honest-hiring/v0.1/local-mvp/examples/synthetic-sap-data-platform-architect.input.json
```

Forbidden command families include:

```text
rank
score
reject
shortlist
hire
offer
contact
send
schedule
ats
execute
mutate
publish
```

## Runtime non-effects

Production code:

- uses no network;
- invokes no provider;
- spawns no process;
- writes no file;
- reads only explicitly supplied local JSON when used through CLI;
- performs no ATS/mail/calendar mutation;
- sends no communication;
- requests no background check;
- creates no ActionPermit;
- records no human disposition;
- changes no employment state.

## Fail-closed coverage

Conformance covers at least:

- wrong Product Contract identity;
- duplicate requirements/evidence;
- unattributed material requirement;
- missing relevance rationale;
- unknown evidence/requirement references;
- non-fictional candidate marker;
- global ranking control;
- cross-context correlation control;
- FREESHIELD receipt/source substitution;
- wrong FREESHIELD consumer binding;
- prohibited feature marker;
- missing material candidate claim;
- conflicting candidate evidence;
- every non-ALLOW FREESHIELD protective outcome;
- comparison machine overclaims;
- unknown comparison claims;
- human disposition state substitution;
- requirement receipt authority overclaim;
- source/result substitution;
- forbidden CLI commands.

## CI

Dedicated CI reruns unchanged predecessor layers first:

```text
Honest Hiring Product Contract
FREESHIELD Product Contract
FREESHIELD Local Protective Assessment conformance
FREESHIELD exact receipt/input binding
```

Then it validates:

```text
canonical Honest Hiring synthetic input
Honest Hiring conformance + protective outcome matrix
exact result/input binding
schema/runtime parity
import safety
input/result/receipt JSON Schemas
CLI boundary
local-only production surface
clean checkout
```

## Non-goals

This MVP does not:

- process real applicant data;
- establish candidate identity or worth;
- rank candidates;
- reject, shortlist, offer or hire;
- contact a candidate;
- schedule an interview;
- mutate ATS/mail/calendar;
- request a background check;
- infer protected attributes or personality/health states;
- call an LLM/provider;
- establish legal compliance;
- complete a human disposition;
- complete a candidate challenge;
- create authority/ActionPermit/execution admission;
- create Stable-Core promotion evidence;
- release or tag anything.

## Successor boundary

A later increment may implement the comparison-disposition or challenge/correction path only with an explicit human-bound predecessor receipt.

This MVP creates neither of those successor decisions automatically.
