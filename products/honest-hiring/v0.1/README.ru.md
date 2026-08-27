# Честный найм — Product Contract v0.1

**Статус:** candidate product definition; runtime не реализован  
**Tracking:** Issue #520  
**Origin frontier:** `18a57f46eac60576ecc7ff9777888cd2b45230a2`  
**Contract hash:** `sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae`

## 1. Назначение

«Честный найм» — не автоматический рекрутер и не машина оценки ценности человека.

Product Contract определяет локальную, доказательную и оспоримую поддержку человеческого review:

```text
role requirements
→ candidate-supplied job evidence
→ provenance / relevance / uncertainty
→ bounded comparison candidate
→ FREESHIELD protective assessment
→ human review
→ contestable disposition
→ correction / appeal successor state
```

Контракт должен помочь человеку увидеть:

- какие требования действительно объявлены для конкретной роли;
- кем и на каком frontier они заданы;
- почему каждое требование считается относящимся к работе;
- какие доказательства кандидат добровольно предоставил;
- какие утверждения подтверждены, не подтверждены, отсутствуют или конфликтуют;
- где система сделала интерпретацию, а не наблюдала факт;
- какие признаки вообще запрещено использовать;
- что именно проверил FREESHIELD;
- какое решение о самом analysis packet принял человек;
- как кандидат может оспорить или исправить packet.

## 2. Главные различия

```text
Hiring Support != Hiring Authority
Candidate Evidence != Candidate Identity or Worth
Missing Evidence != Negative Evidence
Job-Relevant Comparison != Global Person Ranking
Model Score != Employment Decision
Protected Attribute != Job-Relevant Feature
Proxy Correlation != Permission to Infer a Protected Attribute
Interview Observation != Personality, Health or Disability Diagnosis
Human Review != Rubber-Stamping
Disposition != Unappealable Finality
Candidate Challenge != Negative Signal
FREESHIELD Assessment != Automatic Rejection
```

Общий reusable boundary также сохраняется:

```text
Product Contract != Product Runtime
Product Contract != ActionPermit
Described Effect != Authorized Effect
Dependency Edge != Authority Transfer
Product Success != Stable-Core Requirement
Contract Acceptance != Responsibility Acceptance
Contract Version != Future Version
IP Object Boundary != Registration Outcome
```

## 3. Что продукт может анализировать

В v0.1 допускаются только локальные analysis effects:

1. **Role requirement normalization** — связать каждое существенное требование с владельцем, текущим frontier, evidence standard и job-relevance rationale.
2. **Candidate evidence lineage** — связать утверждения кандидата с добровольно предоставленными источниками или явно отметить `unverified / unavailable / UNKNOWN`.
3. **Job-relevance map** — сопоставить доказательства каждому объявленному требованию без глобального ранга человека.
4. **Uncertainty / missing-evidence map** — сохранить отсутствующие, устаревшие, конфликтующие и недостаточные данные.
5. **Bounded comparison candidate** — подготовить requirement-by-requirement packet с причинами и non-effects.
6. **FREESHIELD protective input** — подготовить exact packet для отдельной защитной оценки.
7. **Human review packet** — собрать локальный пакет, который ничего не решает и никого не уведомляет.
8. **Challenge / correction candidate** — подготовить successor candidate после оспаривания, не переписывая predecessor evidence.

Во всех случаях:

```text
external_effect = false
```

Контракт фиксирует:

```text
external_effects = []
default_external_effect_admission = denied
execution_authorized = false
action_permit_created = false
responsibility_accepted = false
stable_core_promotion_authorized = false
legal_outcome_established = false
```

## 4. Что запрещено

Product Contract не допускает:

- автоматический отказ, shortlist, offer или hire;
- автоматическую отправку сообщения, приглашения или календарного события;
- изменение ATS, mailbox, calendar, background-check service или другого внешнего аккаунта;
- единый скрытый score, employability score, рейтинг «лучших людей» или неизменяемую сортировку кандидатов;
- использование отсутствия доказательства как доказательства неспособности;
- scraping социальных профилей;
- cross-context correlation;
- скрытое объединение данных между вакансиями, работодателями или продуктами;
- infer protected attributes или proxies;
- вывод личности, эмоций, честности, обмана, здоровья, инвалидности или психологического состояния по лицу, голосу, видео, стилю письма, скорости ответа или latency;
- использование challenge/appeal как отрицательного сигнала;
- превращение FREESHIELD assessment в automatic rejection;
- утверждение legal compliance или законности конкретного hiring decision.

