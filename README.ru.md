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

### AI Gateway / транспортная система

[`protocols/integration/ai-gateway/`](protocols/integration/ai-gateway/) и reusable execution lifecycle предоставляют provider-neutral путь:

```text
inspect → qualify → authorize → execute by separate actuator → observe → close
```

Gateway и transport не являются источниками полномочий. External effect требует exact Core receipts, current frontier, ActionPermit и отдельную admission/approval границу.

## KONTUR

KONTUR развивается как responsibility control plane и family of bounded runtimes.

- [`server/kontur/v0.1/`](server/kontur/v0.1/) — persistent responsibility kernel;
- [`pilots/kontur-game-companion/`](pilots/kontur-game-companion/) — наиболее зрелая продуктовая линия: synthetic dialogue, assistance/spoiler gates, memory/initiative/focus, uncertainty repair, activation/binding boundaries, local trials, read-only external observation, recovery и privacy-minimized field evidence.

Следующая цель KONTUR — консолидация в измеряемый demo и `KONTURReadinessAggregator`, а не бесконечное добавление разговорных слоёв.

`KONTUR responsibility state != ActionPermit`

`pilot evidence != Stable-Core requirement`

## Экосистема продуктов

Актуальная русская карта портфеля и пересобранный путь развития:

[`docs/ecosystem/ECOSYSTEM-STATE-2026-08.ru.md`](docs/ecosystem/ECOSYSTEM-STATE-2026-08.ru.md)

В портфель входят:

- **UU-AAP Core** — experimental stable-core candidate и общий причинно-доказательный substrate;
- **IAL** — язык границ намерения/ответственности;
- **AI Gateway / Transport** — provider-neutral integration path;
- **KONTUR** — responsibility runtime and product family;
- **Маркетолог Пессимиста** — claim/evidence stress-testing product с отдельным Product Contract v0.1 candidate;
- **FREESHIELD** — protective plane, точная canonical роль ещё должна быть материализована;
- **Честный найм** — contestable evidence-first hiring product, canonical contract ещё должен быть материализован.

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

[`products/marketer-pessimist/v0.1/`](products/marketer-pessimist/v0.1/) материализует первый named-product contract как evidence-first стресс-тест утверждений, планов и стратегий:

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

Текущий файл продукта является candidate, пока его отдельный PR не прошёл human merge gate. Даже после merge он определяет границу продукта, а не запускает MVP или внешний effect.

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
5. [`products/marketer-pessimist/v0.1/`](products/marketer-pessimist/v0.1/) — Маркетолог Пессимиста Product Contract candidate и product-specific validator.
6. [`SPEC.ru.md`](SPEC.ru.md) — русское пояснение UU-AAP v0.1.
7. [`proposals/poai/README.ru.md`](proposals/poai/README.ru.md) — русский вход в PoAI.
8. [`PUBLIC_REVIEW.ru.md`](PUBLIC_REVIEW.ru.md) — как попытаться сломать проект.
9. [`protocols/ial/v0.1/`](protocols/ial/v0.1/) — Intent/Action Language.
10. [`protocols/integration/ai-gateway/`](protocols/integration/ai-gateway/) — AI Gateway and transport integration.
11. [`server/kontur/v0.1/`](server/kontur/v0.1/) и [`pilots/kontur-game-companion/`](pilots/kontur-game-companion/) — KONTUR.

Для нормативной и machine-readable проверки используйте канонические английские документы, schemas, validators и receipts, на которые ссылаются эти страницы.
