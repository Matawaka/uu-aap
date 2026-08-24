### A. Canonical revision/tree/parent observed

- Remote `refs/heads/main`: `2a0fbd4d67e9db4913658da825336d2c4a8c2888`
- Tree: `db02276c32a374eb80bae1ed3701762a9dda7c92`
- Parent: `8a7f3d090cce6eeb4bbe3b281e6c1699fc7eb95e`
- Remote branch remained protected.
- Commit metadata reported a verified GitHub signature.
- PR #288 is merged; its merge commit is the audited revision.

### B. Revision gate result

PASS.

```
remote main
==
temporary checkout HEAD
==
2a0fbd4d67e9db4913658da825336d2c4a8c2888

HEAD^{tree}
==
db02276c32a374eb80bae1ed3701762a9dda7c92

HEAD^
==
8a7f3d090cce6eeb4bbe3b281e6c1699fc7eb95e
```

The temporary checkout was separate from the original repository and remained clean.

### C. Repository and provenance integrity

- `8a7f3d… -> 2a0fbd…` is one commit ahead with no divergence.
- The #288 diff contains exactly seven files: the Human Activation Review workflow, documentation, builder, two schemas, tests, and the Activation Boundary amendment.
- Architecture Convergence predecessor `724ebff7667354f619d0545539c9d513dc58521c` exists remotely and is the merge base/ancestor of the audited revision; the audited revision is six commits ahead.
- Historical tags observed remotely matched `FILE_HASHES.md`:
  - `v0.1 -> 16f83e655b80d1dabcd1d6b7533dc823796c767c`
  - `poai-authority-exp-v0.1 -> 2424e61846fd262f9c01ccc406931683d3c6e616`
  - `poai-ccrp-exp-v0.1 -> 33215e251310105e2fac591b17ae2d90522488d9`
  - `poai-ccrp-v0.1 -> 2c98d34ebfb5e86491bffb29a27e5a55b4db707e`
  - `uu-aap-product-protection-v0.1 -> 66cbeb97b512bc3d09babdfb43fbd4339bae4dda`
  - `uu-aap-licensing-v0.1 -> 541d345432de851b198fa459cb33447c096aebe7`
- Local CCRP release validation confirmed the `poai-ccrp-v0.1` tree `52207c5c0c1b516462221a47a3791ad97b02cc5f` and bound blob inventory.
- Historical tags, current main, copied bytes, repository control, and universal authority remain explicitly distinct.

### D. Workflow evidence inspected

Eight exact-SHA `push`, `main` runs were found. Every run reported:

- `head_sha = 2a0fbd4d67e9db4913658da825336d2c4a8c2888`
- `tree_id = db02276c32a374eb80bae1ed3701762a9dda7c92`
- `status = completed`
- `conclusion = success`

Covered workflows:

- Human Activation Review
- Project Readiness Checkpoint
- Readiness Aggregator
- Independent Audit Hardening
- Activation Preflight
- Activation Executor
- Responsibility Kernel
- Durable Responsibility Ledger

CCRP, Authority Root, PoAI Genesis, Rescue, CHSP, Sustainability, and standalone Architecture Convergence had no separate exact-SHA push run because #288 did not match their path-filtered triggers. Architecture Convergence was nevertheless rerun inside three exact-main jobs.

### E. Actions artifacts verified directly

Artifact inventories, exact run associations, archive sizes, and GitHub-recorded ZIP digests were verified:

- Human review: artifact `9499344935`, digest `abb2c0b0…8a60`
- Project checkpoint: `9499345092`, digest `d8ad0f62…f0a2`
- Readiness frontier: `9499346446`, digest `8e949fda…e95a`
- Activation preflight: `9499345253`, digest `7708864f…171c`
- Executor test evidence: `9499346227`, digest `9244145a…dd3c`
- Durable ledger test evidence: `9499345576`, digest `4d45c1c9…731e`

