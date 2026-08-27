# KONTUR Product Family — Contract v0.1

**Статус:** candidate product-family definition; KONTUR не активирован  
**Tracking:** Issue #522  
**Origin frontier:** `04078a72415b681bc588d801169fc5d9abee3e9b`  
**Origin tree:** `88ee6c1b7417ed3e5758d9b08c2b1252328d23b5`  
**Product Contract hash:** `sha256:21597d591cc4fbe2974c8ac63d669c79158734336c6c64f8ba6a91602835b1b5`  
**Family Manifest hash:** `sha256:90da81f7c33f44f34410790e9269bf8b05a5ad47db596437b214b8301701a5a1`

## 1. Зачем нужен family contract

В репозитории уже существуют несколько самостоятельных KONTUR-линий:

- Responsibility Kernel;
- Readiness Aggregator;
- Activation / Preflight / Human Review boundary;
- append-only Responsibility Ledger и recovery;
- Live Host observation / eligibility / designation / executor-binding boundary;
- Game Companion как наиболее зрелая field-pilot product line.

Каждая линия имеет собственные схемы, validators, workflows и evidence. Но наличие множества зелёных компонентов само по себе не отвечает на вопросы:

- какие компоненты входят в одну product family;
- какой компонент за что отвечает;
- какие связи уже доказаны, а какие только планируются;
- где заканчивается readiness и начинается human activation boundary;
- когда pilot evidence остаётся pilot evidence;
- почему dependency не переносит authority, responsibility или data access.

Family Contract связывает эту карту, **не сливая компоненты в один монолит**.

```text
independent subsystem evidence
→ readiness aggregation
→ human-controlled activation boundary
→ responsibility kernel
→ append-only responsibility ledger
→ bounded runtime / product consumers
→ observation / recovery / successor evidence
```

## 2. Главные различия

```text
KONTUR Product Family Contract != KONTUR Activation
Readiness Aggregation != Kernel Activation
Ready Signal != ActionPermit
Responsibility State != Execution Authority
Family Membership != Shared Data Access
Game Companion Pilot != Server Responsibility Holder
Field Evidence != Production Readiness
Live Host Eligibility != Live Host Designation
Designation != Activation
Activation Review != Activation Execution
Observed Runtime != Permitted Runtime Mutation
Pause or Recovery Evidence != Successor Authority
Product Family != Stable Core
```

Сохраняются и общие Product Contract boundaries:

```text
Product Contract != Product Runtime
Product Contract != ActionPermit
Described Effect != Authorized Effect
Dependency Edge != Authority Transfer
Product Success != Stable-Core Requirement
Contract Acceptance != Responsibility Acceptance
Contract Version != Future Version
IP Object Boundary != Registration Outcome
```

## 3. Machine-readable artifacts

- `product-contract.json` — reusable Product Contract v0.1 specialization;
- `family-manifest.schema.json` — структура family manifest;
- `family-manifest.json` — exact-frontier inventory членов и интерфейсов;
- `validate_contract.py` — schema, identity, repository-path и fail-closed validation;
- `.github/workflows/kontur-family-contract-v0.1-validation.yml` — read-only CI.

## 4. Шесть членов family

### 4.1. Readiness Aggregator

Роль:

```text
six independent readiness axes
→ evidence set
→ aggregation receipt
→ bounded readiness signal
→ dry-run acceptance
→ activation frontier
```

Он может установить bounded readiness, но не activation, responsibility state или execution authority.

```text
subsystem evidence
!= global readiness
!= readiness acceptance
!= kernel activation
!= execution authority
```

### 4.2. Human Activation Boundary

Связывает:

- exact frontier;
- readiness evidence;
- preflight;
- live-host evidence;
- human review;
- expiration/staleness boundary.

Family Contract может только подготовить или проверить referral packet.

```text
REFER_TO_SEPARATE_ACTIVATION_REVIEW
!= ACTIVATE
```

Никакого `ACTIVATE` decision в family gates нет.

### 4.3. Responsibility Kernel

Сохраняет структурное состояние:

