# Matawaka / UU-AAP: итог работы и исследование рынка

Дата среза: 16 ноября 2026. Main: `7115ae5079fb201aaae9fb62305004fcf10deb07`.

## Итог работы и рынок близких продуктов

MATAWAKA / UU-AAP  |  Исследовательский срез: 16 ноября 2026

> **Вывод:** создан исполняемый исследовательский контур с воспроизводимыми отрицательными результатами. Рынок agent authorization и MCP governance уже насыщен базовыми механизмами. Коммерческое преимущество Matawaka пока является проверяемой гипотезой, а не установленным фактом.

Завершённая линия UU Society развивает три разные задачи: что известно об институциональной независимости; какое evidence разрешено искать дальше; как учитывать исходное время свидетельств и независимо возобновлять поиск. Текущий main: **7115ae5079fb201aaae9fb62305004fcf10deb07**. Слой v1.2 влит через PR #1040; при проверке подтверждены 19 успешных post-merge checks. [R01](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/uu-society-model.manifest.json)[R02](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/temporal_verification/README.ru.md)

| Подтверждённый результат | Практическое значение |
| --- | --- |
| v1.0: 14/14; v1.1: 32/32; v1.2: 16/16 | Разные suites проверяют разные механизмы; это не единая оценка качества института. |
| v1.2: 144 варианта; 52 claims поддержаны, 5 опровергнуты | Опровержения сохранены. Conformance не означает истинность всех гипотез. |
| 33 метода в двух модулях тестов v1.1/v1.2 | Проверены clocks, oracle separation, authority binding и сохранение бюджетов. |
| Реальный исторический merge #346 | Помимо симуляций есть ограниченный live acceptance; это не доказательство промышленного runtime. |

### Что обнаружено на рынке

