# Core Pilot 003 — Bounded Multi-Agent Delegation without Authority Amplification

**Status:** specification / synthetic pre-execution  
**Related:** Issue #426  
**Origin frontier:** `a95bd7371d29335e6061b529ab7b9078628ad120`

## Purpose

Test whether authority can cross a multi-agent coordination chain without being silently amplified.

```text
Human authority
  -> bounded delegation to Agent A
  -> coordination / CCRP
  -> narrower delegation to Agent B
  -> action gate
  -> outcome / provenance
  -> successor state
```

The pilot's central invariant is:

`child authority ⊆ parent authority`

A child delegation may preserve or narrow authority. It MUST NOT add effects, resources, duration, redelegation rights, or successor authority that its parent did not possess.

## Non-equivalences

```text
capability != authority
coordination != authority creation
receipt possession != right to redelegate
successful prior action != authority for next action
successful outcome != successor permit
```

## Delegation model

Each delegation receipt binds:

- a unique receipt id;
- an explicit parent receipt, except the human-root receipt;
- delegator and delegate role identifiers;
- exact repository/resource scope;
- allowed effects;
- forbidden effects;
- expiry boundary;
- single-use semantics;
- whether redelegation is explicitly allowed;
- the maximum depth still available.

A verifier MUST reject a child if any authority dimension exceeds its parent.

## Pilot chain

The synthetic positive fixture uses three receipts:

1. `human-root` — human-authorized root with bounded read/prepare/validate capability and explicit permission for one level of redelegation;
2. `agent-a` — narrower child: research and prepare only, with one remaining redelegation level;
3. `agent-b` — terminal child: validate prepared material only, no redelegation.

No receipt authorizes merge, push, issue mutation, release/tag creation, permission changes, KONTUR effects, or creation of a successor permit.

## Fail-closed requirements

Validation MUST reject at least:

- added child effect;
- expanded resource/path scope;
- extended expiry;
- weakened single-use constraint;
- forbidden effect removed or converted to allowed;
- missing parent lineage;
- redelegation without parent permission;
- redelegation depth increase;
- coordination evidence used as authority source;
- previous success used as authority source;
- target frontier/resource substitution;
- outcome treated as a new permit.

## Execution boundary

This specification and its synthetic fixtures do not delegate authority to a real agent and do not authorize external execution.

A future real Run 001 requires a separately materialized human-root permit and a separately chosen low-risk task. Merging this specification is not that permit.
