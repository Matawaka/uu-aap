# C2PA interoperability coordination for UU VERIFIED v0.1

**Status:** additive clarification for PR #1001; non-normative; no issuance or implementation authority.  
**Related:** #777, #999.  
**Effective design baseline for UV-02 interoperability work:** **C2PA Technical Specification 2.4**.

## English

This note resolves an interoperability/version mismatch in the initial UU VERIFIED v0.1 proposal without changing its assurance architecture.

The C2PA 2.2 reference in section 8 of `README.md` / `README.ru.md` is retained only as an earlier design-reference snapshot. It is **not** the effective baseline for successor UU VERIFIED interoperability work.

For UV-02 and later C2PA-facing work:

- use **C2PA 2.4** as the current profile baseline already established by the #777 / #999 interoperability line;
- prefer standard `c2pa.external-reference` as the first binding path for external UU-AAP / PoAI evidence;
- do **not** require or imply a dedicated UU-AAP C2PA assertion namespace unless a concrete interoperability requirement cannot be satisfied with established C2PA mechanisms;
- describe cross-SDK uncertainty precisely: preservation of referenced UU-AAP / PoAI evidence and unknown C2PA fields across relevant producer/consumer/adapter paths is **not yet universally established**;
- do not convert tolerant parsing into a preservation claim;
- preserve the semantic boundaries from #777/#999: provenance does not become permission, repository receipt does not become truth/review/authorization, cryptographic integrity does not become epistemic truth, and AI disclosure does not become decision or publication authority.

Accordingly, the phrase in the initial proposal suggesting that SDKs may not preserve "UU-AAP assertions" must not be read as establishing such an assertion class. The current interop posture is standard C2PA mechanisms first, with external evidence referenced and independently verifiable.

This coordination note makes #999 the current C2PA interoperability posture referenced by the UU VERIFIED proposal. It does not import #999 into the UU VERIFIED conformance criteria automatically; any normative dependency belongs in a separately reviewed UV-02 profile/schema.

## Русский

Эта запись устраняет расхождение версии/терминологии C2PA в исходном предложении UU VERIFIED v0.1, не меняя архитектуру подтверждения соответствия.

Ссылка на **C2PA 2.2** в разделе 8 `README.md` / `README.ru.md` сохраняется только как более ранняя точка проектного обзора. Для последующей работы UV-02 и C2PA-интеграции действующей проектной базой считается **C2PA 2.4**, согласованная с линией #777 / #999.

Для дальнейшей интеграции:

- первый предпочтительный путь привязки внешних записей UU-AAP / PoAI — стандартный `c2pa.external-reference`;
- отдельное пространство C2PA assertions для UU-AAP не требуется и не подразумевается, пока не доказана конкретная необходимость, которую нельзя закрыть стандартными средствами C2PA;
- корректная формулировка ограничения SDK: меж-SDK сохранение ссылочных UU-AAP / PoAI доказательств и неизвестных полей C2PA на соответствующих путях producer/consumer/adapter пока не подтверждено универсально;
- терпимый разбор неизвестных данных не считается доказательством их сохранения;
- сохраняются границы #777/#999: происхождение не становится разрешением, repository receipt не становится истиной/ревью/полномочием, криптографическая целостность не становится эпистемической истинностью, а AI disclosure не становится полномочием на решение или публикацию.

Фраза исходного proposal про сохранение «UU-AAP assertions» поэтому не создаёт новый класс assertion. Текущая позиция: сначала стандартные механизмы C2PA, внешние доказательства — через ссылочную криптографическую привязку и независимую проверяемость.

## Non-effects

This clarification does not change `SPEC.md`, `PRINCIPLES.md`, Stable Core, PoAI, CCRP, Profile V, cryptography, trust infrastructure, issuer policy, runtime, ActionPermit semantics, production authority, or any historical receipt. It does not declare C2PA conformance for UU VERIFIED and does not authorize a mark or merge.
