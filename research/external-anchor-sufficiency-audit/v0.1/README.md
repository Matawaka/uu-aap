# External Append-Only Anchor Sufficiency Audit v0.1

Status: **read-only research successor for #927**. This package records design requirements exposed by public `c2pa-org/specifications#122` and its 2026-09-05 comment `5550475914`. It is not a C2PA specification, not a transparency log implementation, not a Bitcoin/OpenTimestamps verifier, and not proof of global non-equivocation.

Exact repository predecessor:

`e14cbbfb024d57912388468268bce42848f6effd`

## Why this audit exists

The external issue proposes committing canonical C2PA claim hashes to an external append-only log and carrying an inclusion proof. The new external comment makes a second-order requirement explicit: the log/checkpoint layer itself must not be allowed to silently fork, roll back, or present different heads to different verifiers.

The audit therefore separates six evidence layers:

```text
SIGNED_CLAIM
    ↓
CLAIM_COMMITMENT
    ↓
LOG_INCLUSION
    ↓
LOG_APPEND_ONLY_CONSISTENCY
    ↓
CHECKPOINT_NON_EQUIVOCATION
    ↓
EXISTENCE_TIME_EVIDENCE
```

They are not interchangeable.

## Critical distinctions

```text
Signature != Non-Equivocation
Claim Hash != Collision Relation
Inclusion Proof != Append-Only Consistency Proof
Append-Only Consistency != Split-View Resistance
Checkpoint Anchor != Complete Claim Universe
Existence-Time Evidence != Universal Trusted Time
External Proposal != C2PA Adoption
External Participant Agreement != Maintainer Endorsement
Repository README != Verified Security Property
```

## Relation to the accepted authority-observability stack

Merged #900 already proves only bounded observed branch divergence and fixes:

```text
Observed branch divergence != proven global equivocation
```

That remains unchanged. The new external evidence does not retroactively upgrade #900. Instead it clarifies what a **future** stronger successor would need.

The current #900 README is byte-bound at:

`7d00b02b500e98d349d84a11262f50fb8bc00d29`

## Collision semantics

A future non-equivocation claim needs an explicit semantic key defining when two commitments are in conflict. Different hashes alone are not enough.

At minimum bind:

- asset/subject identity used by the profile;
- producer/signing key or authority identity where relevant;
- claim profile/type/version;
- canonical claim digest;
- checkpoint/log identity.

Only then can a verifier describe two commitments as colliding under the same bounded profile.

## Inclusion is not completeness

Even a valid inclusion proof under an independently anchored checkpoint does not establish that:

- every issued manifest was submitted;
- every relevant checkpoint/log was observed;
- selective submission did not occur;
- no hidden parallel log exists;
- the log contains a complete asset history;
- one branch is globally canonical.

Coverage/submission policy therefore remains a separate requirement.

## External source handling

`source-observation.json` freezes only public metadata and SHA-256 commitments to the external issue/comment bodies. It deliberately does not copy their long text.

The package records `MarkovianProtocol/audit-anchor` at observed main `ff6a0000810157f10b6a89ac09d1599eaf29f2bf`. Its README describes local recomputation, an external ledger anchor, and a Bitcoin/OpenTimestamps tier. This audit records those as mechanism descriptions only; it does not independently execute or certify them.

## Current verdict

```text
DESIGN_REQUIREMENTS_CLARIFIED_EXECUTABLE_EXTERNAL_ANCHOR_EVIDENCE_NOT_ADMITTED
```

Established by this audit:

- a claim-commitment layer is conceptually distinct;
- inclusion proof is a separate evidence layer;
- log-level append-only consistency is separately required;
- checkpoint-level non-equivocation/split-view resistance is separately required;
- existence-time evidence is distinct from universal trusted time.

Not established:

- C2PA adoption of #122;
- a conforming external anchor assertion;
- a real inclusion proof in UU-AAP;
- checkpoint consistency proof;
- witness/quorum/chain anchor verification;
- global non-equivocation;
- complete history;
- complete submission;
- trusted time;
- malicious behavior/fraud;
- canonical branch;
- authority/truth.

## Next gate

Only a separate explicit successor may attempt:

```text
EXECUTABLE_EXTERNAL_ANCHOR_PILOT_WITH_REAL_INCLUSION_AND_CHECKPOINT_ANTI_EQUIVOCATION_EVIDENCE
```

That pilot must consume real proof bytes and independently verify the concrete format. Proposal text, README claims, or an inclusion proof without checkpoint anti-equivocation evidence are insufficient.

## Non-effects

No external comment/post, no upstream mutation, no transparency-log deployment, no Bitcoin transaction, no C2PA assertion registration, no Stable Core/SPEC/Interface Registry mutation, no alert/remediation, no authority mutation, no release/tag.
