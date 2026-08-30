# Matawaka Workbench v0.28 — Transport Adversarial Evidence Closure

**Design status:** prepared implementation target  
**Predecessor:** `workbench-v0.27-accepted` / `8cdea04c2304f8589e9120d0451efa9e7e6b2f2b`  
**Boundary:** evidence closure only; no authority expansion  
**Target local tag after acceptance:** `workbench-v0.28-accepted`

## 1. Purpose

v0.28 closes the exact positive and negative transport propositions already demonstrated by v0.26 and v0.27.

```text
exact v0.26 independence receipt bytes
+
exact v0.27 adversarial matrix bytes
+
one shared exact source transport SHA-256
->
byte-bound transport adversarial evidence closure
```

It must prove only that:

1. the retained passing v0.26 receipt demonstrates same-machine replay/materialization from one exact copied transport after the copy boundary;
2. the retained passing v0.27 matrix is cryptographically bound to that exact v0.26 receipt and the same exact transport SHA-256;
3. all three bounded adversarial mutations were refused before evidence materialization;
4. neither source transport nor main Workbench repository changed during the constituent proofs;
5. the closure itself does not mint new operational authority.

## 2. Required input chain

### v0.27 matrix

The closure starts from the retained passing v0.27 matrix rather than independently guessing a v0.26 artifact.

Required:

```text
Schema  = matawaka.workbench-recovery-transport-adversarial-control-matrix/v0.27
Version = 0.27.0
Passed  = true
Status  = TRANSPORT_ADVERSARIAL_CONTROLS_PASSED
```

It must bind the **exact matrix file bytes** with SHA-256 at closure time.

The implementation must reject ambiguity rather than combining multiple unrelated passing matrices. The selected matrix must correspond to the accepted v0.27 state and report an unchanged main repository.

### v0.26 independence receipt

The v0.26 receipt must be resolved through the v0.27 matrix fields:

```text
SourceIndependenceArtifactPath
SourceIndependenceArtifactSha256
```

The closure must read that exact file and require its current SHA-256 to equal:

```text
c94bbb3ec3b7ec577f1199bffadde02ac84bac9c52139b74ccb73e064793a543
```

Required v0.26 semantic state:

```text
Schema = matawaka.workbench-recovery-evidence-transport-independence-drill/v0.26
Version = 0.26.0
Passed = true
Status = INDEPENDENT_LOCAL_TRANSPORT_CAPSULE_VERIFIED
MainRepositoryUnchanged = true
CopiedTransportByteIdentical = true
CopiedTransportInspectionVerified = true
ExactTransportFileSetVerified = true
TransportPayloadDigestsVerified = true
TransportManifestDigestReproduced = true
CapsuleManifestDigestReproduced = true
EvidenceEnvelopeDigestReproduced = true
IndependentMaterializedCopiesVerified = true
ReplayUsedOnlyCopiedTransportBytes = true
OriginalEvidencePathAccessAttemptsDuringTransportReplay = 0
OriginalTransportZipRequiredAfterCopy = false
OriginalRelocationRootRequiredForDrill = false
OriginalReplayRootRequiredForDrill = false
OriginalEvidenceArtifactsRequiredForDrill = false
HistoricalAbsolutePathsDereferencedDuringTransportReplay = false
LocalTransportIndependenceDemonstrated = true
AuthorityLimitationsPreserved = true
```

## 3. Common transport binding

Both receipts must resolve to the same exact transport identity:

```text
692d0dfb375dd07c482f80accb0bf3250fe6f10332506dcb6fb35fee250ecdf8
```

At minimum require exact equality across:

```text
v0.27.SourceTransportZipSha256
v0.26.SourceTransportZipSha256
v0.26.CopiedTransportZipSha256
```

The closure does **not** need authority to reopen or materialize the transport. It closes evidence about already-observed behavior; it does not repeat v0.26 or v0.27 implicitly.

This distinction is mandatory:

