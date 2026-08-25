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

## Optional adapter registration

The registry now materializes the KONTUR Game Companion relation as an experimental optional consumer of Core:

```text
UU-AAP-Core
    -> KONTURGameCompanionAdapter
```

This direction is intentionally one-way.

The adapter entry is required to keep:

- `interface_kind = OPTIONAL_ADAPTER`;
- `optional_adapter = true`;
- `dependencies = ["UU-AAP-Core"]`;
- `core_membership = false`;
- `reverse_dependency_authorized = false`;
- `runtime_activation_authorized = false`;
- `stable_core_promotion = false`;
- `authority_created = false`;
- `pilot_evidence_can_create_core_requirement = false`.

The Core entry and every non-KONTUR registry entry are forbidden from depending on `KONTURGameCompanionAdapter`.

```text
Optional Adapter Registration != Stable-Core Membership
Core -> Adapter != Adapter -> Core
Pilot Evidence != Stable-Core Requirement
Listed Adapter != Runtime Activation
Adapter Evidence != ActionPermit
```

The registration therefore closes the typed forward-interface gap without making the pilot a hidden Core dependency or runtime component.

CI is read-only.
