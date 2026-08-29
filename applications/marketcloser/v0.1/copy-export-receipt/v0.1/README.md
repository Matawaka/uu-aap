# MarketCloser Copy/Export Receipt v0.1

Additive application layer после `Human Response Approval v0.1`.

Origin frontier:

`70dcca94b87f392bb74861765133306691f5d165`

Origin tree:

`a15e79f2fe0ea0e3d2f547f6f4e53645c2e2a36a`

## Задача

Предыдущий слой может дать только:

`APPROVED_FOR_COPY_EXPORT`

Этот слой отделяет разрешение от наблюдаемого события:

```text
exact approved response draft
-> explicit local copy/export event assertion
-> MarketCloserCopyExportReceipt
-> COPIED_PUBLICATION_UNVERIFIED
-> PUBLICATION_OBSERVATION_REQUIRED
-> STOP
```

## Что означает `COPIED_PUBLICATION_UNVERIFIED`

Это не независимая проверка состояния системного clipboard, файла или внешней площадки.

Это означает только:

- exact approval source повторно выведен;
- approval относится к exact draft hash;
- recorded event утверждает copy/export этого же draft hash;
- payload hash совпадает с approved draft hash;
- publication по-прежнему не наблюдалась.

```text
Recorded Copy Event != Independent OS Attestation
Copied Draft != Published Draft
```

## Почему runtime сам не копирует

Production runtime остаётся pure/local recorder. Он не использует:

- clipboard API;
- filesystem write;
- network;
- provider;
- platform mutation;
- subprocess.

Фактический пользовательский/app copy event должен приходить как отдельное typed observation/assertion.

## Event context

Допустимы:

```text
synthetic_conformance
application_observed
human_asserted
```

`application_observed` требует `application_event_observed=true`.

`human_asserted` не может объявлять application observation.

`synthetic_conformance` используется только для CI и требует synthetic refs.

Во всех режимах:

```text
independently_verified = false
```

v0.1 не имеет OS-level clipboard/file attestation.

## Methods

```text
clipboard_copy
local_text_export
```

Метод описывает recorded event, а не capability production runtime.

## Exact draft binding

Event содержит:

```text
draft_hash
payload_hash
```

Оба обязаны равняться `draft_hash` из exact `APPROVED_FOR_COPY_EXPORT` receipt.

Любое изменение текста требует новой цепочки:

```text
new Response Candidate
-> new Human Response Approval
-> new Copy/Export Event
```

Старый approval не переносится на изменённый draft.

## States

```text
APPROVAL_REQUIRED
COPY_EXPORT_EVENT_REQUIRED
COPIED_PUBLICATION_UNVERIFIED
```

### `APPROVAL_REQUIRED`

Нет exact `APPROVED_FOR_COPY_EXPORT` predecessor.

### `COPY_EXPORT_EVENT_REQUIRED`

Exact draft уже одобрен для copy/export, но event ещё не записан.

### `COPIED_PUBLICATION_UNVERIFIED`

Есть exact event assertion для exact approved draft; publication не доказана.

## Mandatory non-effects

```text
Approval For Copy Export != Copy Performed
Recorded Copy Event != Independent OS Attestation
Copied Draft != Published Draft
Copy Export != Platform Publication
Copy Export Receipt != Publication Receipt
Copy Event Actor Reference != Verified Actor Identity
Application Observation != External Platform Observation
Local Export != External Delivery
Copy Export Receipt != ActionPermit
Copy Export Receipt != External Effect
```

## Claims that remain false

Даже положительный receipt сохраняет false:

```text
copy_export_independently_verified
actor_identity_verified
os_clipboard_state_attested
filesystem_export_state_attested
publication_observed
publication_authorized
provider_invoked
network_accessed
platform_mutated
campaign_sent
pilot_permit_created
action_permit_created
external_execution_admitted
external_effect_performed
successor_authority_created
```

## Committed state

Единственный committed fixture:

```text
approval_receipt = null
event = null
classification = APPROVAL_REQUIRED
```

Ни real/private pilot data, ни approved draft, ни copy event в canonical fixture не коммитятся.

Positive paths существуют только во временных `/tmp`-артефактах CI.

## Next safe action

После `COPIED_PUBLICATION_UNVERIFIED` допускается только отдельный слой:

`PUBLICATION_OBSERVATION_REQUIRED`

Он должен наблюдать внешнюю площадку независимо от copy/export receipt и не может выводить публикацию из факта копирования.
