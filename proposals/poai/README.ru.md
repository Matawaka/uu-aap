# Proof of Available Intelligence (PoAI)

**Genesis Proposal v0.0 · машинный слой v0.0.1**  
**Статус:** экспериментальное исследовательское предложение; не является частью нормативного соответствия UU-AAP v0.1.

> **Какой релевантный интеллект действительно был доступен этому решению до того, как решение стало историей?**

PoAI описывает не «уровень ума» человека или модели, а практическую доступность человеческого, машинного, институционального и документального интеллекта относительно конкретного решения и конкретной временной границы.

Ключевые различия:

`доступность != использование != полномочие != ответственность`

и:

`доказательство != истина`

## Самый короткий маршрут

1. [`PRINCIPLES.md`](PRINCIPLES.md) — исходные ограничения.
2. [`CONCEPT.md`](CONCEPT.md) — философская и протокольная модель.
3. [`examples/vibe-coding-reality.poai.json`](examples/vibe-coding-reality.poai.json) — первый реальный исторический пример.
4. [`examples/quasi-existent-future.synthetic.poai.json`](examples/quasi-existent-future.synthetic.poai.json) — синтетическое прогнозируемое событие.
5. [`examples/quasi-existent-future.synthetic.successor.poai.json`](examples/quasi-existent-future.synthetic.successor.poai.json) — successor record после вмешательства.
6. [`schema/poai-record.schema.json`](schema/poai-record.schema.json) — JSON Schema.
7. [`tools/validate_poai.py`](tools/validate_poai.py) — проверка основных инвариантов.

## Быстрая проверка

Из корня репозитория:

```bash
python proposals/poai/tools/validate_poai.py \
  proposals/poai/examples/vibe-coding-reality.poai.json
```

Для полной структурной проверки по JSON Schema:

```bash
python -m pip install "jsonschema>=4.22,<5"
python proposals/poai/tools/validate_poai.py \
  --schema proposals/poai/schema/poai-record.schema.json \
  proposals/poai/examples/vibe-coding-reality.poai.json
```

Набор тест-векторов:

```bash
python proposals/poai/tools/validate_poai.py \
  --test-vectors proposals/poai/test-vectors
```

## Почему второй пилот синтетический

Первый пример связан с реальным UU-AAP-пилотом «Вайбкодинга реальности».

Второй пример специально сделан синтетическим, чтобы не выдавать придуманные события за реальные доказательства. Его задача — проверить более широкий случай:

`будущее событие → доступный прогноз → решение → вмешательство → несостоявшееся событие → successor record`

Это позволяет проверить принцип:

> Несостоявшееся после вмешательства событие не должно автоматически превращать исходное предупреждение в «ложное».

## Что PoAI пока не делает

PoAI не:

- определяет юридическую ответственность;
- доказывает истинность прогноза;
- присваивает универсальный рейтинг интеллекта;
- требует полного prompt history;
- требует blockchain;
- делает доступность знания автоматическим основанием наказания.

## Где обсуждать

Основная публичная RFC-дискуссия PoAI Genesis:

**[RFC: PoAI Genesis — Proof of Available Intelligence v0.0 — Discussion #10](https://github.com/Matawaka/uu-aap/discussions/10)**

Архитектурные альтернативы, контрпримеры и предложения по развитию PoAI лучше обсуждать там. Конкретные воспроизводимые дефекты схемы, валидатора или реализации лучше оформлять через Issues репозитория.

Пока PoAI остаётся исследовательским слоем внутри `uu-aap`. Выделение в отдельный репозиторий имеет смысл после нескольких независимых пилотов и стабилизации схемы.
