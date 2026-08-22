'use strict';

const fs = require('fs');
const path = require('path');
const Authority = require(path.resolve(__dirname, '../tools/authority-core.js'));
const Materialization = require(path.resolve(__dirname, '../../materialization/tools/materialization-core.js'));

const ROOT_PATH = path.resolve(__dirname, '../roots/github/Matawaka.uu-aap.authority-root.json');
const POLICY_PATH = path.resolve(__dirname, '../../materialization/policies/github/Matawaka.uu-aap.materialization-policy.json');
const GRANT_PATH = path.resolve(__dirname, '../grants/github/Matawaka.uu-aap.execute-grant.json');
const SOURCE_PATH = path.resolve(__dirname, '../../examples/quasi-existent-future.synthetic.poai.json');
const SUCCESSOR_PATH = path.resolve(__dirname, '../../examples/quasi-existent-future.synthetic.successor.poai.json');
const TARGET = 'github:Matawaka/uu-aap';
const EVIDENCE_TYPE = 'github_repository_control_publication';
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
  const eventPath = process.argv[3] || '/tmp/live-materialization-event.json';
  const out = process.argv[4] || '/tmp/root-supersession-history-check.json';

  const rootV1 = readJson(ROOT_PATH);
  const policyV1 = readJson(POLICY_PATH);
  const grantV1 = readJson(GRANT_PATH);
  const source = readJson(SOURCE_PATH);
  const successorTemplate = readJson(SUCCESSOR_PATH);
  const historicalVerification = readJson(verificationPath);
  const historicalEvent = readJson(eventPath);

  const rootV1Digest = await Authority.digestJson(rootV1);
  const policyV1Digest = await Materialization.digestJson(policyV1);
  const candidate = Materialization.normalizedSuccessorCandidate(source, successorTemplate);

  assert(historicalVerification.status === 'established', 'historical authority verification must already be established');
  assert(historicalVerification.root.root_id === rootV1.root_id, 'historical verification must reference root v1 lineage');
  assert(historicalVerification.root.root_version === rootV1.root_version, 'historical verification must retain root v1 version');
  assert(historicalVerification.root.digest.value === rootV1Digest, 'historical verification must retain exact root v1 digest');
  assert(historicalVerification.policy.policy_id === policyV1.policy_id, 'historical verification must retain policy v1 id');
  assert(historicalVerification.policy.policy_version === policyV1.policy_version, 'historical verification must retain policy v1 version');
  assert(historicalVerification.policy.digest.value === policyV1Digest, 'historical verification must retain exact policy v1 digest');

  assert(historicalEvent.authority_evaluation.authority_verification_ref === historicalVerification.verification_id, 'historical materialization must retain authority verification reference');
  assert(historicalEvent.authority_evaluation.root_ref === rootV1.root_id, 'historical materialization must retain original root lineage reference');
  assert(historicalEvent.authority_evaluation.grant_ref === grantV1.grant_id, 'historical materialization must retain original grant reference');
  assert(historicalEvent.materialization_policy.policy_id === policyV1.policy_id, 'historical materialization must retain policy v1 id');
  assert(historicalEvent.materialization_policy.policy_version === policyV1.policy_version, 'historical materialization must retain policy v1 version');
  assert(historicalEvent.materialization_policy.digest.value === policyV1Digest, 'historical materialization must retain exact policy v1 digest');

  const historicalEventErrors = await Materialization.validateMaterializationEvent(historicalEvent, { source, candidate, policy: policyV1 });
  assert(historicalEventErrors.length === 0, `historical materialization must remain valid under historical policy: ${historicalEventErrors.join(', ')}`);

  const historicalEvidence = {
    observed: true,
    evidence_type: EVIDENCE_TYPE,
    target: TARGET,
    refs: ['urn:poai:root-evidence:historical-v1']
  };
  const historicalRecheck = await Authority.verifyAuthority({
    root: rootV1,
    grants: [grantV1],
    policy: policyV1,
    rootEvidence: historicalEvidence,
    subject: grantV1.subject,
    requiredScope: Authority.EXECUTE_SCOPE,
    target: TARGET,
    at: historicalVerification.verified_at
  });
  assert(historicalRecheck.status === 'established', `historical v1 recheck must remain established: ${historicalRecheck.errors.join(', ')}`);
  assert(historicalRecheck.claims.issuer_entitlement_chain_valid === true, 'historical issuer entitlement must remain valid under v1 state');
  assert(historicalRecheck.claims.materialization_authority_established === true, 'historical materialization authority must remain valid under v1 state');

  const rootV2 = clone(rootV1);
  rootV2.root_version = rootV1.root_version + 1;
  rootV2.controller_rule.controller_key_ref = ROTATED_KEY;
  rootV2.effective_from = ROTATION_TIME;
  rootV2.transition = {
    status: 'superseding',
    previous_root_ref: `${rootV1.root_id}@${rootV1.root_version}`,
    authorized_by_previous_controller: true,
    authorization_evidence_refs: [
      historicalVerification.verification_id,
      'urn:poai:root-transition:rotation-test-v2'
    ]
  };
  rootV2.notes = 'Secondary in-memory rotation vector for Issue #110. It is not published as the active repository root.';

  const rootV2Errors = Authority.validateRoot(rootV2);
  assert(rootV2Errors.length === 0, `authorized root v2 must be structurally valid: ${rootV2Errors.join(', ')}`);
  assert(rootV2.root_id === rootV1.root_id, 'root lineage id must remain stable across rotation');
  assert(rootV2.root_version === rootV1.root_version + 1, 'root version must increment across rotation');

  const rootV2Digest = await Authority.digestJson(rootV2);
  assert(rootV2Digest !== rootV1Digest, 'root rotation must produce a distinct exact manifest digest');
  assert(Array.isArray(policyV1.authority_verification_rule.root_acceptance_rule.accepted_root_digests), 'live policy must bind accepted root digests');
  assert(policyV1.authority_verification_rule.root_acceptance_rule.accepted_root_digests.includes(rootV1Digest), 'live policy must continue to accept root v1 digest');
  assert(!policyV1.authority_verification_rule.root_acceptance_rule.accepted_root_digests.includes(rootV2Digest), 'root v2 must not become accepted merely by retaining root_id');

  const prospectiveEvidence = {
    observed: true,
    evidence_type: EVIDENCE_TYPE,
    target: TARGET,
    refs: ['urn:poai:root-evidence:rotation-test-v2']
  };
  const prospectiveOldGrantAttempt = await Authority.verifyAuthority({
    root: rootV2,
    grants: [grantV1],
    policy: policyV1,
    rootEvidence: prospectiveEvidence,
    subject: grantV1.subject,
    requiredScope: Authority.EXECUTE_SCOPE,
    target: TARGET,
    at: ROTATION_TIME
  });

  assert(prospectiveOldGrantAttempt.status === 'not_established', 'old grant must not automatically establish authority under superseding root v2');
  assert(prospectiveOldGrantAttempt.claims.root_accepted_by_policy === false, 'unaccepted root v2 digest must not pass policy root acceptance');
  assert(prospectiveOldGrantAttempt.claims.issuer_entitlement_chain_valid === false, 'old grant must not retain prospective issuer entitlement under root v2');
  assert(prospectiveOldGrantAttempt.claims.materialization_authority_established === false, 'old grant must not retain prospective materialization authority under root v2');
  assert(prospectiveOldGrantAttempt.errors.includes('unaccepted_root_digest'), 'same root_id with new digest must be rejected by exact root policy binding');
  assert(prospectiveOldGrantAttempt.errors.includes('grant_root_binding_mismatch'), 'root v1 grant must not bind to root v2');

  const unauthorizedV2 = clone(rootV2);
  unauthorizedV2.transition.authorized_by_previous_controller = false;
  unauthorizedV2.transition.authorization_evidence_refs = [];
  const unauthorizedErrors = Authority.validateRoot(unauthorizedV2);
  assert(unauthorizedErrors.includes('root_replacement_without_previous_controller_authorization'), 'unauthorized replacement must be rejected');

  assert(historicalVerification.root.root_version === rootV1.root_version, 'later rotation must not rewrite historical root version');
  assert(historicalVerification.root.digest.value === rootV1Digest, 'later rotation must not rewrite historical root digest');
  assert(historicalEvent.materialization_policy.digest.value === policyV1Digest, 'later rotation must not rewrite historical policy digest');
  assert(historicalEvent.authority_evaluation.authority_verification_ref === historicalVerification.verification_id, 'later rotation must not rewrite historical authority verification reference');
  assert(historicalEvent.authority_evaluation.grant_ref === grantV1.grant_id, 'later rotation must not rewrite historical grant reference');

  const check = {
    check_type: 'PoAIRootSupersessionHistoricalStabilityCheck',
    check_version: '0.1-experimental',
    mode: 'secondary_in_memory_rotation_vector',
    historical: {
      root_id: rootV1.root_id,
      root_version: rootV1.root_version,
      root_digest: rootV1Digest,
      policy_id: policyV1.policy_id,
      policy_version: policyV1.policy_version,
      policy_digest: policyV1Digest,
      grant_id: grantV1.grant_id,
      authority_verification_id: historicalVerification.verification_id,
      materialization_event_id: historicalEvent.materialization_event_id
    },
    superseding_candidate: {
      root_id: rootV2.root_id,
      root_version: rootV2.root_version,
      root_digest: rootV2Digest,
      effective_from: rootV2.effective_from,
      transition_status: rootV2.transition.status,
      published_as_active_root: false
    },
    claims: {
      stable_root_lineage_id_preserved: true,
      root_version_incremented: true,
      exact_root_digest_changed: true,
      authorized_supersession_structure_valid: true,
      unauthorized_replacement_rejected: true,
      same_root_id_does_not_bypass_exact_digest_policy: true,
      old_grant_not_valid_for_superseding_root: true,
      historical_root_version_preserved: true,
      historical_root_digest_preserved: true,
      historical_policy_binding_preserved: true,
      historical_grant_reference_preserved: true,
      historical_authority_verification_reference_preserved: true,
      historical_materialization_remains_valid_under_historical_state: true,
      prospective_materialization_authority_under_unaccepted_v2: false,
      active_root_changed_in_repository: false,
      repository_mutation_performed_by_test: false,
      universal_authority_established: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    },
    prospective_errors: prospectiveOldGrantAttempt.errors,
    unauthorized_transition_errors: unauthorizedErrors
  };

  writeJson(out, check);
  console.log(`root supersession historical stability passed; v1=${rootV1Digest}; v2=${rootV2Digest}`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
