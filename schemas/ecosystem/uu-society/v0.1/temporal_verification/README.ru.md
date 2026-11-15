# Парная временная верификация / Независимое возобновление поиска v1.2

Экспериментальный слой UU Society. Не создаёт runtime authority, права на неблагоприятное решение, person ranking, moral oracle или Stable Core promotion.

**Институциональная независимость для системы — не доступный ей абсолютный бинарный факт, а ограниченное и пересматриваемое утверждение, поддерживаемое доказательствами, полученными в пределах ограниченного полномочия на проверку.**

В v1.1 риски TTL наблюдались в разных fixtures; причинное парное сравнение ещё отсутствовало. В v1.2 внутри сценария совпадают publication tape, исходные часы источников, скрытые задержки, oracle trajectory, контракты действий, общие бюджеты и правила issuer. Меняются только evaluation TTL и policy.

## Архитектура

Публикация источника → Исходное время / срок действительности → Scoped запрос под Search Lease → Прогноз deadline → Фактическая задержка → Приём или отмена → Эпистемическая оценка → Остановка поиска → Пассивная переоценка по общему календарю.

При исчерпании временного corridor: Незакрытый scoped пробел → Неизменяемый Request Receipt → Независимая проверка issuer / задержка рассмотрения → Новый lease с тем же или меньшим scope либо отказ. Общие бюджеты продолжают действовать между leases.

**16 сценариев × 3 TTL (1, 3, 6) × 3 policy = 144 receipts.** У всех вариантов одинаковые десять циклов 0–9. Поиск может остановиться раньше, но evidence продолжает переоцениваться. Oracle-ошибки считаются по равным временным циклам; в v1.1 считались неравные по длительности наблюдения решений и завершений. Состояние при остановке и состояние в конце горизонта разделены.

Повторно используются оценка v1.0, source-provenance checks и hard gate v1.1. Baseline — **selector bounded_targeted из v1.1 внутри нового общего календарного executor**. Это не утверждение о полном совпадении старой модели исполнения. Предыдущие suites и результаты не меняются.

## Исходные часы и policy

Публикация имеет неизменяемую identity, абсолютное время выпуска, время доступности и source TTL. Запрос получает последнюю доступную публикацию своей цели на момент завершения; simulator не выбирает её по истинности. Реальная задержка скрыта от policy, которой известна лишь оценка длительности и уже полученное evidence.

Действительность заканчивается в source issue cycle + min(evaluation TTL, source TTL). Новое чтение, повторное получение и reauthorization не обновляют эти часы. Проверка происхождения источника имеет свой срок. При expiry запрос отменяется в модели; поздний ответ не принимается. Это bookkeeping, а не гарантия реальной отмены.

- **bounded_targeted**: прежний selector без predictive deadline filtering и без renewal.
- **deadline_aware**: прогнозируемое завершение должно предшествовать expiry lease, действия и горизонта. Сначала сохраняются наблюдаемые freshness anchors; затем длительные проверки выполняются до получения краткоживущей corroboration. Сохраняются приоритеты исправления противоречий, provenance и EIV.
- **deadline_aware_reauthorized**: та же policy может после expiry запросить новое полномочие, если оставшийся кандидат допустим по прежним scope, privacy floor и общему бюджету. Требуется независимое рассмотрение; self-issuance запрещён.

Это эвристика порядка запросов, не доказательство оптимального расписания. Оценки задержки могут ошибаться.

## Независимое новое полномочие

Issuer отличается от requester и не имеет общего наблюдаемого транзитивного источника контроля с requester, reviewers или beneficiary. Используется структурная proxy: неполный observed graph не доказывает абсолютную независимость issuer.

Request связывает requester, предыдущий lease, цель, scope, цикл запроса и digest первоначальной оценки. Issuer сохраняет исходную привязку и отдельно проверяет текущий пробел после задержки. Переписывать request для создания нового согласия нельзя.

Grant сохраняет или сужает scope. Даже независимый issuer с более широкой delegation не может незаметно расширить прежнюю область. Типы действий, необходимые полномочия и privacy floor наследуются. Новый lease не пополняет общие actions, cost или intrusion. Число grants, время review и горизонт конечны; окончательный отказ завершает цепочку. Review cost учитывается отдельно и ограничен (max_grants + 1) × request_cost.

