# KONTUR Live Host Designation v0.1

**Status:** experimental non-activation human-decision boundary  
**Scope:** explicit designation required before a concrete persistent environment may be represented as a KONTUR live-host profile

## Invariant

```text
host parameters supplied
!= explicit human live-host designation
!= live-host profile
!= observed live-host eligibility
!= execution authority
!= activation
```

A caller, builder, agent, CI job or sandbox does not acquire the right to call an environment a live KONTUR host merely by supplying a `host_id`, repository path, ledger path or operator reference.

The designation must exist first as a separate typed human decision.

## KONTURLiveHostDesignationDecision v0.1

The decision binds the exact intended target:

- `system_id`;
- `server_instance_id`;
- distinct `host_id`;
- canonical repository `Matawaka/uu-aap`;
- persistent repository root;
- persistent Durable Responsibility Ledger root;
- `runtime_boundary = host_local`;
- the declarations that the repository and ledger roots are persistent, the ledger is outside the repository, and the intended environment is neither CI nor a temporary sandbox.

The human declaration requires all of:

```text
decision = designate_live_host
declaration_type = explicit_live_host_designation
typed_confirmation = DESIGNATE_KONTUR_LIVE_HOST
explicit = true
fresh one-shot designation nonce
```

The designator identity assurance remains deliberately bounded:

```text
declared_not_cryptographically_verified
```

The deterministic decision identity is derived under RFC 8785 JCS + SHA-256 from the declaration timestamp, designator reference, decision kind, exact target, exact declarations and exact human declaration including its nonce.

## Safe effect

A valid decision has only:

```text
safe_effect = live_host_profile_may_be_built
```

It explicitly does **not** mean:

- the profile has already been created;
- the environment has been observed;
- live-host eligibility has been established;
- an Activation Intent exists;
- preflight passed;
- a Human Execute command exists;
- execution authority was granted;
- Kernel activation occurred;
- responsibility state was created or accepted;
- the Durable Responsibility Ledger was written;
- permissions may be expanded or bypassed;
- legal authority, truth, liability or universal canonicality was established.

## Profile derivation

`KONTURLiveHostProfile v0.1` must be derived from one exact valid `KONTURLiveHostDesignationDecision`.

The profile embeds:

- `human_designation_binding` — RFC 8785 JCS + SHA-256 binding to the exact decision;
- `human_designation_evidence` — the exact decision artifact.

The profile validator independently requires:

- `operator_ref == designator_ref`;
- system/server/host/repository/path/runtime fields equal the designated target;
- profile declarations equal the human-designated declarations;
- the profile creation timestamp does not predate the designation;
- the designation binding recomputes exactly;
- all non-effect claims remain false.

Therefore the old semantic shortcut is prohibited:

```text
buildLiveHostProfile({hostId, operatorRef, repositoryRoot, durableLedgerRoot, ...})
```

Raw parameters alone cannot create a valid designated profile.

## Observation remains separate

Human designation does not prove that the host actually has the declared properties. The runtime observer remains a separate evidence producer:

```text
explicit human designation
→ bound live-host profile
→ host-local runtime observation
→ KONTURLiveHostEligibilityReceipt
```

At the live effect boundary, runtime facts are re-observed again and must reproduce the bound eligibility receipt before Core, Kernel or Durable Responsibility Ledger access.

Thus human designation cannot override a later observation that detects CI, a sandbox, revision drift, a wrong path, an inaccessible ledger root or other ineligibility.

## CI semantics

CI may construct only **synthetic test designation decisions** using synthetic designator references, host IDs and nonces. Such fixtures validate structure and fail-closed behavior; they do not designate the GitHub runner or any real machine as a KONTUR live host.

CI must not infer a real human designation from repository content, test parameters or successful validation.

## Remaining assurance boundary

This layer records explicit human designation but does not authenticate the human cryptographically and does not attest the host through TPM, secure boot, hardware identity, hypervisor trust or OS trust roots.

Those are separate possible successor layers. v0.1 deliberately states only what it can prove.
