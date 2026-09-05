# Reusable Protocol Interface Registry v0.3 delta

v0.3 is an additive successor over the exact accepted v0.2 delta. It admits exactly one new provider-neutral experimental interface:

```text
ObservationSet@0.1
```

The admission is intentionally **set-only**. It recognizes the already consumed `evaluate_set` API in:

```text
protocols/integration/observation-set-calculus-candidate/v0.1/profile.py
```

It does not register the module as a monolithic calculus.

## Admission evidence

Merged #910 proved direct shared implementation reuse of the same `evaluate_set` bytes/schema by two independent consumer families:

1. C2PA authority-observability;
2. Public Review external-source observation.

Merged #912 then applied the historical reusable-component admission threshold and concluded:

```text
ObservationSet
  -> ELIGIBLE_EXPERIMENTAL_INTERFACE_ADMISSION

ObservationSetTransition
  -> DEFER_SECOND_DOMAIN_DIRECT_REUSE

LocalObservationSetChain
  -> DEFER_SECOND_DOMAIN_DIRECT_REUSE

monolithic Observation Set Calculus Candidate
  -> DEFER_SPLIT_REQUIRED

Stable Core
  -> NO_CORE_ADMISSION
```

The v0.3 validator byte-binds that admission evidence and preserves the split.

## Registered contract

Inputs:

```text
scope_binding_sha256
observations[] {
  semantic_fingerprint_sha256
  source_binding_sha256
}
```

Outputs are the set-level receipt surface already produced by `evaluate_set`, including:

- deterministic observation multiset identity;
- semantic set fingerprint;
- exact-input fingerprint;
- duplicate-safe observation multiplicity.

The registry entry does not reinterpret domain-specific evidence. C2PA and Public Review remain responsible for validating their source semantics before projection.

## Explicit non-effects

```text
Observed set != complete world state
Semantic identity != exact source representation
Set membership != truth
Set membership != authority
Set membership != admission or disposition
Set membership != action authorization
Experimental registry entry != Stable Core
Experimental registry entry != published release
Registry entry != external effect
```

## Deferred APIs

The following APIs remain explicitly outside registry admission:

```text
evaluate_transition
evaluate_chain
```

Their implementation may coexist in the same candidate module, but source-file colocation does not create interface admission.

`Set Admission != Calculus Admission`

`Registry Delta != Historical Registry Rewrite`

`Experimental Registry Entry != Stable Core`
