# UU-AAP / Proof of Available Intelligence — русский вход

**Статус:** пояснительный навигационный слой к каноническим материалам проекта.

> Человеческая субъектность, а не «чистота от ИИ». Доказуемая причинность решений, а не тотальная запись действий.

UU-AAP описывает совместную работу людей, ИИ, программ и организаций так, чтобы не смешивать возможность, намерение, полномочия, действие, результат и ответственность. Proof of Available Intelligence (PoAI) добавляет вопрос: какой релевантный человеческий, машинный, институциональный или документальный интеллект действительно был доступен конкретному решению до того, как оно стало историей?

## Важно о переводе

Этот файл помогает русскоязычным людям и агентам войти в проект, но не создаёт отдельную русскую нормативную ветку.

`русское объяснение != независимый нормативный источник`

`различие перевода != изменение протокола`

`переведённая формулировка полномочия != новое полномочие`

При существенном расхождении проверяйте canonical artifact и фиксируйте проблему перевода как отдельный review/change case.

## Минимальное ядро

```text
State / Evidence Anchor
→ Possibility / Availability
→ Intent
→ Authority / Responsibility
→ Coordination / CCRP
→ Action Gate
→ Outcome / Provenance / Successor State
```

Переходы не подразумеваются автоматически:

`возможность != намерение`

`намерение != полномочие`

`полномочие != действие`

`успешное прошлое действие != полномочие на следующее действие`

`доказательство возможности != доказательство намерения != доказательство действия != доказательство ответственности`

## Что уже доказано практическими пилотами

- **Core Pilot 001** — verified continuity capture and recovery;
- **Core Pilot 002** — честный внешний contestable review остаётся открытой Availability-границей;
- **Core Pilot 003** — bounded multi-agent delegation без authority amplification;
- **Core Pilot 004** — один exact single-use external effect с precondition revalidation;
- **Core Pilot 005** — `UNKNOWN → observe → CONFIRMED | ABSENT | CONFLICT`, без автоматического retry.

Пилоты доказывают только свои конкретные bounded runs. Они не создают универсальную безопасность, новый permit или право автоматически продолжать.

## Язык ИИ и транспорт

### Intent/Action Language (IAL)

[`protocols/ial/v0.1/`](protocols/ial/v0.1/) описывает язык ответственности для границ E0–E3 и explicit handoff.

`выражение на IAL != execution admission`

`technical capability != responsibility acceptance`

### IAL Compact Envelope + read-only CLI

[`protocols/ial/v0.1/compact/`](protocols/ial/v0.1/compact/) добавляет компактную product-facing поверхность:

```text
parse → validate → inspect → STOP
```

Первый conformance связывает два независимых продукта:

- Маркетолог Пессимиста — E0 local claim inspection;
- Честный найм — E1 display candidate для полностью fictional human-review packet.

Envelope содержит exact Product Contract hash, repository frontier, intent/scope/non-goals, target, E0–E3 boundary flags, evidence refs и фиксированные non-effects. Он не содержит принятого handoff или разрешения на действие.

CLI допускает только:

```text
parse
validate
inspect
help
```

Команды `execute` нет. CLI не использует сеть, provider, actuator или filesystem write.

```text
IAL Envelope != Responsibility Acceptance
IAL Expression != Authority
IAL Expression != Execution Admission
Validation Success != ActionPermit
Inspection Receipt != External Effect
Consumer Binding != Authority Transfer
E0 Parsing != Responsibility Artifact Creation
E1 Observability != External Mutation Authority
E2 Handoff Candidate != Accepted Handoff
E3 Materialization Candidate != Materialization Permission
```

Для E2/E3 inspection сообщает, какие full handoff, Action Gate и materialization gates ещё нужны, но не считает их пройденными.

### AI Gateway / транспортная система

[`protocols/integration/ai-gateway/`](protocols/integration/ai-gateway/) и reusable execution lifecycle предоставляют provider-neutral путь:

```text
inspect → qualify → authorize → execute by separate actuator → observe → close
```

Gateway и transport не являются источниками полномочий. External effect требует exact Core receipts, current frontier, ActionPermit и отдельную admission/approval границу.

## KONTUR

KONTUR развивается как responsibility control plane и family of bounded runtimes.

- [`server/kontur/v0.1/`](server/kontur/v0.1/) — Responsibility Kernel, Readiness Aggregator, activation/preflight boundary, append-only ledger, live-host boundaries и recovery;
- [`pilots/kontur-game-companion/`](pilots/kontur-game-companion/) — наиболее зрелая product/pilot line: observational, assistance, memory, initiative, focus, receipt, pause/resume, local trials, read-only observation, recovery и privacy-minimized field evidence;
- [`products/kontur/v0.1/`](products/kontur/v0.1/) — Product Family Contract и exact machine-readable family manifest.