Exact logs directly exposed valid current-main verification receipts bound to the audited SHA, `push`, `refs/heads/main`, and identical GitHub/checkout SHAs. The Human Review job’s receipt bound activation frontier digest `13780f43ef1e55fd82858bf1412ac371ecbbf731ac907c060ae57538de126f0f`.

### F. Evidence access gaps

`EVIDENCE_ACCESS_GAP`:

- Artifact ZIPs were materialized only as temporary `oaiusercontent` file references. No available reader could inspect the ZIP bytes without using an additional domain surface.
- Therefore archive existence and ZIP digests are verified, but inner files were not independently extracted or hashed.
- `project-readiness-checkpoint.json`, the production Human Review packet, `readiness-signal.json`, `server-health.json`, and archived `activation-frontier.json` were validated by exact-SHA workflow steps but not independently read from their ZIPs.
- Several unchanged path-filtered planes have no standalone exact-SHA push run.
- The reconstructed local history lacks some intermediate commit objects; remote compare evidence and exact-main full-history workflows supplied the ancestry evidence.

### G. CCRP / Authority findings

- Protocol registry Git-binding validation: PASS.
- Registry resolver: PASS, including five fail-closed vectors.
- CCRP C0, C1, and C2: PASS locally.
- Non-live Authority tests: PASS.
- Protocol negotiation: PASS, nine vectors.
- Authority remained policy-relative and repository-scoped.
- No signature, provider response, repository control, or protocol result was converted into legal identity, universal truth, execution authority, or materialization.
- Live authority-dependent local suites were blocked by outbound-read restrictions; no fallback authority was inferred.

### H. Survival / Rescue findings

- Rescue v0.1 and v0.2 passed.
- Later suites encountered Windows durability incompatibilities around file/directory `fsync`; these are portability non-passes, not silent passes.
- Recovery remains distinct from canonical succession.
- Rescue evidence does not transfer repository ownership, legal authority, or universal canonicality.

### I. CHSP findings

- CHSP v0.1, v0.6, and v1.1 passed locally.
- v0.2–v0.5 and v0.7–v1.0 encountered Windows directory-`fsync` failures.
- CHSP stewardship remains distinct from repository ownership, canonical control, legal authority, and responsibility acceptance.

### J. Sustainability findings

- Contracts preserve capability ceilings, pause/degradation, recovery/resume, human observation, and future evolution.
- Five local suites could not start because `jsonschema` was unavailable.
- Recovery/resume returned exit 0 only because all six tests were skipped; it is not counted as PASS.
- No exact-SHA standalone Sustainability workflow was triggered by #288.
- No contradiction with KONTUR’s permission or activation boundaries was found, but current-environment regression evidence is incomplete.

### K. Architecture Convergence findings

- The assessor remains local-only and has no network/process execution authority.
- Exact-main workflows observed the declared predecessor using Git, required its commit object, and required ancestor status.
- Arbitrary SHA, observed mismatch, absent object, and non-ancestor cases remain fail-closed.
- Architecture Convergence does not claim current-main verification internally, activation, completeness forever, or execution authority.
- The exact-main Independent Audit Hardening and Human Review jobs reran the suite successfully.

### L. Project Readiness Checkpoint findings

- Local checkpoint tests: PASS.
- Exact-main checkpoint workflow: PASS.
- The builder continues to reject convergence manifests that claim `current_kontur_activation_frontier_verified=true`.
- The causal join remains:

```
historical Architecture Convergence
+
later exact current-main frontier verification
->
ProjectReadinessCheckpointReceipt
```

- A checkpoint remains evidence, not activation, responsibility acceptance, execution authority, or permanent readiness.
- Direct archived checkpoint content remains an evidence-access gap.

### M. KONTUR Readiness / Current-Main Frontier findings

- Current-main verifier local tests: PASS.
- Exact-main readiness workflow: PASS.
- Logged receipts required `push`, `refs/heads/main`, matching workflow/checkout SHAs, and the audited revision.
- Readiness summary reported `accepted=true`, `activation_prompt_may_be_requested=true`, and `kernel_activated=false`.
- Different workflows produced separate same-revision frontier receipts. This is legitimate independent reproduction; it does not make the receipts interchangeable without verifying their bindings.
- Current-main verification remains event/revision-scoped, not permanent.