## Инварианты

1. Acquisition Time ≠ Source Issue Time.
2. Re-fetch ≠ Evidence Refresh.
3. Evaluation TTL Cannot Extend Source Validity.
4. Forecast ≠ Guarantee.
5. Search Stop ≠ Permanent Clearance.
6. Independent Reauthorization ≠ Epistemic Truth.
7. Renewal ≠ Budget Reset.
8. New Lease ≠ Broader Scope.
9. Independent Actor ≠ Unbounded Authority.
10. Search Lease ≠ Action Lease.
11. Search Lease ≠ Permission to Punish.
12. Protected Rights ≠ Optimization Variable.

Сохраняются границы v1.1 для неопределённости, противоречий, privacy и независимости источников. Renewal меняет полномочие на приобретение сведений, а не время их выпуска, истинность или право принимать решения.

## Протокол и результаты

[protocol.json](protocol.json) и claims всех сценариев зафиксированы до первого запуска. [initial-run-summary.json](initial-run-summary.json) и [initial-run.log](initial-run.log) сохраняют полный первый прогон. [reference-results.json](reference-results.json) фиксирует его результаты. Тесты проверяют исходные конфигурации, traces и все claims.

**16/16 architectural conformance; 144 receipts; 52 поддержанных и 5 опровергнутых claims.** Опровержение — результат исследования, а не повод снижать thresholds или переписывать предсказание. Провалов архитектурных ожиданий не было. После первого прогона усилены только проверки duplicate claims и предела authority requests, добавлены adversarial checks. Сценарии, TTL, claims и наблюдаемые результаты не менялись.

Проходят **20** temporal adversarial/metamorphic методов и прежние **13** методов v1.1: подмена часов, предел source validity, скрытые будущие ответы, неизменяемая request binding, актуальность потребности, конфликт issuer, scope/purpose/budget overrides, суммарное вмешательство после renewal и сохранность первого прогона.

| Сумма по 48 вариантам policy | bounded_targeted | deadline_aware | deadline_aware_reauthorized |
| --- | ---: | ---: | ---: |
| Новые действия / search cost | 39 / 39 | 15 / 15 | 28 / 28 |
| Отменённые запросы | 27 | 3 | 3 |
| Provisional / indeterminate / capture при остановке | 8 / 40 / 0 | 9 / 39 / 0 | 13 / 32 / 3 |
| False-assurance cycles | 5 | 5 | 10 |
| Capture-discovery cycles | 0 | 0 | 10 |
| Grants / denials | 0 / 0 | 0 / 0 | 12 / 15 |
| Authority requests / review cost | 0 / 0 | 0 / 0 | 27 / 27 |

Каждая колонка включает 480 ticks одних и тех же шестнадцати синтетических миров. Это описание fixtures, не prevalence реальных институтов и не универсальный рейтинг policy. Search cost и review cost — отдельные ресурсы.