Product Family Contract связывает:

```text
independent subsystem evidence
→ readiness aggregation
→ human-controlled activation boundary
→ responsibility kernel
→ append-only responsibility ledger
→ bounded product / pilot consumers
→ observation / recovery / successor evidence
```

Он не активирует KONTUR:

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
Product Family != Stable Core
```

Manifest фиксирует четыре established evidence dependencies и два planned interfaces. Для каждого edge:

```text
authority_transfer = false
responsibility_transfer = false
shared_data_access = false
activation_authorized = false
```

Human gates могут принять только consolidation candidate, referral to a **separate** activation review или bounded pilot evidence. Decisions `ACTIVATE`, `START_RUNTIME`, `WRITE_LEDGER`, `SEND_RESPONSE` отсутствуют.

`pilot evidence != Stable-Core requirement`

## Экосистема продуктов

Актуальная русская карта портфеля и пересобранный путь развития:

[`docs/ecosystem/ECOSYSTEM-STATE-2026-08.ru.md`](docs/ecosystem/ECOSYSTEM-STATE-2026-08.ru.md)

В портфель входят:

- **UU-AAP Core** — experimental stable-core candidate и общий причинно-доказательный substrate;
- **IAL** — язык границ намерения/ответственности с compact no-execute CLI;
- **AI Gateway / Transport** — provider-neutral integration path;
- **KONTUR** — responsibility runtime/product family с отдельным family contract;
- **Маркетолог Пессимиста** — claim/evidence stress-testing product с canonical Product Contract v0.1;
- **FREESHIELD** — protective plane с Protective Contract v0.1;
- **Честный найм** — evidence-first contestable hiring-support product с Product Contract v0.1.

### Product Contract v0.1

[`schemas/product-contract/v0.1/`](schemas/product-contract/v0.1/) задаёт reusable machine-readable границу продукта до глубокой реализации:

```text
Product identity
→ outcomes / anti-goals
→ actors
→ evidence / provenance
→ data policy
→ effects / non-effects
→ human gates
→ uncertainty / reconciliation
→ contestability
→ receipts / success criteria
→ dependencies / IP object boundary
```

Контракт описывает продукт, но ничего не запускает:

`Product Contract != Product Runtime`

`Product Contract != ActionPermit`

`Described Effect != Authorized Effect`

`Dependency Edge != Authority Transfer`

`IP Object Boundary != Registration Outcome`

Reusable schema, template и local no-effect example не принимают автоматически ни один named-product contract. Каждый exact-frontier contract требует собственного validator result и human merge gate.

### Маркетолог Пессимиста Product Contract v0.1

[`products/marketer-pessimist/v0.1/`](products/marketer-pessimist/v0.1/) материализует evidence-first стресс-тест утверждений, планов и стратегий:

```text
Claim / plan
→ evidence / interpretation / assumption / hypothesis
→ counterarguments
→ causal alternatives
→ falsifiers
→ missing evidence / uncertainty
→ bounded candidate
→ human disposition
```

Контракт допускает только локальные analysis effects. В нём нет runtime, campaign send, публикации, ad-account access, spend, audience upload, profiling или autonomous persuasion.

`Pessimistic Analysis != Truth`

`Counterargument != Rejection`

`Audience Description != Permission to Profile a Person`

`Marketing Recommendation != Campaign Authority`

`Candidate Output != Publication Authority`

### FREESHIELD Protective Contract v0.1

[`products/freeshield/v0.1/`](products/freeshield/v0.1/) определяет защитный assessment plane для одного exact request/effect candidate:

```text
candidate
→ product-contract / authority evidence
→ constraints / non-effects
→ frontier observation
→ sufficiency / scope / risk hypotheses
→ ALLOW_ANALYSIS | NARROW_SCOPE | REQUIRE_EVIDENCE | HUMAN_REVIEW | BLOCK_EFFECT
→ human disposition
```

Все разрешённые effects локальны, `external_effects=[]`.

```text
Protective Review != Authority
Protective Assessment != ActionPermit
Risk Hypothesis != Proof of Harm
BLOCK_EFFECT != Global Prohibition
Scope Narrowing != Product Ownership
Protective Assessment != Sanction or Blacklist
```

`BLOCK_EFFECT` означает scoped non-admissibility candidate для одного exact effect при одном contract/evidence/frontier. FREESHIELD не управляет actuator, не создаёт permit, не блокирует аккаунт и не создаёт hidden score.

### Честный найм Product Contract v0.1

[`products/honest-hiring/v0.1/`](products/honest-hiring/v0.1/) определяет evidence-first поддержку человеческого hiring review:

```text
attributable role requirements
→ candidate-supplied job evidence
→ lineage / relevance / uncertainty
→ bounded comparison candidate
→ FREESHIELD protective assessment
→ human review
→ contestable disposition
→ correction / appeal successor state
```

Контракт допускает только локальную подготовку packet. В нём нет real applicant runtime, automatic rejection, shortlist, offer, hire, ATS/email/calendar mutation или внешней коммуникации.

```text
Hiring Support != Hiring Authority
Candidate Evidence != Candidate Identity or Worth
Missing Evidence != Negative Evidence
Job-Relevant Comparison != Global Person Ranking
Model Score != Employment Decision
Protected Attribute != Job-Relevant Feature
Candidate Challenge != Negative Signal
FREESHIELD Assessment != Automatic Rejection
```

Запрещены protected-attribute/proxy inference, personality/emotion/deception/health/disability inference, social-profile scraping, cross-context correlation, hidden score и immutable ranking.

Первый возможный pilot должен быть полностью fictional, synthetic и no-effect.

### KONTUR Product Family Contract v0.1

[`products/kontur/v0.1/`](products/kontur/v0.1/) материализует family boundary для шести членов:

1. Readiness Aggregator;
2. Human Activation Boundary;
3. Responsibility Kernel;
4. Responsibility Ledger;
5. Live Host Boundary;
6. Game Companion.

Разрешены только локальные/read-only analysis effects:

- manifest validation;
- interface review;
- readiness inspection;
- kernel/ledger lineage review;
- activation/host evidence review;
- Game Companion dependency-chain review;
- privacy-minimized field-evidence consolidation.

```text
external_effects = []
execution_authorized = false
action_permit_created = false
responsibility_accepted = false
```

Family contract не означает, что planned Game Companion runtime interfaces уже реализованы, что KONTUR активирован или что полевая проверка доказывает production readiness.

## IP-граница

Заявитель сообщил о подаче заявки на выбранный программный объект Core. Публичный репозиторий пока не связывает фактическую квитанцию подачи и не утверждает государственную регистрацию.

`подача заявки != регистрация`

`регистрация Core validator != регистрация всей экосистемы`

Следующий IP-шаг должен быть privacy-safe checkpoint с digest удерживаемой вне репозитория квитанции.

## Внешнее честное ревью

Самый короткий внешний путь — оставить один конкретный failure case в [Issue #422](https://github.com/Matawaka/uu-aap/issues/422).

Не требуется читать весь репозиторий, писать код, доказывать личность или соглашаться с проектом.

Для autonomous review agent:

1. найти один failure case;
2. разделить `observed fact / interpretation / inferred risk / proposed mitigation`;
3. указать, что не доказано;
4. подготовить review candidate;
5. остановиться перед публикацией без отдельного human confirmation.

`agent-generated review != human-authorized submission`

`successful analysis != permission to publish`

## Русский маршрут чтения

1. Этот файл — текущая навигация.
2. [`docs/ecosystem/ECOSYSTEM-STATE-2026-08.ru.md`](docs/ecosystem/ECOSYSTEM-STATE-2026-08.ru.md) — состояние экосистемы и balanced roadmap.
3. [`ROADMAP.md`](ROADMAP.md) — текущий portfolio-oriented roadmap.
4. [`schemas/product-contract/v0.1/`](schemas/product-contract/v0.1/) — reusable Product Contract, template, example и validator.
5. [`products/marketer-pessimist/v0.1/`](products/marketer-pessimist/v0.1/) — Маркетолог Пессимиста Product Contract.
6. [`products/freeshield/v0.1/`](products/freeshield/v0.1/) — FREESHIELD Protective Contract.
7. [`products/honest-hiring/v0.1/`](products/honest-hiring/v0.1/) — Честный найм Product Contract.
8. [`products/kontur/v0.1/`](products/kontur/v0.1/) — KONTUR Product Family Contract и manifest.
9. [`protocols/ial/v0.1/compact/`](protocols/ial/v0.1/compact/) — IAL Compact Envelope, read-only CLI и E0–E3 inspection receipts.
10. [`SPEC.ru.md`](SPEC.ru.md) — русское пояснение UU-AAP v0.1.
11. [`proposals/poai/README.ru.md`](proposals/poai/README.ru.md) — русский вход в PoAI.
12. [`PUBLIC_REVIEW.ru.md`](PUBLIC_REVIEW.ru.md) — как попытаться сломать проект.
13. [`protocols/ial/v0.1/`](protocols/ial/v0.1/) — Intent/Action Language.
14. [`protocols/integration/ai-gateway/`](protocols/integration/ai-gateway/) — AI Gateway and transport integration.
15. [`server/kontur/v0.1/`](server/kontur/v0.1/) и [`pilots/kontur-game-companion/`](pilots/kontur-game-companion/) — KONTUR implementation and pilots.

Для нормативной и machine-readable проверки используйте канонические английские документы, schemas, validators и receipts, на которые ссылаются эти страницы.