### N. Human Activation Review v0.1 findings

Positive boundary findings:

- CI automatically builds only a review packet.
- The strongest packet state is `ready_for_human_activation_review`.
- Its only safe next step is `human_review_decision_only`.
- The workflow forbids decision construction, preflight, executor, kernel, ledger, network/process authority, Git push, credentials, and write permissions.
- A builder-produced positive decision can establish at most `activation_intent_preparation_may_be_requested=true`.
- All activation, responsibility, permission-expansion, ownership, legal, truth, and consensus claims remain false.

Confirmed Medium defects:

1. The packet builder does not verify that the checkpoint’s embedded `current_main_frontier_verification_binding` equals the separately supplied current-main receipt. A packet-only adversarial probe supplied two different same-revision receipts and returned:

   `ACCEPTED_INCONSISTENT_JOIN`

   The packet bound receipt B while its checkpoint remained bound to receipt A.
2. The packet builder checks selected predecessor fields rather than validating the complete checkpoint and current-main receipt contracts. A structurally incomplete or crafted predecessor can therefore reach `project_readiness_checkpoint_verified=true`.
3. The decision schema does not conditionally couple:
   - decision;
   - declaration type;
   - typed confirmation;
   - confirmation truth values;
   - safe effect;
   - `activation_intent_preparation_may_be_requested`.
   Builder output is consistent, but schema-only validation can accept contradictory combinations.
4. The decision builder revalidates only a shallow subset of packet invariants. It does not independently revalidate revision, project, predecessor bindings, all prohibited claims, or the required confirmation inventory.

The production workflow itself uses the same current-main file for its checkpoint and packet, so no production mismatch was observed. The reusable contract nevertheless fails closed incompletely.

### O. Activation Intent / Preflight boundary findings

The required future intent inputs remain separated and bound to:

- canonical Git revision;
- activation frontier;
- readiness signal and aggregation policy;
- responsibility and activation policies;
- system/server identity;
- server-health observation;
- holder, scopes, lease, readiness/fencing epoch;
- explicit human intent and nonce.

Exact-main preflight CI passed 34 negative vectors covering revision drift, binding substitution, stale evidence, policy drift, server identity/health drift, holder/scope/lease/epoch changes, parallel holder, current state, and stale human intent.

A positive preflight still establishes only `human_execute_step_may_proceed=true`, with kernel and responsibility state false.

No live intent or live preflight was constructed or invoked.

### P. Executor TEST-ONLY / Durable Ledger findings

Exact-main executor evidence reported:

- `execution_mode=test_only`
- durable genesis sequence `1`
- separate-process recovery confirmed
- `live_kontur_activated=false`
- 21 negative vectors

Exact-main durable-ledger evidence reported:

- `test_only_activation=true`
- three committed test entries
- recovered final lifecycle `retired`
- restart recovery verified
- consumed nonce count `1`
- 21 negative vectors
- legal responsibility, truth, and distributed consensus false

The tests cover distinct execute/intent nonces, expiry, stale preflight, Git/binding/holder/scope/lease/epoch substitution, parallel holder, existing genesis, kernel failure, pre/post-commit failures, ambiguous recovery, replay, writer locking, and corrupt ledger.

No live ledger path was used.

### Q. Stale/replay/drift attack findings

Protected successfully:

- stale checkout revision gate;
- old/current frontier revision mismatch;
- stale intent/preflight;
- intent and execute nonce separation;
- policy, holder, scope, lease, epoch, health, state, and Git drift;
- parallel holder and existing genesis;
- ledger replay and corruption.

Remaining Medium gap:

- Human Review documentation says a changed `main` makes a packet historical, but `buildReviewDecision` accepts no observed current-main revision and enforces no packet expiry or `reviewed_at >= prepared_at`.
- Decision nonce validation checks only a prefix; uniqueness/replay handling is not defined or enforced.
- A stale packet can therefore still produce a review-decision artifact, although that artifact cannot itself create intent, preflight, authority, or activation.