| Сценарий | Фактический результат |
| --- | --- |
| T00 | Исходное подтверждение сохраняется 1/3/6 циклов при TTL 1/3/6; новых запросов нет. Остановка не замораживает claim. |
| T01 | При TTL 3 обе policy делают два равных по стоимости запроса: baseline остаётся неопределённым, deadline-aware достигает provisional independence на цикле 4. TTL 1 недостаточен обеим. |
| T02 | Публикация с issue cycle 0, прочитанная на цикле 3, устарела при TTL 1/3 и ещё действительна при TTL 6. Чтение не обновляет срок. |
| T03 | Deadline filtering избегает заведомо бесполезного запроса. Один независимый grant восстанавливает corridor: TTL 3 успешен после двух запросов, TTL 6 после одного; TTL 1 всё равно недостаточен. |
| T04 | Оценка длительности 1, факт 3, expiry lease 2: каждая policy теряет один отменённый запрос. Прогноз не является oracle задержки. |
| T05 | Provenance checks истекают на цикле 2; evidence TTL 6 их не заменяет. |
| T06 | Одинаковые favorable evidence, ноль запросов и capture onset на цикле 2: TTL 1/3/6 даёт 0/1/4 false-assurance cycles. |
| T07 | Renewal получает ошибочное благоприятное evidence. При TTL 3/6 false assurance возрастает с 0 до 2/3 циклов. Законность получения не гарантирует истинность. |
| T08 | Renewal получает свежее adverse evidence: capture signal при каждом TTL и 1/3/6 циклов обнаружения. Права на неблагоприятное действие не возникает. |
| T09 | Номинально отдельный issuer под общим контролем с requester получает отказ. |
| T10 | Self-issuance запрещён. |
| T11 | Уже израсходованная стоимость 2 сохраняется; cost-2 запрос не помещается в остаток 1. Renewal не отмывает бюджет. |
| T12 | Intrusion 4 запрещён floor 2 даже при суммарном allowance 99. Renewal для обхода не запрашивается. |
| T13 | Дополнительный scope issuer отвергается даже при более широкой delegation. |
| T14 | Review latency 9 исчерпывает десятицикловый горизонт; grants нет. |
| T15 | Один grant даёт слишком короткий corridor; второй request отвергнут. Review cost 2, полезных запросов 0. Конечная цепочка разрешений всё ещё может быть бесполезной. |

H1/H3/H4/H6/H7 подтверждены в заданных условиях. Универсальные H2/H5 опровергнуты. Меньше бесполезных запросов не означает гарантированное покрытие; независимое renewal способно увеличить и обнаружение capture, и ложную уверенность.

## Oracle separation

Policy и issuer не получают будущие публикации, реальные задержки, ожидаемые verdicts или synthetic truth. Executor работает без oracle и claims; authority gate — без response tape и oracle. Изменение будущих ответов и latency не меняет первоначальный выбор запроса.

Только post-hoc evaluation читает actual control graph. World/tape digests одинаковы во всех вариантах сценария; это оценочные метаданные, не вход policy. SHA-256 обеспечивает целостность и воспроизводимость, не истинность.

## Ограничения и риски

- Один in-flight запрос, конечный каталог действий, целочисленное время, один синтетический issuer и условные стоимости; оптимальный универсальный TTL не найден и не заявляется.
- Evidence, corrections, EIV и доступность синтетические. Реальные авторство и вероятности обнаружения не аутентифицируются и не калибруются.
- Независимость issuer проверяется по observed graph. Неизвестный capture самого issuer и бесконечная рекурсия «кто проверит проверяющего» не решены.
- Пессимистичная оценка может отбросить полезный запрос; оптимистичная — пропустить deadline. Прямо проверен второй случай, не полное распределение latency.
- Reauthorization создаёт зависимость от новой власти: review delay, отказ и бесполезные grants могут препятствовать получению знания.
- Более длинная freshness сохраняет как полезное покрытие, так и ошибочную уверенность. T06 — контролируемый пример, не нормативный выбор TTL.
- Expiry отзывает поддержку; он не доказывает ложность и не является политикой удаления данных. Purpose limits, retention, withdrawal и стирание raw evidence не реализованы.
- Реальные issuance, identity binding, signatures, consent, cancellation, contestation и enforcement не реализованы. Все leases остаются экспериментальными.
- Capture signal не является виной, permission to punish или автоматическим неблагоприятным действием.

Логичный следующий слой — purpose-bounded evidence memory и отзыв использования: разделить устаревшее evidence, сохраняемую audit provenance и право повторно использовать чувствительные сведения. Receipt не должен разрешать вечное хранение исходных данных.

## Запуск

~~~bash
python schemas/ecosystem/uu-society/v0.1/harness/run_temporal_verification.py --check-reference
python -m unittest discover -s schemas/ecosystem/uu-society/v0.1/harness -p test_temporal_verification.py -v
~~~

--output-dir PATH сохраняет полные calendar/authority receipts; --experiment T06-paired-false-assurance-duration выбирает один сценарий. Отдельная CI job paired-temporal-verification работает вместе с прежними suites и сохраняет 144 receipts в шестнадцати scenario files плюс summary.

