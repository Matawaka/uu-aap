'use strict';

const fs = require('fs');
const path = require('path');
const Core = require(path.resolve(__dirname, '../tools/materialization-core.js'));
const Authority = require(path.resolve(__dirname, '../../authority/tools/authority-core.js'));

const POLICY_PATH = path.resolve(__dirname, '../policies/github/Matawaka.uu-aap.materialization-policy.json');
const GRANT_PATH = path.resolve(__dirname, '../../authority/grants/github/Matawaka.uu-aap.execute-grant.json');
const SOURCE_PATH = path.resolve(__dirname, '../../examples/quasi-existent-future.synthetic.poai.json');
const SUCCESSOR_PATH = path.resolve(__dirname, '../../examples/quasi-existent-future.synthetic.successor.poai.json');
const TARGET = 'github:Matawaka/uu-aap';

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

  const policyDigest = await Core.digestJson(policy);
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
  assert(event.materialization_policy.digest.value === policyDigest, 'dry-run event must bind the exact live policy digest');
  assert(event.authority_evaluation.authority_verification_ref === verification.verification_id, 'dry-run event must retain authority verification provenance');
  assert(event.authority_evaluation.grant_ref === grant.grant_id, 'dry-run event must retain grant provenance');
  assert(event.authority_evaluation.root_ref === verification.root.root_id, 'dry-run event must retain root provenance');
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
    live_grant_ref: grant.grant_id,
    live_policy_ref: policy.policy_id,
    source_record_ref: source.record_id,
    candidate_record_ref: candidate.record_id,
    ephemeral_materialization_event_ref: event.materialization_event_id,
    claims: {
      live_authority_result_consumed: true,
      issuer_entitlement_from_live_result: true,
      materialization_authority_from_live_result: true,
      exact_action_target_time_policy_scope_preserved: true,
      dry_run_policy_evaluation_passed: true,
      persistent_materialization_event_published: false,
      successor_record_published: false,
      repository_mutation_performed: false,
      automatic_browser_action_performed: false,
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
  console.log(`live authority consumed by materialization dry-run; verification=${verification.verification_id}; event=${event.materialization_event_id}`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