### R. Permission-ceiling findings

Confirmed:

```
existing_permissions_only
no_permission_bypass_or_escalation
permission_expansion_authorized = false
permission_bypass_authorized = false
```

Review approval cannot create new permission. Missing permission must fail in a later operation. No permission request, bypass, recovery, escalation, or credential substitution occurred during this audit.

### S. Liability / authority overclaim findings

The final repository-wide search found no KONTUR artifact silently setting activation, execution authority, ownership transfer, legal authority, truth certification, or distributed consensus true.

A scoped IAL example contains `responsibility_accepted=true`; it is an explicit protocol handoff example, not live KONTUR state or legal responsibility.

The following separations remain explicit:

```
Proof of Possibility != Proof of Intent != Proof of Action != Proof of Liability
readiness != activation
review approval != execution authority
action != liability
evidence != authority
observation != authorization
CHSP stewardship != ownership
recovery != canonical succession
repository control != universal authority
```

### T. Portability and environment limitations

- `PORTABILITY_GAP`: Windows rejects several POSIX directory-`fsync` patterns.
- `PORTABILITY_GAP`: several tests hard-code `/tmp`, which resolves unsuccessfully to `C:\tmp`.
- `ENVIRONMENT_LIMITATION`: no usable installed WSL/Linux runtime; WSL enumeration returned access denied.
- `ENVIRONMENT_LIMITATION`: local Python lacks `jsonschema`; no dependency installation or permission request was attempted.
- `ENVIRONMENT_LIMITATION`: live authority reads failed with network `EACCES`.
- `EVIDENCE_ACCESS_GAP`: artifact ZIP content was available only through temporary `oaiusercontent` references.

### U. Exact tests executed and results

Local results:

- Rescue:
  - `v0.1/test_rescue_assessor.py`: PASS
  - `v0.2/test_survival_plane.py`: PASS
  - v0.3: exit 1, `OSError [Errno 9] Bad file descriptor` during `fsync`
  - v0.4/v0.5: exit 1 through the same v0.3 durability prerequisite
  - v0.6: exit 1, Windows directory-open/`fsync` permission error
- CHSP:
  - v0.1, v0.6, v1.1: PASS
  - v0.2–v0.5, v0.7–v1.0: exit 1, Windows directory-`fsync` permission error
- Sustainability:
  - capability ceiling, exploratory disposition, human observation, pause degradation, kernel closure: exit 1, missing `jsonschema`
  - recovery/resume: exit 0, `OK (skipped=6)`; not counted as PASS
- Architecture Convergence full local suite: exit 1, missing `jsonschema`
- Project Readiness Checkpoint: PASS
- Audit Revision Gate: PASS
- Current-main Frontier Verification: PASS
- Responsibility Kernel: PASS, 20 negatives, final synthetic state `retired`
- Readiness Aggregator: exit 1, live authority read `EACCES`
- Preflight/Executor/Ledger local integrations: exit 1 at the same authority prerequisite; executor was not invoked locally
- Human Review builder/test syntax: PASS
- Both Human Review schemas: valid JSON
- Human Review decision test was not locally executed because it constructs decision artifacts.
- Packet substitution probe: exit 0 with `ACCEPTED_INCONSISTENT_JOIN`
- PoAI document suites: all 16 PASS; three required explicit temporary output paths because of `/tmp`
- CCRP C0/C1/C2: PASS
- CCRP C3: core assertions passed, overall exit 1 at hard-coded `/tmp/ccrp-c4`
- CCRP C4: exit 1, missing `jsonschema`
- Registry validator and resolver: PASS
- Non-live authority and protocol negotiation: PASS
- Attestation and IAL: exit 1 at blocked live authority setup

Exact-main Linux CI additionally passed Human Review, Audit Hardening, Architecture Convergence, Checkpoint, Readiness, Current-main Verification, Preflight, Executor, Kernel, and Ledger suites.

