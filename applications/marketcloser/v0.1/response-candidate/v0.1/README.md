# MarketCloser Response Candidate Construction v0.1

`MarketCloser Response Candidate Construction v0.1` — additive application layer после `Human Analysis Disposition Gate v0.1`.

Origin frontier:

`0cac7d49bda673f6bd500fcedf74031064f8ee53`

Origin tree:

`6c008f46c177e12ec12830a025180b71dba48c62`

## Задача

После `Real Stress-Test Adapter` система уже способна выполнить локальный deterministic analysis, а `Human Analysis Disposition Gate` — зафиксировать человеческое отношение к этому exact analysis result.

Этот слой решает следующую, отдельную задачу:

```text
accepted exact analysis
+ exact human disposition
+ human-minimized customer-facing context
-> bounded response candidate
-> HUMAN_RESPONSE_APPROVAL_REQUIRED
-> STOP
```

Response Candidate не является одобренным или опубликованным ответом.

## Admission boundary

Response candidate допускается только после exact disposition:

```text
classification = ANALYSIS_ACCEPTED_FOR_HUMAN_USE
decision = ACCEPT_FOR_HUMAN_USE
```

Любой другой predecessor state заканчивается:

```text
DISPOSITION_ACCEPTANCE_REQUIRED
```

Даже при принятом анализе отсутствие customer-facing context заканчивается:

```text
CUSTOMER_CONTEXT_REQUIRED
```

Только после обеих границ возможно:

```text
RESPONSE_CANDIDATE_READY
```

## Почему raw review не используется

Marketer Pessimist получает только human-minimized non-personal claim/evidence packet. Из него нельзя честно восстановить исходный отзыв или личность автора.

Этот слой не пытается выполнить обратную реконструкцию:

```text
Minimized Analysis != Raw Review Reconstruction
Customer Context != Reviewer Identity
```

Для v0.1 требуется отдельный human-minimized customer context. Он содержит только:

- response purpose;
- язык;
- тон;
- explicit statement IDs из exact accepted analysis;
- privacy assertions.

Он не содержит arbitrary free-form customer facts.

## Privacy boundary

Customer context v0.1 требует:

```text
human_minimization_reviewed = true
personal_data_present = false
sensitive_personal_data_present = false
reviewer_identity_present = false
protected_attribute_data_present = false
psychological_vulnerability_data_present = false
cross_context_identifier_present = false
raw_review_content_present = false
business_pressure_included = false
```

Публичность исходного review сама по себе не ослабляет эту границу.

## Deterministic response construction

v0.1 не использует provider/LLM для свободной генерации ответа.

Человек выбирает material statement IDs из exact accepted analytical candidate. Runtime повторно восстанавливает exact chain:

```text
Disposition input
-> exact Disposition receipt
-> exact Adapter input
-> exact Stress-Test receipt
-> exact Revalidation
-> exact Marketer Real Review Candidate
```

После этого для каждого выбранного statement сохраняется его исходная classification и evidence lineage.

## Epistemic rendering

Каждый response point получает одну из трёх машинных форм:

```text
verified_fact
qualified
conflict
```

`verified_fact` допустим только если:

- statement classification = `observed_evidence`;
- есть evidence refs;
- каждое связанное evidence имеет `quality=verified`;
- evidence поддерживает statement;
- evidence не противоречит statement.

В остальных случаях statement остаётся `qualified` или `conflict`.

```text
Unverified Evidence != Public Fact
Missing Evidence != Negative Fact
```

## Uncertainty disclosures

Missing-evidence codes не копируются в customer-facing текст буквально. Они переводятся в bounded deterministic disclosures:

- `NO_SUPPORTING_EVIDENCE` → недостаточно подтверждающих данных;
- `UNVERIFIED_EVIDENCE` → информация пока не подтверждена независимо;
- `STALE_EVIDENCE` → информация может быть устаревшей;
- `CONFLICTING_EVIDENCE` → есть противоречивые данные.

Неизвестный код также не становится выводом: он переводится в общую формулировку о сохраняющейся неопределённости.

## Response candidate shape

Ready receipt содержит:

```text
acknowledgement
evidence_bound_points
uncertainty_disclosures
next_step
closing
draft_text
```

и жёстко фиксирует:

```text
human_approval_required = true
approved = false
copy_export_allowed = false
published = false
```

Draft text собирается только из этих deterministic components.

## Тон

v0.1 поддерживает:

```text
neutral_professional
empathetic_bounded
concise_factual
```

Язык v0.1:

```text
ru
```

Расширение языков — отдельный successor, а не скрытая эвристика.

## Waiting fixture

В GitHub коммитится только waiting fixture:

```text
disposition_receipt = null
customer_context = null
```

Он должен оставаться:

```text
DISPOSITION_ACCEPTANCE_REQUIRED
response_candidate = null
```

Ни accepted disposition, ни completed stress-test result, ни customer data не коммитятся.

## Positive conformance

Positive path существует только в `/tmp` внутри CI:

```text
synthetic authority
-> one-shot permit
-> revalidation
-> synthetic stress-test
-> ACCEPT_FOR_HUMAN_USE
-> synthetic minimized response context
-> RESPONSE_CANDIDATE_READY
```

Это conformance evidence, а не реальный ответ клиенту.

## Exact binding

`receipt-binding.js` заново выводит receipt из exact input и требует canonical equality.

Изменение:

- request id;
- tone;
- statement selection/order;
- human disposition rationale;
- draft text;

ломает exact source binding даже после пересчёта собственного content hash.

```text
Receipt Self-Consistency != Exact Source Binding
```

## CLI

Разрешены только:

```text
validate
inspect
candidate
help
```

`candidate` fail-closed, пока state не `RESPONSE_CANDIDATE_READY`.

Нет команд:

```text
approve
copy
publish
send
respond
campaign
provider
mutate
execute
authorize
permit
```

## Non-effects

```text
Accepted Analysis != Approved Response
Response Candidate != Approved Response
Response Candidate != Published Response
Minimized Analysis != Raw Review Reconstruction
Unverified Evidence != Public Fact
Missing Evidence != Negative Fact
Counterargument != Accusation
Risk Hypothesis != Admission of Harm
Response Draft != Publication Authority
Response Draft != Platform Mutation
Response Candidate != ActionPermit
Response Candidate != External Effect
Customer Context != Reviewer Identity
```

## Explicit false claims

Ready receipt сохраняет false:

```text
raw_review_reconstructed
reviewer_identity_inferred
truth_certified
unsupported_fact_added
response_approved
copy_export_authorized
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

## Следующий безопасный шаг

Только:

`HUMAN_RESPONSE_APPROVAL_REQUIRED`

Human response approval должен быть отдельным successor layer. Он не должен совмещаться с construction, copy/export или publication.
