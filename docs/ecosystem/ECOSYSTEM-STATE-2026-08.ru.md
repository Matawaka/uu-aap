# UU-AAP — состояние экосистемы и сбалансированный путь развития

**Дата среза:** 26 августа 2026 года  
**Evidence frontier:** `84fc5c968d9b786f5f84f8224179c8a182672089`  
**Tree:** `c3c600be51e901abf77f361830b9d9cb9c1842ab`  
**Статус документа:** пояснительная карта и план развития; machine-readable классификация находится в `schemas/ecosystem/v0.1/`.

## 1. Внешний IP-маркер

Заявитель сообщил, что заявка на государственную регистрацию выбранного программного объекта UU-AAP Core подана.

Это важная внешняя граница, но она не должна превращаться в неподтверждённый публичный результат:

`сообщение заявителя о подаче != публично связанная квитанция подачи`

`подача заявки != принятие заявки ведомством`

`подача заявки != государственная регистрация`

`регистрация одного программного объекта Core != регистрация всей архитектуры и всех продуктов экосистемы`

Текущий публичный machine-readable IP record в репозитории всё ещё отражает предшествующее состояние `PATENT_SCREEN / PRIVATE_PACKET_IN_PROGRESS`. Следующий отдельный IP-инкремент должен связать только privacy-safe checkpoint и SHA-256 удерживаемой вне репозитория квитанции/пакета, не публикуя персональные данные, номер документа, подпись, адрес или платёжные сведения.

## 2. Главный вывод аудита

Экосистема перешла из стадии «создать ядро» в стадию **«сбалансировать общий стек и превратить его в несколько самостоятельных продуктов»**.

Сейчас развитие неравномерно:

- UU-AAP Core, execution lifecycle, IAL и AI Gateway/transport уже имеют формальные контракты, validators, test vectors и реальные bounded-пилоты;
- KONTUR стал самым развитым продуктовым направлением и дошёл до bounded field observation, recovery и privacy-minimized evidence;
- русская входная документация и старый `ROADMAP.md` отстают от реального состояния;
- «Маркетолог Пессимиста», FREESHIELD и «Честный найм» названы как продукты экосистемы, но в текущем canonical tree для них ещё нет отдельных machine-readable Product Contract, validator и runnable pilot;
- отсутствие такого артефакта не означает, что продукта или идеи нет вне репозитория; оно означает только, что canonical evidence plane пока не может утверждать его реализационную зрелость.

Следовательно, ближайшая цель — **не ещё один универсальный слой**, а портфельная конвергенция:

`stable substrate → consumable language/transport → bounded runtime/protection → distinct domain products`

## 3. Карта текущего портфеля

| Направление | Роль | Текущее доказанное состояние | Ближайший необходимый результат |
|---|---|---|---|
| **UU-AAP Core** | стабильный причинно-доказательный substrate | Реализован семипримитивный Core; пройдены реальные Pilots 001–005: continuity/recovery, multi-agent delegation, single-use effect, ambiguous-outcome reconciliation | Compatibility baseline, change budget и запрет product-specific reverse dependencies |
| **IAL / язык ИИ** | язык границ намерения, ответственности и действия | Реализован experimental профиль E0–E3 и explicit handoff; останавливается до исполнения/commit | Компактный agent-facing envelope, CLI-примеры и conformance vectors минимум для двух продуктов |
| **AI Gateway / транспортная система** | provider-neutral перенос запросов, receipts и bounded execution evidence | Реализованы `inspect → qualify → authorize → observe`, adapters, harness, evals, execution lifecycle и live-acceptance evidence | Один понятный public reference CLI/SDK и единый transport profile для IAL + Core receipts |
| **KONTUR** | responsibility control plane и product runtime family | Server responsibility kernel; зрелая Game Companion линия; synthetic conversation, activation/binding boundaries, bounded local trial, external read-only observation, recovery, terminal-state field evidence | Консолидация в измеряемый demo; реализация явно указанного `KONTURReadinessAggregator`; пауза на новые разговорные слои |
| **Маркетолог Пессимиста** | domain product — «адвокат дьявола» для claims и решений | Продуктовая цель известна: разделять facts/hypotheses/assumptions, искать counterarguments, falsifiers, causal alternatives и missing evidence; canonical contract в текущем tree отсутствует | Product Contract v0.1 и local no-send MVP для stress-test одного утверждения/стратегии |
| **FREESHIELD** | предполагаемый protective plane | Имя продукта закреплено в экосистеме, но точная machine-readable роль, authority ceiling и интерфейсы в текущем tree не материализованы | Human-approved Protective Contract v0.1: risk surfacing/minimization без автоматической санкции, authority creation или владения продуктом |
| **Честный найм** | domain product — проверяемая и оспоримая поддержка найма | Отдельный canonical contract и pilot в текущем tree не найдены | Evidence-first Hiring Contract v0.1: no automatic rejection, no protected-attribute inference, explicit human disposition and appeal |