## 5. Требования к роли

Сравнение начинается не с резюме, а с attributable role requirements.

Для каждого существенного требования нужны:

- точная формулировка;
- владелец требования;
- текущий frontier;
- связь с задачей роли;
- evidence standard;
- возможность оспорить relevance или формулировку.

```text
Declared Preference != Job-Relevant Requirement
Current Requirement != Permanent Requirement
Requirement Receipt != Proof of Universal Lawfulness
```

Если requirements не имеют достаточной определённости, процесс останавливается fail-closed.

## 6. Evidence candidate

Кандидат предоставляет только ту информацию, которую намеренно включает в exact package.

Допустимые классы могут включать:

- рабочий опыт;
- навыки;
- work samples;
- сертификаты;
- добровольно предоставленные пояснения;
- role-relevant constraints или preferences.

Каждое материальное утверждение должно быть:

```text
source-bound
| explicitly unverified
| unavailable
| UNKNOWN
```

Доступность дополнительных данных не означает права их искать:

```text
Available Evidence != Permission to Inspect
Stored Relation != Permitted Correlation
Possible Identification != Performed Identification
```

## 7. Data governance

Contract использует следующие классы:

- `role-requirement-data` — internal;
- `candidate-job-evidence` — personal;
- `candidate-declared-context-data` — personal;
- `hiring-process-context` — confidential;
- `derived-job-relevance-map` — derived;
- `protective-assessment-data` — derived;
- `challenge-record-data` — personal.

В contract нет `sensitive_personal` data class.

Это не означает, что sensitive data невозможно встретить в реальном input. Это означает, что product contract не принимает такой класс как допустимый материал сравнения. Реальный runtime должен fail-closed остановить или минимизировать такой input до анализа.

Обязательные правила:

```text
default_minimization = true
purpose_limitation = true
cross_context_correlation_default = denied
identity_resolution_default = denied
retention_extension_requires_human_gate = true
```

Candidate evidence не должно расширяться social data, behavioral biometrics, hidden third-party data или unrelated personal history.

## 8. Роли

### Human hiring owner

- задаёт exact scope;
- отвечает за attributable requirements;
- проверяет job relevance;
- принимает решение только о готовности analysis packet к дальнейшему человеческому review;
- сохраняет отдельную employment-decision boundary.

### Human hiring reviewer

- проверяет lineage, uncertainty и reasons;
- не должен rubber-stamp output системы;
- может reject/correct/request evidence/accept packet for human review.

### Candidate participant

- предоставляет evidence добровольно;
- может его исправить или отозвать в рамках process policy;
- может оспорить requirement, evidence binding, interpretation, uncertainty, protective assessment и disposition.

### Human appeal reviewer

- рассматривает challenge отдельно от исходного system output;
- сохраняет predecessor evidence;
- не использует сам факт challenge как negative signal;
- выпускает reasoned successor state.

### Honest Hiring analysis system

- не обладает independent authority;
- не выдаёт employment decision;
- не управляет внешними системами;
- не получает права продолжать после успешного анализа.

### FREESHIELD protective system

- проверяет exact packet и Product Contract;
- может указать scope/evidence/prohibited-feature risk;
- не может reject candidate, создать blacklist или управлять disposition.

## 9. Human gates

### Comparison disposition gate

Перед тем как packet считается готовым к дальнейшему human review, нужны:

- role requirements;
- candidate evidence package;
- review constraints;
- FREESHIELD assessment.

Допустимые значения:

```text
REJECT_ANALYSIS
CORRECT_ANALYSIS
REQUEST_MORE_JOB_RELEVANT_EVIDENCE
ACCEPT_FOR_HUMAN_REVIEW
```

Default:

```text
REJECT_ANALYSIS
```

`ACCEPT_FOR_HUMAN_REVIEW` не означает hire, shortlist, offer, rejection, contact или ATS mutation.

### Challenge resolution gate

При challenge/correction допустимы:

```text
PAUSE_FOR_REVIEW
REQUEST_MORE_EVIDENCE
UPHOLD_WITH_REASONS
CORRECT_SUCCESSOR_STATE
```

Default:

```text
PAUSE_FOR_REVIEW
```

Challenge требует human appeal reviewer и отдельного `HonestHiringChallengeReceipt`.

## 10. FREESHIELD dependency

В этом contract FREESHIELD указан как required protective dependency:

```text
kind = protective
version_range = v0.1-candidate
required = true
authority_transfer = false
responsibility_transfer = false
reverse_core_dependency = false
```