- AWS документирует не только gate, но и temporal policies: сопоставление действий с историей, накопительные ограничения и single-use approval. [C01](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-temporal.html)[C02](https://aws.amazon.com/bedrock/agentcore/faqs/)

- Arcade, Aembit, Auth0 и Descope уже объединяют разные части identity, делегирования, credentials и управления tool access. [C04](https://docs.arcade.dev/en/operate)[C06](https://docs.descope.com/agentic-identity-hub)[C08](https://auth0.com/blog/auth0-for-ai-agents-generally-available/)[C10](https://docs.aembit-eng.com/user-guide/deploy-install/mcp-identity-gateway/)

- OneTrust заявляет runtime permission enforcement и revalidation. Поэтому считать весь GRC-рынок только пассивными реестрами некорректно. [C20](https://www.onetrust.com/solutions/ai-governance/agent-governance/)

**Рекомендуемая продуктовая гипотеза:** переносимый, независимо проверяемый пакет «конкретное полномочие - конкретное действие - наблюдаемый результат», интегрируемый с существующими IdP, шлюзом и policy engine. Нужность этого пакета покупателю ещё предстоит проверить.

География: международный B2B-рынок agent infrastructure. Метод: просмотрены первичные описания 18 решений/компонентов и стандарта W3C. Возможности поставщиков не испытывались; интервью, оферты и измерение willingness-to-pay не проводились. Несколько страниц одного поставщика не считаются независимыми подтверждениями. Неустановленная функция не объявляется отсутствующей.

## 1. Что именно завершено

Исследовательский результат, работающий пример и готовность продукта

| Слой | Проверяемый механизм | Фактический итог |
| --- | --- | --- |
| v0.8 / R00-R07 | Общие источники контроля и эффективный кворум | 8 структурных сценариев |
| v0.9 / D00-D09 | Фактический и наблюдаемый control graphs во времени | 10 сценариев capture/recovery |
| v1.0 / K00-K13 | Coverage, source independence, contradiction, TTL | 14/14 conform |
| v1.1 / V00-V31 | Bounded search, privacy/scope gates, search lease | 32/32; 96 policy receipts |
| v1.2 / T00-T15 | Одинаковые tapes, TTL 1/3/6, три policy, renewal | 16/16; 144 варианта |

Сильный результат этой линии - ограничения знания стали наблюдаемыми выходами модели. Отсутствие найденной зависимости не превращается в независимость; законная новая проверка не гарантирует истинность полученного evidence. [R01](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/uu-society-model.manifest.json)[R02](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/temporal_verification/README.ru.md)[R03](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/active_verification/README.ru.md)

| Результат v1.2 | Baseline / deadline / renewal |
| --- | --- |
| Новые поисковые действия | 39 / 15 / 28 |
| Отменённые запросы | 27 / 3 / 3 |
| False-assurance cycles | 5 / 5 / 10 |
| Capture-discovery cycles | 0 / 0 / 10 |
| Независимый renewal | 12 grants; 15 denials; review cost 27 |

Каждая policy здесь охватывает 48 вариантов и 480 одинаковых календарных ticks. Это сравнение механизмов на сконструированных мирах. Оно не измеряет качество реальных компаний и не доказывает лучший универсальный TTL. В парном T06 TTL 1/3/6 дал 0/1/4 false-assurance cycles при одном tape и нуле запросов. [R02](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/temporal_verification/README.ru.md)

### Что подтверждено вне синтетической модели

В архиве AI Gateway есть запись full_acceptance для одноразового merge PR #346 от 24.08.2026: exact head/base, approval, pre-action permit, последующие receipts. GitHub отдельно подтвердил merge commit **90d00fa14839bba287df6afb3b60730282934d32**, родителя и valid commit signature. Классификация full_acceptance относится к аудиту проекта; факт merge подтверждён внешним источником. [R04](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/experiments/ai-gateway-live-executor-v0.1/audit/full-acceptance.record.json)[R05](https://github.com/Matawaka/uu-aap/pull/346)

Граница готовности: в рассмотренном контуре есть schemas, runners, validators, reference contracts, dry-run harness и конкретный live acceptance. Эксплуатация общего промышленного gateway, SLA, платящие клиенты и полный актуальный Workbench runtime этим исследованием не подтверждены. Workbench и частные репозитории полностью не аудировались. [R06](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/protocols/integration/ai-gateway/v0.1/README.md)[R07](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/docs/workbench/README.md)

## 2. Gateways и исполнение действий

Ближайшие технические альтернативы: сравнивать нужно с ними

| Решение | Документированные / заявленные возможности | Значение для Matawaka |
| --- | --- | --- |
| AWS AgentCore Gateway + Policy | Внешний enforcement на tool boundary; Dogwood/Cedar; temporal history; сопоставление входов/выходов, order и cumulative rules. Single-use approval описан в FAQ. [C01](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-temporal.html)[C02](https://aws.amazon.com/bedrock/agentcore/faqs/) | Наиболее сильный baseline для проверки нашего action/lease lifecycle. Stateful-контроль уже существует. |
| Arcade | Actions runtime: user authorization, tool execution, contextual pre/post hooks, MCP gateways, audit и tool-run history; заявлены варианты self-hosted deployment. [C04](https://docs.arcade.dev/en/operate)[C05](https://www.arcade.dev/) | Прямой конкурент в сценарии «агент действует в бизнес-системах». Одной прослойки перед tool call недостаточно для отличия. |
| agentgateway | CEL authorization для HTTP/LLM/MCP; matching по claims и tool names. Отдельно описаны LLM spend limits по ключам. [C13](https://agentgateway.dev/docs/kubernetes/latest/documentation/security/authorization/)[C14](https://agentgateway.dev/docs/standalone/latest/documentation/llm/cost-controls/budget-limits/) | База для интеграции либо альтернатива самостоятельному proxy. Денежный LLM budget не равен privacy/intrusion budget. |
| Kong AI Gateway | OAuth и другие auth plugins, MCP tool access controls, traffic policies, MCP audit logs и metrics. [C15](https://developer.konghq.com/mcp/) | Предприятие может расширить уже установленный gateway вместо покупки ещё одного. |
| Gravitee AI Gateway | LLM/MCP/A2A traffic, method/resource controls, delegated on-behalf-of chains, связанная OTel telemetry и policy decisions. [C16](https://www.gravitee.io/platform/ai-gateway) | Provider-neutral governance и прослеживаемые delegation chains уже входят в конкурентное поле. |
| Pomerium | Identity-aware MCP gateway; upstream OAuth, per-tool authorization, credential injection и request-level observability. [C17](https://www.pomerium.com/docs/capabilities/mcp) | Сильная альтернатива для безопасного доступа к внутренним MCP без передачи backend credentials клиенту. |

> Нельзя продавать как уникальность сами по себе: «gate перед агентом», scope, срок действия доступа, audit log, связь с identity или история действий. Для этих механизмов найдены прямые первичные аналоги.

Сценарий будущего benchmark: одинаковый tool, одинаковые разрешения и adverse cases, одинаковая базовая инфраструктура. Сравнивать Matawaka только с незащищённым прямым API-доступом недостаточно для вывода о рыночном преимуществе.

## 3. Identity, credentials и делегирование

Часть конкурентов также может стать интеграционными партнёрами

| Решение | Подтверждённое по первичным страницам | Коммерческий смысл |
| --- | --- | --- |
| Auth0 for AI Agents | Authentication, Token Vault, Asynchronous Authorization/CIBA и FGA for RAG. Human approval выделен в отдельный механизм, а не заменён хранением токенов. [C08](https://auth0.com/blog/auth0-for-ai-agents-generally-available/) | Не строить собственный IdP только ради агента. Проверять, что именно добавляет наш receipt поверх существующего approval flow. |
| Descope Agentic Identity Hub | Short-lived scoped credentials, runtime context, Resources/Connections и policies. В документации отдельный Agent Gateway помечен Early access. [C06](https://docs.descope.com/agentic-identity-hub) | Близкое пересечение с scoped delegation. Статус конкретной gateway-функции нужно отличать от статуса всей identity-платформы. |
| Aembit MCP Identity Gateway | Проверка tokens/policy на запросах, изоляция downstream credentials, identity-aware MCP traffic и audit. [C10](https://docs.aembit-eng.com/user-guide/deploy-install/mcp-identity-gateway/) | Credential isolation и per-request access уже являются продаваемыми функциями. Нужен совместимый evidence layer. |
| Astrix Agent Control Plane | Least-privilege profiles, short-lived precisely scoped credentials, lifecycle/ownership и activity trail; отдельно discovery агентов/NHI. [C11](https://astrix.security/product/deploy-and-provisions-ai-agent-discovery/) | Покупатель security может предпочесть общий NHI control plane отдельному протокольному шлюзу. |
| Microsoft Entra Agent ID | Выделенная agent identity и framework авторизации, централизованное управление доступом к сервисам/API. [C12](https://learn.microsoft.com/en-us/entra/agent-id/authorization-agent-id) | Сильный путь для организаций с существующим Entra. Мы не проверяли весь Agent 365 и его коммерческие условия. |
| Composio | Session связывает пользователя, connected accounts, доступные tools и execution state. OAuth scopes настраиваются через auth config. [C18](https://docs.composio.dev/reference/api-reference/tool-router)[C19](https://docs.composio.dev/docs/authentication/controlling-scopes) | Конкурирует за developer adoption и стоимость интеграций. Часть scope recommendation API отмечена experimental. |

Это разные точки внедрения. Identity-платформа отвечает за субъекта и credentials, gateway - за enforcement, tool runtime - за исполнение, а переносимый receipt может связывать их. Возможность совместной работы не доказана описанием интерфейсов: нужен конкретный интеграционный pilot.

Для каждого поставщика отдельно проверить token/session lifetime, propagation revocation, объект approval, гарантии at-most-once, экспорт audit evidence и retention. Наличие OAuth само по себе не отвечает на все эти вопросы; отсутствие отдельной страницы не доказывает отсутствие функции.

## 4. Governance и доступные строительные блоки

Конкурировать приходится и с платформой, и с вариантом build-it-yourself

| Решение | Что уже есть | Граница сравнения |
| --- | --- | --- |
| OneTrust AI Agent Governance | Поставщик заявляет registration scope, runtime permission enforcement, Guardian monitoring, delegated handoffs, audit evidence и revalidation. [C20](https://www.onetrust.com/solutions/ai-governance/agent-governance/) | Не считать весь GRC только пассивными документами. Заявления нужно проверить по конкретным connectors и deployment. |
| Credo AI | Evidence retrieval, registry, risk workflows, approval gates и trace evaluation. На рассмотренной странице часть integration enforcement прямо помечена planned. [C21](https://www.credo.ai/product) | Ближе к governance process и evidence workflows. Planned нельзя автоматически считать готовым inline enforcement. |
| Cerbos | PDP, policy/context management, decision audit; cerbosCallId связывает решение с app log. [C22](https://www.cerbos.dev/how-it-works)[C23](https://docs.cerbos.dev/cerbos/latest/configuration/audit.html) | Большую часть authorization logic можно собрать на готовом engine; прикладная интеграция остаётся отдельной работой. |
| Open Policy Agent | Decision logs содержат policy query, input и bundle metadata; доступны plugin/HTTP пути экспорта. [C25](https://www.openpolicyagent.org/docs/management-decision-logs) | Просто записывать «почему allow/deny» - недостаточное отличие. Проверяемый outcome chain нужно показать дополнительно. |
| OpenFGA | Conditional relationship tuples поддерживают grant timestamp + duration и deny вне временного окна. [C26](https://openfga.dev/docs/modeling/conditions) | Сами relation graph и временный доступ не являются новыми примитивами UU-AAP. |
| Eclipse Biscuit | Capability token, публичная проверка, offline attenuation, логические ограничения и expiry. [C27](https://www.biscuitsec.org/docs/why-biscuit/) | Scoped lease и нерасширяемое делегирование имеют существующие технические основания. Не следует заявлять изобретение capability security. |

W3C VC 2.0 отдельно задаёт сроки validFrom/validUntil и прямо разделяет проверяемость credential и истинность содержащихся claims. Наше правило «verifiable не означает true» важно, но не уникально как общий принцип. [C28](https://www.w3.org/TR/vc-data-model-2.0/)

> В рассмотренных страницах не подтверждён готовый эквивалент всей UU Society-модели source-control independence + bounded evidence acquisition + independent renewal. Это ограниченный результат desk research, а не доказательство отсутствия аналогов или патентной новизны.

## 5. Где искать реальное отличие

Исследовательский вклад нужно превратить в проверяемую пользовательскую пользу

| Механизм | Состояние и конкуренция | Допустимое утверждение |
| --- | --- | --- |
| Scopes, временный доступ, audit | Уже есть у нескольких классов решений. | Рыночная база, а не самостоятельный moat. |
| Temporal action policy и one-shot approval | Документированы у AWS; есть reusable primitives. [C01](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-temporal.html)[C02](https://aws.amazon.com/bedrock/agentcore/faqs/) | Нужно прямое сравнение семантики, не заявление «только у нас». |
| Точная связка permit / target / predecessor / observed successor | Есть UU-AAP contract и historical acceptance. [R04](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/experiments/ai-gateway-live-executor-v0.1/audit/full-acceptance.record.json)[R06](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/protocols/integration/ai-gateway/v0.1/README.md) | Полезная демонстрация; преимущество относительно vendor tooling ещё не измерено. |
| Переносимый пакет доказательств с независимым verifier | Проектная гипотеза интеграционного продукта. | Проверить offline verification, экспорт, privacy redaction и устойчивость после смены провайдера. |
| Source count != independent support; evidence clocks | Реализовано в экспериментальном UU Society. [R01](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/uu-society-model.manifest.json)[R02](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/temporal_verification/README.ru.md) | Исследовательское отличие модели. Нужны реальные provenance data и покупательская задача. |
| Bounded search и independent renewal | В симуляции сохраняются бюджеты/scope; возможны false assurance и review bottleneck. [R02](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/temporal_verification/README.ru.md)[R03](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/active_verification/README.ru.md) | Ограничение полномочия на поиск, не сертификат истинной независимости. |
| Purpose-bounded retention / evidence reuse | Предложено следующим слоем; в v1.2 не реализовано. | Не включать в перечень уже доступных продуктовых функций. |

### Предлагаемый первый продукт

**Matawaka Authority Evidence Layer для consequential GitHub/MCP actions.** Поверх имеющегося IdP и gateway он проверяет точное основание перед действием и собирает минимальный проверяемый пакет после действия. Первая поверхность: один тип GitHub merge, один repo, один approval/permit lifecycle; затем один корпоративный MCP tool.

UU-AAP остаётся протоколом/семантикой. Matawaka - предлагаемой реализацией и интеграцией. UU Society - исследовательской лабораторией, проверяющей ограничения модели. Такое разделение снижает путаницу: текущий root README прежде всего описывает authorship, тогда как покупатель agent security ищет контроль внешнего эффекта. [R08](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/README.md)

Потенциальная защита продукта - integrations, независимый verifier, качественная adversarial corpus и экономия времени расследования. Само количество schemas, инвариантов и пройденных fixtures не устанавливает рыночную защиту.

## 6. Покупатель, коммерческие ориентиры и риски

Цены ниже - факты страниц; готовность платить за Matawaka пока неизвестна

| Решение | Публичный ориентир на 16.11.2026 | Что нельзя из него выводить |
| --- | --- | --- |
| Descope | Pro от $249/мес.; Growth от $799/мес.; billed annually, возможны usage overages. [C07](https://www.descope.com/pricing) | Это не фиксированная цена любой agentic deployment и не оценка стоимости нашего продукта. |
| Cerbos Hub | Development от $25/мес.; Production от $933/мес.; principals и план влияют на расчёт. PDP отдельно доступен free. [C24](https://www.cerbos.dev/pricing) | Не эквивалент готового корпоративного gateway и его интеграционных работ. |
| AWS AgentCore | Gateway тарифицирует операции; Policy - authorization requests и отдельные authoring usage components. [C03](https://aws.amazon.com/bedrock/agentcore/pricing/) | Конкретная ставка и полный TCO зависят от конфигурации. Динамическую числовую таблицу в этом срезе не фиксировали. |
| Auth0 | AI features зависят от плана/add-ons; CIBA, Token Vault и Auth for MCP представлены раздельно. [C09](https://auth0.com/pricing) | Базовая стоимость identity-плана не гарантирует включение нужного approval flow. |

Enterprise-котировки остальных поставщиков не получены. Публичные цены - ориентиры покупки отдельных компонентов; напрямую нормализовать их в «цену за безопасное действие» нельзя. Наличие free/низкого entry tier усиливает требование доказать ценность интеграции, а не ещё одного proxy.

### Кому предлагать первым - гипотеза ICP

- Platform/AI Infrastructure teams, уже подключающие агентов к GitHub и внутренним MCP, которым нужен воспроизводимый incident review.

- AppSec/Security Architecture как согласующий участник: проверяет обходы, credential exposure, scope, revocation и минимизацию evidence.

- Engineering leader как владелец пилота: выбирает один consequential workflow и оценивает накладные расходы.

Продажная формулировка: «Для конкретного действия покажем связанное основание разрешения и наблюдаемый эффект, чтобы incident review не собирал картину вручную из разрозненных журналов». Это предлагаемая ценность, не уже измеренная экономия.

Не оценивали TAM/SAM и рыночную выручку этого узкого сегмента: доступные описания смешивают IAM, API gateways, agent runtime и GRC. Складывать размеры этих рынков или подменять их числом агентов было бы необоснованно. Bottom-up оценка возможна после выбора ICP, получения нескольких оферт и первых paid pilots.

## 7. Следующий шаг: сравнительный пилот

Предложение плана; интервью и переговоры в рамках исследования не запускались

### Четыре недели, один workflow

| Срок | Работа | Результат для решения |
| --- | --- | --- |
| Неделя 1 | 8-12 проблемных интервью; выбрать до 3 design partners; установить их текущий stack. | Кто владеет бюджетом, какой incident/audit workflow действительно дорог. |
| Неделя 2 | Выбрать один сильный baseline: AWS Policy либо Arcade/agentgateway + policy engine. Согласовать сценарии и критерии заранее. | Зафиксированный comparison protocol и целевая операция. |
| Неделя 3 | Один sandbox GitHub/MCP adapter, exact target, минимальный receipt export и независимая проверка пакета. | Повторяемая демонстрация с разрешёнными и запрещёнными попытками. |
| Неделя 4 | Измерить audit reconstruction, overhead, review cost и ценность portable evidence; обсудить ограниченный paid pilot. | Решение продолжать продукт, сузить до компонента или остановить гипотезу. |

### Сценарии сравнения с поставщиками

- Approval выдан для другого repo/PR/head или устарел между оценкой и исполнением.

- Повторное и конкурентное использование одноразового разрешения; проверить атомарность consumption.

- Renewal сохраняет общий бюджет между leases и не расширяет scope.

- Новый token не освежает старое source evidence; два зависимых источника не становятся независимой corroboration.

- Поиск исчерпан при uncertainty: корректный indeterminate без adverse verdict и без скрытого расширения.

- Экспорт проверяемого пакета после смены провайдера; минимизация/редакция чувствительного payload.

Метрики: покрытие consequential actions цепочкой pre-action permit/post-action evidence; доля заблокированных adverse vectors до эффекта; время восстановления основания решения; p50/p95 overhead отдельно от human waiting; ручные часы review; размер и срок хранения чувствительного evidence. Пороговые значения согласовать до измерений.

> Условие продолжения: клиент подтверждает проблему, выделяет владельца и предоставляет реальный сигнал готовности платить за конкретное преимущество над baseline. Если текущий stack решает задачу без существенной дополнительной работы, гипотезу следует сузить до verifier/test suite/integration, сохранив отрицательный результат.

## Источники и границы доказательства

Источники проверены 16.11.2026. Официальные страницы подтверждают, что поставщик документирует или заявляет функцию; они не заменяют независимую проверку исполнения, SLA или наличия функции в конкретном контракте. Несколько страниц одной организации не создают независимую corroboration.

- **R01** [UU Society: current manifest](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/uu-society-model.manifest.json) - Репозиторий, experimental status и результаты.

- **R02** [Temporal verification v1.2: RU findings](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/temporal_verification/README.ru.md) - Репозиторий, методика и ограничения.

- **R03** [Active verification v1.1: RU findings](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/schemas/ecosystem/uu-society/v0.1/active_verification/README.ru.md) - Репозиторий, bounded search.

- **R04** [Live acceptance: full record](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/experiments/ai-gateway-live-executor-v0.1/audit/full-acceptance.record.json) - Архив проекта; оценка full_acceptance принадлежит проекту.

- **R05** [GitHub PR #346: historical live action](https://github.com/Matawaka/uu-aap/pull/346) - GitHub независимо подтверждает сам merge.

- **R06** [AI Gateway v0.1 contract](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/protocols/integration/ai-gateway/v0.1/README.md) - Экспериментальный контракт и non-effects.

- **R07** [Workbench external implementation frontier](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/docs/workbench/README.md) - Ограниченный архив внешней реализации.

- **R08** [UU-AAP root README](https://github.com/Matawaka/uu-aap/blob/7115ae5079fb201aaae9fb62305004fcf10deb07/README.md) - Текущее публичное позиционирование.

- **C01** [AWS: temporal policies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-temporal.html) - Техническая документация.

- **C02** [AWS: AgentCore FAQs](https://aws.amazon.com/bedrock/agentcore/faqs/) - Описание temporal controls, single-use approval и policy engine.

- **C03** [AWS: AgentCore pricing](https://aws.amazon.com/bedrock/agentcore/pricing/) - Публичная модель тарификации.

- **C04** [Arcade: operations and governance](https://docs.arcade.dev/en/operate) - Техническая документация; обновлена 13.11.2026.

- **C05** [Arcade: actions runtime](https://www.arcade.dev/) - Описание продукта; hooks, execution, deployment.

- **C06** [Descope: Agentic Identity Hub](https://docs.descope.com/agentic-identity-hub) - Техническая документация; Gateways отмечены Early access.

- **C07** [Descope: pricing](https://www.descope.com/pricing) - Публичный прайс; annual billing и overages.

- **C08** [Auth0: AI Agents GA](https://auth0.com/blog/auth0-for-ai-agents-generally-available/) - Официальное объявление и компоненты.

- **C09** [Auth0: pricing](https://auth0.com/pricing) - Публичная матрица планов и AI add-ons.

- **C10** [Aembit: MCP Identity Gateway](https://docs.aembit-eng.com/user-guide/deploy-install/mcp-identity-gateway/) - Техническая документация.

- **C11** [Astrix: Agent Control Plane](https://astrix.security/product/deploy-and-provisions-ai-agent-discovery/) - Заявленные возможности продукта.

- **C12** [Microsoft: authorization in Entra Agent ID](https://learn.microsoft.com/en-us/entra/agent-id/authorization-agent-id) - Техническая документация.

- **C13** [agentgateway: authorization](https://agentgateway.dev/docs/kubernetes/latest/documentation/security/authorization/) - Документация latest.

- **C14** [agentgateway: budget and spend limits](https://agentgateway.dev/docs/standalone/latest/documentation/llm/cost-controls/budget-limits/) - LLM бюджеты, не privacy cost.

- **C15** [Kong: MCP traffic gateway](https://developer.konghq.com/mcp/) - Техническая документация.

- **C16** [Gravitee: AI Gateway](https://www.gravitee.io/platform/ai-gateway) - Заявленные возможности продукта.

- **C17** [Pomerium: MCP support](https://www.pomerium.com/docs/capabilities/mcp) - Техническая документация.

- **C18** [Composio: sessions](https://docs.composio.dev/reference/api-reference/tool-router) - Техническая документация; бывший Tool Router.

- **C19** [Composio: controlling scopes](https://docs.composio.dev/docs/authentication/controlling-scopes) - Техническая документация; часть рекомендаций experimental.

- **C20** [OneTrust: AI Agent Governance](https://www.onetrust.com/solutions/ai-governance/agent-governance/) - Заявленные runtime и revalidation возможности.

- **C21** [Credo AI: product](https://www.credo.ai/product) - Заявления продукта; часть enforcement integration помечена planned.

- **C22** [Cerbos: how it works](https://www.cerbos.dev/how-it-works) - Описание архитектуры PDP/Hub/context.

- **C23** [Cerbos: audit logs](https://docs.cerbos.dev/cerbos/latest/configuration/audit.html) - Техническая документация; cerbosCallId.

- **C24** [Cerbos: pricing](https://www.cerbos.dev/pricing) - Публичные цены от указанного минимума.

- **C25** [OPA: decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) - Техническая документация.

- **C26** [OpenFGA: conditions](https://openfga.dev/docs/modeling/conditions) - Стабильная документация: временные conditional grants.

- **C27** [Eclipse Biscuit: capability tokens](https://www.biscuitsec.org/docs/why-biscuit/) - Делегирование, offline attenuation и expiry.

- **C28** [W3C VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/) - Стандарт: validity и verifiability != truth.