### V. GitHub workflow/run evidence used

- [Activation Preflight — 32663441645](https://github.com/Matawaka/uu-aap/actions/runs/32663441645)
- [Independent Audit Hardening — 32663441625](https://github.com/Matawaka/uu-aap/actions/runs/32663441625)
- [Durable Responsibility Ledger — 32663441597](https://github.com/Matawaka/uu-aap/actions/runs/32663441597)
- [Activation Executor — 32663441587](https://github.com/Matawaka/uu-aap/actions/runs/32663441587)
- [Responsibility Kernel — 32663441569](https://github.com/Matawaka/uu-aap/actions/runs/32663441569)
- [Project Readiness Checkpoint — 32663441553](https://github.com/Matawaka/uu-aap/actions/runs/32663441553)
- [Readiness Aggregator — 32663441552](https://github.com/Matawaka/uu-aap/actions/runs/32663441552)
- [Human Activation Review — 32663441549](https://github.com/Matawaka/uu-aap/actions/runs/32663441549)

### W. Remaining Low findings

- `reviewer_ref` is declared identity only; it is not cryptographically authenticated.
- Packet/decision binding schemas permit arbitrary nonempty `artifact_type` values instead of fixing the expected predecessor type.
- Decision and packet timestamps have no monotonic-order constraint.
- Thirty-day retention for readiness/review/checkpoint archives reduces long-term independent evidence availability.

### X. Remaining Medium findings

1. Review-packet predecessor validation is incomplete, including a confirmed checkpoint/frontier substitution acceptance.
2. Decision JSON Schema does not enforce outcome/declaration/effect/confirmation semantic coupling.
3. Decision construction shallowly revalidates its packet and does not enforce current-main freshness, packet expiry, timestamp order, or nonce replay protection.

All three are bounded below activation authority, but they weaken the formal evidence basis for a human review.

### Y. Remaining High/Critical findings

None found.

### Z. Current KONTUR state

- `kernel_activated=false`
- No live responsibility state was created.
- No responsibility acceptance was recorded.
- No execution authority was granted.
- No activation intent was created.
- No live preflight was run.
- No execute command was created.
- No live executor was invoked.
- CI executor/ledger evidence is explicitly test-only.
- No GitHub or canonical-origin mutation occurred.
- Temporary checkout remained clean.
- Original checkout remained clean at `9894f6be4be663863696c5981d3d68c3c6777525`.

### AA. Human activation review packet status

- Exact-main Human Review workflow and packet archive existence: verified.
- Exact-main workflow production and schema/non-effect validation: verified.
- Inner archived packet bytes and digest: not independently materialized — `EVIDENCE_ACCESS_GAP`.
- No Human Activation Review decision exists from this audit.
- Packet readiness does not authorize activation-intent preparation.

### AB. Minimal recommended changes ordered by severity

1. Require complete schema/semantic validation of checkpoint and current-main receipts, and require exact ref/digest equality between the checkpoint’s embedded frontier binding and the separately supplied receipt.
2. Add decision-schema conditional branches coupling each decision to its exact declaration, token, confirmations, safe effect, and claim value.
3. Make decision construction revalidate the complete packet, accept an observed current-main revision, reject historical/expired packets, enforce timestamp order, and define nonce replay handling.
4. Add permanent negative tests for all three cases above.
5. Replace hard-coded `/tmp` and unconditional POSIX directory-`fsync` assumptions with platform-aware helpers.
6. Publish a small artifact manifest containing inner file names and SHA-256 digests in directly inspectable job logs or an already-accessible evidence surface.
7. Provide a pinned local audit environment containing `jsonschema` and a usable Linux durability runner.

### AC. Whether any repository change is required before formal human activation review

Yes. The three Medium Human Review evidence-contract findings should be corrected and regression-tested before treating the generated packet as the basis of a formal human activation review.

This requirement does not authorize activation or any intermediate activation action.

### AD. Final bounded conclusion

READY\_FOR\_MORE\_TESTING