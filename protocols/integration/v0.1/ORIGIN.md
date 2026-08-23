# UU-AAP Integration v0.1 — Typed Origin and Provenance Completion

**Status:** experimental integration layer  
**Scope:** machine-readable semantic origin and exact-byte completion of the previously bounded provenance frontier.

## Why this layer exists

`ProvenanceClosureReceipt v0.1` intentionally stopped at the earliest evidence it could actually bind. It proved the machine suffix from `RevalidationReceipt` through policy-relative canonicalization, while reporting that standalone `ContextFrame` / `Intent` provenance and six upstream evidence byte bindings were still absent.

This layer closes those two gaps without changing any earlier artifact's meaning.

## New origin chain

```text
CCRP WorkContext inputs
  -> ContextFrame
  -> IntentArtifact
  -> CCRPOperationIntent
  -> ResponsibilityHandoff
  -> Authority verification
  -> CCRP execution admission
  -> PoAI+CCRP pre-materialization
  -> CommitDecision
  -> CommitReceipt
  -> ObservationReceipt
  -> CanonicalizationReceipt
  -> ProvenanceClosureReceipt (bounded predecessor)
  -> ProvenanceCompletionReceipt
```

## ContextFrame

`ContextFrame` is a normalized machine-context artifact. It binds the exact CCRP WorkContext inputs used by the integration harness with RFC 8785 JCS + SHA-256 digests and fixes the target/base-revision frontier from which the intent is formed.

It does **not** claim to capture every human, organizational, conversational or cognitive fact that may have influenced the work.

Therefore:

```text
machine_context_frontier_established = true
human_context_exhaustively_captured = false
```

## IntentArtifact

`IntentArtifact` is the first standalone typed intent in this integration chain. It binds:

- the exact ContextFrame ref + digest;
- action;
- target;
- CCRP operation ref;
- base revision;
- the declared purpose of requesting materialization execution subject to later responsibility, authority and execution-admission checks.

The intent is deliberately earlier/weaker than responsibility acceptance, authority, execution admission or materialization permission.

```text
Intent declared != Responsibility accepted
Intent declared != Authority
Intent declared != Execution admitted
```

## OriginEnvelope

`OriginEnvelope` binds the exact ContextFrame, IntentArtifact and CCRPOperationIntent bytes into one declared machine-semantic origin frontier.

It establishes only:

`machine_semantic_origin_established = true`

and keeps:

`human_cognitive_origin_established = false`.

This distinction prevents a machine-readable intent from being misrepresented as proof of a person's private thoughts, motives or complete subjective context.

## Same-execution EvidenceBundle

The earlier bounded closure carried exact refs to six upstream artifacts but did not have their bytes.

`origin-capture-preload.js` is loaded before the existing decision harness. It intercepts the first actual `approved` `evaluateCommitDecision(input, evidence)` invocation and exports the exact objects passed to that evaluation:

- ResponsibilityHandoffResult;
- ResponsibilityHandoffOffer;
- ResponsibilityHandoffAcceptance;
- PoAI AuthorityVerificationResult;
- CCRPExecutionAdmissionResult;
- PoAICCRPPreMaterializationResult;
- the CCRPOperationIntent itself.

The bundle also binds the exact CommitDecisionInput and CommitDecisionResult digests from that same evaluation call.

This is stronger than re-running the upstream logic and obtaining equivalent objects later:

```text
same decision execution capture != reconstructed equivalent evidence
```

## ProvenanceCompletionReceipt

`ProvenanceCompletionReceipt` consumes:

- the merged semantics of the bounded ProvenanceClosureReceipt;
- ContextFrame;
- IntentArtifact;
- OriginEnvelope;
- same-execution IntegrationEvidenceBundle;
- CommitDecisionInput / Result;
- CanonicalizationReceipt.

It verifies exact refs, RFC 8785 JCS + SHA-256 artifact digests and cross-stage semantics for:

- intent -> operation;
- intent -> responsibility handoff;
- accepted receiving party / executor;
- authority subject/scope/target;
- CCRP admission operation/revision;
- pre-materialization action/target/authority/admission refs;
- the bounded closure's evidence frontier;
- policy-relative canonicality already established downstream.

Only after all of those checks may it state:

```text
context_frame_provenance_established = true
intent_provenance_established = true
all_upstream_evidence_artifact_bytes_bound = true
machine_semantic_origin_provenance_complete = true
```

## Assurance boundary

A complete machine-semantic provenance chain is still not a truth engine.

The completion receipt MUST retain:

```text
human_cognitive_origin_provenance_established = false
remote_branch_or_ref_canonicality_established = false
poai_materialization_event_recorded = false
poai_successor_record_identity_inferred = false
universal_canonicality_established = false
truth_certified = false
causal_proof_certified = false
legal_responsibility_determined = false
legal_effect_established = false
moral_correctness_established = false
poai_v_conformance_established = false
```

Core invariant:

```text
complete machine provenance
  != complete human cognition
  != causal proof
  != legal blame
  != truth
  != universal canonicality
```

## Next architectural layer

Once semantic origin is machine-complete, the next useful boundary is not another stronger canonicality flag. It is a typed **Outcome / ResponsibilityTrace** layer.

That future layer should bind later observed consequences back to this responsible event chain and preserve probability / uncertainty / attribution boundaries. It must be able to say that an outcome is associated with, downstream of, or within the responsibility horizon of an event without silently converting provenance into proven causality, moral blame or legal liability.
