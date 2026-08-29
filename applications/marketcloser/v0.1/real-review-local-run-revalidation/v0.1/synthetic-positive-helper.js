'use strict';

const fs = require('fs');
const path = require('path');
const Permit = require(path.resolve(__dirname, '../../real-review-run-permit/v0.1/permit.js'));
const Gate = require(path.resolve(__dirname, '../../real-review-run-authority-gate/v0.1/authority-gate.js'));
const Bridge = require(path.resolve(__dirname, '../../minimized-real-review-bridge/v0.1/bridge.js'));
const Core = require(path.resolve(__dirname, '../../../../../proposals/poai/authority/tools/authority-core.js'));

const clone = v => JSON.parse(JSON.stringify(v));
const gateFixture = path.resolve(__dirname, '../../real-review-run-authority-gate/v0.1/examples/synthetic-authority-wait.input.json');

async function buildPositive({ gatePath = '/tmp/marketcloser-revalidation-positive-gate.json', materializationPath = '/tmp/marketcloser-revalidation-positive-materialization.json' } = {}) {
  const input = JSON.parse(fs.readFileSync(gateFixture, 'utf8'));
  const bridgeInput = Gate.loadBridgeInput(input.bridge_source);
  const bridgeReceipt = Bridge.deriveReceipt(bridgeInput);
  const target = Gate.requiredTargetForBridgeReceipt(bridgeReceipt);
  const subject = clone(input.effect_actor_subject);

  const root = {
    artifact_type: 'PoAIAuthorityRoot', artifact_version: '0.1-experimental',
    root_id: 'urn:poai:authority-root:marketcloser-revalidation-synthetic:1', root_version: 1,
    root_mode: 'contractual_root', governance_scope: target, target,
    accepted_actions: [Gate.REQUIRED_SCOPE, Core.POLICY_CONTROL_SCOPE],
    controller_rule: {
      mode: 'single_controller',
      controller_id: 'actor:synthetic-marketcloser-revalidation-controller',
      controller_key_ref: 'key:synthetic-marketcloser-revalidation-controller'
    },
    root_evidence_rule: {
      mode: 'synthetic_conformance', resource: target,
      accepted_evidence_types: ['synthetic_authority_evidence']
    },
    effective_from: '2026-08-29T02:00:00Z', effective_until: '2026-08-29T03:00:00Z',
    delegation_policy: { mode: 'non_delegable', max_depth: 0 },
    policy_control_rule: { required_scope: Core.POLICY_CONTROL_SCOPE },
    transition: { status: 'genesis', previous_root_ref: null, authorized_by_previous_controller: null, authorization_evidence_refs: [] },
    claims: {
      legal_identity_verified: false, legal_authority_established: false,
      universal_authority_established: false, truth_certified: false,
      causal_proof_certified: false, legal_responsibility_determined: false,
      moral_correctness_established: false, poai_v_conformance_established: false
    }
  };
  if (Core.validateRoot(root).length) throw new Error(`synthetic root invalid: ${Core.validateRoot(root).join(', ')}`);
  const policy = {
    policy_id: 'marketcloser-revalidation-synthetic-authority-policy',
    canonicality_scope: target,
    authority_verification_rule: {
      required_target: target,
      root_acceptance_rule: {
        accepted_root_ids: [root.root_id], accepted_root_digests: [], allowed_root_modes: ['contractual_root'],
        require_root_evidence: true, allowed_evidence_types: ['synthetic_authority_evidence'], exact_scope_match: true
      }
    }
  };
  const controller = { id: root.controller_rule.controller_id, key_ref: root.controller_rule.controller_key_ref };
  const grant = await Core.buildGrant({
    root, issuer: controller, subject, actionScope: Gate.REQUIRED_SCOPE, target, governanceScope: target,
    validFrom: '2026-08-29T02:05:00Z', validUntil: '2026-08-29T02:50:00Z',
    delegationMode: 'non_delegable', remainingDepth: 0, policyRef: policy.policy_id,
    issuedAt: '2026-08-29T02:05:00Z'
  });
  const rootEvidence = {
    observed: true, evidence_type: 'synthetic_authority_evidence', target,
    refs: ['urn:synthetic:marketcloser:revalidation-authority-evidence:001']
  };
  const gateEvaluatedAt = '2026-08-29T02:08:00Z';
  const authorityResult = await Core.verifyAuthority({
    root, grants: [grant], policy, rootEvidence, subject,
    requiredScope: Gate.REQUIRED_SCOPE, target, at: gateEvaluatedAt
  });
  if (authorityResult.status !== 'established' || Core.validateVerificationResult(authorityResult).length) {
    throw new Error(`synthetic authority result invalid: ${(authorityResult.errors || []).join(', ')}`);
  }

  const positiveGateInput = clone(input);
  positiveGateInput.authority_verification_result = authorityResult;
  positiveGateInput.evaluated_at = gateEvaluatedAt;
  Gate.rehash(positiveGateInput);
  fs.writeFileSync(gatePath, `${JSON.stringify(positiveGateInput, null, 2)}\n`);
  const gateReceipt = Gate.deriveReceipt(positiveGateInput);
  if (gateReceipt.classification !== 'SYNTHETIC_AUTHORITY_CONFORMANCE_READY') throw new Error('synthetic gate did not become ready');

  const materializationInput = {
    protocol: Permit.PROTOCOL,
    version: Permit.VERSION,
    artifact_type: Permit.INPUT_TYPE,
    materialization_id: 'urn:uu-aap:marketcloser:real-review-run-permit-materialization:synthetic-revalidation-positive-001',
    permit_origin: {
      repository: 'Matawaka/uu-aap',
      revision: Permit.ORIGIN_FRONTIER,
      tree: Permit.ORIGIN_TREE
    },
    authority_gate_source: {
      mode: 'local_private',
      path: gatePath,
      expected_gate_input_hash: positiveGateInput.content_hash
    },
    execution_frontier: {
      repository: 'Matawaka/uu-aap',
      revision: '72f6ea7185b75ecf6ca459c8f88c8c613f3ae968',
      tree: '4610936795b5726eb074d4b0431e6d5b919e0d13',
      observed_at: '2026-08-29T02:08:20Z'
    },
    requested_run: {
      run_id: 'urn:uu-aap:marketcloser:real-review-run:synthetic-revalidation-positive-001',
      operation: Permit.OPERATION,
      one_shot: true,
      max_invocations: 1,
      valid_for_seconds: 600,
      local_only: true,
      read_only: true,
      deterministic_input_bound: true,
      pre_run_revalidation_required: true,
      network_access_available: false,
      filesystem_write_available: false,
      provider_invocation_available: false,
      platform_mutation_available: false,
      response_candidate_available: false,
      publication_available: false,
      pilot_permit_available: false,
      action_permit_available: false,
      external_execution_available: false,
      external_effect_available: false
    },
    materialized_at: '2026-08-29T02:08:30Z',
    controls: {
      local_only: true,
      read_only: true,
      permit_materialization_available: true,
      stress_test_run_available: false,
      network_access_available: false,
      provider_invocation_available: false,
      platform_mutation_available: false,
      publication_available: false,
      pilot_permit_available: false,
      action_permit_available: false,
      external_execution_available: false,
      external_effect_available: false
    },
    content_hash: ''
  };
  Permit.rehash(materializationInput);
  Permit.validateInput(materializationInput);
  fs.writeFileSync(materializationPath, `${JSON.stringify(materializationInput, null, 2)}\n`);
  const permit = Permit.materializePermit(materializationInput);
  return { positiveGateInput, gateReceipt, materializationInput, permit, gatePath, materializationPath };
}

module.exports = { buildPositive };