```text
Evidence that an exact transport was usable != authority to use it now.
Evidence that mutations were refused != authority to create new mutations now.
Closure over receipts != replay of their side effects.
```

## 4. Required negative matrix semantics

The exact v0.27 matrix must require:

```text
CopyByteDriftAfterBindingRefused = true
ExtraZipEntryRefused = true
TransportManifestDriftRefused = true
AllControlsRefusedBeforeEvidenceMaterialization = true
SourceTransportUnchanged = true
MainRepositoryUnchanged = true
```

For every scenario:

```text
Passed = true
Rejected = true
EvidenceMaterializationAttempted = false
EvidenceMaterializationRootCreated = false
CandidateTransportPreservedAfterRefusal = true
SourceTransportUnchanged = true
```

The exact observed adversarial candidate hashes remain evidence, not reusable permissions:

```text
copy-byte-drift:       60bebb261744358a4e07d7b6672ea705a0328b981d071a354cd6dccead77c53b
extra-zip-entry:       6fdba0636740aae212b71be7ba2b91dfe84b3defd39cbb52a8a83eb622ee7177
transport-manifest:    9c93f08da1a82add2d632c1c8fc6ed89dfe81de8fd5f89675459c2af9f4bf599
```

## 5. Proposed closure receipt

Suggested schema:

```text
matawaka.workbench-recovery-transport-adversarial-evidence-closure/v0.28
```

Suggested success status:

```text
CLOSED_BYTE_BOUND_TRANSPORT_ADVERSARIAL_EVIDENCE_ENVELOPE
```

Minimum success surface:

```json
{
  "Version": "0.28.0",
  "Closed": true,
  "Status": "CLOSED_BYTE_BOUND_TRANSPORT_ADVERSARIAL_EVIDENCE_ENVELOPE",
  "PositiveIndependenceReceiptVerified": true,
  "AdversarialControlMatrixVerified": true,
  "CommonSourceTransportBindingVerified": true,
  "AllAdversarialControlsRefusedBeforeEvidenceMaterialization": true,
  "PositiveNegativeEvidencePairClosed": true,
  "AuthorityLimitationsPreserved": true,
  "AuthorityExpansionDetected": false,
  "MainRepositoryUnchanged": true
}
```

The receipt should also record:

- exact v0.26 artifact path, SHA-256, schema/version/status;
- exact v0.27 matrix path, newly computed SHA-256, schema/version/status;
- exact common source transport SHA-256;
- exact v0.26 source transport manifest SHA-256 (`22aa0903566cab24bc8cfbd08f49df66ff584b7d90328d045b410c6422f46ad4`);
- exact three v0.27 adversarial candidate SHA-256 values;
- main HEAD/tags/dirty paths before and after closure;
- explicit UI confirmation fields;
- authority and non-effects block.

## 6. Closure digest

Do not hash a path or a parsed-object approximation and call it byte binding.

The closure digest must include the exact SHA-256 of both retained receipt files plus the common exact transport SHA-256 in a fixed role order. Reuse an existing Workbench deterministic digest construction pattern where possible rather than introducing an incompatible canonicalization convention solely for v0.28.

Normative role order:

```text
positive-transport-independence-receipt
adversarial-transport-control-matrix
common-source-transport
```

A valid closure digest therefore binds **roles + exact receipt bytes + exact transport identity**, not only semantic booleans.

## 7. Fail-closed cases

v0.28 must refuse closure if any of the following occurs:

- v0.27 matrix file bytes drift after selection;
- v0.27 matrix no longer passes its exact schema/version/status checks;
- v0.27 points to a missing v0.26 receipt;
- current v0.26 receipt SHA-256 differs from `SourceIndependenceArtifactSha256` carried by v0.27;
- v0.26 schema/version/status no longer match the passing independence proof;
- any required positive-independence assertion is false;
- any required adversarial refusal assertion is false;
- any scenario reports evidence materialization attempted or a materialization root created;
- v0.26/v0.27/common transport SHA-256 values disagree;
- the main Workbench repository is dirty before closure;
- main HEAD/tag/dirty state changes during closure;
- a constituent receipt claims an authority level inconsistent with the bounded evidence line;
- closure output path would escape the fixed Workbench artifact root.

