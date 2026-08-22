'use strict';

const fs = require('fs');
const path = require('path');
const Core = require(path.resolve(__dirname, '../tools/materialization-core.js'));
const Authority = require(path.resolve(__dirname, '../../authority/tools/authority-core.js'));

const ROOT_PATH = path.resolve(__dirname, '../../authority/roots/github/Matawaka.uu-aap.authority-root.json');
const POLICY_PATH = path.resolve(__dirname, '../policies/github/Matawaka.uu-aap.materialization-policy.json');
const GRANT_PATH = path.resolve(__dirname, '../../authority/grants/github/Matawaka.uu-aap.execute-grant.json');
const SOURCE_PATH = path.resolve(__dirname, '../../examples/quasi-existent-future.synthetic.poai.json');
const SUCCESSOR_PATH = path.resolve(__dirname, '../../examples/quasi-existent-future.synthetic.successor.poai.json');
const TARGET = 'github:Matawaka/uu-aap';
const ROTATED_KEY = 'urn:poai:key:ed25519:rotation-test-v2';
const ROTATION_TIME = '2026-08-23T00:00:00Z';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const verificationPath = process.argv[2] || '/tmp/live-authority-verification.json';
  const eventOut = process.argv[3] || '/tmp/live-materialization-event.json';
  const checkOut = process.argv[4] || '/tmp/live-materialization-consumption.json';

  const verification = readJson(verificationPath);
  const root = readJson(ROOT_PATH);
  const policy = readJson(POLICY_PATH);
  const grant = readJson(GRANT_PATH);
  const source = readJson(SOURCE_PATH);
  const successorTemplate = readJson(SUCCESSOR_PATH);

  const verificationErrors = Authority.validateVerificationResult(verification);
  assert(verificationErrors.length === 0, `live authority verification result is invalid: ${verificationErrors.join(', ')}`);
  assert(verification.status === 'established', 'live authority verification status must be established');
  assert(verification.errors.length === 0, `live authority verification contains errors: ${verification.errors.join(', ')}`);
  assert(verification.claims.issuer_entitlement_chain_valid === true, 'issuer entitlement must come from the live verification result');
  assert(verification.claims.materialization_authority_established === true, 'materialization authority must come from the live verification result');
  assert(verification.claims.policy_control_authority_established === false, 'execute authority must not imply policy control');
  assert(verification.required_scope === Authority.EXECUTE_SCOPE, 'live result must be execute-scoped');
  assert(verification.target === TARGET, 'live result target must be the exact repository');
  assert(verification.policy.policy_id === policy.policy_id, 'live result must reference the live materialization policy');
  assert(verification.grant_path.includes(grant.grant_id), 'live result must contain the published execute grant');
  assert(verification.root.root_id === grant.root_ref.root_id, 'live result root must match the grant root');
  assert(verification.root.digest.value === grant.root_ref.digest.value, 'live result root digest must match the grant root binding');

  const rootDigest = await Authority.digestJson(root);
  const policyDigest = await Core.digestJson(policy);
  assert(verification.root.root_id === root.root_id, 'live verification must bind the exact live root lineage');
  assert(verification.root.root_version === root.root_version, 'live verification must retain the exact live root version');
  assert(verification.root.digest.value === rootDigest, 'live verification must retain the exact live root digest');
  assert(verification.policy.digest.value === policyDigest, 'live verification must bind the exact live policy digest');
  assert(policy.applies_to.target === TARGET, 'live policy must apply to the exact repository target');
  assert(policy.authority_verification_rule.required_target === TARGET, 'live policy authority target must be exact');
  assert(typeof policy.applies_to.source_record_prefix === 'string' && source.record_id.startsWith(policy.applies_to.source_record_prefix), 'dry-run source record must be inside the live policy source prefix');

  const candidate = Core.normalizedSuccessorCandidate(source, successorTemplate);
  const authority = Authority.materializationAuthorityView(verification, grant);

  assert(authority.scope === Authority.EXECUTE_SCOPE, 'authority view must remain execute-scoped');
  assert(authority.target === TARGET, 'authority view target must remain exact');
  assert(authority.issuer_entitlement_verified === true, 'authority view must preserve live issuer entitlement');
  assert(authority.authority_verified === true, 'authority view must preserve live materialization authority');
  assert(authority.delegation_mode === 'non_delegable', 'live execute grant must remain non-delegable');
  assert(authority.delegated_from === null, 'live execute grant must remain a direct root grant');
  assert(authority.evidence_refs.includes(verification.verification_id), 'authority view must reference the live verification result');
  assert(authority.evidence_refs.includes(verification.root.root_id), 'authority view must reference the live root');
  assert(authority.evidence_refs.includes(grant.grant_id), 'authority view must reference the live grant');

  const event = await Core.buildMaterializationEvent({
    source,
    candidate,
    policy,
    successorProposalRef: 'urn:poai:successor-proposal:live-authority-dry-run:synthetic-shipment-r2',
    authority,
    contest: { active_stay: false, refs: [] },
    conflict: { status: 'none', candidate_refs: [candidate.record_id] },
    recordedAt: verification.verified_at
  });

  const eventErrors = await Core.validateMaterializationEvent(event, { source, candidate, policy });
  assert(eventErrors.length === 0, `live authority materialization dry-run failed: ${eventErrors.join(', ')}`);
  assert(event.declared_disposition === 'materialized', 'live authority dry-run should satisfy the materialization policy');
  assert(event.canonicality_claim.status === 'materialized', 'dry-run event should reach policy-relative materialized status');
  assert(event.canonicality_claim.scope === TARGET, 'dry-run canonicality scope must remain repository-scoped');
  assert(event.materialization_policy.policy_id === policy.policy_id, 'dry-run event must bind the live policy');
  assert(event.materialization_policy.policy_version === policy.policy_version, 'dry-run event must retain the live policy version');
  assert(event.materialization_policy.digest.value === policyDigest, 'dry-run event must bind the exact live policy digest');
  assert(event.authority_evaluation.authority_verification_ref === verification.verification_id, 'dry-run event must retain authority verification provenance');
  assert(event.authority_evaluation.grant_ref === grant.grant_id, 'dry-run event must retain grant provenance');
  assert(event.authority_evaluation.root_ref === verification.root.root_id, 'dry-run event must retain root lineage provenance');
  assert(event.authority_evaluation.issuer_entitlement_verified === true, 'dry-run event must consume live issuer entitlement');
  assert(event.authority_evaluation.authority_verified === true, 'dry-run event must consume live materialization authority');
  assert(event.claims.policy_evaluation_passed === true, 'dry-run policy evaluation must pass');
  assert(event.claims.policy_relative_canonicality_established === true, 'dry-run event may establish only policy-relative canonicality');

  const negativeCases = [
    ['issuer_entitlement_not_verified', bad => { bad.authority_evaluation.issuer_entitlement_verified = false; }],
    ['materialization_authority_not_verified', bad => { bad.authority_evaluation.authority_verified = false; }],
    ['authority_scope_mismatch', bad => { bad.authority_evaluation.scope = Authority.POLICY_CONTROL_SCOPE; }],
    ['authority_target_mismatch', bad => { bad.authority_evaluation.target = 'github:Other/example'; }],
    ['authority_outside_validity_window', bad => { bad.recorded_at = '2026-08-22T22:03:59Z'; }]
  ];

  for (const [expected, mutate] of negativeCases) {
    const bad = clone(event);
    mutate(bad);
    const errors = await Core.validateMaterializationEvent(bad, { source, candidate, policy });
    assert(errors.includes(expected), `${expected}: expected rejection not found; got ${errors.join(', ')}`);
  }

  // Historical-stability vector for Issue #110 acceptance item 10.
  // Root identity stays stable within the lineage while version/digest change prospectively.
  const historicalEventBeforeRotation = JSON.stringify(event);
  const historicalVerificationBeforeRotation = JSON.stringify(verification);

  const historicalEvidence = {
    observed: true,
    evidence_type: 'github_repository_control_publication',
    target: TARGET,
    refs: ['urn:poai:root-evidence:historical-v1']
  };
  const historicalRecheck = await Authority.verifyAuthority({
    root,
    grants: [grant],
    policy,
    rootEvidence: historicalEvidence,
    subject: grant.subject,
    requiredScope: Authority.EXECUTE_SCOPE,
    target: TARGET,
    at: verification.verified_at
  });
  assert(historicalRecheck.status === 'established', `historical v1 authority must remain established: ${historicalRecheck.errors.join(', ')}`);
  assert(historicalRecheck.claims.issuer_entitlement_chain_valid === true, 'historical issuer entitlement must remain valid under historical v1 state');
  assert(historicalRecheck.claims.materialization_authority_established === true, 'historical materialization authority must remain valid under historical v1 state');

  const rootV2 = clone(root);
  rootV2.root_version = root.root_version + 1;
  rootV2.controller_rule.controller_key_ref = ROTATED_KEY;
  rootV2.effective_from = ROTATION_TIME;
  rootV2.transition = {
    status: 'superseding',
    previous_root_ref: `${root.root_id}@${root.root_version}`,
    authorized_by_previous_controller: true,
    authorization_evidence_refs: [
      verification.verification_id,
      'urn:poai:root-transition:rotation-test-v2'
    ]
  };
  rootV2.notes = 'Secondary in-memory root-rotation vector for Issue #110; not published as the active repository root.';

  const rootV2Errors = Authority.validateRoot(rootV2);
  assert(rootV2Errors.length === 0, `authorized superseding root v2 must be structurally valid: ${rootV2Errors.join(', ')}`);
  assert(rootV2.root_id === root.root_id, 'stable root_id must be preserved within one root lineage');
  assert(rootV2.root_version === root.root_version + 1, 'root_version must increment for superseding normative content');

  const rootV2Digest = await Authority.digestJson(rootV2);
  assert(rootV2Digest !== rootDigest, 'superseding root manifest must have a distinct exact digest');
  const acceptedRootDigests = policy.authority_verification_rule.root_acceptance_rule.accepted_root_digests;
  assert(Array.isArray(acceptedRootDigests) && acceptedRootDigests.includes(rootDigest), 'historical root v1 digest must remain explicitly accepted by historical policy');
  assert(!acceptedRootDigests.includes(rootV2Digest), 'same root_id must not make a new root v2 digest implicitly accepted');

  const prospectiveOldGrantAttempt = await Authority.verifyAuthority({
    root: rootV2,
    grants: [grant],
    policy,
    rootEvidence: {
      observed: true,
      evidence_type: 'github_repository_control_publication',
      target: TARGET,
      refs: ['urn:poai:root-evidence:rotation-test-v2']
    },
    subject: grant.subject,
    requiredScope: Authority.EXECUTE_SCOPE,
    target: TARGET,
    at: ROTATION_TIME
  });
  assert(prospectiveOldGrantAttempt.status === 'not_established', 'old root-v1 grant must not automatically establish authority under root v2');
  assert(prospectiveOldGrantAttempt.claims.root_accepted_by_policy === false, 'unaccepted root v2 digest must not pass exact policy root acceptance');
  assert(prospectiveOldGrantAttempt.claims.issuer_entitlement_chain_valid === false, 'old grant must not retain prospective issuer entitlement under root v2');
  assert(prospectiveOldGrantAttempt.claims.materialization_authority_established === false, 'old grant must not retain prospective materialization authority under root v2');
  assert(prospectiveOldGrantAttempt.errors.includes('unaccepted_root_digest'), 'same root_id with a new digest must be rejected by exact root policy binding');
  assert(prospectiveOldGrantAttempt.errors.includes('grant_root_binding_mismatch'), 'root-v1 grant must not bind to root v2');

  const unauthorizedV2 = clone(rootV2);
  unauthorizedV2.transition.authorized_by_previous_controller = false;
  unauthorizedV2.transition.authorization_evidence_refs = [];
  const unauthorizedErrors = Authority.validateRoot(unauthorizedV2);
  assert(unauthorizedErrors.includes('root_replacement_without_previous_controller_authorization'), 'unauthorized root replacement must be rejected');

  assert(JSON.stringify(event) === historicalEventBeforeRotation, 'later root rotation must not rewrite the historical materialization event');
  assert(JSON.stringify(verification) === historicalVerificationBeforeRotation, 'later root rotation must not rewrite the historical authority verification');
  assert(verification.root.root_version === root.root_version, 'historical verification must retain original root version');
  assert(verification.root.digest.value === rootDigest, 'historical verification must retain original root digest');
  assert(event.materialization_policy.policy_id === policy.policy_id, 'historical event must retain original policy id');
  assert(event.materialization_policy.policy_version === policy.policy_version, 'historical event must retain original policy version');
  assert(event.materialization_policy.digest.value === policyDigest, 'historical event must retain original policy digest');
  assert(event.authority_evaluation.authority_verification_ref === verification.verification_id, 'historical event must retain original authority verification reference');
  assert(event.authority_evaluation.grant_ref === grant.grant_id, 'historical event must retain original grant reference');

  const prohibitedClaims = [
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_responsibility_determined',
    'moral_correctness_established',
    'poai_v_conformance_established'
  ];
  prohibitedClaims.forEach(key => assert(event.claims[key] === false, `${key} must remain false`));

  const check = {
    check_type: 'PoAILiveAuthorityMaterializationConsumptionCheck',
    check_version: '0.1-experimental',
    mode: 'dry_run_ci_only',
    live_authority_verification_ref: verification.verification_id,
    live_root_ref: verification.root.root_id,
    live_root_version: verification.root.root_version,
    live_root_digest: verification.root.digest.value,
    live_grant_ref: grant.grant_id,
    live_policy_ref: policy.policy_id,
    live_policy_version: policy.policy_version,
    live_policy_digest: policyDigest,
    source_record_ref: source.record_id,
    candidate_record_ref: candidate.record_id,
    ephemeral_materialization_event_ref: event.materialization_event_id,
    root_supersession_test: {
      mode: 'secondary_in_memory_rotation_vector',
      historical_root_version: root.root_version,
      historical_root_digest: rootDigest,
      superseding_root_version: rootV2.root_version,
      superseding_root_digest: rootV2Digest,
      superseding_root_effective_from: rootV2.effective_from,
      active_repository_root_changed: false,
      prospective_old_grant_errors: prospectiveOldGrantAttempt.errors,
      unauthorized_transition_errors: unauthorizedErrors
    },
    claims: {
      live_authority_result_consumed: true,
      issuer_entitlement_from_live_result: true,
      materialization_authority_from_live_result: true,
      exact_action_target_time_policy_scope_preserved: true,
      dry_run_policy_evaluation_passed: true,
      root_lineage_id_stable_across_rotation: true,
      root_version_incremented: true,
      exact_root_digest_changed: true,
      authorized_supersession_structure_valid: true,
      unauthorized_root_replacement_rejected: true,
      same_root_id_does_not_bypass_exact_digest_policy: true,
      old_grant_not_valid_for_superseding_root: true,
      historical_root_version_and_digest_preserved: true,
      historical_policy_binding_preserved: true,
      historical_grant_reference_preserved: true,
      historical_authority_verification_reference_preserved: true,
      historical_materialization_remains_valid_under_historical_state: true,
      prospective_materialization_authority_under_unaccepted_v2: false,
      persistent_materialization_event_published: false,
      successor_record_published: false,
      repository_mutation_performed: false,
      automatic_browser_action_performed: false,
      universal_authority_established: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    }
  };

  writeJson(eventOut, event);
  writeJson(checkOut, check);
  console.log(`live authority consumed and root-history stability passed; verification=${verification.verification_id}; event=${event.materialization_event_id}; v2=${rootV2Digest}`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
