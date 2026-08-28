# Matawaka — единая карта репозиториев, архитектуры, монетизации и публичного раскрытия

**Дата среза:** 28 августа 2026 года  
**Canonical UU-AAP frontier:** `8ebb0e5a13089f6d43e499310a869102810577da`  
**Статус:** public-safe decision plane; private inventory ещё не завершён.

## 1. Почему нужен отдельный repository plane

Репозиторий — физическая граница хранения и provenance, но не архитектурная сущность сам по себе.

```text
Repository != Product
Repository != Protocol Primitive
Repository Visibility != Disclosure Authorization
Private Repository Existence != Authorization to Publish Its Name
```

`Matawaka/uu-aap` уже содержит несколько самостоятельных слоёв и продуктовых линий: Core, CCRP, FCL, IAL-профили, AI transport/integration, KONTUR, FREESHIELD, Маркетолог Пессимиста и Честный найм. Поэтому общий обзор должен иметь минимум четыре независимых плана:

1. **repository plane** — где хранится canonical/source evidence;
2. **architecture plane** — какие protocol/runtime interfaces существуют;
3. **product plane** — какой пользовательский результат продаётся или тестируется;
4. **disclosure/economics plane** — что публично, что можно раскрыть и где возникает коммерческая ценность.

## 2. Наблюдаемая публичная карта

Публично и на точных frontiers наблюдаются:

### `Matawaka/uu-aap`

Роль: открытый причинно-доказательный protocol/architecture substrate и общий reusable stack.

Целевой режим:

```text
OPEN FOUNDATION
UU-AAP Core
→ Possibility / Intent / Authority / Coordination
→ Action Gate
→ Outcome / Provenance / Successor State
→ CCRP / FCL / reusable integration profiles
```

Рекомендация по раскрытию: **оставить полностью публичным**.

Причина: interoperability, независимая проверяемость и возможность сторонних реализаций являются частью ценности самого протокола. Текущая split-license модель уже разрешает широкое и коммерческое повторное использование, не превращая fork в canonical successor.

Коммерческая модель вокруг открытого Core:

- conformance/verification tooling;
- enterprise integration;
- hosted verifier / evidence services;
- внедрение, поддержка и обучение;
- canonical governance/service value.

`Open Source != Zero Monetization`.

### `Matawaka/marketcloser-public`

Роль: runnable B2B product pilot и уже существующий прямой consumer UU-AAP.

Текущий публичный продукт — устанавливаемая PWA для малого локального бизнеса с local-first состоянием, доказательной экономикой, bounded review workflow и read-only интеграционным контуром.

Рекомендация по раскрытию: **оставить полностью публичным как reference/product repository**.

Ближайший приоритет разработки: **P0**.

Ближайший приоритет монетизации: **P0**.

Главная задача сейчас не создавать новый универсальный слой, а проверить:

```text
есть ли у конкретного бизнеса измеримая проблема
→ помогает ли продукт принять лучшее решение
→ можно ли доказать экономический результат
→ готов ли пользователь платить за managed convenience
```

Наиболее естественные коммерческие поверхности:

- managed hosting;
- настройка read-only integrations;
- onboarding/support;
- bounded paid pilots;
- доказательные audit/workflow функции.

Открытый исходный код не мешает продавать эксплуатацию, удобство, интеграцию и ответственность за сервисную границу.

### `Matawaka/vibe-coding-reality`

Роль: canonical public publication/provenance и вход в идеи экосистемы для человека, а не основной инженерный runtime.

Рекомендация по раскрытию: **оставить полностью публичным**.

Инженерный WIP: низкий. Коммуникационный leverage: высокий.

Возможная экономика:

- печатное издание;
- аудио;
- образовательные материалы;
- выступления;
- сообщество;
- перевод аудитории к runnable продуктам.

Книга не должна конкурировать с MarketCloser или Core за основной implementation budget.

## 3. Архитектурная карта поверх репозиториев

```text
PUBLICATION / ADOPTION
  Вайбкодинг реальности
        ↓ explains / attracts

PRODUCTS / PILOTS
  MarketCloser
  KONTUR / Game Companion
  Маркетолог Пессимиста
  FREESHIELD
  Честный найм
        ↓ consume

SHARED INFRASTRUCTURE
  KONTUR responsibility runtime
  AI Gateway / Transport
  execution evidence profiles
  IAL profiles
        ↓ consume

OPEN FOUNDATION
  UU-AAP Core
  CCRP
  FCL
  reusable typed receipts
```

