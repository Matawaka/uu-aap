# MarketCloser Publication Observation v0.1

Additive read-only layer after `Copy/Export Receipt v0.1`.

Origin frontier:

`d18416a0f11c5135ba9a4a04bfe366b25a0872eb`

Origin tree:

`426bc06cf8a59f6c779b1acf39d1264567911124`

## Цель

Зафиксировать отдельно факт наблюдения внешней публикации exact approved/copied draft.

Цепочка:

```text
COPIED_PUBLICATION_UNVERIFIED
+ supplied publication observation evidence
-> Publication Observation Receipt
-> STOP / outcome successor
```

Runtime не публикует, не вызывает provider, не выполняет network fetch и не меняет внешнюю платформу.

## Состояния

```text
COPY_EXPORT_REQUIRED
PUBLICATION_OBSERVATION_REQUIRED
PUBLICATION_NOT_OBSERVED
PUBLICATION_CONTENT_MISMATCH
PUBLICATION_OBSERVED
```

`PUBLICATION_NOT_OBSERVED` — только результат конкретного observation event, а не доказательство отсутствия публикации вообще.

`PUBLICATION_CONTENT_MISMATCH` — внешний ресурс наблюдался, но его hash не совпал с exact copied draft.

`PUBLICATION_OBSERVED` — strict exact hash match.

## Exact matching

v0.1 поддерживает только:

```text
exact_utf8_sha256
```

Для `content_match` обязательно:

```text
observed_content_hash == copied draft hash
```

Никакой скрытой нормализации HTML, whitespace, punctuation, case или семантики нет. Если площадка трансформировала текст, v0.1 возвращает mismatch. Любая equivalence-модель должна быть отдельным successor.

## Observation contexts

```text
synthetic_conformance -> synthetic_probe
application_observed  -> application_surface
human_asserted        -> human_visual
independent_observer  -> http_fetch
```

`http_fetch` здесь означает метод уже переданного observation evidence. Production runtime сам HTTP-запрос не выполняет.

`independently_verified=true` допустимо только для `independent_observer`. Human/application observation не повышается до independent.

## URL boundary

`publication_url` — locator наблюдаемого ресурса.

```text
Publication URL != Deployment Provenance
```

URL не доказывает владельца, actor identity, authority или связь с deployment. Synthetic fixtures используют только `.invalid`.

## Evidence ceiling

Даже `PUBLICATION_OBSERVED` сохраняет false:

```text
publication_authorized
publication_performed_by_runtime
publication_actor_identity_verified
deployment_provenance_established
runtime_network_accessed
provider_invoked
platform_mutated
campaign_sent
PilotPermit
ActionPermit
external_effect_performed
successor_authority_created
```

То есть:

```text
Observed External Effect != Authority To Cause Effect
```

## Committed state

Единственный committed fixture:

`examples/synthetic-publication-wait.input.json`

Он содержит:

```text
copy_export_receipt = null
observation = null
```

и остаётся `COPY_EXPORT_REQUIRED`.

Positive publication evidence создаётся только в `/tmp` внутри CI через полную synthetic predecessor chain.

## Non-effects

```text
Copy Export != Platform Publication
Publication Observation != Publication Authority
Observed Publication != Authorized Publication
Human Assertion != Independent Observation
Application Observation != Independent Observation
Content Match != Actor Identity Verification
Publication URL != Deployment Provenance
Publication Observation Receipt != ActionPermit
Publication Observation Receipt != External Effect
Observed External Effect != Authority To Cause Effect
```

## Следующий переход

Только `PUBLICATION_OBSERVED` переходит к:

`OUTCOME_EVIDENCE_REQUIRED`

Следующий слой должен наблюдать последствия отдельно. Сам факт публикации не доказывает результат, причинность или полезность ответа.
