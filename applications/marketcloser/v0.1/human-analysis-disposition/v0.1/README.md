# MarketCloser Human Analysis Disposition Gate v0.1

## Назначение

Этот слой находится сразу после `MarketCloser Real Stress-Test Adapter v0.1` и записывает явное человеческое отношение к одному exact результату аналитического stress-test.

Он не отвечает клиенту, не создаёт текст ответа, не публикует, не вызывает провайдера и не создаёт внешнее полномочие.

```text
exact stress-test result
-> explicit human disposition
-> typed disposition receipt
-> STOP / bounded successor
```

## Канонический словарь решений

Слой не вводит новый словарь `approve/reject`. Он переиспользует Human Gate из Product Contract `Маркетолог Пессимиста` v0.1:

```text
REJECT
CORRECT
REQUEST_MORE_EVIDENCE
ACCEPT_FOR_HUMAN_USE
```

Семантика:

```text
REJECT
-> ANALYSIS_REJECTED_FOR_HUMAN_USE
-> STOP_AFTER_ANALYSIS_REJECTION

CORRECT
-> ANALYSIS_CORRECTION_REQUIRED
-> ANALYSIS_CORRECTION_SUCCESSOR_REQUIRED

REQUEST_MORE_EVIDENCE
-> MORE_EVIDENCE_REQUIRED
-> EVIDENCE_SUCCESSOR_REQUIRED

ACCEPT_FOR_HUMAN_USE
-> ANALYSIS_ACCEPTED_FOR_HUMAN_USE
-> RESPONSE_CANDIDATE_CONSTRUCTION_REQUIRED
```

`ACCEPT_FOR_HUMAN_USE` означает только локальное человеческое принятие анализа для дальнейшей человеческой работы.

Это не:

- ответ пользователю;
- response candidate;
- публикация;
- campaign authority;
- platform mutation;
- `PilotPermit`;
- `ActionPermit`;
- external execution.

## Точная причинная цепочка

Положительный путь не принимает готовый флаг `analysis_completed=true`.

Он повторно выполняет:

```text
analysis_source
-> exact Adapter input hash
-> Adapter.validateInput()
-> Adapter.stressTest()
-> exact MarketCloserRealStressTestReceipt
-> canonical equality with supplied analysis_receipt
-> explicit human decision assertion
-> MarketCloserHumanAnalysisDispositionReceipt
```

Таким образом:

```text
Receipt Self-Consistency != Exact Source Binding
```

## Состояния ожидания

До человеческого решения существуют два разных состояния:

```text
ANALYSIS_RESULT_REQUIRED
HUMAN_DECISION_REQUIRED
```

Первое означает, что completed stress-test receipt отсутствует.

Второе означает, что exact stress-test receipt уже имеется и проверен, но человек ещё не выразил disposition.

Эти состояния намеренно не объединяются.

## Committed fixture

Единственный committed fixture:

```text
examples/synthetic-disposition-wait.input.json
```

содержит:

```text
analysis_receipt = null
decision = null
decided_at = null
```

и должен давать:

```text
ANALYSIS_RESULT_REQUIRED
human_disposition_recorded = false
```

Ни completed stress-test receipt, ни ready permit, ни человеческое решение не коммитятся в conformance fixture.

Положительный synthetic путь создаётся только во временных `/tmp`-артефактах теста:

```text
synthetic authority
-> permit
-> revalidation
-> stress-test adapter
-> completed synthetic stress-test receipt
-> one of four synthetic human dispositions
```

## Reviewer reference

`reviewer_ref` — opaque reference.

Система записывает только то, что reference был supplied вместе с решением.

Она не выводит из него:

```text
reviewer_identity_verified
reviewer_authority_verified
```

Для `synthetic_conformance` reviewer reference обязан находиться в `urn:synthetic:*` namespace.

## Исправление не переписывает прошлое

Решение `CORRECT` не изменяет stress-test receipt или исходный evidence packet.

Оно означает только необходимость отдельного successor state:

```text
CORRECT != Source Rewrite
```

Будущая correction должна сохранить predecessor provenance и создать новый typed successor.

## Reject не является запретом

`REJECT` означает отказ человека использовать один exact анализ в текущей цепочке.

Он не создаёт:

- глобальный запрет;
- санкцию;
- blacklist;
- доказательство ошибки или вреда;
- запрет на получение новых доказательств;
- future authority decision.

```text
REJECT != Global Prohibition
```

## Request More Evidence

`REQUEST_MORE_EVIDENCE` означает, что текущего evidence packet недостаточно для желаемого человеческого использования.

```text
Request More Evidence != Negative Evidence
```

Отсутствующее доказательство не превращается в доказательство противоположного утверждения.

## Mandatory non-effects

Каждый receipt сохраняет:

```text
Stress-Test Result != Human Disposition
Human Disposition != Truth
REJECT != Global Prohibition
CORRECT != Source Rewrite
Request More Evidence != Negative Evidence
Accept For Human Use != Response Candidate
Accept For Human Use != Publication Authority
Human Decision Recorded != Reviewer Identity Verified
Human Decision Recorded != Reviewer Authority Verified
Disposition Receipt != ActionPermit
Disposition Receipt != External Effect
Successful Analysis != Successor Authority
```

И фиксирует false для:

```text
truth_certified
reviewer_identity_verified
reviewer_authority_verified
source_rewritten
global_prohibition_created
response_candidate_created
publication_authorized
campaign_send_authorized
provider_invoked
network_accessed
platform_mutated
pilot_permit_created
action_permit_created
external_execution_admitted
external_effect_performed
successor_authority_created
```

## CLI

Разрешены только:

```text
validate
receipt
help
```

Нет imperative-команд:

```text
accept
reject
correct
publish
send
respond
campaign
execute
authorize
```

Human disposition является входным evidence assertion, а не командой runtime.

## Следующая безопасная граница

Только:

```text
ANALYSIS_ACCEPTED_FOR_HUMAN_USE
```

может перейти к:

```text
RESPONSE_CANDIDATE_CONSTRUCTION_REQUIRED
```

Даже этот переход ещё не создаёт ответ и не даёт права публикации.

Остальные решения либо останавливают цепочку, либо требуют отдельного evidence/correction successor.
