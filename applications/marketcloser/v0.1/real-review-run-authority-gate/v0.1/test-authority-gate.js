'use strict';

const fs = require('fs');
const path = require('path');
const Gate = require('./authority-gate.js');
const Bridge = require('../../minimized-real-review-bridge/v0.1/bridge.js');
const Core = require('../../../../../proposals/poai/authority/tools/authority-core.js');

const fixturePath = path.resolve(__dirname, 'examples/synthetic-authority-wait.input.json');
const clone = v => JSON.parse(JSON.stringify(v));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  const input = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  Gate.validateInput(input);
  const waiting = Gate.deriveReceipt(input);
  assert(waiting.classification === 'AUTHORITY_EVIDENCE_REQUIRED', 'null authority evidence must remain required');
  assert(waiting.authority_verified === false, 'waiting case cannot verify authority');
  assert(waiting.run_permit_created === false, 'waiting case cannot create run permit');
  assert(waiting.next_safe_action === 'OBTAIN_MATCHING_APPLICATION_AUTHORITY_EVIDENCE', 'waiting next action mismatch');

  const bridgeInput = Gate.loadBridgeInput(input.bridge_source);
  const bridgeReceipt = Bridge.deriveReceipt(bridgeInput);
  const target = Gate.requiredTargetForBridgeReceipt(bridgeReceipt);
  const subject = clone(input.effect_actor_subject);
  const root = {
    artifact_type: 'PoAIAuthorityRoot',
    artifact_version: '0.1-experimental',
    root_id: 'urn:poai:authority-root:marketcloser-synthetic-review-run:1',
    root_version: 1,
    root_mode: 'contractual_root',
    governance_scope: target,
    target,
    accepted_actions: [Gate.REQUIRED_SCOPE, Core.POLICY_CONTROL_SCOPE],
    controller_rule: {
      mode: 'single_controller',
      controller_id: 'actor:synthetic-marketcloser-controller',
      controller_key_ref: 'key:synthetic-marketcloser-controller'
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
  assert(Core.validateRoot(root).length === 0, `synthetic root invalid: ${Core.validateRoot(root).join(', ')}`);

  const policy = {
    policy_id: 'marketcloser-synthetic-review-run-authority-policy',
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
  const rootEvidence = {
    observed: true,
    evidence_type: 'synthetic_authority_evidence',
    target,
    refs: ['urn:synthetic:marketcloser:authority-evidence:001']
  };
  const authorityResult = await Core.verifyAuthority({
    root,
    grants: [grant],
    policy,
    rootEvidence,
    subject,
    requiredScope: Gate.REQUIRED_SCOPE,
    target,
    at: input.evaluated_at
  });
  assert(authorityResult.status === 'established', `synthetic authority not established: ${(authorityResult.errors || []).join(', ')}`);
  assert(Core.validateVerificationResult(authorityResult).length === 0,
    `synthetic authority result invalid: ${Core.validateVerificationResult(authorityResult).join(', ')}`);

  const positiveInput = clone(input);
  positiveInput.authority_verification_result = authorityResult;
  Gate.rehash(positiveInput);
  const positive = Gate.deriveReceipt(positiveInput);
  assert(positive.classification === 'SYNTHETIC_AUTHORITY_CONFORMANCE_READY', 'synthetic positive classification mismatch');
  assert(positive.authority_verified === true, 'synthetic positive must verify authority');
  assert(positive.run_permit_created === false, 'authority gate must not create run permit');
  assert(positive.claims.stress_test_run === false, 'authority gate must not run stress-test');
  assert(positive.next_safe_action === 'STOP_AFTER_SYNTHETIC_AUTHORITY_CONFORMANCE', 'synthetic positive must stop');

  const scopeMismatch = clone(positiveInput);
  scopeMismatch.authority_verification_result.required_scope = 'fcl.run.interrupt';
  Gate.rehash(scopeMismatch);
  const scopeReceipt = Gate.deriveReceipt(scopeMismatch);
  assert(scopeReceipt.classification === 'AUTHORITY_SCOPE_MISMATCH', 'scope mismatch not preserved');

  const targetMismatch = clone(positiveInput);
  targetMismatch.authority_verification_result.target = `${target}:other`;
  Gate.rehash(targetMismatch);
  const targetReceipt = Gate.deriveReceipt(targetMismatch);
  assert(targetReceipt.classification === 'AUTHORITY_TARGET_MISMATCH', 'target mismatch not preserved');

  const subjectMismatch = clone(positiveInput);
  subjectMismatch.effect_actor_subject.id = 'actor:synthetic-other-reviewer';
  Gate.rehash(subjectMismatch);
  const subjectReceipt = Gate.deriveReceipt(subjectMismatch);
  assert(subjectReceipt.classification === 'AUTHORITY_SUBJECT_MISMATCH', 'subject mismatch not preserved');

  const stale = clone(positiveInput);
  stale.authority_verification_result.verified_at = '2026-08-28T19:00:00Z';
  Gate.rehash(stale);
  const staleReceipt = Gate.deriveReceipt(stale);
  assert(staleReceipt.classification === 'AUTHORITY_EVIDENCE_STALE', 'stale authority evidence not rejected');

  const liveRoot = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../proposals/poai/authority/roots/github/Matawaka.uu-aap.authority-root.json'), 'utf8'));
  assert(!liveRoot.accepted_actions.includes(Gate.REQUIRED_SCOPE), 'live GitHub root must not acquire MarketCloser run scope');

  console.log('MarketCloser Real Review Run Authority Gate v0.1 conformance: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
