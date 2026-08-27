# DLC-SI v0.1 — Dual-Legitimacy Contention under a Singular Interface

**Status:** experimental core protocol slice  
**Tracking:** Issue #526  
**Origin frontier:** `2c1d8a32844528633ed0778f4bb8d1da86ac7c15`  
**Origin tree:** `4798b0f1b1cad3867e3875ea5b1e63c642a550c9`

## Purpose

DLC-SI v0.1 represents the case where two legitimate claims remain valid while one
shared interface can expose only one actionable candidate at a time.

The first slice deliberately does **not** decide which claim is normatively true.
It records contention, validates an explicitly supplied resolution mode, preserves
the non-selected legitimacy, and emits a deterministic `ContestedActionReceipt`.

```text
Legitimacy != Priority
Precedence != Victory
Selection != Erasure
Interface Singularity != Normative Singularity
ContestedActionReceipt != ActionPermit
```

DLC-SI is designed to extend existing CCRP semantic-conflict evidence. Existing
conflict records may be bound through opaque `source_conflict_refs`; this profile
does not reimplement the historical CCRP detector.

## First-slice chain

```text
PriorityClaim x SharedInterfaceDescriptor
  -> InterfaceContention
  -> TEMPORARY_PRECEDENCE | DEFERRED | UNRESOLVED
  -> ContestedActionReceipt
  -> downstream Action Gate / later RevisitTrigger
```

This slice intentionally avoids a generalized policy engine.

## Canonical first-slice invariants

- both claims carry independent `legitimacy_ref` values;
- exactly one singular interface is modeled with `output_capacity = 1`;
- the first slice requires `claim_relation = INCOMPARABLE`;
- incompatible successor states remain explicit;
- claim arrival order cannot establish precedence;
- interface capacity cannot establish precedence;
- `TEMPORARY_PRECEDENCE` requires an explicit selected claim and bounded lease;
- lease expiry reopens the contention deterministically as `UNRESOLVED`;
- an unselected claim remains present in `preserved_claim_ids` and `claim_refs`;
- `contest_visible` remains `true` after a temporary selection;
- unresolved/deferred contention freezes only the irreversible conflicting portion;
- declared safe/reversible work remains visible in `safe_work_allowed`;
- this layer never admits execution.

```text
Conflict Freeze != Total System Freeze
Temporary Precedence != Permanent Authority
Deferred Claim != Invalid Claim
Execution Under Contest Must Remain Contest-Visible
```

## Files

- `contention.schema.json` — structural contract for the first-slice contention;
- `contested-action-receipt.schema.json` — deterministic receipt contract;
- `dlc-si.js` — read-only validator/resolver CLI and reusable functions;
- `test-dlc-si.js` — conformance and fail-closed tests;
- `examples/unresolved.contention.json` — unresolved incomparable claims;
- `examples/deferred.contention.json` — explicit deferral with revisit triggers;
- `examples/temporary-precedence.contention.json` — bounded precedence lease.

## Contention input

The input contains two or more independently legitimate claims, an interface with
one visible/actionable slot, an explicit conflict classification and one proposed
resolution mode.

`source_conflict_refs` are opaque evidence references. They are the compatibility
bridge to prior CCRP conflict receipts and do not grant authority by themselves.

The first slice accepts the conflict types:

```text
epistemic
normative
resource
temporal
interface_capacity
referential
```

The first slice intentionally accepts only:

```text
claim_relation = INCOMPARABLE
successor_relation = INCOMPATIBLE
```

That constraint proves the difficult case first: no ordering may be inferred from
input position or implementation convenience.

## Resolution modes

### UNRESOLVED

No claim is selected. The irreversible conflicting portion remains frozen.
Reversible/safe work may continue and revisit triggers are preserved.

### DEFERRED

No claim is selected. The contention is explicitly deferred until one or more
declared revisit triggers become true.

```text
Deferred Claim != Invalid Claim
```

### TEMPORARY_PRECEDENCE

One claim is explicitly named and a bounded `PrecedenceLease` is supplied.

The lease includes:

- authority reference;
- exact scope;
- start and expiry;
- revocation conditions;
- revisit triggers;
- successor-state constraints.

The lease MUST include `lease_expiry` as a revisit trigger and MUST have
`expires_at > starts_at`.

A live lease produces an Action-Gate **candidate**, not an execution permit:

```text
precedence_effective = true
action_gate_candidate = true
execution_admitted = false
```

At or after `expires_at`, the same input evaluated at its declared
`evaluated_at` deterministically produces:

```text
status = UNRESOLVED
precedence_effective = false
action_gate_candidate = false
reopened_by = ["lease_expiry"]
```

The former selected claim gains no permanent authority.

## Deterministic receipt identity

The receipt fingerprint is:

```text
sha256(
  UTF8(
    recursively-key-sorted compact JSON of the receipt
    with fingerprint_sha256 replaced by ""
  )
)
```

Semantically set-like arrays are sorted before fingerprinting:

- `source_conflict_refs`;
- `claim_refs` by `claim_id`;
- `preserved_claim_ids`;
- `safe_work_allowed`;
- `revisit_triggers`;
- lease scope/revocation/revisit/successor constraints.

Therefore reversing claim arrival order cannot change the receipt fingerprint.

## CLI

Validate:

```bash
node protocols/dlc-si/v0.1/dlc-si.js validate \
  protocols/dlc-si/v0.1/examples/unresolved.contention.json
```

Resolve to a deterministic contested receipt:

```bash
node protocols/dlc-si/v0.1/dlc-si.js resolve \
  protocols/dlc-si/v0.1/examples/temporary-precedence.contention.json
```

Read from stdin with `-`.

The only commands are:

```text
validate
resolve
help
```

There is deliberately no `execute` command.

## Runtime non-effects

The CLI:

- performs no network access;
- writes no file;
- spawns no process;
- mutates no repository state;
- grants no authority;
- creates no `ActionPermit`;
- admits no execution;
- performs no automatic winner selection.

```text
Validation Success != ActionPermit
Temporary Precedence != Execution Admission
ContestedActionReceipt != Successor-State Commitment
```

## Deferred scope

Issue #526 intentionally leaves later slices for:

- `PARTITIONED`;
- `HUMAN_SELECTED`;
- `ESCALATED`;
- generalized conflict-set semantics;
- automatic `RevisitTrigger` event ingestion;
- policy-specific decomposition engines;
- multi-slot/multi-interface coordination.

Those additions must preserve the v0.1 contest-visibility and non-erasure invariants.
