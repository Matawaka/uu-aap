# Маркетолог Пессимиста — Real Review Intake v0.1

**Status:** experimental Phase E product-specific intake  
**Issue:** #605  
**Origin frontier:** `fc59a6c39d41e977dcc4df4831dccdf65deab57e`  
**Origin tree:** `0b165ac7e6ff2b6afcc123681660c7b979c9e673`

## Назначение

Этот слой подготавливает первый настоящий неперсональный маркетинговый кейс к ограниченному локальному разбору.

Он существует отдельно от `local-mvp`, потому что predecessor runtime намеренно зафиксирован как:

```text
synthetic_only = true
```

Реальные данные нельзя объявлять синтетическими только ради повторного использования старого runtime.

Поэтому цепочка разделяется:

```text
реальный или синтетический источник
-> явная классификация данных человеком
-> bounded intake validation
-> MarketerPessimistRealReviewCandidate
-> authority verification / real-review run gate
-> STOP
```

На этом этапе stress-test над реальным источником ещё не выполняется.

## Режимы источника

Runtime понимает только два режима:

```text
synthetic_conformance
real_non_personal
```

### `synthetic_conformance`

Используется только для CI и проверки совместимости. Committed fixture:

```text
examples/synthetic-positioning.intake.json
```

не содержит реального пользовательского, клиентского или участнического материала.

### `real_non_personal`

Предназначен для будущего локально переданного бизнес-кейса.

Runtime не пытается сам доказать отсутствие персональных данных. Он требует явное человеческое утверждение и основание классификации:

```text
human_classification_supplied = true
classification_basis = <явное основание>
personal_data_present = false
sensitive_personal_data_present = false
identity_resolution_required = false
protected_attribute_data_present = false
psychological_vulnerability_data_present = false
```

Дополнительно обязательны:

```text
retention_mode = session
deletion_supported = true
correction_supported = true
```

Отсутствие обнаруженных персональных данных само по себе не считается доказательством того, что данные неперсональные.

## Что входит в intake

Один пакет содержит:

- одну маркетинговую claim package;
- явные material statements;
- классификацию каждого material statement;
- evidence references и provenance references;
- falsification probes;
- objectives;
- constraints;
- unacceptable outcomes;
- success conditions;
- bounded control surface;
- exact content hash.

Поддерживаемые классы утверждений сохраняют Product Contract vocabulary:

```text
observed_evidence
interpretation
assumption
hypothesis
declared_objective
```

Качество доказательств:

```text
verified
unverified
stale
conflicting
```

## Candidate

Успешный intake создаёт только:

```text
MarketerPessimistRealReviewCandidate
```

Состояние зависит от режима источника:

```text
synthetic_conformance -> SYNTHETIC_CONFORMANCE_CANDIDATE_READY
real_non_personal     -> REAL_REVIEW_CANDIDATE_READY
```

Это состояние означает только готовность bounded case representation к следующей проверке.

Оно не означает:

```text
stress-test выполнен
claim признан истинным или ложным
human disposition записан
pilot admitted
PilotPermit создан
ActionPermit создан
execution разрешено
publication/campaign разрешены
```

## Совместимость с Local MVP

Synthetic conformance test строит synthetic-only predecessor input из тех же:

```text
claim_package
supporting_evidence
decision_constraints
```

и прогоняет существующий `Local Stress-Test MVP v0.1` без изменения его predecessor semantics.

Это доказывает совместимость структуры, но не создаёт право использовать `synthetic_only=true` для реального источника.

Инвариант:

```text
Structural Compatibility != Source-Class Equivalence
```

## Source binding

`candidate-binding.js` заново выводит candidate из exact intake и сравнивает каноническое представление целиком.

Поэтому структурно валидная подмена:

- source reference;
- classification basis hash;
- frontier;
- claim text;

не проходит exact source binding.

Инвариант:

```text
Candidate Self-Consistency != Exact Intake Binding
```

## Fail-closed граница

v0.1 отвергает intake, если присутствует хотя бы одно из условий:

- personal data;
- sensitive personal data;
- identity resolution;
- protected-attribute data;
- psychological-vulnerability data;
- persistent retention;
- отсутствует correction/deletion path;
- network access;
- provider invocation;
- publication;
- campaign send;
- advertising-account access;
- spend;
- audience upload;
- personal targeting;
- cross-context correlation;
- external mutation;
- PilotPermit capability;
- ActionPermit capability;
- execution;
- external effect.

## Обязательные non-effects

```text
Real Source != Synthetic Fixture
Real Review Intake != Pilot Admission
Pilot Admission != Human Disposition
Human Disposition != Authority Verification
Intake Candidate != Stress-Test Receipt
Intake Candidate != PilotPermit
Intake Candidate != ActionPermit
Intake Candidate != Execution
Non-Personal Classification != Identity Inference
Missing Personal Data Evidence != Proof of Non-Personal Data
```

## CLI

Разрешены только read-only команды:

```text
validate
inspect
help
```

Пример для committed synthetic fixture:

```bash
node products/marketer-pessimist/v0.1/real-review-intake/v0.1/real-review-intake.js \
  inspect \
  products/marketer-pessimist/v0.1/real-review-intake/v0.1/examples/synthetic-positioning.intake.json
```

Команды вроде `stress-test`, `analyze`, `approve`, `admit`, `permit`, `run`, `execute`, `send`, `publish`, `campaign`, `spend` и `target` отсутствуют и должны fail closed.

## Следующий безопасный шаг

Для `REAL_REVIEW_CANDIDATE_READY` следующий шаг фиксирован как:

```text
AUTHORITY_VERIFICATION_AND_REAL_REVIEW_RUN_GATE_REQUIRED
```

То есть даже корректно классифицированный реальный неперсональный кейс ещё не запускает анализ автоматически.

## Историческая непрерывность

`products/marketer-pessimist/v0.1/local-mvp/` не изменяется.

Его `synthetic_only` остаётся исторически и технически истинным.

```text
Successor Real-Review Intake != Rewrite of Synthetic Predecessor
```