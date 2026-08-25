# Core Pilot 001 — Verified Continuity Capture & Recovery

**Status:** specification / pre-execution  
**Pilot class:** bounded real-world local effect  
**Target:** UU-AAP repository continuity  
**Related:** Project Continuity Layer v0.1; Issue #255  
**Origin frontier:** `9ed03f99d4ccab7896b62664ecd273f2919c5bb8`  
**Origin tree:** `3719b1a3a4d785b1f9a58586e8b1fa7cefa954fb`

## Purpose

Exercise the reusable UU-AAP core as one end-to-end protocol over a useful project operation: create one local continuity capture of the frozen origin frontier and independently prove that the resulting Git bundle can recover that frontier in a disposable location.

This pilot is deliberately not an authorization to execute the capture merely because this specification exists or is merged.

```text
pilot specified != action authorized
capture authorized != push authorized
backup created != backup verified
recovery possible != recovery exercised
recovered copy != canonical successor
```

## Core path

```text
State / Evidence Anchor
  -> Possibility / Availability
  -> Intent
  -> Authority / Responsibility
  -> Coordination / CCRP
  -> Action Gate
  -> Outcome / Provenance
  -> Successor State
```

### 1. State / Evidence Anchor

The pilot origin is frozen to the commit and tree recorded above. Execution MUST fail closed if the requested capture target does not match the explicitly authorized frontier.

### 2. Possibility / Availability

Before authorization, an observer may establish only whether the required capabilities are available: readable canonical repository, Git, Python, the continuity tool, and writable local/disposable destinations.

Availability is evidence of possibility only. It creates no execution authority.

### 3. Intent

The bounded intent is exactly:

> Create one verifiable local continuity capture of the authorized UU-AAP frontier and perform one disposable recovery drill from that capture.

The intent does not include recurring backup authority, GitHub mutation, release/tag creation, canonical migration, KONTUR activation, credential changes, or authority delegation.

### 4. Authority / Responsibility

The permitted effect classes are limited to:

- read the canonical Git repository;
- write a designated local continuity root;
- write a designated disposable recovery directory;
- compute and compare verification evidence.

Explicit non-effects:

- no push or remote ref mutation;
- no GitHub settings, permissions, secrets, ruleset, release, or tag mutation;
- no write to the canonical working repository;
- no KONTUR read/write requirement or activation;
- no authority transfer to a replica or recovered copy;
- no reuse of the permit for a later frontier.

### 5. Coordination / CCRP

All participants MUST preserve the same frozen origin frontier and distinguish observation, proposal, authorization, execution, and verification. A verifier MUST be able to validate the resulting receipts without trusting an executor's success assertion.

### 6. Action Gate

Execution requires a separate, explicit Action Permit conforming to `action-permit.schema.json`. The permit is single-use and binds:

- pilot id;
- exact origin commit and tree;
- continuity root;
- disposable recovery root;
- allowed effects;
- forbidden effects.

Merging this pilot specification is not an Action Permit.

### 7. Outcome / Provenance / Successor State

The capture phase MUST produce evidence sufficient to establish:

- captured main commit equals the authorized frontier;
- captured main tree equals the authorized tree;
- `git fsck --full` succeeded;
- `git bundle verify` succeeded;
- bundle SHA-256 is recorded and re-checkable;
- source/canonical repository was not intentionally mutated by the pilot.

The recovery phase MUST restore from the produced bundle into a disposable destination and establish that recovered `main` commit and tree equal the captured/authorized frontier.

Only then may the pilot emit a successful successor-state receipt.

## Acceptance criteria

The pilot passes only when all of the following are true:

1. pre-action evidence and permit bind the exact frozen frontier;
2. all requested effects are inside the allow-list and no forbidden effect is requested;
3. continuity capture completes with its normal manifest/completion evidence;
4. bundle digest verification succeeds;
5. bundle validity verification succeeds;
6. recovery is performed from the bundle into a disposable location;
7. recovered commit and tree equal the authorized commit and tree;
8. outcome and recovery receipts are independently machine-checkable;
9. no canonicality or authority is inferred from possession of the recovered bytes;
10. the permit is consumed by this one run and cannot silently authorize a successor run.

## Execution boundary

This repository change creates only the pilot protocol, schemas, fixtures, and validation. It MUST NOT execute `continuity.py capture`, create a real local backup, perform a recovery drill, mutate KONTUR, or change GitHub authority.

The first real run is a separate human-gated event.