- holder;
- scope;
- generation;
- lease;
- fencing;
- predecessor;
- lifecycle state.

Но даже отдельно активированный kernel не становится actuator:

```text
structural responsibility state
!= execution authority
!= legal responsibility
!= moral blame
```

В рамках этого Product Contract kernel остаётся `not_activated`.

### 4.4. Responsibility Ledger

Отвечает за append-only evidence:

- transition identity;
- ordering;
- replay protection;
- replica verification;
- divergence detection;
- recovery lineage.

Family review ничего в ledger не пишет.

```text
Ledger Review != Ledger Mutation
Correction != Predecessor Rewrite
```

### 4.5. Live Host Boundary

Сохраняет последовательность:

```text
host observation
→ eligibility
→ human designation decision
→ executor binding
→ runtime reobservation
```

Ни один предыдущий шаг не подразумевает следующий.

```text
eligible != designated
designated != bound
bound != activated
observed != mutable
```

### 4.6. Game Companion

Game Companion включён как `canonical_pilot_evidence`, а не как server responsibility holder.

Family manifest связывает его cross-layer dependency contract:

```text
observational-lane
→ assistance-gate
→ shared-discovery-memory
→ bounded-initiative
→ focus-diversity
→ interaction-receipt
→ pause-resume
```

Но family membership не разрешает:

- live response generation;
- proactive messaging;
- background activity;
- autonomous gameplay;
- account control;
- profiling;
- engagement/retention optimization;
- cross-game preference construction;
- total-history capture.

## 5. Established и planned edges

Established evidence dependencies:

```text
readiness-aggregator → activation-boundary
live-host-boundary → activation-boundary
activation-boundary → responsibility-kernel
responsibility-kernel → responsibility-ledger
```

Planned interfaces:

```text
responsibility-kernel → game-companion
game-companion → responsibility-ledger
```

`planned_interface` означает только архитектурно названную будущую границу. Он не доказывает runtime integration.

Каждый edge фиксирует:

```text
authority_transfer = false
responsibility_transfer = false
shared_data_access = false
activation_authorized = false
```

## 6. Consolidation policy

Manifest не допускает:

```text
single_member_may_self_certify_family_readiness = false
automatic_activation = false
automatic_host_designation = false
automatic_ledger_mutation = false
automatic_runtime_start = false
automatic_external_effect = false
automatic_stable_core_promotion = false
cross_member_data_access_default = denied
```

Обязательны:

```text
member_roles_remain_distinct = true
human_activation_boundary_required = true
fresh_frontier_required = true
observe_before_retry = true
```

## 7. Разрешённые analysis effects

Contract разрешает только локальные/read-only действия:

1. family manifest validation;
2. component/interface review;
3. readiness composition inspection;
4. responsibility lineage review;
5. ledger continuity review;
6. activation boundary review;
7. live-host boundary review;
8. Game Companion dependency-chain review;
9. privacy-minimized field-evidence consolidation.

Во всех случаях:

```text
external_effect = false
```

А top-level boundary остаётся:

```text
external_effects = []
default_external_effect_admission = denied
execution_authorized = false
action_permit_created = false
responsibility_accepted = false
stable_core_promotion_authorized = false
legal_outcome_established = false
```

## 8. Human gates

### Family consolidation gate

Required evidence:

- family manifest;
- readiness;
- kernel/ledger;
- activation/host boundary;
- Game Companion chain.

Decisions:

```text
REJECT_FAMILY_PACKET
CORRECT_FAMILY_PACKET
REQUEST_MORE_EVIDENCE
ACCEPT_CONSOLIDATION_CANDIDATE
```

Default:

```text
REJECT_FAMILY_PACKET
```

Acceptance означает только planning candidate.

### Activation referral gate

Decisions:

```text
PAUSE_ACTIVATION_REFERRAL
REQUIRE_FRESH_FRONTIER
REFER_TO_SEPARATE_ACTIVATION_REVIEW
```

Default:

```text
PAUSE_ACTIVATION_REFERRAL
```

Даже referral receipt не является live command.

### Pilot evidence gate

Decisions:

