# Sustainability Pause / Degradation Contract v0.1

**Status:** non-normative operational contract  
**Canonical predecessor:** `bb59df959aadc8dc59ac95473cb0b2e1b74adad4`  
**Kernel relation:** operationalizes Sustainability Kernel K5 and reinforces K2/K3/K10.

## Purpose

This contract classifies entry into a project interruption without converting interruption into authority loss, authority persistence, failover permission, or abandonment.

It is deliberately upstream of the Recovery / Resume Contract v0.1 (#276).

`pause preserves history != pause preserves mutable permission`

`degradation observed != failover authorized`

`context loss != rescue authorized`

`inactivity != consent`

## State model

A fresh interruption observation is classified into exactly one of three bounded results:

`human_pause -> paused + preserve-only`

`provider_degradation -> degraded + observe-and-preserve-only`

`context_loss | unknown -> recovery-required + invoke-recovery-contract-only`

None of these states is resumable by this contract.

Any later resume or preparation after interruption MUST pass through the separate Recovery / Resume Contract v0.1 and establish a fresh recovery frontier.

`pause ended != resume authorized`

`provider recovered != prior authorization revived`

## Interruption kinds

### human_pause

A human explicitly pauses work or participation.

The project history remains intact. The pause does not imply abandonment, waiver, incapacity, delegation, authority transfer, or consent to another actor.

Safe effect: `preserve-only`.

### provider_degradation

A required provider, repository surface, external dependency, or execution surface is observably degraded while project context remains available.

The degradation may justify bounded re-observation needed to determine whether assumptions are stale. It does not justify failover, bypass, alternate-provider mutation, rescue, permission expansion, or automatic retry.

Safe effect: `observe-and-preserve-only`.

### context_loss

Material project context, causal frontier, or required local state is unavailable or cannot be trusted as current.

This contract does not reconstruct that state. It only declares that the Recovery / Resume Contract v0.1 is required before later preparation.

Safe effect: `invoke-recovery-contract-only`.

### unknown

The interruption cannot be classified reliably.

Unknown fails closed to the same result as context loss: recovery is required before later preparation.

Safe effect: `invoke-recovery-contract-only`.

## Permission continuity

Mutable authorization is never carried forward merely because the project history is preserved.

Required invariants:

- `history_preserved = true`;
- `mutable_authorization_preserved = false`;
- `pause_is_abandonment = false`;
- `pause_is_authority_waiver = false`;
- `inactivity_is_consent = false`;
- `degradation_authorizes_failover = false`;
- `degradation_authorizes_bypass = false`;
- `context_loss_authorizes_rescue = false`;
- `automatic_resume = false`;
- `external_execution_authorized = false`.

This contract does not assert that an earlier authorization is invalid in every possible external system. It asserts the narrower protocol rule that such authorization MUST NOT be presumed reusable after interruption without the later freshness/reconciliation process.

## Relationship to Recovery / Resume v0.1

This contract governs interruption entry. #276 governs re-entry.

`pause/degradation classification -> preserve or observe only -> Recovery / Resume v0.1 -> fresh frontier -> safe_to_prepare`

The strongest successful state of #276 remains `prepare-only`, not execution.

This contract therefore never substitutes for recovery and never skips it.

## Relationship to Capability Ceiling v0.1

After #276 establishes a fresh frontier, the Capability Ceiling Contract v0.1 (#278) can classify a requested capability against the current allowed/denied/unlisted envelope.

`interruption classified != recovered`

`recovered != capability expanded`

`within ceiling != executable`

## Relationship to CHSP v1.0

CHSP v1.0 remains the specific exact external-execution architecture.

Pause/degradation classification cannot create, renew, or revive CHSP execution authorization and cannot invoke the CHSP executor.

## Relationship to KONTUR

This contract does not activate KONTUR, add permissions, reinterpret denied permissions, infer permission continuity, or authorize a bypass around existing limits.

## Bounded observation

For `provider_degradation`, observation is permitted only to determine current condition and staleness relevant to recovery. Continuous polling, background monitoring, automatic retry, or observe-then-act behavior is outside this contract.

`bounded observation != monitoring authority`

## Non-effects

This contract does not:

- execute Git/GitHub/provider mutations;
- modify repository permissions or collaborators;
- perform failover or rescue;
- transfer authority;
- diagnose human health, incapacity, competence, or intent;
- infer abandonment from silence;
- activate KONTUR;
- mutate tags, releases, checkpoints, or canonical origin.

## Compact chain

`interruption observed -> classify human_pause | provider_degradation | context_loss | unknown -> preserve history -> do not presume mutable permission continuity -> bounded observation only when degraded -> require Recovery / Resume before later preparation`
