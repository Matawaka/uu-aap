'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

if ((process.argv[1] || '').endsWith('protocols/integration/v0.1/test-commit-decision.js')) {
  const evaluatorPath = path.resolve(__dirname, 'evaluate-commit-decision.js');
  const evaluator = require(evaluatorPath);
  const original = evaluator.evaluateCommitDecision;
  let captured = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function canonicalDigest(value) {
    const canonical = Binding.canonicalize(value, '$');
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  function digest(value) {
    return {
      canonicalization: 'RFC8785-JCS',
      digest_algorithm: 'SHA-256',
      digest_encoding: 'hex',
      value: canonicalDigest(value)
    };
  }

  function exported(artifactRef, artifact) {
    return {
      artifact_ref: artifactRef,
      artifact_type: artifact.artifact_type || 'UnknownArtifact',
      digest: digest(artifact),
      artifact: clone(artifact)
    };
  }

  evaluator.evaluateCommitDecision = function captureEvaluate(input, evidence) {
    const result = original(input, evidence);
    if (!captured && result && result.decision === 'approved') {
      captured = {
        input: clone(input),
        evidence: clone(evidence),
        result: clone(result)
      };
    }
    return result;
  };

  process.on('exit', () => {
    if (!captured) return;

    const repoRoot = path.resolve(__dirname, '../../..');
    const contextPath = process.env.UU_AAP_CONTEXT_FRAME_PATH || '/tmp/uu-aap-context-frame.json';
    const intentPath = process.env.UU_AAP_INTENT_ARTIFACT_PATH || '/tmp/uu-aap-intent-artifact.json';
    const originPath = process.env.UU_AAP_ORIGIN_ENVELOPE_PATH || '/tmp/uu-aap-origin-envelope.json';
    const bundlePath = process.env.UU_AAP_EVIDENCE_BUNDLE_PATH || '/tmp/uu-aap-evidence-bundle.json';

    const { input, evidence, result } = captured;
    const operation = evidence.operation;
    const head = operation.base_revision.slice(4);
    const sourceContextPaths = [
      'proposals/ccrp/examples/c0-same-actor-chat-a.work-context.json',
      'proposals/ccrp/examples/c0-same-actor-chat-b.work-context.json'
    ];
    const sourceContexts = sourceContextPaths.map((relative) => {
      const artifact = JSON.parse(fs.readFileSync(path.resolve(repoRoot, relative), 'utf8'));
      return {
        artifact_type: artifact.artifact_type,
        artifact_ref: artifact.context_id,
        digest: digest(artifact)
      };
    });

    const contextFrame = {
      $schema: './origin-provenance.schema.json#/$defs/contextFrame',
      artifact_type: 'ContextFrame',
      artifact_version: '0.1',
      context_frame_id: `urn:uu-aap:context-frame:${head}`,
      captured_at: evidence.revalidationReceipt.observed_at,
      construction_mode: 'normalized_from_declared_machine_context',
      target_scope: [input.target],
      base_revision: operation.base_revision,
      source_contexts: sourceContexts,
      claims: {
        machine_context_frontier_established: true,
        human_context_exhaustively_captured: false,
        authority_established: false,
        execution_admitted: false,
        outcome_observed: false,
        truth_certified: false
      }
    };

    const intentArtifact = {
      $schema: './origin-provenance.schema.json#/$defs/intentArtifact',
      artifact_type: 'IntentArtifact',
      artifact_version: '0.1',
      intent_id: evidence.handoffOffer.effect_ref.intent_id,
      declared_at: operation.created_at,
      context_frame_ref: contextFrame.context_frame_id,
      context_frame_digest: digest(contextFrame),
      action: input.action,
      target: input.target,
      operation_ref: operation.operation_id,
      base_revision: operation.base_revision,
      purpose: 'request_materialization_execution_subject_to_responsibility_authority_and_admission',
      claims: {
        intent_declared: true,
        responsibility_accepted: false,
        authority_established: false,
        execution_admitted: false,
        materialization_permitted: false,
        outcome_observed: false,
        truth_certified: false
      }
    };

    const originEnvelope = {
      $schema: './origin-provenance.schema.json#/$defs/originEnvelope',
      artifact_type: 'OriginEnvelope',
      artifact_version: '0.1',
      origin_envelope_id: `urn:uu-aap:origin-envelope:${head}`,
      recorded_at: evidence.revalidationReceipt.observed_at,
      origin_mode: 'normalized_machine_semantic_origin',
      context_frame_binding: {
        stage: 'context_frame',
        artifact_type: contextFrame.artifact_type,
        artifact_ref: contextFrame.context_frame_id,
        digest: digest(contextFrame)
      },
      intent_binding: {
        stage: 'intent',
        artifact_type: intentArtifact.artifact_type,
        artifact_ref: intentArtifact.intent_id,
        digest: digest(intentArtifact)
      },
      operation_binding: {
        stage: 'operation',
        artifact_type: operation.artifact_type,
        artifact_ref: operation.operation_id,
        digest: digest(operation)
      },
      semantic_binding: {
        action: input.action,
        target: input.target,
        operation_ref: operation.operation_id,
        base_revision: operation.base_revision
      },
      claims: {
        context_frame_bound: true,
        intent_bound: true,
        operation_bound: true,
        machine_semantic_origin_established: true,
        human_cognitive_origin_established: false,
        truth_certified: false,
        causal_proof_certified: false
      }
    };

    const upstream = {
      handoff_result: exported(input.evidence_refs.handoff_result_ref, evidence.handoffResult),
      handoff_offer: exported(input.evidence_refs.handoff_offer_ref, evidence.handoffOffer),
      handoff_acceptance: exported(input.evidence_refs.handoff_acceptance_ref, evidence.handoffAcceptance),
      authority_verification: exported(input.evidence_refs.authority_verification_ref, evidence.authorityVerification),
      execution_admission: exported(input.evidence_refs.execution_admission_ref, evidence.executionAdmission),
      pre_materialization: exported(input.evidence_refs.pre_materialization_ref, evidence.preMaterializationResult)
    };

    const bundleSeed = [
      canonicalDigest(input),
      canonicalDigest(result),
      canonicalDigest(operation),
      ...Object.values(upstream).map((entry) => entry.digest.value)
    ].join('|');
    const bundleHash = crypto.createHash('sha256').update(bundleSeed, 'utf8').digest('hex');

    const evidenceBundle = {
      $schema: './origin-provenance.schema.json#/$defs/evidenceBundle',
      artifact_type: 'IntegrationEvidenceBundle',
      artifact_version: '0.1',
      bundle_id: `urn:uu-aap:integration-evidence-bundle:${bundleHash.slice(0, 24)}`,
      captured_at: evidence.revalidationReceipt.decision_at,
      decision_input_ref: input.decision_input_id,
      decision_input_digest: digest(input),
      decision_result_ref: result.decision_id,
      decision_result_digest: digest(result),
      operation: exported(operation.operation_id, operation),
      upstream,
      claims: {
        same_decision_execution_captured: true,
        all_upstream_evidence_artifact_bytes_exported: true,
        reconstructed_equivalent_evidence_used: false
      }
    };

    fs.writeFileSync(contextPath, JSON.stringify(contextFrame, null, 2) + '\n');
    fs.writeFileSync(intentPath, JSON.stringify(intentArtifact, null, 2) + '\n');
    fs.writeFileSync(originPath, JSON.stringify(originEnvelope, null, 2) + '\n');
    fs.writeFileSync(bundlePath, JSON.stringify(evidenceBundle, null, 2) + '\n');
  });
}
