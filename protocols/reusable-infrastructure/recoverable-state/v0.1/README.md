# Recoverable State Infrastructure Candidate v0.1

**Status:** experimental reusable-infrastructure candidate / provider-neutral / non-actuating  
**Tracking issue:** #881  
**Origin frontier:** `ef4c8c6030ef517f2997fb76cff4f584fb25c691`

This candidate composes two independently accepted profiles without collapsing their semantics:

- **Event-Responsive Dormancy (ERD)** — removes the need for an active waiting process while preserving a bounded dormant capability and requiring fresh evidence/authority/intent re-evaluation after a supplied wake signal.
- **RERC** — reduces the active operational relation surface while preserving the exact observed relation graph through a reversible suppression receipt.

Shared infrastructure principle:

`Reduced Active Burden != Loss of Recoverable State != Authority Creation`

This is not a benchmark claim. The candidate does not claim measured CPU, memory, latency, throughput, energy,
or financial savings.

## Formal candidate meaning

"Formal reusable-infrastructure candidate" means:

1. both component contracts remain independently reusable and byte-bound to accepted implementations;
2. their composition has a closed machine-readable receipt;
3. a reference composer proves they can coexist without minting authority or destroying source state;
4. Reusable Protocol Interface Registry v0.2 lists ERD, RERC, and this candidate as `experimental` typed interfaces;
5. no automatic transition, runtime activation, release, or Stable Core promotion follows.

It does **not** mean a published protocol release, production runtime, scheduler, storage engine, or Stable Core primitive.

## Composition

The reference composer executes the accepted ERD evaluator and RERC compressor/restorer. RERC exact restoration
must succeed before the composition receipt is admitted. `PreActionEvidenceBundle` appears only as a possible next
interface when the ERD result is `READY_FOR_SEPARATE_ACTION_ADMISSION`, and `automatic_transition=false` remains fixed.

`ERD READY != ActionPermit`

`RERC Operational Graph != Source Graph Deleted`

`Component Composition != Shared World Identity Proof`

`Possible Next Interface != Automatic Transition`

## Exploratory boundary

SCAF, CPOT, Immune Tremor, and Conscious AI remain exploratory and are not candidate dependencies. Research may
later justify a new component, reuse an existing component, or demonstrate that no new component is needed.

## Non-effects

No Stable Core/SPEC/roadmap change, no performance proof, no authority/ActionPermit, no scheduler/network monitor,
no external graph mutation/evidence deletion, no runtime/external effect, no release/tag, and no Workbench reactivation.
