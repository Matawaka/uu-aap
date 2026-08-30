# Matawaka Workbench v0.27 — Transport Adversarial Controls

**Evidence class:** Workbench-local implementation evidence  
**Status:** `TRANSPORT_ADVERSARIAL_CONTROLS_PASSED`  
**Observed:** `2026-08-30T23:04:20.3236182+05:00`  
**Not:** canonical UU-AAP conformance, Stable Core promotion, production recovery proof, or recovery authority

## Accepted local state

- version: `0.27.0`
- accepted tag: `workbench-v0.27-accepted`
- main HEAD before: `8cdea04c2304f8589e9120d0451efa9e7e6b2f2b`
- main HEAD after: `8cdea04c2304f8589e9120d0451efa9e7e6b2f2b`
- dirty paths before/after: none
- `MainRepositoryUnchanged=true`
- explicit UI confirmation required and observed

## Positive predecessor binding

The negative controls bind back to the retained passing v0.26 independence evidence:

- v0.26 receipt SHA-256: `c94bbb3ec3b7ec577f1199bffadde02ac84bac9c52139b74ccb73e064793a543`
- source/copied transport ZIP SHA-256: `692d0dfb375dd07c482f80accb0bf3250fe6f10332506dcb6fb35fee250ecdf8`
- v0.26 status: `INDEPENDENT_LOCAL_TRANSPORT_CAPSULE_VERIFIED`

That v0.26 proof established one same-machine independence shape: after an exact byte-identical copy boundary, replay and evidence materialization could proceed from the copied transport bytes without dereferencing the original transport/replay/relocation/evidence roots.

## Adversarial refusal matrix

### 1. Copy byte drift after binding

- control id: `copy-byte-drift-after-binding-refused`
- initial bound SHA-256: `692d0dfb375dd07c482f80accb0bf3250fe6f10332506dcb6fb35fee250ecdf8`
- candidate SHA-256 at attempt: `60bebb261744358a4e07d7b6672ea705a0328b981d071a354cd6dccead77c53b`
- mutation: append JSON whitespace to one expected payload entry after exact copied-transport SHA binding
- inspection attempted: `false`
- rejected: `true`
- evidence materialization attempted: `false`
- evidence materialization root created: `false`
- candidate preserved after refusal: `true`
- source transport unchanged: `true`

Refusal meaning: a path that once contained verified bytes cannot stand in for the exact bytes that were bound.

### 2. Unexpected extra ZIP entry

- control id: `extra-zip-entry-refused`
- candidate SHA-256 at attempt: `6fdba0636740aae212b71be7ba2b91dfe84b3defd39cbb52a8a83eb622ee7177`
- mutation: add `unexpected-control.json` to an otherwise exact transport copy
- inspection attempted: `true`
- rejected: `true`
- evidence materialization attempted: `false`
- evidence materialization root created: `false`
- candidate preserved after refusal: `true`
- source transport unchanged: `true`

Refusal meaning: a valid expected subset is insufficient when the actual transport contains an unbound entry.

### 3. Transport manifest evidence-envelope drift

- control id: `transport-manifest-drift-refused`
- candidate SHA-256 at attempt: `9c93f08da1a82add2d632c1c8fc6ed89dfe81de8fd5f89675459c2af9f4bf599`
- mutation: change only the declared `EvidenceEnvelopeDigest` in a structurally valid transport manifest
- inspection attempted: `true`
- rejected: `true`
- rejection status: `TRANSPORT_VERIFICATION_FAILED`
- evidence materialization attempted: `false`
- evidence materialization root created: `false`
- candidate preserved after refusal: `true`
- source transport unchanged: `true`

Refusal meaning: syntactic validity of the manifest does not substitute for its exact evidence binding.

## Aggregate result

```text
CopyByteDriftAfterBindingRefused=true
ExtraZipEntryRefused=true
TransportManifestDriftRefused=true
AllControlsRefusedBeforeEvidenceMaterialization=true
SourceTransportUnchanged=true
MainRepositoryUnchanged=true
```

Every scenario was rejected before evidence materialization and retained the negative candidate for audit.

## Strengthened invariants

```text
Transport once verified != transport forever valid.
Bound path != bound bytes.
Copied evidence != authority to materialize evidence.
Syntactically valid manifest != valid evidence binding.
Expected entries present != exact transport file set.
```

## Authority ceiling

The control run allowed only isolated copied-transport mutation plus verify-only inspection where applicable. It did not authorize or prove:

- main Workbench source mutation;
- source transport mutation or deletion;
- evidence import/materialization;
- recovery execution, rollback, or automatic recovery;
- build, checkpoint, network, or catalog mutation;
- Agent Execute or ActionPermit creation;
- producer authentication;
- cross-machine or cross-OS portability;
- production-main recovery or a general failure-recovery claim;
- canonical UU-AAP conformance;
- Stable Core or interface-registry promotion.

## Closure consequence

v0.26 provides the bounded **positive** proposition: one exact copied transport remains independently usable after the copy boundary.

v0.27 provides the bounded **negative** proposition: three exact post-copy mutation classes are rejected before materialization.

The next safe layer is therefore not broader recovery. It is a byte-bound evidence closure that proves these two propositions refer to the same exact source transport while preserving their authority ceiling.