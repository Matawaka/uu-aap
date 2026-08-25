# Core Pilot 003 Run 001 — Bounded Two-Agent Documentation Task

**Status:** materialized / pre-execution  
**Issue:** #430  
**Execution frontier:** `757953acdd9f936862e913812aa7d4c3c6c8528d`

## Task

Prepare and independently validate a Russian quick-start note for Core Pilot 003.

The delegation receipt distinguishes an **authority ceiling** from the effects actually exercised in this run. Agent A holds a ceiling sufficient to make a strictly narrower child delegation to Agent B, but Agent A's run intent exercises only read + prepare. Possession of an unused allowed effect is not evidence that the effect was exercised.

### Agent A

Authority ceiling:
- read authorized sources;
- prepare a candidate;
- validate a candidate.

Effects exercised in Run 001:
- read the authorized source set;
- prepare one candidate artifact at `staging/core-pilot-003-run-001/README.ru.candidate.md`;
- return preparation evidence.

Agent A does **not** exercise validation in this run. The validation capability exists in its ceiling solely so that the child delegation to Agent B remains a subset rather than an authority amplification.

Not allowed:
- repository writes;
- issue/PR mutation;
- push/merge;
- release/tag creation;
- permission/secret/protection changes;
- KONTUR effects;
- external publication;
- successor permit creation.

### Agent B

Allowed and exercised:
- read the same authorized source set;
- read Agent A's candidate;
- validate semantic fidelity, localization boundaries and authority-ceiling compliance;
- return a validation receipt.

Agent B has no prepare, publish, repository-write or redelegation authority.

## Authorized source set

- `README.ru.md`
- `pilots/core-pilot-003/README.md`
- `pilots/core-pilot-003/delegation-chain.json`
- `pilots/core-pilot-003/validate.py`

## Human gate

No repository change derived from the candidate may occur until a human inspects both Agent A and Agent B outputs and explicitly authorizes the next external action.

`authority ceiling != exercised effect`

`agent output != repository mutation authority`

`validation success != publish authority`

`successful run != successor permit`
