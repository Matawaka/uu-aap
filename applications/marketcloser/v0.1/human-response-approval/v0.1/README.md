# MarketCloser Human Response Approval v0.1

`MarketCloser Human Response Approval v0.1` — additive application layer после `Response Candidate Construction v0.1`.

Origin frontier:

`92533e6f84f036c1e45daa8ae18fe22957707f10`

Origin tree:

`b1c11f4756055eb69e4c212726f39facddd8f41e`

## Задача

Предыдущий слой умеет создать только локальный `RESPONSE_CANDIDATE_READY` и специально фиксирует:

```text
human_approval_required = true
approved = false
copy_export_allowed = false
published = false
```

Этот слой добавляет отдельное человеческое решение над одним exact response candidate:

```text
exact response candidate
+ explicit human decision
-> Human Response Approval Receipt
-> STOP / bounded successor
```

Он ничего не копирует и не публикует.

## Решения

```text
REJECT_RESPONSE
REQUEST_RESPONSE_CHANGES
APPROVE_FOR_COPY_EXPORT
```

Результаты:

```text
REJECT_RESPONSE
-> RESPONSE_REJECTED
-> STOP_AFTER_RESPONSE_REJECTION

REQUEST_RESPONSE_CHANGES
-> RESPONSE_CHANGES_REQUIRED
-> RESPONSE_CANDIDATE_REVISION_REQUIRED

APPROVE_FOR_COPY_EXPORT
-> APPROVED_FOR_COPY_EXPORT
-> COPY_EXPORT_RECEIPT_REQUIRED
```

## Exact draft binding

Approval относится не к «ответу вообще», а к exact candidate receipt.

Receipt хранит:

```text
response candidate id
response candidate receipt hash
draft SHA-256
```

Любое изменение draft, tone, selected statements, customer context или predecessor chain создаёт другой response candidate и требует нового approval.

```text
Approved Exact Draft != Authority To Edit Draft
Draft Change != Existing Approval Continuity
```

## Approval scope

Положительный результат устанавливает только:

```text
classification = APPROVED_FOR_COPY_EXPORT
approved_for_copy_export = true
copy_export_authorized = true
```

Одновременно остаётся false:

```text
copy_export_performed
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

Следовательно:

```text
Approval For Copy Export != Copy Performed
Approval For Copy Export != Publication Authority
Human Approval != Publication
```

## Почему approval не является публикационным разрешением

Копирование текста в локальный буфер или экспорт для человека и публикация на внешней площадке — разные причинные события.

Даже после `APPROVED_FOR_COPY_EXPORT` система не знает:

- был ли текст реально скопирован;
- был ли он изменён после копирования;
- куда его вставили;
- был ли он опубликован;
- совпал ли опубликованный текст с approved draft.

Поэтому следующий слой обязан сначала создать отдельный `Copy/Export Receipt`.

## Reviewer boundary

`reviewer_ref` — opaque human-supplied reference.

```text
Human Decision Recorded != Reviewer Identity Verified
Human Decision Recorded != Reviewer Authority Verified
```

v0.1 не выводит reviewer identity/authority из факта решения.

## Committed state

В репозитории хранится только waiting fixture:

```text
response_candidate_receipt = null
decision = null
```

Он даёт:

```text
RESPONSE_CANDIDATE_REQUIRED
approved_for_copy_export = false
copy_export_authorized = false
```

Ни ready candidate, ни human approval не коммитятся.

Все три решения проверяются только во временной synthetic conformance цепочке.

## CLI

Разрешены только:

```text
validate
receipt
help
```

Команды вида `approve`, `copy`, `export`, `publish`, `send`, `execute` не являются частью runtime. Решение поступает как явно сформированный typed input, а не как императивная команда.

## Non-effects

```text
Response Candidate != Approved Response
Human Approval != Publication
Approval For Copy Export != Copy Performed
Approval For Copy Export != Publication Authority
Approved Exact Draft != Authority To Edit Draft
Draft Change != Existing Approval Continuity
Human Decision Recorded != Reviewer Identity Verified
Human Decision Recorded != Reviewer Authority Verified
Approval Receipt != ActionPermit
Approval Receipt != External Effect
Copy Export != Platform Publication
```

## Следующий безопасный переход

Только `APPROVED_FOR_COPY_EXPORT` может перейти к:

```text
COPY_EXPORT_RECEIPT_REQUIRED
```

Следующий слой должен наблюдать/зафиксировать сам локальный copy/export event и завершиться до публикации.
