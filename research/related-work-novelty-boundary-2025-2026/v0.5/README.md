# Empirical Semantic-Escalation Benchmark v0.5

Status: `SYNTHETIC_BENCHMARK_CANDIDATE_AWAITING_INDEPENDENT_CI`

Tracks #964.

Exact qualified predecessor: `1473ab2005c876816dab12ae46ed7f39bbfbad6b` (v0.4).

## Purpose

This package tests the remaining v0.4 **integration/evaluation** hypothesis with a reproducible synthetic mutation benchmark. It does not test real WEXP, StateBench, AIRGuard, CAP/PCL, LLM judges, or production Matawaka deployments.

The experiment deliberately uses the same semantic state shape across six materially different domains and applies one primary unsupported semantic promotion at a time.

```text
6 base scenarios
× 10 hostile promotion classes
= 60 hostile fixtures
+ 6 benign controls
= 66 total fixtures
```

Domains:

1. human-AI authorship/review;
2. enterprise disclosure;
3. repository/code action;
4. purchase/payment-like action;
5. deployment/infrastructure effect;
6. analytical decision using heterogeneous intelligence.

Promotion classes are inherited unchanged from qualified v0.4.

## Local comparison profiles

The runner compares only **local synthetic profiles**:

- `MATAWAKA_TYPED_PROFILE` — checks all ten typed support relations;
- `WEXP_LIKE_EXECUTION_PROFILE` — local approximation of the subset covered by the v0.4 WEXP mapping;
- `STATEBENCH_LIKE_STATE_PROFILE` — local approximation of the subset covered by the v0.4 StateBench mapping;
- `SPECIALIZED_UNION_PROFILE` — union of all local narrow checks, intentionally strong enough to test whether unification alone increases recall;
- `NAIVE_SCHEMA_PROFILE` — validates shape only and therefore should not detect schema-preserving semantic mutations;
- `LLM_POLICY_JUDGE` — `NOT_YET_MEASURED`; no model call is made in this package.

No score may be attributed to upstream WEXP, StateBench, or any other third-party implementation.

## Primary question

Does `MATAWAKA_TYPED_PROFILE` achieve better hostile-mutation detection recall than the composed `SPECIALIZED_UNION_PROFILE` under identical fixtures?

The expected scientific posture is deliberately adverse to Matawaka: if the specialized union detects the same fixtures, the result is:

`NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION`.

A single profile surface may still be operationally convenient, but this benchmark does not measure convenience, integration cost, latency, real-system reliability, or deployment complexity.

## Metrics

For each measured deterministic profile:

- hostile detection recall;
- per-class recall;
- benign false-positive rate;
- number of domains with at least one hostile detection;
- unsupported promotion-class count;
- exact verdict trace (`fixture_id`, expected class, fired boundary).

Aggregate recall never substitutes for per-class reporting.

## Ablations

`MATAWAKA_TYPED_PROFILE` is ablated by six semantic families:

- epistemic availability/consideration;
- identity/authority;
- review/permission;
- invocation/effect;
- provenance/causality;
- freshness/current-state authority.

The ablation only shows which synthetic fixtures depend on which checks. It does not prove the uniqueness or necessity of the exact UU-AAP seven-layer architecture.

## Non-effects

This package does not establish novelty, world-first status, patentability, real-world security, real upstream benchmark superiority, LLM-judge performance, natural attack prevalence, or deployment readiness. It changes no Stable Core, PoAI, C2PA, runtime, application, package, or production surface and grants no merge authority.
