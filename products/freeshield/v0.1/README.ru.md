# FREESHIELD — Protective Contract v0.1

**Статус:** candidate Product Contract; runtime отсутствует  
**Tracking:** Issue #518  
**Origin frontier:** `c831b643a9b984a274c5093033c28ea4a8a26794`  
**Contract hash:** `sha256:355ad149846745c6009dcf22a1ce059c47460bcdc49a9a9009620372282c8295`

## Назначение

FREESHIELD определяется как защитный слой **до допуска действия**, а не как новый центр власти.

Он принимает один exact-bound request или effect candidate и проверяет его относительно:

- product-contract;
- authority lineage;
- declared scope;
- evidence sufficiency;
- constraints и explicit non-effects;
- current observed frontier.

Результат — локальный защитный кандидат одного из пяти типов:

```text
ALLOW_ANALYSIS
NARROW_SCOPE
REQUIRE_EVIDENCE
HUMAN_REVIEW
BLOCK_EFFECT
```

После этого FREESHIELD останавливается на fail-closed human gate.

```text
candidate
→ contract / authority evidence
→ constraints / non-effects
→ observed frontier
→ sufficiency / scope / risk hypotheses
→ protective outcome candidate
→ human disposition
→ contestable receipt / successor state
```

## Что FREESHIELD не означает

Название не создаёт привилегии «защищать любой ценой» и не делает систему санкционирующим субъектом.

```text
Protective Review != Authority
Protective Assessment != ActionPermit
Risk Hypothesis != Proof of Harm
BLOCK_EFFECT != Global Prohibition
Scope Narrowing != Product Ownership
Human Review Requirement != Negative Judgment
Missing Evidence != Evidence of Safety or Harm
Protective Outcome != Legal Judgment
Protective Assessment != Sanction or Blacklist
Available Evidence != Permission to Inspect
```

FREESHIELD не устанавливает намерение, вину, незаконность, ответственность, диагноз или общую опасность человека/продукта.

## Семантика пяти outcomes

### `ALLOW_ANALYSIS`

Достаточно оснований продолжить **только локальный анализ**, который сам по себе не создаёт external effect.

```text
ALLOW_ANALYSIS != execution admission
```

### `NARROW_SCOPE`

Исходный candidate шире доказанной цели, полномочия, данных или допустимого эффекта. Система предлагает более узкую границу, но не переписывает запрос автоматически.

```text
narrowing candidate != accepted successor scope
```

### `REQUIRE_EVIDENCE`

Материальные поля отсутствуют, устарели, конфликтуют или не имеют lineage. Это не означает ни безопасность, ни опасность.

```text
missing evidence != negative evidence
missing evidence != proof of safety
```

### `HUMAN_REVIEW`

Автоматическая классификация недостаточна или затрагивает boundary, которую обязан разрешить человек/организация с отдельной ответственностью.

```text
human review required != negative judgment
```

### `BLOCK_EFFECT`

Один exact external-effect candidate не является admissible при текущем contract/evidence/frontier.

`BLOCK_EFFECT` не означает:

- глобальный запрет;
- санкцию или blacklist;
- блокировку аккаунта;
- доказательство вреда, намерения или нарушения;
- бессрочное решение;
- право FREESHIELD самостоятельно остановить actuator.

```text
BLOCK_EFFECT
= scoped non-admissibility candidate
for one exact effect / contract / evidence / frontier
```

Любой изменённый candidate является successor state и требует новой проверки.

## Authority ceiling

FREESHIELD может:

- читать только declared and authorized evidence;
- проверять exact candidate envelope;
- сопоставлять его с product-contract и authority lineage;
- отмечать отсутствующие, stale и conflicting evidence;
- строить bounded risk hypotheses;
- предлагать narrowing, evidence request или human review;
- выпускать local protective assessment candidate и receipt.

FREESHIELD не может:

- исполнять или физически блокировать actuator;
- создавать, расширять, продлевать или подразумевать `ActionPermit`;
- публиковать, уведомлять внешних адресатов или изменять системы;
- блокировать пользователя, аккаунт, организацию или продукт;
- создавать глобальный score, blacklist или скрытый профиль;
- выводить protected attributes или psychological vulnerability;
- объединять контексты и разрешать identity без отдельного основания;
- забирать ownership или ответственность другого продукта;
- заменять human/institutional decision.

## Evidence inputs

Контракт использует четыре exact-bound входа:

1. `request-or-effect-candidate` — операция, target, digest, intended outcome и scope;
2. `product-contract-and-authority-evidence` — exact contract hash, actors, authority lineage и отдельно предложенный permit, если он существует;
3. `constraints-and-non-effects` — применимые ограничения с источником и scope;
4. `frontier-observation` — минимально достаточное наблюдение актуального состояния.

Каждый input требует provenance.

```text
available evidence != active knowledge
stored relation != permitted correlation
observation != surveillance
```

## Data boundary

Контракт допускает только:

