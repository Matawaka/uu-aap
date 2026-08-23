# KONTUR server responsibility kernel v0.1

**Status:** experimental server-level responsibility control plane  
**Canonical subsystem name:** `KONTUR`

`KONTRUR` is not a second machine identity. It is treated only as a spelling variant in discussion.

## Architectural role

KONTUR moves responsibility from a sequence of protocol receipts into a durable server-level state machine.

```text
upstream evidence / readiness producer
              |
              v
     KONTURReadinessSignal
              |
              v
   Responsibility Kernel
              |
              v
 KONTURResponsibilityState(generation N)
              |
              +--> TransitionReceipt --> State(generation N+1)
```

The server kernel is activated only after a machine-readable readiness trigger is accepted under an exact responsibility policy.

## Boundary

```text
readiness
!= authority
!= responsibility acceptance
!= kernel activation
!= legal responsibility
!= moral blame
```

The readiness signal proves only that the declared readiness checks were observed as passing at a bounded time/epoch frontier. It does **not** grant execution authority and does not establish legal or moral conclusions.

## Why a persistent state machine

A one-shot responsibility receipt answers what was accepted at one event. A server must also answer:

- who currently holds the structural responsibility scope;
- which generation of that responsibility is current;
- which fencing epoch protects it from stale writers;
- whether its lease is still live;
- whether server health still permits full active responsibility;
- which exact readiness frontier activated or recovered it;
- whether it is active, degraded, suspended or retired;
- which exact predecessor state produced the current state.

KONTUR therefore derives every new state from an append-only transition receipt. Direct in-place mutation is outside v0.1.

## KONTURReadinessSignal

A readiness trigger contains:

- `system_id`;
- `server_instance_id`;
- `readiness_epoch`;
- bounded `emitted_at / valid_until`;
- a source reference;
- typed checks and evidence references;
- `ready`;
- explicit assurance boundaries.

The reference policy currently requires:

1. `protocol_registry_ready`;
2. `coordination_ready`;
3. `authority_ready`;
4. `provenance_ready`;
5. `causal_qualification_ready`;
6. `server_health_ready`.

All required checks must be present and every check carried by a `ready=true` signal must pass. A check observed after signal emission is rejected.

The first kernel PR defines this exact consumer contract. It intentionally does not invent an upstream producer that does not yet exist.

## KONTURResponsibilityPolicy

The reference policy is:

```text
urn:uu-aap:kontur:responsibility-policy:reference-server:1
```

Scope:

```text
urn:uu-aap:kontur:responsibility-scope:server-control-plane-v0.1
```

It fixes:

- exact KONTUR system/server identity;
- required readiness checks;
- allowed responsibility scopes;
- single-active-holder behavior;
- monotonic fencing epochs;
- lease requirement;
- generation increment of exactly one;
- fail-closed health behavior;
- fresh readiness for recovery;
- terminal retirement;
- prohibition of scalar responsibility scores.

The policy itself is an immutable artifact and is JCS/SHA-256 bound into every state and transition receipt.

## Responsibility scopes

The reference policy exposes four structural server scopes:

```text
server.readiness.consume
server.responsibility.maintain
server.degradation.control
server.transition.audit
```

These are server responsibility scopes, not execution authority grants.

## State lifecycle

### Genesis activation

```text
inactive -> active
```

requires:

- no predecessor state;
- fresh unexpired `KONTURReadinessSignal`;
- exact system/server identity;
- all required checks passing;
- `fencing_epoch == readiness_epoch`;
- non-empty allowed responsibility scopes;
- unique declared holder;
- no supplied parallel active holder;
- live holder/server-bound lease;
- healthy server snapshot.

The resulting generation is exactly `1`.

### Heartbeat

```text
active -> active
```

A heartbeat may renew the lease and advances the state generation, but:

- it cannot replace readiness evidence;
- it cannot change the fencing epoch;
- it cannot change holder or scopes;
- it cannot preserve active state if health is not healthy;
- its lease must remain live.

This prevents a continuously running server from self-promoting its readiness epoch.

### Degradation

```text
active -> degraded
```

requires typed degraded health with no critical failure. The lease must still be live.

Degradation is explicit state, not an invisible warning attached to an otherwise fully active holder.

### Suspension

```text
active | degraded -> suspended
```

is allowed when at least one fail-closed condition is present:

- lease is expired;
- health is critical;
- an explicit typed suspension trigger reference is supplied.

Suspended responsibility remains structurally traceable, but it is not an active server responsibility state.

### Recovery / resume

```text
degraded | suspended -> active
```

requires:

- a **fresh** readiness signal;
- readiness epoch strictly greater than the predecessor fencing epoch;
- resulting fencing epoch equal to that readiness epoch;
- a live lease;
- healthy server state;
- unchanged holder and responsibility scope.

Recovery therefore cannot be synthesized from a heartbeat alone.

### Retirement

```text
active | degraded | suspended -> retired
```

is explicit and terminal. v0.1 rejects every successor transition from `retired`.

## Holder replacement and handoff

v0.1 deliberately does not permit an in-place holder replacement.

```text
holder A state
   != mutate field -> holder B state
```

A future typed KONTUR responsibility handoff protocol must bind old holder, new holder, accepted scope, fencing frontier and state generations. Until that exists, holder substitution fails closed.

## Generation and replay protection

For every non-genesis transition:

```text
successor.generation = predecessor.generation + 1
```

and the successor contains an exact RFC 8785 JCS + SHA-256 binding to the predecessor state.

Fencing epochs never decrease. Normal heartbeat/degrade/suspend/retire preserve the epoch. Only recovery with fresh readiness may advance it.

This separates two notions that are easy to confuse:

- **generation** — every accepted responsibility-state successor;
- **fencing epoch** — a stronger freshness boundary requiring new readiness evidence.

## Responsibility is not a score

v0.1 prohibits scalar fields such as:

```text
responsibility_score
probability
likelihood
confidence_score
rating
```

Structural responsibility is represented by identity, scope, state, evidence, lease, epoch and transition lineage rather than an opaque number.

## Assurance boundary

A positive active KONTUR state may establish only:

- responsibility kernel state exists;
- a structural holder is bound;
- responsibility scopes are bound;
- readiness frontier is bound;
- lease/fencing frontier is established;
- deterministic predecessor lineage exists.

It does not establish:

- execution authority;
- legal responsibility or legal effect;
- moral blame or correctness;
- universal causal truth;
- general truth certification;
- PoAI MaterializationEvent;
- universal canonicality.

## Relationship to the integration causal chain

The existing integration chain continues to answer evidence questions:

```text
... -> ResponsibilityTrace
    -> CausalAttributionAssessment
    -> CounterfactualInterventionAssessment
    -> CausalClaimQualification
```

KONTUR does not replace those artifacts. It provides a server responsibility control plane that can later consume their readiness/qualification results through a typed readiness producer.

This preserves a clean separation:

```text
protocol evidence plane
        |
readiness aggregation
        |
server responsibility control plane (KONTUR)
```

## Next server-level layer

The next layer is explicitly:

```text
KONTURReadinessAggregator
```

Its purpose is to build `KONTURReadinessSignal` from independently verified subsystem evidence including, where applicable:

- protocol registry health;
- CCRP coordination/admission;
- authority verification;
- provenance completion;
- causal claim qualification;
- server runtime health.

No single subsystem may self-certify global KONTUR readiness. The aggregator must preserve exact source bindings, freshness horizons and disagreement/failure states.

Only after that aggregation layer exists should production code wire automatic readiness triggers into this kernel.

No auto-merge. Human squash merge remains final.
