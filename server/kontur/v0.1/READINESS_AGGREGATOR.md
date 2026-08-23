# KONTUR Readiness Aggregator v0.1

**Status:** experimental server-level readiness composition layer  
**Machine identity:** `KONTUR`  
**Scope:** reference server responsibility control plane

## Purpose

The KONTUR Responsibility Kernel consumes a typed readiness signal, but it must not invent that signal or accept a single subsystem's self-declaration of global readiness.

This layer establishes the missing producer boundary:

```text
independent machine evidence
        |
        v
KONTURReadinessEvidenceSet
        |
        v
KONTURReadinessAggregator
        |
        v
KONTURReadinessSignal
        |
        v
KONTURReadinessAcceptanceReceipt   (dry-run only)
        |
        v
KONTURActivationFrontierReceipt
        |
        v
HUMAN ACTIVATION BOUNDARY
        |
        v
KONTUR Responsibility Kernel
```

The core invariant is:

```text
subsystem evidence
!= global readiness
!= readiness acceptance
!= kernel activation
!= execution authority
```

## Six independent readiness axes

The reference aggregation policy requires exactly six checks, each produced under a different producer identity and bound to a specific artifact type.

| Readiness check | Producer | Required artifact |
| --- | --- | --- |
| `protocol_registry_ready` | `urn:uu-aap:producer:protocol-registry-validator` | `ProtocolRegistry` |
| `coordination_ready` | `urn:uu-aap:producer:ccrp-c5-validator` | `CCRPPolicyCoordinationResult` |
| `authority_ready` | `urn:uu-aap:producer:poai-authority-validator` | `PoAIAuthorityVerificationResult` |
| `provenance_ready` | `urn:uu-aap:producer:origin-provenance-validator` | `ProvenanceCompletionReceipt` |
| `causal_qualification_ready` | `urn:uu-aap:producer:causal-qualification-validator` | `CausalClaimQualification` |
| `server_health_ready` | `urn:uu-aap:producer:kontur-server-health-observer` | `KONTURServerHealthObservation` |

No seventh implicit check is allowed in v0.1, and no required check may be omitted or duplicated.

## Evidence observation versus historical event time

The evidence record's `observed_at` is the time at which the source artifact is **re-verified in the current readiness capture**, not a rewrite of the historical time embedded in the source artifact.

For example, a provenance completion receipt may describe a historical transition. The readiness harness reruns the provenance validator on the current checkout and then records when that exact artifact was freshly observed as valid.

This distinction preserves both:

- immutable historical event timestamps; and
- freshness of the current readiness verification.

## Reference live harness

`test-readiness-aggregator.js` does not supply six hard-coded booleans. It executes existing machine validators and consumes their actual outputs:

1. `protocols/registry/v0.1/validate-registry.js`
2. `proposals/poai/authority/live/test-live-published-grant-authority.js`
3. `proposals/ccrp/test-c5.js`
4. `protocols/integration/v0.1/test-origin-provenance.js`
5. `protocols/integration/v0.1/test-causal-claim-qualification.js`
6. `observe-server-health.js` after independent runtime checks

The aggregator subsequently validates the semantic boundary of every source again before it may count as a passing readiness axis.

## Source assurance boundaries

A source is rejected not only when it is negative, but also when it claims more than its layer permits.

Examples:

- CCRP/C5 may establish `policy_integrated_coordination_established=true`, but must keep `materialization_permitted=false`.
- Authority may establish the scoped live materialization authority path, but must keep legal and universal authority false.
- Provenance may establish machine semantic-origin provenance, but must keep truth and causal proof false.
- Causal qualification may qualify the two bounded predicates while necessity, sufficiency, exclusivity and universal causal truth remain withheld.
- Server health may establish health only; it may not self-certify KONTUR global readiness.

Therefore `green source artifact` does not mean `unbounded trust in that source`.

## KONTURReadinessAggregationPolicy

Canonical reference policy:

```text
urn:uu-aap:kontur:readiness-aggregation-policy:reference-server:1
```

Scope:

```text
urn:uu-aap:kontur:readiness-aggregation-scope:reference-server-v0.1
```

It requires:

