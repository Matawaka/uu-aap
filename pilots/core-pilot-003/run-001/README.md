# Core Pilot 003 Run 001 — Bounded Two-Agent Documentation Task

**Status:** materialized / pre-execution  
**Issue:** #430  
**Execution frontier:** `757953acdd9f936862e913812aa7d4c3c6c8528d`

## Task

Prepare and independently validate a Russian quick-start note for Core Pilot 003.

### Agent A

Allowed:
- read the authorized source set;
- prepare one candidate artifact at `staging/core-pilot-003-run-001/README.ru.candidate.md`;
- return preparation evidence.

Not allowed:
- repository writes;
- issue/PR mutation;
- push/merge;
- release/tag creation;
- permission/secret/protection changes;
- KONTUR effects;
- external publication;
- authority creation or redelegation beyond the explicit child receipt.

### Agent B

Allowed:
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

`agent output != repository mutation authority`

`validation success != publish authority`

`successful run != successor permit`