```text
EXCLUDE_PILOT_EVIDENCE
CORRECT_PILOT_EVIDENCE
REQUEST_MORE_SANITIZED_EVIDENCE
ACCEPT_AS_BOUNDED_PILOT_EVIDENCE
```

Default:

```text
EXCLUDE_PILOT_EVIDENCE
```

Pilot evidence не повышается до production readiness.

## 9. Data boundaries

Contract использует только bounded evidence classes:

- family contract evidence;
- readiness evidence;
- responsibility state/ledger evidence;
- activation/host review evidence;
- Game Companion pilot evidence;
- sanitized field outcomes;
- family challenge evidence.

Нет `sensitive_personal` class.

Обязательные ограничения:

```text
cross_context_correlation_default = denied
identity_resolution_default = denied
retention_extension_requires_human_gate = true
```

Game Companion/field evidence исключает:

- raw game history;
- transcripts;
- identity correlation;
- behavioral/psychological/mood/attention profiles;
- engagement optimization;
- unnecessary device history.

Family membership не открывает shared data access.

## 10. Failure and uncertainty

Состояния включают:

```text
UNKNOWN
CONFLICT
STALE_FRONTIER
INCOMPLETE_FAMILY_EVIDENCE
COMPONENT_DRIFT
ACTIVATION_BOUNDARY_UNSATISFIED
PILOT_EVIDENCE_EXCLUDED
CONSOLIDATION_CANDIDATE_READY
REJECTED_FAMILY_PACKET
REFERRED_TO_SEPARATE_ACTIVATION_REVIEW
CORRECTED_SUCCESSOR_STATE
```

```text
UNKNOWN != SUCCESS
UNKNOWN != Permission to Retry
CONFLICT requires reconciliation
Stale Frontier != Executable Authority
Correction != History Rewrite
```

## 11. Receipts

Contract определяет:

- `KONTURFamilyManifestReceipt`;
- `KONTURFamilyConsolidationReceipt`;
- `KONTURActivationBoundaryReviewReceipt`;
- `KONTURPilotEvidenceReceipt`;
- `KONTURFamilyChallengeReceipt`.

Ни один receipt не активирует KONTUR и не создаёт ActionPermit.

## 12. Success criteria

Проверяются:

- 100% coverage шести members и canonical paths;
- 100% non-transfer coverage всех edges;
- readiness/activation separation;
- kernel/ledger lineage closure;
- Game Companion seven-layer chain closure;
- field-evidence minimization;
- zero external effects.

```text
Success != Successor Authority
Failure != Liability
Green Family Validation != Production Readiness
```

## 13. IP boundary

В object входят только exact v0.1 artifacts family contract.

Исключены:

- live runtime state;
- activation commands;
- host credentials;
- leases;
- production deployments;
- Game Companion user data и raw history;
- third-party models/games/devices/hosting;
- future versions;
- общая идея responsibility runtime.

```text
Exact Artifact Scope != Runtime Ownership
Family Contract != Registration Outcome
Current Version != Future Version
```

## 14. Проверка

```bash
python -m pip install "jsonschema>=4.22,<5"
python schemas/product-contract/v0.1/validate_product_contract.py
python products/kontur/v0.1/validate_contract.py
```

Dedicated validator:

- validates both JSON schemas;
- verifies exact contract and manifest hashes;
- verifies the origin commit/tree;
- checks that every canonical member path exists;
- distinguishes four established edges from two planned interfaces;
- reruns representative KONTUR and Game Companion checks in CI;
- rejects **126 fail-closed mutations**.

Expected output:

```text
KONTUR Product Family Contract v0.1 validation:
PASS (126 fail-closed mutations rejected)
```

## 15. Следующая граница

Merge принимает только consolidation contract.

Он не создаёт runtime or activation permit.

Следующий roadmap step after a separate human merge decision:

```text
IAL Compact Envelope
→ parse
→ validate
→ inspect
→ no execute by default
```

KONTUR activation remains an independent human-controlled operation and is not a successor action of this contract.

```text
Merged Family Contract != Activation Permit
```