- exact server/system identity;
- six exact producer/type rules;
- producer independence;
- RFC 8785 JCS + SHA-256 artifact binding;
- `all_required_checks_pass` aggregation;
- bounded evidence freshness;
- bounded signal validity;
- explicit monotonic readiness epoch;
- no scalar readiness/confidence/responsibility score;
- no authority/legal/moral/truth/PoAI upgrade.

## KONTURReadinessEvidenceSet

The evidence set is immutable and binds all six source artifacts by:

- check ID;
- producer identity;
- artifact type;
- artifact reference;
- exact JCS/SHA-256 digest;
- current observation time;
- decision and reason codes.

The evidence set itself does **not** establish global readiness.

## KONTURReadinessAggregationReceipt

Only after all six axes are valid may the aggregation receipt establish:

```text
global_readiness_aggregated = true
readiness_signal_emitted = true
```

It must simultaneously keep false:

```text
single_source_self_certified_global_readiness
kernel_activated
responsibility_state_created
execution_authority_granted
legal_responsibility_determined
moral_blame_assigned
truth_certified
poai_materialization_event_recorded
universal_canonicality_established
```

## KONTURReadinessSignal

The emitted signal is compatible with the Responsibility Kernel's existing `KONTURReadinessSignal v0.1` contract.

It contains:

- exact system/server identity;
- readiness epoch;
- bounded validity interval;
- six passing checks;
- evidence references;
- `ready=true`;
- the pre-activation assurance boundary.

`ready=true` does not activate the kernel.

## Dry-run readiness acceptance

`KONTURReadinessAcceptanceReceipt` answers one narrow question:

> Would the current Responsibility Kernel readiness boundary accept this exact signal as an activation precondition?

A positive receipt may establish:

```text
readiness_signal_accepted = true
activation_permitted_by_readiness_boundary = true
human_activation_step_still_required = true
```

It must keep false:

```text
kernel_activated
responsibility_state_created
responsibility_accepted
execution_authority_granted
```

and all legal/moral/truth/PoAI/universal claims.

This is deliberately a **dry run**. It does not call `transitionResponsibility(... transitionKind='activate')`.

## Activation frontier receipt

`KONTURActivationFrontierReceipt v0.1` is the machine-readable boundary needed for a canonical activation prompt.

It binds:

- exact Git revision;
- aggregation policy;
- responsibility policy;
- readiness signal;
- aggregation receipt;
- readiness acceptance receipt;
- readiness epoch;
- system/server identity.

Its status is:

```text
activation_prompt_may_be_requested
```

while:

```text
kernel_activated = false
human_activation_step_still_required = true
```

A PR-run frontier is a **candidate** frontier bound to that PR checkout. It is not the canonical activation frontier.

Only a successful post-merge `main` workflow run can establish the repository frontier from which the project may announce:

```text
KONTUR ACTIVATION FRONTIER READY
```

That sentence means only that the human may request the canonical activation prompt. It does not mean KONTUR has been activated.

## Reference harness versus production deployment

The current server identity is a reference-server machine contract:

```text
urn:uu-aap:kontur:server:reference-primary
```

Its runtime health observations prove the CI/reference execution environment required by this repository harness. They do not claim to be a production datacenter health monitor.

A future deployment may replace the health producer and server identity under a successor policy without weakening the readiness composition rules.

## Fail-closed design

The harness rejects, among other vectors:

- missing or duplicate checks;
- duplicate or substituted producer identity;
- wrong source artifact type;
- source digest substitution;
- policy ID/version/scope substitution;
- stale or future-observed evidence;
- source assurance overclaims;
- degraded/critical server health;
- wrong server identity;
- scalar readiness scores;
- invalid or stale epoch;
- expired readiness signal;
- wrong Responsibility Policy;
- parallel-active-holder frontier;
- acceptance binding substitution;
- invalid Git activation frontier;
- any attempt for the dry-run/frontier to claim activation.

## Human boundary

The canonical sequence remains:

```text
merge aggregator
-> canonical main readiness capture
-> canonical dry-run acceptance
-> canonical activation frontier
-> KONTUR ACTIVATION FRONTIER READY
-> human requests canonical activation prompt
-> separate human-controlled activation operation
```

There is no auto-activation and no auto-merge.
