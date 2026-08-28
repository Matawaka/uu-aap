# Matawaka — Repository Portfolio & Disclosure v0.2

Статус: public-safe successor к историческому registry v0.1. Этот документ описывает только уже публичные поверхности и не публикует имена или детали оставшегося private portfolio.

## Что изменилось после v0.1

Публичный портфель теперь имеет четыре доказуемых репозитория:

1. `Matawaka/marketcloser-public` — runnable B2B pilot и ближайший P0-кандидат для проверки готовности платить;
2. `Matawaka/truehire-public` — deterministic public reference продукта TRUEHIRE, P1 для bounded commercialization;
3. `Matawaka/uu-aap` — P0 стратегический открытый protocol/architecture substrate, но P1 по текущему WIP;
4. `Matawaka/vibe-coding-reality` — публичная provenance/adoption поверхность, P2 по engineering WIP.

Появление второго публичного domain-product не меняет базовый принцип:

```text
Repository != Product
Open Source != Zero Monetization
Development Priority != Monetization Priority
Public Disclosure != Runtime Deployment
```

## TRUEHIRE: что именно стало публичным

`Matawaka/truehire-public` опубликован как детерминированная allowlisted projection, а не как экспорт private development history.

Наблюдаемый public frontier:

```text
main/root commit = 99a8ed329f20d670b1130795eecff305c0c996bf
root tree = 585cd1d24e6feecdfebdcfe54faf27db3d4b1475
root parents = 0
release anchor = release/v0.1
projection root = sha256:41be1d4f43f16e7b10f7d4242e782651d326632efe4e56369de40051abb1351e
non-receipt files = 45
total public files = 47
```

Публичные `PUBLIC_PROJECTION.json` и `PUBLIC_RELEASE_AUTHORIZATION.json` связывают этот root с разрешённой projection и одновременно сохраняют non-effects: публикация исходников не является разрешением на deployment, обработку реальных данных кандидатов, автономное решение о найме или бинарную дистрибуцию без отдельного compliance gate.

```text
Public Projection != Private History Export
Authorization Receipt != Action Receipt != Outcome Receipt
Source Publication PASS != Binary Distribution Compliance PASS
```

## Приоритет развития

### P0 — MarketCloser

`Matawaka/marketcloser-public` остаётся первым near-term development и monetization focus. Следующая ценность должна подтверждаться customer discovery, реальными бизнес-результатами и bounded paid pilots, а не дополнительным усложнением архитектуры.

### P1 — TRUEHIRE

`Matawaka/truehire-public` теперь достаточно открыт для независимой проверки reference implementation. Его следующая стадия — не «сразу production hiring», а контролируемая подготовка bounded pilots.

До любого реального найма нужны отдельные evidence gates:

- human-impact и jurisdiction review;
- доказуемая цель и границы обработки реальных данных;
- retention/deletion authority;
- contestability и возможность отказа;
- employer authority evidence;
- release-specific third-party/binary compliance.

Коммерческие поверхности допустимо развивать вокруг открытого reference source: bounded paid pilots, managed integrations, private evidence workspace, audit/contestability, enterprise conformance и privacy-preserving selective disclosure.

### P0 strategic / P1 WIP — UU-AAP

`Matawaka/uu-aap` остаётся стратегическим основанием всей линии. Но P0 strategic не означает P0 текущего WIP. Core должен сохранять ограниченный change budget и развиваться прежде всего там, где реальный продукт требует interoperable receipt/contract.

### P2 engineering — Publication / adoption

`Matawaka/vibe-coding-reality` сохраняет роль публичной provenance и adoption-поверхности. Его отдача сейчас больше зависит от распространения и обратной связи, чем от роста engineering WIP.

## Монетизационная последовательность

```text
open standards/specifications
→ public reference implementations
→ managed verification / integrations / support
→ bounded paid pilots
→ domain services/subscriptions
→ enterprise conformance/governance
```

Открытие TRUEHIRE не создаёт обязанности монетизировать доступ к исходникам. Наоборот, оно отделяет проверяемость reference implementation от платной операционной ценности.

## Граница оставшегося private portfolio

Один завершённый путь private-origin → public projection не означает, что весь private portfolio проаудирован или разрешён к раскрытию.

```text
At Least One Publication Completed != All Private Projects Assessed
Known Private Existence != Authorization to Publish Its Name
Public Registry Growth != Automatic Private Inventory Disclosure
```

Registry v0.2 специально не добавляет имена оставшихся private repositories. Для каждого следующего кандидата по-прежнему нужны exact frontier, secret/private-data scan, IP/license review, security/abuse review, role classification, monetization assessment, provenance receipt и отдельное human disclosure decision.

## Итоговая последовательность публичного портфеля

```text
PUBLICATION / ADOPTION
  Matawaka/vibe-coding-reality

DOMAIN PRODUCTS
  Matawaka/marketcloser-public        P0 near-term
  Matawaka/truehire-public            P1 bounded next wave

OPEN FOUNDATION
  Matawaka/uu-aap                     P0 strategic / P1 WIP
```

Registry отражает наблюдаемое состояние и приоритеты. Он не меняет visibility, цены, лицензии, deployment, real-data authority, employment authority или binary-distribution status.