Направление dependency не определяет направление полномочия.

```text
Dependency != Authority
Consumer != Owner
Product Success != Stable-Core Requirement
```

## 4. Приоритеты развития

### P0 — MarketCloser: доказать платёжеспособную ценность

Это сейчас наиболее зрелый прямой commercial-validation path среди публично наблюдаемых репозиториев.

Следующие вопросы важнее нового функционального слоя:

- кто первый реальный тип платящего клиента;
- какое решение он принимает лучше благодаря продукту;
- какая ошибка/неопределённость становится дешевле;
- какой результат можно независимо наблюдать;
- за что платят: hosting, integration, audit, support или workflow.

### P0 strategic / P1 WIP — UU-AAP

Core и shared stack остаются стратегически первыми, но развитие должно перейти от максимального числа новых примитивов к:

- interoperability;
- conformance;
- public reference interfaces;
- двум и более независимым продуктовым consumers;
- bounded change budget.

### P1 — KONTUR и Маркетолог Пессимиста как следующие product evidence lines

Они уже представлены внутри `Matawaka/uu-aap`, но не должны вытеснять MarketCloser из P0 commercial-validation WIP.

KONTUR — сильная доказательная линия responsibility runtime, но более чувствительная по human/safety boundary.

Маркетолог Пессимиста — более дешёвый и низкорисковый путь к отдельному knowledge-work product.

### P2 — FREESHIELD / Честный найм

Потенциал монетизации высокий, особенно в enterprise governance/hiring, но цена ошибки и regulatory/contestability burden выше. Их следует развивать после подтверждения protective and evidence interfaces, а не ради быстрого revenue.

### P2 engineering / P1 adoption — Вайбкодинг реальности

Минимум engineering WIP, максимум использования как публичного объясняющего слоя и adoption funnel.

## 5. Общая модель монетизации

Целевой economic stack:

```text
open standards/specifications
→ public reference implementations
→ managed hosting / integrations / verification / support
→ bounded paid pilots
→ domain subscriptions/services
→ enterprise conformance/governance offerings
```

Это позволяет не вводить денежный барьер в сам протокол и одновременно создавать коммерчески устойчивые сервисы вокруг demonstrated consumption.

`Free Distribution != Zero Cost`.

`Open Protocol != Free Managed Service`.

`Public Reference Implementation != Free Integration`.

## 6. Что раскрывать полностью

По текущему публичному evidence:

**оставить полностью публичными:**

- `Matawaka/uu-aap`;
- `Matawaka/marketcloser-public`;
- `Matawaka/vibe-coding-reality`.

Это уже публичные линии, и их открытость усиливает provenance, adoption и trust.

Для private-проектов публичного решения пока **нет**. Их имена и содержание намеренно не перечисляются в этом документе.

## 7. Gate перед раскрытием private-проекта

Полное раскрытие допустимо только после последовательности:

1. exact connector-verified frontier;
2. secret/token/private-data scan;
3. IP/patent/trademark disclosure check;
4. third-party license check;
5. security/abuse-surface review;
6. `protocol vs product vs experiment vs archive` classification;
7. monetization impact assessment;
8. canonical lineage/provenance receipt;
9. explicit human disclosure decision.

До завершения:

```text
Publicly Useful != Safe To Publish Now
Private Project != Secret Forever
Not Assessed != Keep Private Forever
```

Но default должен быть `KEEP_PRIVATE_AND_UNASSESSED`.

## 8. Ограничение текущего обзора

GitHub connector пока не имеет полного private repository inventory. Поэтому:

```text
public_inventory_observed = true
private_inventory_complete = false
full_ecosystem_disclosure_decision_complete = false
```

Это ограничение является частью результата, а не ошибкой, которую можно скрыть предположением.

Следующий safe action:

`EXPAND_GITHUB_REPOSITORY_SCOPE_AND_RESCAN_PRIVATE_PORTFOLIO`.

После расширения scope private-проекты следует анализировать в закрытом контуре; наружу публиковать только явно одобренный disclosure receipt или выбранный public successor.
