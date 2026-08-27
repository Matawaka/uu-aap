# UU-AAP Ecosystem Roadmap

**Status:** portfolio-oriented successor to the original Public Draft roadmap  
**Portfolio baseline:** `55dda89ac681e2c7ffbc90f00fe33852c35e8c65` (PR #513)  
**Reusable Product Contract baseline:** `70c1dfe0e2d4f3e8401050c4e7f56a5e76d11b4d` (PR #515)  
**Маркетолог Пессимиста contract baseline:** `c831b643a9b984a274c5093033c28ea4a8a26794` (PR #517)  
**FREESHIELD contract baseline:** `18a57f46eac60576ecc7ff9777888cd2b45230a2` (PR #519)  
**Честный найм contract baseline:** `04078a72415b681bc588d801169fc5d9abee3e9b` (PR #521)  
**KONTUR Product Family baseline:** `b4faf8e759e5839b6d5ddf9ce461231b2d85375c` (PR #523)  
**Current language-productization increment:** Issue #524  
**Related:** completed Issue #512 and `docs/ecosystem/ECOSYSTEM-STATE-2026-08.ru.md`

This roadmap reflects the implemented repository rather than the original August 2026 public-draft plan.

## Strategic objective

Prove that one stable-core candidate, one responsibility-boundary language and one provider-neutral transport system can support multiple independent products without mixing product semantics, authority, responsibility, data or successor decisions.

```text
Stable-Core candidate
  -> Intent/Action Language
  -> AI Gateway / Transport
  -> bounded responsibility runtime and protective checks
  -> independent domain products
  -> comparable receipts and human-controlled successor decisions
```

A dependency edge is not an authority transfer.

## Portfolio invariants

```text
Core != Product
Product Success != Stable-Core Requirement
Transport != Authority
IAL Expression != Execution Admission
KONTUR Responsibility State != ActionPermit
Protective Review != Automatic Block or Sanction
Product Contract != Product Runtime
Application Filed != Application Registered
```

## Foundation already implemented

The repository already contains:

- UU-AAP Core v0.1 experimental stable-core candidate and reusable receipt-chain validation;
- real Core Pilots for continuity/recovery, bounded multi-agent delegation, single-use external effects and observe-before-retry reconciliation;
- Intent/Action Language v0.1 responsibility-boundary and handoff profile;
- provider-neutral AI Gateway, adapters, harnesses, evaluations and bounded execution lifecycle profiles;
- KONTUR server Responsibility Kernel, Readiness Aggregator, activation boundary, responsibility ledger, live-host boundaries and Game Companion field-pilot evidence;
- a privacy-preserving IP rights/filing pipeline for exact software objects;
- Product Contract v0.1 schema, template, exact-frontier no-effect example and fail-closed validator;
- canonical candidate Product Contracts for Маркетолог Пессимиста, FREESHIELD and Честный найм;
- KONTUR Product Family Contract binding six family members without activation, shared-data admission, execution authority or Stable-Core promotion;
- a candidate IAL Compact Envelope and read-only CLI binding Маркетолог Пессимиста and Честный найм through `parse -> validate -> inspect -> STOP`.

The applicant reports that the selected Core software-registration application has been submitted externally. A separate privacy-safe filing checkpoint is still required; submission does not establish registration.

## Portfolio balance policy

- At most two active domain-product implementation lines at once.
- No new universal Core primitive without at least two named product consumers and one cross-product conformance case.
- Every named product receives a compact Product Contract before deep implementation.
- Product-specific semantics may not become reverse dependencies of Core.
- A shared layer must gain a consumable product path within the next two increments.
- KONTUR remains in consolidation and measurement mode before more conversational layers are added.

## Phase A — Portfolio convergence

1. [x] Publish the ecosystem state, product portfolio manifest and rebuilt roadmap.
2. [ ] Bind the applicant-reported filing event to a privacy-safe receipt digest when retained evidence is available.
3. [x] Add a reusable Product Contract v0.1 schema, validator and template.
4. [ ] Add a cross-product interface/dependency registry separate from Core membership and release status.
5. [ ] Keep Public Review and Core Pilot 002 open for honest external counterexamples.

Reusable Product Contract: [`schemas/product-contract/v0.1/`](schemas/product-contract/v0.1/).

**Exit condition:** every ecosystem direction has an explicit role, maturity class, dependency direction and next gate.

## Phase B — Canonical product definitions

1. [x] **Маркетолог Пессимиста** — [`products/marketer-pessimist/v0.1/`](products/marketer-pessimist/v0.1/); local evidence/claim stress testing, no campaign send, profiling or autonomous persuasion.
2. [x] **FREESHIELD** — [`products/freeshield/v0.1/`](products/freeshield/v0.1/); scoped protective assessment without actuator control, sanction, global prohibition or authority creation.
3. [x] **Честный найм** — [`products/honest-hiring/v0.1/`](products/honest-hiring/v0.1/); evidence-first contestable hiring support without automatic rejection, ranking, protected-attribute inference or external effects.
4. [x] **KONTUR Product Family Contract** — [`products/kontur/v0.1/`](products/kontur/v0.1/); binds readiness, activation, kernel, ledger, live-host and Game Companion evidence while keeping member roles distinct.

KONTUR family sequence:

```text
independent evidence
-> readiness aggregation
-> human activation boundary
-> responsibility kernel
-> append-only ledger
-> bounded product/pilot consumers
-> observation / recovery / successor evidence
```

The family contract fixes:

```text
automatic_activation = false
automatic_host_designation = false
automatic_ledger_mutation = false
automatic_runtime_start = false
cross_member_data_access_default = denied
```

**Exit condition reached:** all named products have canonical effects, non-effects, human gates, data boundaries, receipts and IP object boundaries.

## Phase C — Language and transport productization

1. [ ] **Current:** publish the IAL Compact Envelope and read-only CLI at [`protocols/ial/v0.1/compact/`](protocols/ial/v0.1/compact/) for `parse -> validate -> inspect`, with execution unavailable by construction.
2. [ ] Publish one provider-neutral AI Transport reference CLI/SDK carrying Core and IAL evidence through exact-frontier adapters.
3. [ ] Expose the implemented KONTUR Readiness Aggregator through a read-only product-family interoperability example without creating activation or responsibility acceptance.
4. [ ] Run one local interoperability scenario consumed by at least two products.

IAL Compact v0.1 first binds two independent consumers:

```text
Маркетолог Пессимиста -> E0 local analysis
Честный найм -> E1 observable human-review packet
```

The Compact CLI exposes only:

```text
parse
validate
inspect
help
```

It fixes:

```text
execute_command_available = false
network_access_required = false
filesystem_write_required = false
responsibility_accepted = false
execution_admitted = false
materialization_permitted = false
```

E2 and E3 inspection identify required downstream handoff/Action Gate/materialization steps without satisfying them.

**Exit condition:** IAL and transport are usable infrastructure rather than only formal profiles.

## Phase D — Product MVPs

### Маркетолог Пессимиста

```text
claim / plan
  -> evidence split
  -> assumptions
  -> counterarguments
  -> causal alternatives
  -> falsifiers
  -> missing evidence
  -> human disposition
```

### FREESHIELD

```text
ALLOW_ANALYSIS | NARROW_SCOPE | REQUIRE_EVIDENCE | HUMAN_REVIEW | BLOCK_EFFECT
```

`BLOCK_EFFECT` is scoped non-admissibility for one exact effect candidate, not actuator execution, guilt, diagnosis, blacklist, global prohibition or sanction.

### Честный найм

```text
attributable role requirements
  -> candidate-supplied job evidence
  -> lineage / relevance / uncertainty
  -> bounded comparison candidate
  -> FREESHIELD assessment
  -> human review
  -> contestable disposition
  -> correction / appeal successor receipt
```

The first pilot MUST be fully fictional and synthetic. Real applicant data or employment effects require a separate later authorization and data-protection review.

### KONTUR

Consolidate the existing stack into one bounded measurable demo with:

- exact family/member identity;
- readiness/activation separation;
- lifecycle and ledger lineage;
- host observation/designation separation;
- Game Companion dependency-chain evidence;
- pause/recovery;
- privacy-minimized field outcomes;
- resource and human-interruption metrics.

The Product Family Contract does not activate KONTUR and does not authorize live Game Companion behavior.

**Exit condition:** each active product has a runnable local no-effect scenario and fail-closed validation.

## Phase E — Bounded product pilots

Each product follows the same ladder:

1. canonical Product Contract;
2. deterministic synthetic conformance;
3. runnable local no-effect pilot;
4. one bounded real pilot;
5. execution/outcome receipt;
6. post-run assessment;
7. independent review or contestability case.

No pilot result creates a successor permit or Stable-Core requirement.

## Phase F — Ecosystem interoperability and release candidate

An ecosystem release candidate requires at least three independent vertical evidence lines:

- KONTUR;
- Маркетолог Пессимиста;
- Честный найм or an independently exercised FREESHIELD implementation.

Required outputs:

- cross-product conformance matrix;
- provider-neutral transport interoperability report;
- Russian and English navigation;
- security, privacy, accessibility and contestability review;
- versioned migration policy;
- independent implementation or external review evidence.

A release candidate is not automatically a release, standard, certification or legal registration.

## Near-term merge sequence

1. **Completed:** Ecosystem State + Portfolio Manifest + Roadmap (#513).
2. **Evidence-gated:** privacy-safe filing checkpoint after a private receipt digest exists.
3. **Completed:** reusable Product Contract v0.1 (#515).
4. **Completed:** Маркетолог Пессимиста Product Contract v0.1 (#517).
5. **Completed:** FREESHIELD Protective Contract v0.1 (#519).
6. **Completed:** Честный найм Product Contract v0.1 (#521).
7. **Completed:** KONTUR Product Family Contract and consolidation boundary (#523).
8. **Current:** IAL Compact Envelope + read-only CLI conformance (Issue #524).
9. AI Transport Reference CLI/SDK.
10. Synthetic product pilots and cross-product interoperability.

Every item remains a separate review and human merge gate.