- `candidate-envelope`;
- `contract-authority-bundle`;
- `constraint-bundle`;
- ephemeral `frontier-state`;
- derived `protective-assessment`.

По умолчанию запрещены:

```text
cross_context_correlation_default = denied
identity_resolution_default = denied
```

Personal и sensitive-personal profile classes в контракт не входят. Protective assessment не может содержать guilt labels, diagnoses, protected-attribute inference, global score или blacklist entry.

## Analysis effects

Все шесть разрешённых действий локальны:

- `candidate-envelope-inspection`;
- `contract-authority-consistency-check`;
- `evidence-sufficiency-assessment`;
- `scope-risk-hypothesis-map`;
- `protective-outcome-candidate`;
- `protective-reconciliation-candidate`.

```text
external_effects = []
default_external_effect_admission = denied
```

Следовательно, даже `BLOCK_EFFECT` здесь является **кандидатом защитной оценки**, а не external mutation.

## Human gate

Единственный gate:

```text
protective-disposition-gate
```

Допустимые решения:

```text
REJECT_ASSESSMENT
CORRECT_ASSESSMENT
REQUEST_MORE_EVIDENCE
ACCEPT_PROTECTIVE_ASSESSMENT
```

Default:

```text
REJECT_ASSESSMENT
```

`ACCEPT_PROTECTIVE_ASSESSMENT` означает только принятие человеком exact assessment для использования в следующем отдельном product/action gate.

```text
accepted protective assessment != execution authority
```

Любое изменение candidate, contract, authority, constraints, target state или frontier делает disposition stale.

## Failure и reconciliation

Контракт сохраняет состояния:

```text
UNKNOWN
CONFLICT
INSUFFICIENT_EVIDENCE
SCOPE_UNBOUND
ASSESSMENT_READY
REJECTED
ACCEPTED_PROTECTIVE_ASSESSMENT
```

Обязательные правила:

```text
UNKNOWN != SUCCESS
UNKNOWN != permission to retry
CONFLICT requires reconciliation
observation before retry
```

Reconciliation принадлежит `human-protection-owner`, а не analysis system.

## Contestability

Можно оспорить и исправить:

- candidate identity и scope;
- interpretation product-contract;
- authority lineage;
- sufficiency и freshness evidence;
- applicability constraints;
- risk hypotheses;
- protective outcome;
- observed frontier.

Original evidence сохраняется. Исправление создаёт successor state, а не переписывает историю.

## Receipts

### `FreeShieldProtectiveAssessmentReceipt`

Фиксирует:

- exact contract hash;
- candidate digest;
- authority/constraint evidence;
- observed frontier;
- sufficiency и scope findings;
- hypotheses/uncertainty;
- один protective outcome candidate.

Он явно не исполняет, не разрешает и не блокирует actuator.

### `FreeShieldDispositionReceipt`

Фиксирует human disposition, scope и expiry boundary.

Consumer product обязан применить собственный отдельный Action Gate. FREESHIELD receipt не заменяет его.

## Dependencies

Required:

```text
uu-aap-core v0.1
```

Optional/planned:

```text
IAL v0.1
AI Transport v0.1
KONTUR v0.1
```

Для каждой dependency:

```text
authority_transfer = false
responsibility_transfer = false
reverse_core_dependency = false
```

FREESHIELD может защищать product boundary, но не становится owner продукта и не переносит его semantics в Core.

## Связь с Маркетологом Пессимиста

Маркетолог Пессимиста уже объявляет FREESHIELD как optional/planned dependency. После merge этого контракта станет возможен отдельный synthetic interoperability case:

```text
Marketer Pessimist candidate
→ FREESHIELD protective assessment
→ human disposition
→ no external effect
```

Этот future case не создаётся автоматически данным контрактом.

## IP boundary

Exact object:

```text
freeshield-protective-contract-v0.1
```

В него включены только contract, этот README, validator и dedicated workflow.

Не включены runtime, actuators, integrations, future versions, private evidence, reviewed products и общая идея защиты/модерации/compliance.

```text
exact artifact scope != ownership of protection as an idea
contract candidate != registration outcome
current version != future versions
```

## Validation

```bash
python -m pip install "jsonschema>=4.22,<5"
python schemas/product-contract/v0.1/validate_product_contract.py
python products/freeshield/v0.1/validate_contract.py
```

Ожидаемый dedicated result:

```text
FREESHIELD Protective Contract v0.1 validation: PASS
(75 fail-closed mutations rejected)
```

Suite отклоняет authority amplification, direct external blocking, automatic sanctions, hidden profiling, global blacklist semantics, missing human gate, unsafe retry, dependency transfer, Stable-Core promotion и IP overclaim.

## Следующая граница

Merge этого candidate определит FREESHIELD как продуктовую границу, но не создаст runtime.

Следующий отдельный portfolio increment после human merge gate — `Честный найм Product Contract v0.1`. Первый FREESHIELD runtime/pilot должен быть отдельным consumer-driven шагом после product contracts, а не неявным следствием этого документа.
