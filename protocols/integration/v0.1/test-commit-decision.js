'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Core = require(path.resolve(__dirname, '../../../proposals/ccrp/tools/ccrp-core.js'));
const C2 = require(path.resolve(__dirname, '../../../proposals/ccrp/tools/ccrp-c2.js'));
const Gate = require(path.resolve(__dirname, '../../../proposals/ccrp/tools/pre-materialization-gate.js'));
const { evaluateHandoff } = require(path.resolve(__dirname, '../../ial/v0.1/evaluate-handoff.js'));
const { evaluateCommitDecision } = require('./evaluate-commit-decision.js');

const repoRoot = path.resolve(__dirname, '../../..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readRepo(relative) {
  return readJson(path.resolve(repoRoot, relative));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function iso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function runLiveAuthority(outPath, checkPath) {
  const run = cp.spawnSync('node', [
    'proposals/poai/authority/live/test-live-published-grant-authority.js',
    outPath,
    checkPath
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (run.error) throw run.error;
  assert(run.status === 0, `live authority verification failed\n${run.stdout || ''}\n${run.stderr || ''}`);
  return readJson(outPath);
}

function buildIalE3({ action, target, authoritySubjectId }) {
  const attestationPath = 'protocols/attestation/v0.1/attestations/ccrp-reference-implementation.v0.1.json';
  const attestationBlob = git(['hash-object', attestationPath]);
  const assessmentId = 'urn:ial:boundary-assessment:e3-live-precommit:1';
  const intentId = 'urn:ial:intent:live-precommit:1';

  const assessment = {
    $schema: '../boundary-assessment.schema.json',
    artifact_type: 'BoundaryAssessment',
    artifact_version: '0.1',
    assessment_id: assessmentId,
    subject_ref: { intent_id: intentId, action, target },
    effect_class: 'materialization_or_canonical_commitment',
    elevation_level: 'E3',
    state: 'ELEVATED',
    responsibility_boundary_required: true,
    reason_codes: ['materialization_boundary', 'responsibility_handoff_required'],
    claims: {
      private_reasoning_required: false,
      private_reasoning_disclosed: false,
      responsibility_transfer_established: false,
      authority_established: false,
      execution_admitted: false,
      materialization_permitted: false,
      outcome_observed: false
    }
  };

  const receipt = {
    $schema: '../elevation-receipt.schema.json',
    artifact_type: 'ElevationReceipt',
    artifact_version: '0.1',
    receipt_id: 'urn:ial:elevation-receipt:e3-live-precommit:1',
    assessment_id: assessmentId,
    elevation_level: 'E3',
    effect_class: 'materialization_or_canonical_commitment',
    elevated_by: 'urn:uu-aap:actor:precommit-boundary-evaluator',
    semantic_basis: { intent_id: intentId, action, target },
    private_reasoning_disclosed: false,
    claims: {
      semantic_elevation_recorded: true,
      responsibility_transfer_established: false,
      authority_established: false,
      execution_admitted: false,
      materialization_permitted: false,
      outcome_observed: false
    }
  };

  const responsibilityScope = [
    action,
    'preserve_historical_frontier',
    'return_commit_receipt'
  ];

  const assignment = {
    $schema: '../responsibility-assignment.schema.json',
    artifact_type: 'ResponsibilityAssignment',
    artifact_version: '0.1',
    assignment_id: 'urn:ial:responsibility-assignment:e3-live-precommit:source:1',
    assessment_id: assessmentId,
    responsible_party_id: 'urn:uu-aap:party:precommit-source-coordinator',
    responsibility_scope: responsibilityScope,
    assignment_kind: 'current_owner',
    claims: {
      responsibility_assignment_recorded: true,
      legal_authority_established: false,
      execution_admitted: false,
      materialization_permitted: false,
      outcome_observed: false
    }
  };

  const offer = {
    $schema: '../responsibility-handoff-offer.schema.json',
    artifact_type: 'ResponsibilityHandoffOffer',
    artifact_version: '0.1',
    offer_id: 'urn:ial:responsibility-handoff-offer:e3-live-precommit:1',
    boundary_assessment_id: assessmentId,
    elevation_receipt_id: receipt.receipt_id,
    responsibility_assignment_id: assignment.assignment_id,
    source_responsible_party_id: assignment.responsible_party_id,
    receiving_party_id: authoritySubjectId,
    executor_implementation_id: 'urn:uu-aap:implementation:ccrp-reference:0.1',
    effect_ref: { intent_id: intentId, action, target },
    responsibility_scope: responsibilityScope,
    required_capability: {
      registry_id: 'urn:uu-aap:protocol-registry:v0.1',
      protocol_id: 'CCRP',
      version: '0.1',
      logical_uri: 'urn:uu-aap:protocol:ccrp:0.1',
      release_commit: '2c98d34ebfb5e86491bffb29a27e5a55b4db707e',
      required_conformance_levels: ['C0', 'C1', 'C2', 'C3', 'C4', 'C5']
    },
    attestation_policy: 'reproducible_attestation_required',
    claims: {
      responsibility_offered: true,
      responsibility_accepted: false,
      technical_capability_is_responsibility_acceptance: false,
      authority_established: false,
      execution_admitted: false,
      materialization_permitted: false,
      outcome_observed: false
    }
  };

  const acceptance = {
    $schema: '../responsibility-handoff-acceptance.schema.json',
    artifact_type: 'ResponsibilityHandoffAcceptance',
    artifact_version: '0.1',
    acceptance_id: 'urn:ial:responsibility-handoff-acceptance:e3-live-precommit:1',
    offer_id: offer.offer_id,
    receiving_party_id: authoritySubjectId,
    executor_implementation_id: offer.executor_implementation_id,
    decision: 'accepted',
    accepted_responsibility_scope: responsibilityScope,
    attestation_ref: {
      path: attestationPath,
      git_blob_sha: attestationBlob,
      attestation_id: 'urn:uu-aap:attestation:ccrp-reference-implementation:0.1',
      subject_id: 'urn:uu-aap:implementation:ccrp-reference:0.1'
    },
    claims: {
      responsibility_acceptance_explicit: true,
      responsibility_accepted: true,
      capability_attestation_is_authority: false,
      authority_established: false,
      execution_admitted: false,
      materialization_permitted: false,
      outcome_observed: false
    }
  };

  const handoffResult = evaluateHandoff({
    assessment,
    elevationReceipt: receipt,
    assignment,
    offer,
    acceptance
  }, { rerunAttestation: true });

  assert(handoffResult.status === 'accepted', 'E3 responsibility handoff must be accepted');
  return { assessment, receipt, assignment, offer, acceptance, handoffResult };
}

async function main() {
  const AUTH_PATH = '/tmp/commit-decision-live-authority.json';
  const AUTH_CHECK_PATH = '/tmp/commit-decision-live-authority-check.json';
  const RESULT_PATH = process.argv[2] || '/tmp/commit-decision-result.json';
  const INPUT_PATH = process.argv[3] || '/tmp/commit-decision-input.json';
  const REVALIDATION_PATH = process.argv[4] || '/tmp/revalidation-receipt.json';

  const ACTION = 'poai.successor.materialization.execute';
  const TARGET = 'github:Matawaka/uu-aap';
  const head = git(['rev-parse', 'HEAD']);
  const currentRevision = `git:${head}`;
  const decisionAt = iso();
  const observedAt = decisionAt;

  const authorityVerification = runLiveAuthority(AUTH_PATH, AUTH_CHECK_PATH);
  assert(authorityVerification.status === 'established', 'live authority must be established');
  assert(authorityVerification.required_scope === ACTION, 'live authority scope mismatch');
  assert(authorityVerification.target === TARGET, 'live authority target mismatch');

  const ial = buildIalE3({ action: ACTION, target: TARGET, authoritySubjectId: authorityVerification.subject.id });

  const chatA = readRepo('proposals/ccrp/examples/c0-same-actor-chat-a.work-context.json');
  const chatB = readRepo('proposals/ccrp/examples/c0-same-actor-chat-b.work-context.json');
  const baseOperation = readRepo('proposals/ccrp/examples/c1-chat-b-exclusive.operation-intent.json');
  const baseLease = readRepo('proposals/ccrp/examples/c2-chat-b-current.execution-lease.json');
  const policy = readRepo('proposals/poai/materialization/policies/github/Matawaka.uu-aap.materialization-policy.json');

  const operation = clone(baseOperation);
  operation.operation_id = 'urn:ccrp:operation:uu-aap:live-precommit-decision:1';
  operation.action = ACTION;
  operation.target = TARGET;
  operation.base_revision = currentRevision;
  operation.observed_current_revision = currentRevision;
  operation.idempotency_key = `commit-decision-${head}`;
  operation.read_set = ['ref:refs/heads/main'];
  operation.write_set = ['poai:successor-materialization'];
  operation.created_at = iso(-30_000);

  const lease = clone(baseLease);
  lease.lease_id = 'urn:ccrp:lease:uu-aap:live-precommit-decision:1';
  lease.execution_lineage_id = 'urn:ccrp:execution-lineage:uu-aap:live-precommit-decision';
  lease.epoch = 1;
  lease.fencing_token = 1;
  lease.operation_scope = [ACTION];
  lease.target_scope = [TARGET];
  lease.issued_revision = currentRevision;
  lease.issued_at = iso(-60_000);
  lease.expires_at = iso(600_000);
  lease.status = 'active';
  lease.supersedes_lease_ref = null;
  lease.superseded_by_lease_ref = null;

  const collision = Core.detectC1Collision({
    operation,
    contexts: [chatA, chatB],
    currentRevision,
    evaluatedAt: decisionAt
  });
  assert(collision.collision_type === 'no_collision', `live precommit operation must be collision-clear: ${collision.collision_type}`);

  const executionAdmission = C2.evaluateC2ExecutionAdmission({
    operation,
    presentedLease: lease,
    currentLease: lease,
    collisionResult: collision,
    currentRevision,
    evaluatedAt: decisionAt
  });
  assert(executionAdmission.decision === 'admitted', 'live precommit execution must be admitted');

  const preMaterializationResult = await Gate.evaluatePreMaterializationGate({
    authorityVerification,
    materializationPolicy: policy,
    ccrpAdmission: executionAdmission,
    operation,
    requestedAction: ACTION,
    requestedTarget: TARGET,
    evaluatedAt: decisionAt
  });
  assert(preMaterializationResult.decision === 'permitted', `live pre-materialization gate must permit: ${preMaterializationResult.reason_codes.join(',')}`);

  const revalidationReceipt = {
    $schema: './revalidation-receipt.schema.json',
    artifact_type: 'RevalidationReceipt',
    artifact_version: '0.1',
    receipt_id: `urn:uu-aap:revalidation:${head}`,
    operation_ref: operation.operation_id,
    action: ACTION,
    target: TARGET,
    intended_base_revision: currentRevision,
    observed_current_revision: currentRevision,
    observed_at: observedAt,
    decision_at: decisionAt,
    max_age_seconds: 60,
    checks: {
      revision_unchanged: true,
      action_exact: true,
      target_exact: true,
      operation_exact: true
    },
    claims: {
      revalidation_performed: true,
      freshness_established: true,
      commit_approved: false,
      commit_performed: false,
      outcome_observed: false,
      canonical_state_established: false
    }
  };

  const input = {
    $schema: './commit-decision-input.schema.json',
    artifact_type: 'CommitDecisionInput',
    artifact_version: '0.1',
    decision_input_id: `urn:uu-aap:commit-decision-input:${head}`,
    action: ACTION,
    target: TARGET,
    operation_ref: operation.operation_id,
    responsible_party_id: authorityVerification.subject.id,
    executor_implementation_id: ial.offer.executor_implementation_id,
    evidence_refs: {
      handoff_result_ref: ial.handoffResult.assessment_id,
      handoff_offer_ref: ial.offer.offer_id,
      handoff_acceptance_ref: ial.acceptance.acceptance_id,
      revalidation_receipt_ref: revalidationReceipt.receipt_id,
      authority_verification_ref: authorityVerification.verification_id,
      execution_admission_ref: executionAdmission.result_id,
      pre_materialization_ref: preMaterializationResult.decision_id
    }
  };

  const evidence = {
    handoffResult: ial.handoffResult,
    handoffOffer: ial.offer,
    handoffAcceptance: ial.acceptance,
    revalidationReceipt,
    authorityVerification,
    operation,
    executionAdmission,
    preMaterializationResult
  };

  const positive = evaluateCommitDecision(input, evidence);
  assert(positive.decision === 'approved', `positive commit decision must approve: ${positive.reason_codes.join(',')}`);
  assert(Object.values(positive.checks).every(Boolean), 'all positive commit-decision checks must pass');
  assert(positive.claims.commit_decision_approved === true, 'positive decision claim missing');
  for (const key of [
    'commit_performed',
    'materialization_event_recorded',
    'repository_mutation_performed',
    'outcome_observed',
    'canonical_state_established',
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_effect_established',
    'poai_v_conformance_established'
  ]) assert(positive.claims[key] === false, `positive decision must keep ${key}=false`);

  const vectors = [];
  function negative(name, mutate, expectedReason) {
    const localInput = clone(input);
    const localEvidence = clone(evidence);
    mutate(localInput, localEvidence);
    const value = evaluateCommitDecision(localInput, localEvidence);
    assert(value.decision === 'not_approved', `${name}: must be not_approved`);
    assert(value.reason_codes.includes(expectedReason), `${name}: expected ${expectedReason}; got ${value.reason_codes.join(',')}`);
    assert(value.claims.commit_decision_approved === false, `${name}: approval claim must be false`);
    assert(value.claims.commit_performed === false, `${name}: must not perform commit`);
    vectors.push({ name, decision: value.decision, reason_codes: value.reason_codes });
  }

  negative('responsibility_removed', (_i, e) => {
    e.handoffResult.status = 'blocked';
    e.handoffResult.claims.responsibility_transfer_established = false;
    e.handoffResult.claims.responsibility_accepted = false;
  }, 'failed:handoff_accepted');

  negative('responsible_party_substituted', (i) => {
    i.responsible_party_id = 'urn:uu-aap:actor:other-materializer';
  }, 'failed:handoff_party_exact');

  negative('executor_substituted', (i) => {
    i.executor_implementation_id = 'urn:uu-aap:implementation:other:0.1';
  }, 'failed:handoff_executor_exact');

  negative('stale_revalidation', (_i, e) => {
    e.revalidationReceipt.observed_at = new Date(Date.parse(e.revalidationReceipt.decision_at) - 120_000).toISOString();
    e.revalidationReceipt.max_age_seconds = 60;
  }, 'failed:revalidation_fresh');

  negative('revision_moved', (_i, e) => {
    e.revalidationReceipt.observed_current_revision = 'git:' + '0'.repeat(40);
    e.revalidationReceipt.checks.revision_unchanged = false;
  }, 'failed:revision_unchanged');

  negative('authority_removed', (_i, e) => {
    e.authorityVerification.status = 'not_established';
    e.authorityVerification.claims.materialization_authority_established = false;
  }, 'failed:authority_established');

  negative('authority_target_changed', (_i, e) => {
    e.authorityVerification.target = 'github:Other/repo';
  }, 'failed:authority_target_exact');

  negative('execution_not_admitted', (_i, e) => {
    e.executionAdmission.decision = 'not_admitted';
    e.executionAdmission.reason_codes = ['stale_fencing_token'];
    e.executionAdmission.claims.execution_admitted = false;
  }, 'failed:execution_admitted');

  negative('collision_not_clear', (_i, e) => {
    e.executionAdmission.checks.collision_clear = false;
    e.executionAdmission.reason_codes = ['blocking_collision'];
  }, 'failed:collision_clear');

  negative('pre_materialization_revoked', (_i, e) => {
    e.preMaterializationResult.decision = 'not_permitted';
    e.preMaterializationResult.reason_codes = ['failed:test'];
    e.preMaterializationResult.claims.pre_materialization_permit_established = false;
    e.preMaterializationResult.claims.materialization_permitted = false;
  }, 'failed:pre_materialization_permitted');

  negative('pre_materialization_authority_ref_substituted', (_i, e) => {
    e.preMaterializationResult.authority_verification_ref = 'urn:poai:authority-verification:other';
  }, 'failed:pre_materialization_refs_exact');

  negative('action_changed_after_handoff', (i) => {
    i.action = 'poai.materialization.policy.control';
  }, 'failed:action_exact');

  fs.writeFileSync(RESULT_PATH, JSON.stringify(positive, null, 2) + '\n');
  fs.writeFileSync(INPUT_PATH, JSON.stringify(input, null, 2) + '\n');
  fs.writeFileSync(REVALIDATION_PATH, JSON.stringify(revalidationReceipt, null, 2) + '\n');

  console.log(JSON.stringify({
    suite: 'UU-AAP pre-commit decision integration v0.1',
    current_revision: currentRevision,
    positive_decision: positive.decision,
    negative_vectors: vectors.length,
    responsibility_party: input.responsible_party_id,
    executor_implementation: input.executor_implementation_id,
    no_commit_performed: true,
    no_outcome_observed: true,
    no_canonical_state_established: true
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
