'use strict';

const fs = require('fs');
const path = require('path');
const Core = require(path.resolve(__dirname, 'tools/ccrp-core.js'));
const C2 = require(path.resolve(__dirname, 'tools/ccrp-c2.js'));
const C4 = require(path.resolve(__dirname, 'tools/ccrp-c4.js'));
const C5 = require(path.resolve(__dirname, 'tools/ccrp-c5.js'));

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function readLocal(relativePath) { return readJson(path.resolve(__dirname, relativePath)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const verificationPath = process.argv[2] || '/tmp/live-authority-verification.json';
  const resultPath = process.argv[3] || '/tmp/ccrp-c5-policy-coordination-result.json';
  const summaryPath = process.argv[4] || '/tmp/ccrp-c5-policy-coordination-check.json';

  const TARGET = 'github:Matawaka/uu-aap';
  const ACTION = 'poai.successor.materialization.execute';
  const currentRevision = 'git:5fc96b852107e3683f9af4bd768e42d5fe5d3de1';
  const evaluatedAt = '2026-08-22T23:59:00Z';

  const authorityVerification = readJson(verificationPath);
  const policy = readLocal('../poai/materialization/policies/github/Matawaka.uu-aap.materialization-policy.json');
  const chatA = readLocal('examples/c0-same-actor-chat-a.work-context.json');
  const chatB = readLocal('examples/c0-same-actor-chat-b.work-context.json');
  const baseOperation = readLocal('examples/c1-chat-b-exclusive.operation-intent.json');
  const baseLease = readLocal('examples/c2-chat-b-current.execution-lease.json');

  const operation = clone(baseOperation);
  operation.operation_id = 'urn:ccrp:operation:uu-aap:c5-policy-integration:1';
  operation.action = ACTION;
  operation.target = TARGET;
  operation.base_revision = currentRevision;
  operation.observed_current_revision = currentRevision;
  operation.idempotency_key = 'ccrp-c5-policy-integration-1';
  operation.read_set = ['ref:refs/heads/main'];
  operation.write_set = ['poai:successor-materialization'];
  operation.created_at = '2026-08-22T23:58:30Z';

  const lease = clone(baseLease);
  lease.lease_id = 'urn:ccrp:lease:uu-aap:c5-policy-integration:5';
  lease.execution_lineage_id = 'urn:ccrp:execution-lineage:uu-aap:c5-policy-integration';
  lease.epoch = 5;
  lease.fencing_token = 5;
  lease.operation_scope = [ACTION];
  lease.target_scope = [TARGET];
  lease.issued_revision = currentRevision;
  lease.issued_at = '2026-08-22T23:58:00Z';
  lease.expires_at = '2026-08-23T00:20:00Z';
  lease.status = 'active';
  lease.supersedes_lease_ref = null;
  lease.superseded_by_lease_ref = null;

  const coordinationState = C4.deriveC4State({
    workContext: chatB,
    currentLease: lease,
    lastCanonicalRevision: currentRevision
  });

  const contextAdmission = C4.evaluateC4ContextAdmission({
    operation,
    presentedLease: lease,
    state: coordinationState,
    workContext: chatB,
    currentRevision,
    evaluatedAt
  });
  assert(contextAdmission.decision === 'context_admitted', 'C5 vector requires independently established C4 Context Admission');
  assert(contextAdmission.claims.execution_admitted === false, 'C4 Context Admission must not self-establish execution admission');
  assert(contextAdmission.claims.materialization_permitted === false, 'C4 Context Admission must not self-establish materialization permission');
  assert(C4.validateC4Boundary(contextAdmission).length === 0, 'C4 Context Admission boundary must validate');

  const collision = Core.detectC1Collision({
    operation,
    contexts: [chatA, chatB],
    currentRevision,
    evaluatedAt
  });
  assert(collision.collision_type === 'no_collision', 'C5 operation must be collision-clear');

  const executionAdmission = C2.evaluateC2ExecutionAdmission({
    operation,
    presentedLease: lease,
    currentLease: lease,
    collisionResult: collision,
    currentRevision,
    evaluatedAt
  });
  assert(executionAdmission.decision === 'admitted', 'C5 vector requires independently established C2 execution admission');
  assert(executionAdmission.claims.materialization_permitted === false, 'C2 admission must not self-establish materialization permission');
  assert(C2.validateC2AdmissionBoundary(executionAdmission).length === 0, 'C2 execution boundary must validate');

  const positive = await C5.evaluateC5PolicyCoordination({
    authorityVerification,
    materializationPolicy: policy,
    contextAdmission,
    executionAdmission,
    operation,
    requestedAction: ACTION,
    requestedTarget: TARGET,
    evaluatedAt
  });

  assert(positive.decision === 'coordinated', `C5 positive vector must coordinate: ${positive.reason_codes.join(', ')}`);
  assert(Object.values(positive.checks).every(Boolean), 'all C5 positive checks must pass');
  assert(positive.claims.external_poai_authority_input_established === true, 'external PoAI authority input must remain independently established');
  assert(positive.claims.external_materialization_policy_input_established === true, 'external policy input must remain independently established');
  assert(positive.claims.context_admission_input_established === true, 'C4 input must remain independently established');
  assert(positive.claims.execution_admission_input_established === true, 'C2 input must remain independently established');
  assert(positive.claims.policy_integrated_coordination_established === true, 'C5 may establish policy-integrated coordination');
  assert(positive.claims.poai_authority_established === false, 'C5 must not re-issue PoAI authority as a CCRP claim');
  assert(positive.claims.execution_admitted === false, 'C5 must not replace C2 execution admission');
  assert(positive.claims.materialization_permitted === false, 'C5 must not replace the pre-materialization gate');
  assert(positive.claims.canonical_state_established === false, 'C5 must not establish canonical state');
  assert(C5.validateC5Boundary(positive).length === 0, 'positive C5 boundary must validate');

  const negativeCases = [];

  const contextRejected = clone(contextAdmission);
  contextRejected.decision = 'not_admitted';
  contextRejected.reason_codes = ['session_not_current_owner'];
  contextRejected.checks.owner_exact = false;
  contextRejected.claims.context_admission_established = false;
  negativeCases.push(['context_not_admitted', await C5.evaluateC5PolicyCoordination({
    authorityVerification, materializationPolicy: policy, contextAdmission: contextRejected,
    executionAdmission, operation, requestedAction: ACTION, requestedTarget: TARGET, evaluatedAt
  }), 'failed:context_admitted']);

  const executionRejected = clone(executionAdmission);
  executionRejected.decision = 'not_admitted';
  executionRejected.reason_codes = ['stale_fencing_token'];
  executionRejected.checks.fencing_token_current = false;
  executionRejected.claims.execution_admitted = false;
  negativeCases.push(['execution_not_admitted', await C5.evaluateC5PolicyCoordination({
    authorityVerification, materializationPolicy: policy, contextAdmission,
    executionAdmission: executionRejected, operation, requestedAction: ACTION, requestedTarget: TARGET, evaluatedAt
  }), 'failed:execution_admitted']);

  const wrongOperationContext = clone(contextAdmission);
  wrongOperationContext.operation_ref = 'urn:ccrp:operation:uu-aap:other-operation:1';
  negativeCases.push(['operation_ref_mismatch', await C5.evaluateC5PolicyCoordination({
    authorityVerification, materializationPolicy: policy, contextAdmission: wrongOperationContext,
    executionAdmission, operation, requestedAction: ACTION, requestedTarget: TARGET, evaluatedAt
  }), 'failed:operation_ref_exact']);

  const wrongLeaseContext = clone(contextAdmission);
  wrongLeaseContext.presented_lease_ref = 'urn:ccrp:lease:uu-aap:other-lease:99';
  negativeCases.push(['lease_ref_mismatch', await C5.evaluateC5PolicyCoordination({
    authorityVerification, materializationPolicy: policy, contextAdmission: wrongLeaseContext,
    executionAdmission, operation, requestedAction: ACTION, requestedTarget: TARGET, evaluatedAt
  }), 'failed:lease_ref_exact']);

  const noAuthority = clone(authorityVerification);
  noAuthority.status = 'not_established';
  noAuthority.errors = ['test_authority_removed'];
  noAuthority.claims.issuer_entitlement_chain_valid = false;
  noAuthority.claims.materialization_authority_established = false;
  negativeCases.push(['external_authority_not_established', await C5.evaluateC5PolicyCoordination({
    authorityVerification: noAuthority, materializationPolicy: policy, contextAdmission,
    executionAdmission, operation, requestedAction: ACTION, requestedTarget: TARGET, evaluatedAt
  }), 'failed:external_authority_established']);

  const wrongPolicyBinding = clone(authorityVerification);
  wrongPolicyBinding.policy.digest.value = '0'.repeat(64);
  negativeCases.push(['policy_digest_mismatch', await C5.evaluateC5PolicyCoordination({
    authorityVerification: wrongPolicyBinding, materializationPolicy: policy, contextAdmission,
    executionAdmission, operation, requestedAction: ACTION, requestedTarget: TARGET, evaluatedAt
  }), 'failed:policy_binding_exact']);

  negativeCases.push(['wrong_action', await C5.evaluateC5PolicyCoordination({
    authorityVerification, materializationPolicy: policy, contextAdmission,
    executionAdmission, operation, requestedAction: 'poai.materialization.policy.control', requestedTarget: TARGET, evaluatedAt
  }), 'failed:authority_scope_exact']);

  negativeCases.push(['wrong_target', await C5.evaluateC5PolicyCoordination({
    authorityVerification, materializationPolicy: policy, contextAdmission,
    executionAdmission, operation, requestedAction: ACTION, requestedTarget: 'github:Other/example', evaluatedAt
  }), 'failed:authority_target_exact']);

  const selfPermittingContext = clone(contextAdmission);
  selfPermittingContext.claims.materialization_permitted = true;
  negativeCases.push(['context_self_permits_materialization', await C5.evaluateC5PolicyCoordination({
    authorityVerification, materializationPolicy: policy, contextAdmission: selfPermittingContext,
    executionAdmission, operation, requestedAction: ACTION, requestedTarget: TARGET, evaluatedAt
  }), 'failed:context_input_did_not_self_permit_materialization']);

  for (const [name, result, expectedReason] of negativeCases) {
    assert(result.decision === 'not_coordinated', `${name}: C5 must reject`);
    assert(result.claims.policy_integrated_coordination_established === false, `${name}: C5 coordination claim must remain false`);
    assert(result.claims.materialization_permitted === false, `${name}: C5 must never establish materialization permission`);
    assert(result.claims.poai_authority_established === false, `${name}: C5 must never re-issue authority`);
    assert(result.reason_codes.includes(expectedReason), `${name}: expected ${expectedReason}; got ${result.reason_codes.join(', ')}`);
    assert(C5.validateC5Boundary(result).length === 0, `${name}: negative C5 boundary must validate`);
  }

  fs.writeFileSync(resultPath, `${JSON.stringify(positive, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    check_type: 'CCRPPolicyIntegratedCoordinationCheck',
    check_version: '0.1-experimental',
    policy_coordination_ref: positive.result_id,
    authority_verification_ref: positive.authority_verification_ref,
    context_admission_ref: positive.context_admission_ref,
    execution_admission_ref: positive.execution_admission_ref,
    negative_vectors: negativeCases.map(([name, value]) => ({ name, decision: value.decision, reason_codes: value.reason_codes })),
    claims: {
      policy_integrated_coordination_established: true,
      source_axes_preserved_separately: true,
      poai_authority_reissued_by_ccrp: false,
      materialization_permitted_by_c5: false,
      repository_mutation_performed: false,
      canonical_state_established: false,
      universal_canonicality_established: false,
      poai_v_conformance_established: false
    }
  }, null, 2)}\n`);

  console.log('CCRP/C5 policy-integrated coordination vectors passed');
  console.log('external_authority != CCRP_authority confirmed');
  console.log('context_admission != execution_admission != materialization_permission confirmed');
  console.log('policy_integrated_coordination != canonical_state != PoAI/V confirmed');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
