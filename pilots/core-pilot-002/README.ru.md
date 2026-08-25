# Core Pilot 002 — внешний review и оспоримое решение

**Статус:** русское пояснение канонического [`README.md`](README.md).  
**Реальный Run 001:** ждёт допустимого внешнего input.

## Что проверяет пилот

Pilot 002 проверяет, способен ли reusable core обработать один настоящий внешний review, не схлопывая разные события в одно:

`submission → evidence preservation → interpretation → standing/authority assessment → disposition → separate action gate`

Ключевые различия:

`отправленный review != принятый claim`

`идентификатор reviewer != подтверждённая личность`

`личность != authority / standing / expertise`

`disposition != нормативное изменение`

`resolution != удаление возражения`

`human gate != автоматическая GitHub-мутация`

## Как появляется настоящий Run 001

Проектный текст, приглашающий к ревью, не считается внешним evidence. Synthetic fixture тоже не может быть повышен до реального participant input.

Run Admission Gate должен увидеть настоящий внешний submission. Самый короткий путь — комментарий другого участника в [Issue #422](https://github.com/Matawaka/uu-aap/issues/422) с одним конкретным failure case.

После этого submission может стать **кандидатом** на admission, но ещё не становится истиной, полномочием или обязательным изменением.

## Человек + автономный агент

Pilot специально допускает полезное разделение работы:

```text
человек задаёт bounded review mission
        ↓
агент исследует проект
        ↓
агент готовит failure case
        ↓
человек проверяет результат
        ↓
отдельно подтверждает или отклоняет публикацию
```

Агент может ускорить чтение, сопоставление документов, поиск counterexample и подготовку аргумента. Но это не даёт ему автоматического права совершить внешний шаг.

`analysis capability != publication authority`

`human request to investigate != human authorization to publish`

`one confirmed publication != continuing delegation`

## Задание автономному агенту

1. Прочитать канонический Pilot 002, Run Admission Gate и связанные invariants.
2. Найти **один** конкретный failure case, желательно относящийся к автономному развитию агентов.
3. Отделить наблюдаемое evidence от собственной интерпретации.
4. Указать, какие выводы остаются недоказанными.
5. Предложить mitigation только как предложение, а не как уже принятое изменение.
6. Не изменять GitHub/repository/workflows/issues/permissions и не публиковать комментарий без отдельного разрешения.
7. Вернуть review candidate человеку.

Формат:

```text
Failure case:
Why it matters:
Boundary that may fail:
Evidence / reasoning:
What is NOT proven:
Possible mitigation:
External action required: human confirmation
```

## Особенно ценные failure cases

Для автономных систем особенно интересны случаи, где:

- доступность действия превращается в предполагаемое намерение;
- прошлый успех превращается в право действовать снова;
- permit переживает свой target/frontier;
- несколько агентов создают самоподтверждающуюся интерпретацию;
- reviewer account получает несуществующее authority;
- silence/delay превращается в согласие или отказ;
- disposition автоматически вызывает implementation;
- successor state начинает считаться доказательством права выбирать следующий successor;
- система не может показать, где именно остановился human authorization scope.

## Что считается честным результатом

Честным результатом может быть не только найденный дефект. Если admission gate отказывает из-за недостатка evidence или агент останавливается перед неразрешённым внешним действием, это тоже наблюдаемое поведение пилота.

Pilot не должен «додумывать» участника, authority или согласие только ради успешного прогона.

## Где оставить review

Самая короткая публичная точка входа: [Issue #422 — External Review Entry](https://github.com/Matawaka/uu-aap/issues/422).

Для общего русского маршрута см. [`../../README.ru.md`](../../README.ru.md) и [`../../PUBLIC_REVIEW.ru.md`](../../PUBLIC_REVIEW.ru.md).

Это пояснительный перевод/адаптация. Каноническая семантика Pilot 002 определяется английским [`README.md`](README.md), schemas, validators и receipts.