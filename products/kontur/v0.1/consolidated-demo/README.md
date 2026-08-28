# KONTUR Consolidated Measurable Demo v0.1

**Status:** experimental runnable repository-backed read-only demo  
**Issue:** #599  
**Origin frontier:** `0f284779a51a2161d3300384586b375ecffd870a`  
**Origin tree:** `fd7e8553ba211f6ea8737d7f153eb38551b5d448`  
**KONTUR Product Contract:** `sha256:21597d591cc4fbe2974c8ac63d669c79158734336c6c64f8ba6a91602835b1b5`  
**Family Manifest:** `sha256:90da81f7c33f44f34410790e9269bf8b05a5ad47db596437b214b8301701a5a1`

## Purpose

This successor closes the remaining Phase D KONTUR requirement by composing the already-implemented family evidence into one deterministic measurable demo without activating KONTUR.

```text
canonical family manifest
+ repository-backed subsystem conformance
+ Game Companion seven-layer dependency chain
+ synthetic pause/recovery evidence
+ privacy-minimized synthetic field outcomes
+ deterministic demo metrics
-> KONTURFamilyConsolidationReceipt
-> HUMAN_FAMILY_CONSOLIDATION_GATE_REQUIRED
-> STOP
```

The demo is not live runtime telemetry.

```text
Repository Conformance != Live Runtime State
Synthetic Demo Metrics != Production Telemetry
Family Consolidation Candidate != KONTUR Activation
```

## Six family members

The receipt binds all six canonical members while preserving their roles:

1. `readiness-aggregator`;
2. `activation-boundary`;
3. `responsibility-kernel`;
4. `responsibility-ledger`;
5. `live-host-boundary`;
6. `game-companion`.

The runtime reads the canonical `family-manifest.json` only when explicitly invoked and validates it with the existing `readiness-interop` family validator. It does not duplicate family identity semantics.

## Subsystem boundary

The dedicated CI reruns existing predecessor validators. The demo input stores bounded `PASS` summaries only after those independent tests run.

The receipt preserves:

```text
readiness evidence available
!= activation authorization

activation review boundary
!= preflight execution
!= activation

kernel structural lineage
!= activated responsibility holder

ledger continuity review
!= ledger mutation

host observation
!= designation
!= executor binding
!= runtime start
```

## Game Companion

The runtime reads the canonical dependency chain at:

`pilots/kontur-game-companion/dependency-contract/game-companion-chain.json`

and requires the exact seven ordered layers:

```text
observational-lane
assistance-gate
shared-discovery-memory
bounded-initiative
focus-diversity
interaction-receipt
pause-resume
```

Every top-level Game Companion non-effect must remain `false`. The demo therefore cannot enable live response generation, proactive messaging, background activity, autonomous gameplay, account control, profiling, attention tracking, engagement optimization or total-history capture.

## Pause / recovery fixture

The committed fixture is fully synthetic:

```text
ACTIVE_LOCAL_REVIEW
-> PAUSE_REQUESTED
-> PAUSED_NO_BACKGROUND_ACTIVITY
-> RESUME_FROM_MINIMAL_STATE
-> LOCAL_REVIEW_RESUMED
```

Required claims:

```text
background_activity_during_pause = false
pause_creates_successor_authority = false
resume_creates_successor_authority = false
minimal_state_resume = true
```

## Privacy-minimized field outcomes

No raw game history or transcript is stored. The fixture exposes only aggregate synthetic counts and explicit exclusions:

```text
raw_game_history = false
transcripts = false
identity_correlation = false
behavioral_profile = false
psychological_profile = false
mood_profile = false
attention_profile = false
engagement_optimization = false
cross_game_preference_profile = false
total_history_capture = false
```

These records are demo evidence, not claims about a real player.

## Deterministic metrics

The canonical fixture records:

```text
measurement_class = synthetic_demo_metrics
family_member_count = 6
established_edge_count = 4
planned_edge_count = 2
canonical_path_count = 23
game_companion_layer_count = 7
human_gate_count = 3
human_interruption_count = 3
pause_event_count = 1
resume_event_count = 1
network_call_count = 0
filesystem_write_count = 0
external_effect_count = 0
runtime_start_count = 0
ledger_mutation_count = 0
host_designation_count = 0
```

Wall-clock CI time, CPU and memory are intentionally not presented as field measurements.

## Receipt

The primary output is the Product Contract-defined `KONTURFamilyConsolidationReceipt`.

Expected state:

```text
CONSOLIDATION_CANDIDATE_READY
```

Expected next safe action:

```text
HUMAN_FAMILY_CONSOLIDATION_GATE_REQUIRED
```

A positive receipt establishes only bounded facts about repository-backed evidence composition. It does not accept the family packet for planning by itself; the human consolidation gate remains separate.

## Mandatory non-effects

The machine receipt keeps false at least:

```text
family_activated
production_ready
activation_authorized
activation_performed
preflight_run
kernel_activated
responsibility_state_created
responsibility_accepted
ledger_mutated
host_designated
executor_bound
runtime_started
cross_member_data_access_admitted
authority_created
action_permit_created
execution_admitted
external_effect_performed
live_response_generated
proactive_message_sent
background_activity_performed
autonomous_gameplay_performed
game_account_controlled
behavioral_profile_built
psychological_inference_performed
attention_profile_built
engagement_optimized
stable_core_promotion_established
successor_authority_created
```

## Exact source binding

`receipt-binding.js` revalidates the source input, reloads canonical repository evidence, re-derives the expected consolidation receipt and requires canonical equality.

```text
Receipt Self-Consistency != Exact Source + Repository Evidence Binding
```

## CLI

Allowed commands:

```text
validate
consolidate
inspect
help
```

Forbidden command families include:

```text
activate
start
run
execute
write-ledger
designate-host
bind-executor
message
play
mutate
promote
```

The production surface has no network, subprocess or filesystem-write capability.

## Phase D meaning

After this demo and the already-merged local no-effect MVPs for Маркетолог Пессимиста, FREESHIELD and Честный найм, every active Phase D product line has a runnable local no-effect scenario.

This does **not** automatically begin Phase E real pilots. Every bounded real pilot still requires its own evidence, privacy/authority boundary and human merge/review gate.
