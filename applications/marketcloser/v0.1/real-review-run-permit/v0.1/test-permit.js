'use strict';

const fs = require('fs');
const path = require('path');
const Permit = require('./permit.js');
const Gate = require('../../real-review-run-authority-gate/v0.1/authority-gate.js');
const Bridge = require('../../minimized-real-review-bridge/v0.1/bridge.js');
const Core = require('../../../../../proposals/poai/authority/tools/authority-core.js');

const fixturePath = path.resolve(__dirname, 'examples/synthetic-permit-wait.input.json');
const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const reject = (fn, label) => {
  let rejected = false;
  try { fn(); } catch (_) { rejected = true; }
  assert(rejected, `${label} must reject`);
};

async function buildPositiveGateInput(waitGateInput) {
  const bridgeInput = Gate.loadBridgeInput(waitGateInput.bridge_source);
  const bridgeReceipt = Bridge.deriveReceipt(bridgeInput);
  const target = Gate.requiredTargetForBridgeReceipt(bridgeReceipt);
  const subject = clone(waitGateInput.effect_actor_subject);
  const root = {
    artifact_type: 'PoAIAuthorityRoot',
    artifact_version: '0.1-experimental',
    root_id: 'urn:poai:authority-root:marketcloser-synthetic-permit:1',
    root_version: 1,
    root_mode: 'contractual_root',
    governance_scope: target,
    target,
    accepted_actions: [Gate.REQUIRED_SCOPE, Core.POLICY_CONTROL_SCOPE],
    controller_rule: {
      mode: 'single_controller',
      controller_id: 'actor:synthetic-marketcloser-permit-controller',
      controller_key_ref: 'key:synthetic-marketcloser-permit-controller'
    },
    root_evidence_rule: {
      mode: 'synthetic_conformance',
      resource: target,
      accepted_evidence_types: ['synthetic_authority_evidence']
    },
    effective_from: '2026-08-28T23:00:00Z',
    effective_until: '2026-08-29T00:00:00Z',
    delegation_policy: { mode: 'non_delegable', max_depth: 0 },
    policy_control_rule: { required_scope: Core.POLICY_CONTROL_SCOPE },
    transition: {
      status: 'genesis',
      previous_root_ref: null,
      authorized_by_previous_controller: null,
      authorization_evidence_refs: []
    },
    claims: {
      legal_identity_verified: false,
      legal_authority_established: false,
      universal_authority_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      poai_v_conformance_established: false
    }
  };
  assert(Core.validateRoot(root).length === 0, `synthetic permit root invalid: ${Core.validateRoot(root).join(', ')}`);
  const policy = {
    policy_id: 'marketcloser-synthetic-permit-authority-policy',
    canonicality_scope: target,
    authority_verification_rule: {
      required_target: target,
      root_acceptance_rule: {
        accepted_root_ids: [root.root_id],
        accepted_root_digests: [],
        allowed_root_modes: ['contractual_root'],
        require_root_evidence: true,
        allowed_evidence_types: ['synthetic_authority_evidence'],
        exact_scope_match: true
      }
    }
  };
  const controller = { id: root.controller_rule.controller_id, key_ref: root.controller_rule.controller_key_ref };
  const grant = await Core.buildGrant({
    root,
    issuer: controller,
    subject,
    actionScope: Gate.REQUIRED_SCOPE,
    target,
    governanceScope: target,
    validFrom: '2026-08-28T23:10:00Z',
    validUntil: '2026-08-28T23:50:00Z',
    delegationMode: 'non_delegable',
    remainingDepth: 0,
    policyRef: policy.policy_id,
    issuedAt: '2026-08-28T23:10:00Z'
  });
  const authorityResult = await Core.verifyAuthority({
    root,
    grants: [grant],
    policy,
    rootEvidence: {
      observed: true,
      evidence_type: 'synthetic_authority_evidence',
      target,
      refs: ['urn:synthetic:marketcloser:permit-authority-evidence:001']
    },
    subject,
    requiredScope: Gate.REQUIRED_SCOPE,
    target,
    at: waitGateInput.evaluated_at
  });
  assert(authorityResult.status === 'established', `synthetic authority not established: ${(authorityResult.errors || []).join(', ')}`);
  const positiveGateInput = clone(waitGateInput);
  positiveGateInput.authority_verification_result = authorityResult;
  Gate.rehash(positiveGateInput);
  assert(Gate.deriveReceipt(positiveGateInput).classification === 'SYNTHETIC_AUTHORITY_CONFORMANCE_READY', 'positive gate not ready');
  return positiveGateInput;
}