Failure must preserve the inputs. A failed closure is evidence of a failed closure attempt, not permission to repair, rewrite, delete, replay, or recover anything.

## 8. Authority

Suggested operation:

```text
workbench.maintenance.transport-adversarial-evidence-closure
```

Allowed effects only:

- read the selected exact v0.27 matrix bytes;
- resolve and read the exact v0.26 receipt referenced by that matrix;
- calculate SHA-256 over the two receipt files;
- validate the fixed positive/negative/common-binding assertions;
- write one closure receipt under a fixed Workbench artifact directory.

Suggested artifact root:

```text
Workbench/artifacts/recovery-transport-adversarial-evidence-closures
```

Explicitly unauthorized:

- mutate either source receipt;
- mutate/delete/copy the source transport as part of closure;
- inspect or materialize transport payload entries as a hidden replay;
- create a recovery materialization root;
- execute recovery or rollback;
- mutate Workbench source;
- build, checkpoint, tag, fetch, push, or access network as part of the closure action;
- mutate Matawaka catalog repositories;
- Agent Execute or ActionPermit creation;
- producer-authentication claims;
- cross-machine/cross-OS portability claims;
- production-main recovery claims;
- general failure-recovery claims;
- canonical UU-AAP conformance;
- Stable Core or interface-registry promotion.

## 9. UI boundary

After `workbench-v0.28-accepted`, expose one explicit post-acceptance maintenance action, for example:

```text
Transport closure
```

It must require an explicit confirmation dialog before reading/binding the retained v0.26/v0.27 evidence pair and writing the closure receipt.

The button does not inherit authority from Self-test or acceptance. Acceptance proves the v0.28 implementation passed its local acceptance gates; the closure button is a separate human-authorized evidence action.

## 10. Expected implementation surface

The narrow implementation should normally require only the v0.28 patch documentation, acceptance/checkpoint version bindings, UI button/handler, and one dedicated closure service. It should not modify transport materialization/recovery execution code merely to create the closure.

Conceptually:

```text
PATCH-v0.28.md
AcceptanceHarness.cs
LocalCheckpointService.cs
MainWindow.xaml
MainWindow.xaml.cs
RecoveryTransportAdversarialEvidenceClosureService.cs
```

This list is an implementation target, not a substitute for the exact v0.27 source bytes.

## 11. Acceptance target

After update materialization/build/candidate launch and v0.28 Self-test, acceptance should remain the ordinary explicit Workbench acceptance boundary.

After `workbench-v0.28-accepted`, the separate **Transport closure** action should produce a receipt whose key aggregate is:

```text
Closed: true
Status: CLOSED_BYTE_BOUND_TRANSPORT_ADVERSARIAL_EVIDENCE_ENVELOPE
PositiveIndependenceReceiptVerified: true
AdversarialControlMatrixVerified: true
CommonSourceTransportBindingVerified: true
AllAdversarialControlsRefusedBeforeEvidenceMaterialization: true
PositiveNegativeEvidencePairClosed: true
AuthorityLimitationsPreserved: true
AuthorityExpansionDetected: false
MainRepositoryUnchanged: true
```

## 12. What v0.28 changes epistemically

Before v0.28 the project has two compatible observations:

```text
v0.26: exact copied bytes can remain independently usable.
v0.27: bounded mutations of those bytes/bindings fail closed.
```

v0.28 adds one new claim only:

```text
Those positive and negative observations form one byte-bound evidence envelope about the same exact transport identity.
```

It does **not** add:

```text
verified producer identity
cross-machine portability
cross-OS portability
production recovery
automatic recovery
new execution authority
```

The strengthened invariant is therefore:

```text
Transport evidence closure != transport authority.
Positive proof + negative proof != broader permission.
Byte-bound evidence envelope != authenticated producer envelope.
```