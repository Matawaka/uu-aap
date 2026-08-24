# UU-AAP Reusable Protocol Interface Registry v0.1

**Status:** experimental stacked interface index  
**Issue:** #379

## Purpose

Provide machine-readable discovery of reusable Core/integration interfaces without altering or impersonating the published release registry.

```text
Interface Registry != Release Registry
listed != published
next interface != automatic transition
path present != compatibility proven
```

Each entry declares typed inputs/outputs, mandatory dependencies, normative non-effects and possible next interfaces. Every current entry is provider-neutral and `external_effect_emission = false`; an execution profile can describe evidence of an external effect without the profile/validator invoking one.

The validator requires unique IDs, existing repository paths, explicit non-effects, no automatic transitions and no publication/release claims for experimental entries.

CI is read-only.
