'use strict';

const fs = require('fs');
const path = require('path');
const Core = require(path.resolve(__dirname, 'tools/ccrp-core.js'));
const C2 = require(path.resolve(__dirname, 'tools/ccrp-c2.js'));
const Gate = require(path.resolve(__dirname, 'tools/pre-materialization-gate.js'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readLocal(relativePath) {
  return readJson(path.resolve(__dirname, relativePath));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const verificationPath = process.argv[2] || '/tmp/live-authority-verification.json';
  const resultPath = process.argv[3] || '/tmp/poai-ccrp-pre-materialization-result.json';
  const summaryPath = process.argv[4] || '/tmp/poai-ccrp-pre-materialization-check.json';

  const TARGET = 'github:Matawaka/uu-aap';
  const ACTION = 'poai.successor.materialization.execute';
  const currentRevision = 'git:14210c01acbdc300a76df4a93eb65f2872bd4fd3';
  const evaluatedAt = '2026-08-22T23:24:00Z';

  const authorityVerification = readJson(verificationPath);
  const policy = readLocal('../poai/materialization/policies/github/Matawaka.uu-aap.materialization-policy.json');
  const chatA = readLocal('examples/c0-same-actor-chat-a.work-context.json');
  const chatB = readLocal('examples/c0-same-actor-chat-b.work-context.json');
  const baseOperationB = readLocal('examples/c1-chat-b-exclusive.operation-intent.json');
  const baseLeaseB = readLocal('examples/c2-chat-b-current.execution-lease.json');
  const contexts = [chatA, chatB];

  // This is an ephemeral CI-only materialization-scoped C2 vector. It does not
  // publish or replace a repository execution lease.
  const operation = clone(baseOperationB);
  operation.operation_id = 'urn:ccrp:operation:uu-aap:chat-b:successor-materialization-preflight:1';
  operation.action = ACTION;
  operation.target = TARGET;
  operation.base_revision = currentRevision;
  operation.observed_current_revision = currentRevision;
  operation.idempotency_key = 'ccrp-poai-pre-materialization-chat-b-1';
  operation.read_set = ['ref:refs/heads/main'];
  operation.write_set = ['poai:successor-materialization'];
  operation.created_at = '2026-08-22T23:23:30Z';

  const lease = clone(baseLeaseB);
  lease.lease_id = 'urn:ccrp:lease:uu-aap:successor-materialization-preflight:3';
  lease.execution_lineage_id = 'urn:ccrp:execution-lineage:uu-aap:successor-materialization-preflight';
  lease.epoch = 3;
  lease.fencing_token = 3;
  lease.operation_scope = [ACTION];
  lease.target_scope = [TARGET];
  lease.issued_revision = currentRevision;
  lease.issued_at = '2026-08-22T23:23:00Z';
  lease.expires_at = '2026-08-22T23:35:00Z';
  lease.status = 'active';
  lease.supersedes_lease_ref = null;
  lease.superseded_by_lease_ref = null;

  const collision = Core.detectC1Collision({
    operation,
    contexts,
    currentRevision,
    evaluatedAt
  });
  assert(collision.collision_type === 'no_collision', 'pre-materialization operation must be collision-clear');

  const admission = C2.evaluateC2ExecutionAdmission({
    operation,
    presentedLease: lease,
    currentLease: lease,
    collisionResult: collision,
    currentRevision,
    evaluatedAt
  });
  assert(admission.decision === 'admitted', 'ephemeral exact-scope C2 vector must be admitted');
  assert(admission.claims.execution_admitted === true, 'C2 input must establish execution admission');
  assert(admission.claims.materialization_permitted === false, 'C2 alone must not establish materialization permission');
  assert(C2.validateC2AdmissionBoundary(admission).length === 0, 'C2 input must preserve its own assurance boundary');

  const result = await Gate.evaluatePreMaterializationGate({
    authorityVerification,
    materializationPolicy: policy,
    ccrpAdmission: admission,
    operation,
    requestedAction: ACTION,
    requestedTarget: TARGET,
    evaluatedAt
  });

  assert(result.decision === 'permitted', `combined preflight must be permitted: ${result.reason_codes.join(', ')}`);
  assert(Object.values(result.checks).every(Boolean), 'every combined preflight check must pass');
  assert(result.claims.poai_authority_input_established === true, 'PoAI authority input must remain independently established');
  assert(result.claims.ccrp_execution_admission_input_established === true, 'CCRP admission input must remain independently established');
  assert(result.claims.pre_materialization_permit_established === true, 'combined gate must establish only a pre-materialization permit');
  assert(result.claims.materialization_permitted === true, 'preflight materialization permission may be true only after both gates pass');
  assert(result.claims.materialization_event_recorded === false, 'preflight must not record a materialization event');
  assert(result.claims.successor_record_published === false, 'preflight must not publish a successor');
  assert(result.claims.repository_mutation_performed === false, 'preflight must not mutate the repository');
  assert(result.claims.policy_relative_canonicality_established === false, 'preflight must not establish canonicality');
  assert(Gate.validatePreMaterializationBoundary(result).length === 0, 'positive preflight boundary must validate');

  const negativeCases = [];

  const staleAdmission = clone(admission);
  staleAdmission.decision = 'not_admitted';
  staleAdmission.reason_codes = ['stale_fencing_token'];
  staleAdmission.checks.fencing_token_current = false;
  staleAdmission.claims.execution_admitted = false;
  negativeCases.push(['stale_ccrp_admission', await Gate.evaluatePreMaterializationGate({
    authorityVerification,
    materializationPolicy: policy,
    ccrpAdmission: staleAdmission,
    operation,
    requestedAction: ACTION,
    requestedTarget: TARGET,
    evaluatedAt
  }), 'failed:ccrp_execution_admitted']);

  negativeCases.push(['wrong_action', await Gate.evaluatePreMaterializationGate({
    authorityVerification,
    materializationPolicy: policy,
    ccrpAdmission: admission,
    operation,
    requestedAction: 'poai.materialization.policy.control',
    requestedTarget: TARGET,
    evaluatedAt
  }), 'failed:authority_scope_exact']);

  negativeCases.push(['wrong_target', await Gate.evaluatePreMaterializationGate({
    authorityVerification,
    materializationPolicy: policy,
    ccrpAdmission: admission,
    operation,
    requestedAction: ACTION,
    requestedTarget: 'github:Other/example',
    evaluatedAt
  }), 'failed:authority_target_exact']);

  const noAuthority = clone(authorityVerification);
  noAuthority.status = 'not_established';
  noAuthority.errors = ['test_authority_removed'];
  noAuthority.claims.issuer_entitlement_chain_valid = false;
  noAuthority.claims.materialization_authority_established = false;
  negativeCases.push(['missing_authority', await Gate.evaluatePreMaterializationGate({
    authorityVerification: noAuthority,
    materializationPolicy: policy,
    ccrpAdmission: admission,
    operation,
    requestedAction: ACTION,
    requestedTarget: TARGET,
    evaluatedAt
  }), 'failed:materialization_authority_established']);

  const wrongPolicyBinding = clone(authorityVerification);
  wrongPolicyBinding.policy.digest.value = '0'.repeat(64);
  negativeCases.push(['wrong_policy_binding', await Gate.evaluatePreMaterializationGate({
    authorityVerification: wrongPolicyBinding,
    materializationPolicy: policy,
    ccrpAdmission: admission,
    operation,
    requestedAction: ACTION,
    requestedTarget: TARGET,
    evaluatedAt
  }), 'failed:policy_binding_exact']);

  const wrongScopeAuthority = clone(authorityVerification);
  wrongScopeAuthority.required_scope = 'poai.materialization.policy.control';
  negativeCases.push(['wrong_authority_scope', await Gate.evaluatePreMaterializationGate({
    authorityVerification: wrongScopeAuthority,
    materializationPolicy: policy,
    ccrpAdmission: admission,
    operation,
    requestedAction: ACTION,
    requestedTarget: TARGET,
    evaluatedAt
  }), 'failed:authority_scope_exact']);

  for (const [name, negative, expectedReason] of negativeCases) {
    assert(negative.decision === 'not_permitted', `${name}: gate must reject`);
    assert(negative.claims.pre_materialization_permit_established === false, `${name}: permit claim must stay false`);
    assert(negative.claims.materialization_permitted === false, `${name}: materialization permission must stay false`);
    assert(negative.reason_codes.includes(expectedReason), `${name}: expected ${expectedReason}; got ${negative.reason_codes.join(', ')}`);
    assert(negative.claims.materialization_event_recorded === false, `${name}: no event may be recorded`);
    assert(negative.claims.repository_mutation_performed === false, `${name}: no repository mutation may occur`);
    assert(Gate.validatePreMaterializationBoundary(negative).length === 0, `${name}: negative boundary must validate`);
  }

  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    check_type: 'PoAICCRPPreMaterializationIntegrationCheck',
    check_version: '0.1-experimental',
    mode: 'dry_run_ci_only',
    authority_verification_ref: result.authority_verification_ref,
    ccrp_execution_admission_ref: result.ccrp_execution_admission_ref,
    ccrp_operation_ref: result.ccrp_operation_ref,
    decision_ref: result.decision_id,
    negative_vectors: negativeCases.map(([name, value]) => ({ name, decision: value.decision, reason_codes: value.reason_codes })),
    claims: {
      independent_poai_authority_consumed: true,
      independent_ccrp_admission_consumed: true,
      exact_action_target_policy_fence_bound: true,
      pre_materialization_permit_established: true,
      persistent_materialization_event_published: false,
      successor_record_published: false,
      repository_mutation_performed: false,
      automatic_browser_action_performed: false,
      policy_relative_canonicality_established: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      legal_authority_established: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    }
  }, null, 2)}\n`);

  console.log('PoAI + CCRP pre-materialization bridge vectors passed');
  console.log('authority + current execution admission -> preflight permit only');
  console.log('preflight permit != materialization event != canonicality');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