Это означает только, что packet не может быть принят для дальнейшего human review без separately bound protective assessment.

Это не означает:

- что FREESHIELD runtime уже существует;
- что protective outcome является employment decision;
- что `BLOCK_EFFECT` означает candidate rejection;
- что protective system получил власть над продуктом;
- что dependency создаёт authority transfer.

## 11. Failure and uncertainty

Состояния включают:

```text
UNKNOWN
CONFLICT
INSUFFICIENT_JOB_RELEVANT_EVIDENCE
PROHIBITED_FEATURE_RISK
COMPARISON_CANDIDATE_READY
REJECTED_ANALYSIS
ACCEPTED_FOR_HUMAN_REVIEW
CHALLENGE_PENDING
CORRECTED_SUCCESSOR_STATE
```

Обязательные свойства:

```text
UNKNOWN != SUCCESS
UNKNOWN != Permission to Retry
CONFLICT requires reconciliation
Missing Evidence != Negative Evidence
Correction != History Deletion
```

Reconciliation owner — `human-appeal-reviewer`.

## 12. Contestability

Challenge может касаться:

- role requirements;
- relevance rationale;
- evidence lineage;
- job relevance;
- uncertainty и missing evidence;
- FREESHIELD protective assessment;
- comparison reasons;
- disposition.

Original evidence сохраняется. Correction создаёт successor state.

```text
Challenge != Admission of Weakness
Challenge != Negative Signal
Upheld Packet != Universal Correctness
```

## 13. Receipts

Contract определяет четыре типа:

### `HonestHiringRequirementReceipt`

Фиксирует exact requirements, evidence standards, relevance rationales, owner и frontier.

### `HonestHiringComparisonReceipt`

Фиксирует requirement-by-requirement bindings, uncertainty, conflicts, missing evidence и FREESHIELD reference.

### `HonestHiringDispositionReceipt`

Фиксирует human decision о самом packet до отдельного employment-decision process.

### `HonestHiringChallengeReceipt`

Фиксирует challenge, predecessor evidence, reasons и successor state.

Ни один receipt не является ActionPermit и не доказывает, что external effect произошёл.

## 14. Success criteria

Contract проверяет:

1. attributable requirement coverage;
2. candidate evidence lineage coverage;
3. zero prohibited-feature use;
4. no global numerical or ordinal ranking;
5. uncertainty visibility;
6. contestability closure;
7. zero external effects.

```text
Success != Successor Authority
Failure != Liability
Pilot Success != General Hiring Safety
```

## 15. IP boundary

Included artifacts ограничены четырьмя exact files contract v0.1.

Explicitly excluded:

- resumes/applications/work samples и identity data;
- candidate challenges и employment decisions;
- organization-specific requirements/policies;
- legal advice и compliance outcomes;
- third-party models/ATS/background-check/communication systems;
- future versions;
- общая идея честного найма.

```text
Exact Artifact Scope != Candidate Data Ownership
Product Contract != Legal Compliance Certification
Current Version != Future Version
```

## 16. Проверка

```bash
python -m pip install "jsonschema>=4.22,<5"
python schemas/product-contract/v0.1/validate_product_contract.py
python products/freeshield/v0.1/validate_contract.py
python products/honest-hiring/v0.1/validate_contract.py
```

Ожидаемый dedicated result:

```text
Честный найм Product Contract v0.1 validation: PASS
(162 fail-closed mutations rejected)
```

Validator отклоняет в том числе:

- automatic hire/reject/shortlist;
- external ATS effect;
- hidden/global ranking;
- protected/proxy/personality inference;
- sensitive-personal data class;
- social-profile expansion;
- loss of candidate challenge;
- challenge retaliation;
- FREESHIELD authority amplification;
- missing human gates;
- unsafe uncertainty/retry;
- dependency authority transfer;
- reverse Core dependency;
- Stable-Core promotion;
- IP/registration/legal-outcome overclaim;
- content-hash substitution.

## 17. Следующая граница

Merge этого contract означает только принятие product-definition candidate.

Он не создаёт runtime и не разрешает обработку real applicant data.

Следующий допустимый product step после отдельного human decision — synthetic, fully fictional, no-effect contestability pilot:

```text
fictional role
→ fictional candidate evidence
→ local comparison candidate
→ synthetic FREESHIELD assessment
→ human-review simulation
→ candidate challenge
→ successor receipt
→ post-run assessment
```

`Merged Contract != Pilot Permit`