## 4. Целевая композиция экосистемы

Продукты должны использовать общий стек, но не переписывать его снизу вверх:

```text
Маркетолог Пессимиста | Честный найм | KONTUR Game Companion | будущие продукты
                              ↓ consume
                 KONTUR runtime / FREESHIELD checks
                              ↓ consume
                 IAL + AI Gateway / Transport System
                              ↓ consume
                         UU-AAP Core
```

Для FREESHIELD это пока **целевая гипотеза размещения**, а не утверждение уже принятой спецификации. Его окончательная роль должна быть определена отдельным продуктовым контрактом.

Направление dependency не является направлением authority:

`dependency edge != authority transfer`

`transport path != permission`

`protective check != sanction`

`product evidence != Stable-Core requirement`

`KONTUR state != ActionPermit`

## 5. Портфельные правила баланса

### 5.1. WIP и концентрация

- одновременно активно реализуются не более **двух domain-product lines**;
- KONTUR временно переходит из режима наращивания слоёв в режим консолидации, измерения и usability;
- shared-infrastructure работа не считается завершённой, пока у неё нет понятного consumer path в продукте;
- новый shared layer должен получить хотя бы одного реального consumer в следующих двух инкрементах.

### 5.2. Защита Core

Новый universal Core primitive допустим только при одновременном наличии:

1. минимум двух явно названных product consumers;
2. одного cross-product conformance case;
3. доказательства, что задача не решается extension/profile/adapter уровнем;
4. explicit non-effects и migration boundary.

`новая идея != новый Core primitive`

### 5.3. Contract-first для продуктов

До глубокой реализации каждый продукт обязан иметь compact Product Contract:

- user outcome и anti-goals;
- actors/roles;
- evidence inputs и provenance;
- Possibility / Intent / Authority границы;
- data classes, retention и disclosure;
- allowed effects и explicit non-effects;
- human gates;
- failure/uncertainty/reconciliation states;
- contestability/appeal;
- output receipts;
- runtime/transport dependencies;
- success criteria;
- IP object boundary.

`Product Contract != Product Runtime`

`MVP Success != General Safety Proof`

## 6. Пересобранный путь развития

### Wave A — Portfolio convergence

1. Зафиксировать этот ecosystem snapshot, machine-readable portfolio и новый roadmap.
2. Отдельно записать privacy-safe filing checkpoint после получения/хэширования фактической квитанции подачи.
3. Создать общий `Product Contract v0.1` schema + validator + template.
4. Создать cross-product interface/dependency registry, не смешивая его с release registry и Stable Core.

**Результат:** все направления имеют одно место в архитектуре и больше не конкурируют за смысл Core.

### Wave B — Canonical product definitions

Первые две активные линии:

1. **Маркетолог Пессимиста Product Contract v0.1** — быстрый низкорисковый consumer языка и транспорта;
2. **FREESHIELD Protective Contract v0.1** — защита до перехода к более чувствительным решениям.

После их merge:

3. **Честный найм Product Contract v0.1** — использует уже материализованный protective plane;
4. KONTUR получает Product Family Contract, который связывает server responsibility kernel и Game Companion, но не делает пилот Stable Core.

**Почему такой порядок:** «Честный найм» потенциально затрагивает людей и жизненные возможности, поэтому сначала полезно материализовать защитные и contestability interfaces, а не строить автоматизацию решения раньше них.

### Wave C — Language and transport productization

1. **IAL Compact Envelope / CLI** — parse, validate, inspect, no execute by default.
2. **AI Transport Reference CLI/SDK** — provider-neutral tool binding, dry-run, exact frontier, receipts, observe-before-retry.
3. **KONTURReadinessAggregator** — агрегирует readiness evidence, но не создаёт authority или responsibility acceptance.
4. Общий local sandbox, в котором один и тот же IAL/transport path используется минимум двумя продуктами.

**Результат:** язык и транспорт становятся потребляемой инфраструктурой, а не только коллекцией формальных профилей.

### Wave D — Product MVPs

#### Маркетолог Пессимиста MVP

```text
Claim / plan
→ evidence split
→ assumptions
→ counterarguments
→ causal alternatives
→ falsifiers
→ missing evidence
→ bounded recommendation candidate
→ human disposition
```

No campaign send, ad account access, spend, automatic persuasion or publication.

#### FREESHIELD MVP

