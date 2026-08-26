# Маркетолог Пессимиста — Product Contract v0.1

**Статус:** candidate product definition; runtime отсутствует  
**Tracking:** Issue #516  
**Origin frontier:** `70c1dfe0e2d4f3e8401050c4e7f56a5e76d11b4d`  
**Contract hash:** `sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6`

## 1. Назначение

Маркетолог Пессимиста — не «генератор негатива» и не автоматический критик. Это evidence-first инструмент для стресс-теста утверждений, планов и стратегий до того, как человек примет решение или допустит внешний эффект.

Базовая цепочка:

```text
Claim / plan
→ evidence and provenance split
→ assumptions and hypotheses
→ counterarguments
→ causal alternatives
→ falsifiers
→ missing evidence / uncertainty
→ bounded recommendation candidate
→ human disposition
```

Продукт должен помогать увидеть слабые места решения, но не подменять человеческое решение собственной отрицательной оценкой.

## 2. Главная граница

```text
Пессимистический анализ != истина

Контраргумент != отказ

Гипотеза риска != доказательство вреда

Негативная возможность != негативное намерение или ответственность
```

Название продукта задаёт режим проверки, а не привилегированный epistemic status. Негативный сценарий должен проходить те же требования к доказательствам, происхождению и неопределённости, что и исходное оптимистичное утверждение.

## 3. Что продукт анализирует

Product Contract допускает только локальные аналитические результаты:

1. **Claim decomposition** — разделение текста на наблюдаемое доказательство, интерпретацию, допущение, гипотезу и заявленную цель.
2. **Counterargument map** — набор контраргументов с указанием, на каком доказательстве или гипотезе они основаны.
3. **Causal alternative map** — альтернативные причинные объяснения, не выдаваемые за установленные факты.
4. **Falsifier map** — наблюдения или тесты, способные ослабить или опровергнуть существенное утверждение.
5. **Missing-evidence map** — отсутствующие, устаревшие, конфликтующие или недостаточные доказательства.
6. **Bounded recommendation candidate** — кандидат рекомендации с неопределённостью, альтернативами и explicit non-effects.

## 4. Что продукт не делает

В v0.1 отсутствуют external effects. Запрещены:

- отправка рекламной кампании;
- публикация текста;
- доступ к рекламному кабинету;
- расходование средств;
- загрузка или построение аудитории;
- персональное таргетирование;
- вывод защищённых признаков;
- вывод психологической уязвимости человека;
- автономное убеждение или давление;
- изменение аккаунта или внешней системы;
- автоматическое отклонение продукта, плана или человека.

```text
Marketing Recommendation != Campaign Authority

Candidate Output != Publication Authority

Audience Description != Permission to Profile a Person
```

Даже человек в рамках этого no-effect контракта не получает через сам документ полномочия выполнить внешний эффект. Такое полномочие, если когда-либо будет спроектировано в отдельной версии, потребует отдельного ActionPermit, exact-frontier revalidation, human gate и bounded actuator.

## 5. Входные доказательства

Контракт принимает три bounded input groups:

### `claim-package`

Точное утверждение, план или стратегия, цель проверки и scope.

### `supporting-evidence`

Источники, наблюдения, метрики и документы за или против утверждения. Каждый элемент должен иметь provenance или явную отметку `unverified`.

### `decision-constraints`

Цели, ограничения, недопустимые последствия и критерии успеха.

Отсутствие доказательства сохраняется как неопределённость:

```text
Missing Evidence != Negative Evidence

Available Evidence != Permission to Inspect
```

## 6. Data boundary

Контракт использует только намеренно переданные данные review-сессии:

- `claim-content`;
- `evidence-bundle`;
- `decision-context`;
- `derived-stress-test`.

По умолчанию запрещены:

```text
cross-context correlation
identity resolution
personal audience records
protected-attribute inference
psychological-vulnerability model
```

Данные минимизируются, имеют bounded retention, correction/deletion path и не предназначены для внешней публикации или campaign use.

## 7. Human gate

Единственный gate текущего контракта:

```text
analysis-disposition-gate
```

Он срабатывает до того, как output можно трактовать как рекомендацию или successor decision.

Допустимые решения:

```text
REJECT
CORRECT
REQUEST_MORE_EVIDENCE
ACCEPT_FOR_HUMAN_USE
```

Fail-closed default:

```text
REJECT
```

`ACCEPT_FOR_HUMAN_USE` означает только принятие локального candidate человеком. Оно не разрешает campaign send, публикацию, spend, targeting или account mutation.

## 8. Failure и uncertainty

Контракт различает:

```text
UNKNOWN
CONFLICT
INSUFFICIENT_EVIDENCE
CANDIDATE_READY
REJECTED
ACCEPTED_FOR_HUMAN_USE
```

Инварианты:

```text
UNKNOWN != SUCCESS

CONFLICT != AUTOMATIC RETRY

CANDIDATE_READY != ACCEPTED_FOR_HUMAN_USE
```

Конфликт требует human reconciliation. Изменение доказательств, constraints или текста создаёт successor input/state, а не переписывает исходную причинную линию.

## 9. Receipts

### `MarketerPessimistStressTestReceipt`

Фиксирует:

- exact contract hash;
- input frontier;
- evidence lineage;
- classifications;
- counterarguments;
- causal alternatives;
- falsifiers;
- missing evidence;
- `UNKNOWN` / `CONFLICT`.

Он не сертифицирует истину, не отклоняет человека/утверждение и не разрешает внешний эффект.

### `MarketerPessimistDispositionReceipt`

Фиксирует human disposition для одного exact candidate. Correction или narrowing образуют successor state.

## 10. Dependencies

Текущий обязательный dependency:

```text
UU-AAP Core v0.1
```

Необязательные/planned dependencies:

```text
IAL v0.1
AI Transport v0.1
FREESHIELD v0.1-candidate
```

FREESHIELD пока не является обязательным dependency: его собственный canonical Product Contract ещё должен быть материализован отдельным PR.

Для всех dependency:

```text
authority_transfer = false
responsibility_transfer = false
reverse_core_dependency = false
```

## 11. Success criteria

Contract-level success означает только, что:

- все material statements классифицированы или явно отмечены `UNKNOWN`;
- каждый recommendation candidate имеет falsifier/test либо явное объяснение, почему falsification пока недоступна;
- выполнено ноль внешних мутаций.

```text
Product Success != Stable-Core Requirement

Success != Successor Authority

Failure != Liability
```

## 12. IP object boundary

Object ID:

```text
marketer-pessimist-product-contract-v0.1
```

Включены только exact contract, этот README, validator и dedicated workflow. Runtime, model weights, campaign integrations, advertising accounts, third-party dependencies и будущие версии не включены.

```text
IP Object Boundary != Registration Outcome

Current Version != Future Version
```

## 13. Validation

```bash
python -m pip install "jsonschema>=4.22,<5"
python products/marketer-pessimist/v0.1/validate_contract.py
```

Ожидаемый результат:

```text
Маркетолог Пессимиста Product Contract v0.1 validation: PASS
(53 fail-closed mutations rejected)
```

Validator повторно применяет reusable Product Contract validator и затем проверяет product-specific boundaries: отсутствие external effects, персонального профилирования, persuasion optimization, automatic rejection, unsafe retry, authority transfer и IP overclaim.

## 14. Следующий слой после отдельного merge

Следующий возможный инкремент — **local no-send MVP**, который принимает один bounded claim package и выпускает только local `MarketerPessimistStressTestReceipt` candidate.

Этот Product Contract не создаёт permit на такой runtime и не разрешает следующий PR автоматически.
