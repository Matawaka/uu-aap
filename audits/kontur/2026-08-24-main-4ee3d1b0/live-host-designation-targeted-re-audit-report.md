# KONTUR Live Host Designation — Targeted Post-Merge Re-audit

**Result:** `KONTUR_LIVE_HOST_DESIGNATION_BINDING_REAUDIT_PASS`  
**Finding:** `KONTUR-LIVE-HOST-DESIGNATION-BINDING-GAP`  
**Disposition:** `closed_verified`  
**Canonical successor revision:** `git:4ee3d1b0725a1bb30d6eafb87920ee4391690d20`  
**Canonical successor tree:** `67d0c43e9af456ef1b22a19978d790d16dd343a7`  
**Predecessor revision:** `git:91188043c22b4a563d460272c9a7b949769be4ae`  
**Merged remediation PR:** `#317`  
**Tested PR head:** `git:9a97e9a8a99d458da5b3368f3df20830c6bc5c7f`  
**Tested PR head tree:** `67d0c43e9af456ef1b22a19978d790d16dd343a7`

## Scope

This re-audit is narrowly limited to the human-designation binding gap discovered before any concrete live host is selected: supplying `hostId`, `operatorRef` and filesystem paths must not itself be structurally equivalent to an explicit human decision that designates a live KONTUR host.

The closure is limited to the path:

```text
explicit human live-host designation
→ designation-bound KONTURLiveHostProfile
→ independently observed KONTURLiveHostEligibilityReceipt
```

It does not reopen Formal Human Activation Review or assert any live activation authority.

## Merge integrity

PR #317 was merged onto exact predecessor `91188043c22b4a563d460272c9a7b949769be4ae`.

The resulting canonical `main` revision is `4ee3d1b0725a1bb30d6eafb87920ee4391690d20`, with parent exactly equal to that predecessor and GitHub verification `verified=true`, `reason=valid`.

The canonical successor tree `67d0c43e9af456ef1b22a19978d790d16dd343a7` is byte-identical to the tested PR-head tree on `9a97e9a8a99d458da5b3368f3df20830c6bc5c7f`. Therefore the squash merge did not alter the tested source tree.

## Re-audited designation boundary

The merged successor now requires a separate `KONTURLiveHostDesignationDecision v0.1` before a live-host profile can be constructed.

The decision binds:

- exact `system_id`, `server_instance_id` and `host_id`;
- a designated `operator_ref` inside the target;
- a separate `designator_ref` identifying who made the designation declaration;
- canonical repository, repository root and durable-ledger root;
- `runtime_boundary = host_local`;
- persistence, ledger-separation, CI and temporary-sandbox declarations;
- explicit typed confirmation `DESIGNATE_KONTUR_LIVE_HOST`;
- a required nonce that is included in the deterministic decision identity.

The decision safe effect is exactly:

```text
live_host_profile_may_be_built
```

It does not establish eligibility, execution authority or activation.

## Re-audited profile derivation

`KONTURLiveHostProfile` now requires both:

- `human_designation_binding` to the exact decision under RFC 8785 JCS + SHA-256; and
- `human_designation_evidence` containing the exact decision artifact.

The validator recomputes the designation binding, rejects a profile that predates the human designation, and requires all profile target fields and host declarations to match the designation exactly.

The designated operator is derived from `designation.target.operator_ref`; it is not inferred to be the same entity as `designator_ref`.

The public builder now has the bounded interface:

```text
buildLiveHostProfile({ createdAt, designationDecision })
```

The prior raw-parameter semantic shortcut is no longer a valid profile-construction path.

## Targeted CI evidence on tested head

The most directly relevant successful PR-head runs on `9a97e9a8a99d458da5b3368f3df20830c6bc5c7f` were:

- `32715475601` — KONTUR Live Host Eligibility v0.1 validation — success;
- `32715475638` — KONTUR Live Host Executor Gate v0.1 validation — success;
- `32715475630` — KONTUR Live Host Runtime Re-observation v0.1 validation — success;
- `32715475623` — KONTUR Activation Executor validation — success;
- `32715475544` — KONTUR Activation Preflight validation — success;
- `32715475606` — KONTUR Durable Responsibility Ledger validation — success.

The dedicated designation-to-eligibility workflow used distinct synthetic `designator_ref` and `target.operator_ref` values and asserted that the resulting profile preserves the designated operator role rather than collapsing it into the designator role.

The executor-gate and runtime-reobservation workflows continued to use only synthetic designation fixtures and confirmed that no positive live execution, Kernel activation or live durable-ledger write occurred in CI.

## Bounded conclusion

The finding `KONTUR-LIVE-HOST-DESIGNATION-BINDING-GAP` is `closed_verified` for the KONTUR v0.1 application-level designation/profile boundary.

Supplying host parameters is no longer sufficient to create a valid designated host profile. An explicit typed human designation decision must exist first, and the resulting profile is deterministically bound to that exact decision and its declared target.

## Explicit non-effects and remaining limitations

This PASS does **not** establish any of the following:

- designation of any concrete real machine by this re-audit;
- cryptographic authentication of the human designator;
- authentication of the designated operator;
- cryptographic machine identity, TPM, secure-boot, OS or hypervisor attestation;
- global uniqueness of designation nonces across independent histories;
- truth of persistence or non-CI/non-sandbox declarations without subsequent runtime observation;
- Human Activation Review approval;
- Activation Intent, preflight, final Human Execute command or activation;
- execution authority, responsibility acceptance, permission expansion or bypass;
- legal authority, truth certification, liability or universal canonicality.

No live Durable Responsibility Ledger was written by this re-audit.

## Evidence limitation

This re-audit independently inspected merged successor source and merge metadata and relies on exact tree equality to transfer successful PR-head CI evidence to the squash successor. A separate push-triggered workflow run against the squash successor SHA is not asserted as independently inspected here.

## Safe next step

The designation-binding remediation is closed. The next bounded operational step may proceed only from canonical successor `4ee3d1b0725a1bb30d6eafb87920ee4391690d20`:

1. explicitly choose the concrete persistent host target, designated operator, repository root and durable-ledger root;
2. produce a fresh human `KONTURLiveHostDesignationDecision` for those exact values;
3. derive the bound `KONTURLiveHostProfile`;
4. independently observe the actual host and require `KONTURLiveHostEligibilityReceipt = live_host_eligible`;
5. only then consider a fresh Formal Human Activation Review for the same canonical revision.

No concrete host choice is inferred by this report.