Принимает product request/evidence bundle и выпускает protective receipt:

```text
ALLOW_ANALYSIS | NARROW_SCOPE | REQUIRE_EVIDENCE | HUMAN_REVIEW | BLOCK_EFFECT
```

`BLOCK_EFFECT` должен означать только отсутствие admissibility для конкретного effect, а не санкцию, диагноз, guilt или глобальный запрет.

#### Честный найм MVP

```text
Role requirements
→ evidence-bound candidate claims
→ uncertainty / missing evidence
→ job-relevant comparison
→ human review
→ contestable disposition
→ appeal/correction receipt
```

No automatic rejection, hidden personality scoring, protected-attribute inference, immutable ranking or autonomous hiring decision.

#### KONTUR consolidation MVP

Собрать уже существующие слои в один измеряемый bounded demo:

- readiness and lifecycle state;
- observation evidence;
- candidate generation/admissibility;
- no-send or separately permitted send boundary;
- pause/recovery;
- privacy-minimized outcome receipt;
- CPU/RAM/latency and human-interruption metrics.

### Wave E — Cross-product pilots

Каждый продукт проходит одинаковый maturity ladder:

1. canonical contract;
2. deterministic synthetic conformance;
3. runnable local no-effect pilot;
4. one bounded real pilot;
5. execution/outcome receipt;
6. post-run assessment;
7. independent review or contestability case.

Ecosystem release candidate допустим после минимум трёх независимых vertical evidence lines:

- KONTUR;
- Маркетолог Пессимиста;
- Честный найм или FREESHIELD как independent protective implementation.

`three pilots != universal correctness`

## 7. Конкретная последовательность следующих merge-инкрементов

1. Ecosystem State + Portfolio Manifest + Roadmap — текущий инкремент.
2. Privacy-safe `FILED_REPORTED` / filing-receipt checkpoint — только после private evidence digest.
3. Reusable Product Contract v0.1.
4. Маркетолог Пессимиста Product Contract v0.1.
5. FREESHIELD Protective Contract v0.1.
6. Честный найм Product Contract v0.1.
7. IAL Compact Envelope + CLI conformance.
8. AI Transport Reference CLI/SDK.
9. KONTUR product-family consolidation + readiness aggregator.
10. Маркетолог Пессимиста local MVP.
11. FREESHIELD protective MVP over Маркетолог Пессимиста.
12. Честный найм synthetic contestable MVP.
13. Shared transport interoperability scenario across two products.
14. Bounded product pilots and ecosystem post-run assessment.

Эта последовательность намеренно не создаёт автоматический successor permit. Каждый инкремент остаётся отдельным review/merge gate.

## 8. Definition of Done для каждого продукта

Продукт нельзя считать «реализованным» только по наличию идеи или схемы. Минимальный DoD:

- canonical RU/EN navigation;
- Product Contract;
- schema + validator;
- explicit effects/non-effects;
- runnable local scenario;
- one fail-closed negative suite;
- one bounded pilot receipt;
- privacy/data-retention statement;
- contestability path;
- dependency registration;
- IP object inventory;
- post-run assessment.

## 9. Основные риски и противовесы

| Риск | Противовес |
|---|---|
| Core продолжает расти быстрее продуктов | два consumers + cross-product case до нового primitive |
| KONTUR поглощает всю экосистему | consolidation mode и WIP cap |
| транспорт становится источником власти | `Transport != Authority`, exact ActionPermit/frontier |
| FREESHIELD превращается в цензора/санкционирующую систему | protective receipt scope, contestability, no authority creation |
| «Честный найм» превращается в автоматическое ранжирование людей | no automatic rejection, job relevance, uncertainty, appeal, human disposition |
| Маркетолог Пессимиста становится генератором негативности | evidence/falsifier discipline, bounded decision support, no persuasion/send |
| подача заявки трактуется как регистрация всей экосистемы | object-specific IP records и external receipt checkpoint |
| русская и английская документация расходятся | Russian explanation != independent normative source |

## 10. Новая стратегическая граница

Следующий этап проекта можно сформулировать так:

> **UU-AAP больше не должен доказывать ценность только количеством новых протокольных слоёв. Он должен доказать, что одно стабильное ядро, один язык и одна транспортная система способны поддержать несколько действительно разных продуктов без смешения полномочий, ответственности, данных и целей.**

Целевой результат следующего цикла:

```text
One Stable Core
+ One Intent/Action Language
+ One Provider-Neutral Transport
+ One Bounded Responsibility Runtime
+ One Protective Plane
+ Multiple Independent Products
+ Comparable Receipts
+ Human-Controlled Successor Decisions
```