(async () => {
  const waitingInput = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  Permit.validateInput(waitingInput);
  const waitingDecision = Permit.deriveDecisionReceipt(waitingInput);
  assert(waitingDecision.classification === 'AUTHORITY_NOT_READY_PERMIT_NOT_CREATED', 'waiting authority must not create permit');
  assert(waitingDecision.permit_created === false && waitingDecision.permit_binding === null, 'waiting decision leaked permit');
  reject(() => Permit.materializePermit(waitingInput), 'materialize without authority');

  const waitGateInput = Permit.loadGateInput(waitingInput.authority_gate_source);
  const positiveGateInput = await buildPositiveGateInput(waitGateInput);
  const positiveGatePath = '/tmp/marketcloser-positive-permit-gate.input.json';
  fs.writeFileSync(positiveGatePath, `${JSON.stringify(positiveGateInput, null, 2)}\n`);

  const positiveInput = clone(waitingInput);
  positiveInput.materialization_id = 'urn:uu-aap:marketcloser:real-review-run-permit-materialization:synthetic-positive-001';
  positiveInput.authority_gate_source = {
    mode: 'local_private',
    path: positiveGatePath,
    expected_gate_input_hash: positiveGateInput.content_hash
  };
  positiveInput.execution_frontier = {
    repository: 'Matawaka/uu-aap',
    revision: '1111111111111111111111111111111111111111',
    tree: '2222222222222222222222222222222222222222',
    observed_at: '2026-08-28T23:30:30Z'
  };
  positiveInput.requested_run.run_id = 'urn:uu-aap:marketcloser:real-review-run:synthetic-positive-001';
  positiveInput.materialized_at = '2026-08-28T23:31:00Z';
  Permit.rehash(positiveInput);

  const positiveDecision = Permit.deriveDecisionReceipt(positiveInput);
  assert(positiveDecision.classification === 'SYNTHETIC_RUN_PERMIT_MATERIALIZED', 'synthetic permit classification mismatch');
  assert(positiveDecision.permit_created === true && positiveDecision.permit_binding, 'synthetic permit not materialized');
  const permit = Permit.materializePermit(positiveInput);
  assert(permit.one_shot === true && permit.max_invocations === 1 && permit.remaining_invocations === 1, 'permit is not one-shot');
  assert(permit.consumed === false, 'permit must start unconsumed');
  assert(permit.capabilities.local_analysis_permitted === true, 'local analysis permission missing');
  assert(permit.capabilities.external_effect_permitted === false, 'permit leaked external effect');
  assert(permit.authority_revalidation_required === true && permit.frontier_revalidation_required === true, 'pre-run revalidation missing');

  const currentFrontier = clone(permit.execution_frontier);
  currentFrontier.observed_at = '2026-08-28T23:31:10Z';
  assert(Permit.evaluateCurrentness(permit, currentFrontier, '2026-08-28T23:31:20Z') === 'PERMIT_FRONTIER_CURRENT_AUTHORITY_REVALIDATION_REQUIRED', 'current permit must still require authority revalidation');
  const staleFrontier = clone(currentFrontier);
  staleFrontier.revision = '3333333333333333333333333333333333333333';
  assert(Permit.evaluateCurrentness(permit, staleFrontier, '2026-08-28T23:31:20Z') === 'PERMIT_FRONTIER_STALE', 'main change must stale permit');
  assert(Permit.evaluateCurrentness(permit, currentFrontier, '2026-08-28T23:47:00Z') === 'PERMIT_EXPIRED', 'expired permit not rejected');

  const multiUse = clone(waitingInput);
  multiUse.requested_run.max_invocations = 2;
  Permit.rehash(multiUse);
  reject(() => Permit.validateInput(multiUse), 'multi-use request');

  const overlong = clone(waitingInput);
  overlong.requested_run.valid_for_seconds = Permit.MAX_VALIDITY_SECONDS + 1;
  Permit.rehash(overlong);
  reject(() => Permit.validateInput(overlong), 'overlong permit request');

  const wrongOperation = clone(waitingInput);
  wrongOperation.requested_run.operation = 'marketcloser.publish.response';
  Permit.rehash(wrongOperation);
  reject(() => Permit.validateInput(wrongOperation), 'operation expansion');

  const consumed = clone(permit);
  consumed.consumed = true;
  Permit.rehash(consumed);
  reject(() => Permit.validatePermit(consumed), 'pre-consumed permit');

  console.log('MarketCloser Real Review Run Permit v0.1 conformance: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
