# UU-AAP Component Manifest v0.1 — краткая навигация

`Component Manifest v0.1` — первый инкремент reusable runtime/tooling substrate. Он описывает уже существующий компонент через machine-readable инженерный контракт и не изменяет его семантику.

Основные границы:

```text
Component Manifest != Release Registry
Dependency Edge != Authority Transfer
Declared Interface != Compatibility Proof
Manifest Validation != Runtime Attestation
Manifest Presence != Runtime Activation
Reusable Tooling != Stable-Core Promotion
```

Первый инкремент включает schema, read-only validator, template, conformance/import-safety tests и два независимых примера: `UU-AAP-Core` и `AI-Transport-Reference`.

Следующий путь:

```text
Component Manifest
-> Dependency / Impact Graph
-> Generated Conformance Runner
-> Receipt Runtime SDK
-> Implementation Substitution Assessment
```

Цель — уменьшать повторную реализацию hashing/frontier/dependency/CI tooling без создания нового смыслового Core primitive.
