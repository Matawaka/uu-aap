'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Core = require(path.resolve(__dirname, 'tools/ccrp-core.js'));
const C2 = require(path.resolve(__dirname, 'tools/ccrp-c2.js'));
const C4 = require(path.resolve(__dirname, 'tools/ccrp-c4.js'));

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const outDir = process.argv[2] || '/tmp/ccrp-c4';
const currentRevision = 'git:6a14704178b59d0ccb596b51e50bd37eac761532';
const workContext = readJson('examples/c0-same-actor-chat-b.work-context.json');
const leaseTemplate = readJson('examples/c2-chat-b-current.execution-lease.json');

const initialLease = clone(leaseTemplate);
initialLease.lease_id = 'urn:ccrp:lease:uu-aap:c4-cross-context:4';
initialLease.execution_lineage_id = 'urn:ccrp:execution-lineage:uu-aap:c4-cross-context';
initialLease.epoch = 4;
initialLease.fencing_token = 4;
initialLease.operation_scope = ['repository.main.update'];
initialLease.target_scope = ['github:Matawaka/uu-aap:branch/main'];
initialLease.issued_revision = currentRevision;
initialLease.issued_at = '2026-08-22T23:47:00Z';
initialLease.expires_at = '2026-08-23T00:30:00Z';
initialLease.status = 'active';
initialLease.supersedes_lease_ref = 'urn:ccrp:lease:uu-aap:c4-cross-context:3';
initialLease.superseded_by_lease_ref = null;
initialLease.context_ref.context_id = workContext.context_id;
initialLease.context_ref.actor_id = workContext.origin.actor_id;
initialLease.context_ref.session_id = workContext.origin.session_id;
initialLease.context_ref.intent_id = workContext.intent.intent_id;
initialLease.context_ref.intent_revision = workContext.intent.revision;
initialLease.context_ref.intent_digest = workContext.intent.digest;

function c1Claims() {
  return {
    context_bound: true,
    collision_checked: false,
    execution_admitted: false,
    current_execution_owner_established: false,
    lease_established: false,
    materialization_permitted: false,
    canonical_state_established: false,
    poai_authority_established: false,
    universal_canonicality_established: false,
    truth_certified: false,
    causal_proof_certified: false,
    legal_responsibility_determined: false,
    moral_correctness_established: false,
    legal_effect_established: false,
    poai_v_conformance_established: false
  };
}

function operation({ suffix, owner, lease, revision = currentRevision, action = 'repository.main.update', target = 'github:Matawaka/uu-aap:branch/main' }) {
  return {
    artifact_type: 'CCRPOperationIntent',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C1',
    operation_id: `urn:ccrp:operation:uu-aap:c4:${suffix}`,
    context_ref: {
      context_id: workContext.context_id,
      actor_id: owner.actor_id,
      session_id: owner.session_id,
      intent_id: workContext.intent.intent_id,
      intent_revision: workContext.intent.revision,
      intent_digest: workContext.intent.digest
    },
    action,
    target,
    concurrency_class: 'exclusive',
    base_revision: revision,
    observed_current_revision: revision,
    idempotency_key: `ccrp-c4-${suffix}`,
    read_set: ['ref:refs/heads/main'],
    write_set: ['ref:refs/heads/main'],
    created_at: '2026-08-22T23:48:30Z',
    claims: c1Claims(),
    presented_lease_ref: lease && lease.lease_id
  };
}

// C1 schema forbids presented_lease_ref; remove it before C1 use while keeping a
// helper-local association available to the C4 test code.
function c1Operation(args) {
  const value = operation(args);
  delete value.presented_lease_ref;
  return value;
}

function previousLeaseRef(state) {
  if (state.active_lease_ref) return state.active_lease_ref;
  return state.historical_lease_refs[state.historical_lease_refs.length - 1];
}

function transition({
  state,
  type,
  suffix,
  toOwner = null,
  fromOwner = state.owner,
  observedRevision = currentRevision,
  operationScope = state.operation_scope,
  targetScope = state.target_scope,
  intentRef = state.intent_ref,
  requestedAt
}) {
  return {
    artifact_type: 'CCRPCoordinationTransition',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C4',
    transition_id: `urn:ccrp:coordination-transition:uu-aap:${suffix}`,
    transition_type: type,
    context_id: state.context_id,
    intent_ref: clone(intentRef),
    from_owner: clone(fromOwner),
    to_owner: toOwner ? clone(toOwner) : null,
    previous_epoch: state.epoch,
    previous_fencing_token: state.fencing_token,
    previous_lease_ref: previousLeaseRef(state),
    execution_lineage_id: initialLease.execution_lineage_id,
    observed_current_revision: observedRevision,
    operation_scope: [...operationScope],
    target_scope: [...targetScope],
    requested_at: requestedAt,
    reason: `CCRP/C4 vector: ${type}`
  };
}

const ownerB = {
  actor_id: workContext.origin.actor_id,
  session_id: workContext.origin.session_id
};
const ownerC = {
  actor_id: workContext.origin.actor_id,
  session_id: 'urn:ccrp:session:chat-c'
};
const ownerD = {
  actor_id: workContext.origin.actor_id,
  session_id: 'urn:ccrp:session:chat-d'
};

const initialState = C4.deriveC4State({
  workContext,
  currentLease: initialLease,
  lastCanonicalRevision: currentRevision
});
assert(initialState.coordination_status === 'active', 'C4 must derive an active coordination state from the current lease');
assert(initialState.origin_ref.session_id === workContext.origin.session_id, 'immutable origin session must remain historical provenance');
assert(initialState.owner.session_id === ownerB.session_id, 'initial current owner must match the current lease');
assert(C4.validateC4Boundary(initialState).length === 0, 'initial C4 state boundary must validate');

const pauseTransition = transition({
  state: initialState,
  type: 'pause',
  suffix: 'pause:1',
  requestedAt: '2026-08-22T23:48:00Z'
});
const pauseResult = C4.applyC4Transition({
  state: initialState,
  transition: pauseTransition,
  workContext,
  currentRevision
});
assert(pauseResult.decision === 'accepted', 'active context must accept an exact pause transition');
assert(pauseResult.next_state.coordination_status === 'paused', 'pause must establish PAUSED protocol state');
assert(pauseResult.next_state.epoch === initialState.epoch, 'pause itself must not invent a successor epoch');
assert(pauseResult.next_state.fencing_token === initialState.fencing_token, 'pause itself must not invent a successor fencing token');
assert(pauseResult.next_state.active_lease_ref === null, 'paused context must have no active execution lease ref');
assert(pauseResult.next_state.historical_lease_refs.includes(initialLease.lease_id), 'pause must preserve predecessor lease provenance');
assert(pauseResult.claims.pause_barrier_established === true, 'pause barrier must be explicit');
assert(C4.validateC4Boundary(pauseResult).length === 0, 'pause transition boundary must validate');

const oldOperation = c1Operation({ suffix: 'old-session-write:1', owner: ownerB, lease: initialLease });
const pausedAdmission = C4.evaluateC4ContextAdmission({
  operation: oldOperation,
  presentedLease: initialLease,
  state: pauseResult.next_state,
  workContext,
  currentRevision,
  evaluatedAt: '2026-08-22T23:48:30Z'
});
assert(pausedAdmission.decision === 'not_admitted', 'paused context must reject otherwise-valid writes');
assert(pausedAdmission.reason_codes.includes('context_paused_or_inactive'), 'pause rejection reason must be explicit');
assert(C4.validateC4Boundary(pausedAdmission).length === 0, 'paused admission boundary must validate');

const resumeTransition = transition({
  state: pauseResult.next_state,
  type: 'resume',
  suffix: 'resume-to-chat-c:1',
  toOwner: ownerC,
  requestedAt: '2026-08-22T23:49:00Z'
});
const resumeResult = C4.applyC4Transition({
  state: pauseResult.next_state,
  transition: resumeTransition,
  workContext,
  currentRevision
});
assert(resumeResult.decision === 'accepted', 'paused context must accept exact explicit resume');
assert(resumeResult.claims.resume_established === true, 'resume must be explicit');
assert(resumeResult.claims.successor_epoch_established === true, 'resume must establish a successor epoch');
assert(resumeResult.successor_lease.epoch === initialState.epoch + 1, 'resume epoch must increase monotonically');
assert(resumeResult.successor_lease.fencing_token === initialState.fencing_token + 1, 'resume fencing token must increase monotonically');
assert(resumeResult.successor_lease.context_ref.session_id === ownerC.session_id, 'resume must bind the receiving session');
assert(resumeResult.next_state.origin_ref.session_id === workContext.origin.session_id, 'resume must not rewrite Work Context origin provenance');
assert(resumeResult.next_state.owner.session_id === ownerC.session_id, 'resume must establish the new current owner');
assert(resumeResult.next_state.last_canonical_revision === currentRevision, 'resume must preserve the freshly reread current revision');
assert(C2.leaseTimeValid(resumeResult.successor_lease, '2026-08-22T23:50:00Z') === true, 'resume successor lease must be time-valid');
assert(C4.validateC4Boundary(resumeResult).length === 0, 'resume transition boundary must validate');

const resumedOperation = c1Operation({
  suffix: 'chat-c-after-resume:1',
  owner: ownerC,
  lease: resumeResult.successor_lease
});
const resumedAdmission = C4.evaluateC4ContextAdmission({
  operation: resumedOperation,
  presentedLease: resumeResult.successor_lease,
  state: resumeResult.next_state,
  workContext,
  currentRevision,
  evaluatedAt: '2026-08-22T23:50:00Z'
});
assert(resumedAdmission.decision === 'context_admitted', 'receiving session must independently pass C4 Context Admission');
assert(resumedAdmission.claims.context_admission_established === true, 'exact resumed context admission may be established');
assert(resumedAdmission.claims.execution_admitted === false, 'C4 Context Admission must remain distinct from execution admission');
assert(C4.validateC4Boundary(resumedAdmission).length === 0, 'resumed context admission boundary must validate');

const delayedOldAdmission = C4.evaluateC4ContextAdmission({
  operation: oldOperation,
  presentedLease: initialLease,
  state: resumeResult.next_state,
  workContext,
  currentRevision,
  evaluatedAt: '2026-08-22T23:50:00Z'
});
assert(delayedOldAdmission.decision === 'not_admitted', 'old session must not regain current context after resume');
assert(delayedOldAdmission.reason_codes.includes('session_not_current_owner'), 'old session owner mismatch must be explicit');
assert(delayedOldAdmission.reason_codes.includes('stale_epoch'), 'old session epoch must be stale after resume');
assert(delayedOldAdmission.reason_codes.includes('stale_fencing_token'), 'old session fencing token must be stale after resume');

const oldCollision = Core.detectC1Collision({
  operation: oldOperation,
  contexts: [workContext],
  currentRevision,
  evaluatedAt: '2026-08-22T23:50:00Z'
});
assert(oldCollision.collision_type === 'no_collision', 'old delayed operation is context-historically valid at C1 and must be rejected by newer fencing, not rewritten as false history');
const staleC2 = C2.evaluateC2ExecutionAdmission({
  operation: oldOperation,
  presentedLease: initialLease,
  currentLease: resumeResult.successor_lease,
  collisionResult: oldCollision,
  currentRevision,
  evaluatedAt: '2026-08-22T23:50:00Z'
});
assert(staleC2.decision === 'not_admitted', 'C2 must fence the delayed old executor after C4 resume');
assert(staleC2.reason_codes.includes('stale_epoch'), 'C2 must detect stale pre-resume epoch');
assert(staleC2.reason_codes.includes('stale_fencing_token'), 'C2 must detect stale pre-resume fencing token');

const handoffTransition = transition({
  state: resumeResult.next_state,
  type: 'handoff',
  suffix: 'handoff-chat-c-to-chat-d:1',
  toOwner: ownerD,
  requestedAt: '2026-08-22T23:51:00Z'
});
const handoffResult = C4.applyC4Transition({
  state: resumeResult.next_state,
  transition: handoffTransition,
  workContext,
  currentRevision
});
assert(handoffResult.decision === 'accepted', 'active owner must be able to explicitly hand off');
assert(handoffResult.claims.handoff_established === true, 'handoff claim must be explicit');
assert(handoffResult.successor_lease.epoch === resumeResult.successor_lease.epoch + 1, 'handoff must create a new epoch');
assert(handoffResult.successor_lease.fencing_token === resumeResult.successor_lease.fencing_token + 1, 'handoff must create a new fencing token');
assert(handoffResult.successor_lease.context_ref.session_id === ownerD.session_id, 'handoff successor lease must bind destination session');
assert(handoffResult.successor_lease.supersedes_lease_ref === resumeResult.successor_lease.lease_id, 'handoff must preserve predecessor lease reference');
assert(C4.validateC4Boundary(handoffResult).length === 0, 'handoff boundary must validate');

const handoffOperation = c1Operation({
  suffix: 'chat-d-after-handoff:1',
  owner: ownerD,
  lease: handoffResult.successor_lease
});
const handoffAdmission = C4.evaluateC4ContextAdmission({
  operation: handoffOperation,
  presentedLease: handoffResult.successor_lease,
  state: handoffResult.next_state,
  workContext,
  currentRevision,
  evaluatedAt: '2026-08-22T23:52:00Z'
});
assert(handoffAdmission.decision === 'context_admitted', 'handoff receiver must independently pass Context Admission');
assert(handoffAdmission.claims.execution_admitted === false, 'handoff admission must not itself execute anything');

const wrongFrom = transition({
  state: resumeResult.next_state,
  type: 'handoff',
  suffix: 'wrong-from-owner:1',
  fromOwner: ownerB,
  toOwner: ownerD,
  requestedAt: '2026-08-22T23:51:10Z'
});
const wrongFromResult = C4.applyC4Transition({ state: resumeResult.next_state, transition: wrongFrom, workContext, currentRevision });
assert(wrongFromResult.decision === 'rejected', 'handoff from a non-current session must be rejected');
assert(wrongFromResult.reason_codes.includes('from_owner_mismatch'), 'wrong from-session reason must be explicit');

const resumeWhileActive = transition({
  state: resumeResult.next_state,
  type: 'resume',
  suffix: 'resume-while-active:1',
  toOwner: ownerD,
  requestedAt: '2026-08-22T23:51:20Z'
});
const resumeWhileActiveResult = C4.applyC4Transition({ state: resumeResult.next_state, transition: resumeWhileActive, workContext, currentRevision });
assert(resumeWhileActiveResult.decision === 'rejected', 'resume while active must be rejected');
assert(resumeWhileActiveResult.reason_codes.includes('resume_requires_paused_context'), 'resume state mismatch reason must be explicit');

const staleResume = transition({
  state: pauseResult.next_state,
  type: 'resume',
  suffix: 'stale-reread:1',
  toOwner: ownerC,
  observedRevision: 'git:4eb19eb841bc4202f4dc483d33e2bb38c750ba91',
  requestedAt: '2026-08-22T23:49:10Z'
});
const staleResumeResult = C4.applyC4Transition({ state: pauseResult.next_state, transition: staleResume, workContext, currentRevision });
assert(staleResumeResult.decision === 'hold', 'stale resume must be held for explicit current-state reread');
assert(staleResumeResult.reason_codes.includes('current_revision_reread_required'), 'stale resume reread reason must be explicit');

const scopeExpansion = transition({
  state: pauseResult.next_state,
  type: 'resume',
  suffix: 'scope-expansion:1',
  toOwner: ownerC,
  operationScope: [...pauseResult.next_state.operation_scope, 'poai.materialization.policy.control'],
  requestedAt: '2026-08-22T23:49:20Z'
});
const scopeExpansionResult = C4.applyC4Transition({ state: pauseResult.next_state, transition: scopeExpansion, workContext, currentRevision });
assert(scopeExpansionResult.decision === 'rejected', 'resume must not expand operation scope');
assert(scopeExpansionResult.reason_codes.includes('operation_scope_change_not_permitted'), 'scope expansion reason must be explicit');

const foreignIntent = clone(pauseResult.next_state.intent_ref);
foreignIntent.intent_digest = `sha256:${'f'.repeat(64)}`;
const intentMismatch = transition({
  state: pauseResult.next_state,
  type: 'resume',
  suffix: 'intent-mismatch:1',
  toOwner: ownerC,
  intentRef: foreignIntent,
  requestedAt: '2026-08-22T23:49:30Z'
});
const intentMismatchResult = C4.applyC4Transition({ state: pauseResult.next_state, transition: intentMismatch, workContext, currentRevision });
assert(intentMismatchResult.decision === 'rejected', 'resume must not silently change intent');
assert(intentMismatchResult.reason_codes.includes('intent_mismatch'), 'intent mismatch reason must be explicit');

for (const artifact of [
  initialState,
  pauseResult,
  pausedAdmission,
  resumeResult,
  resumedAdmission,
  delayedOldAdmission,
  handoffResult,
  handoffAdmission,
  wrongFromResult,
  resumeWhileActiveResult,
  staleResumeResult,
  scopeExpansionResult,
  intentMismatchResult
]) {
  assert(C4.validateC4Boundary(artifact).length === 0, `C4 assurance boundary failed for ${artifact.artifact_type}`);
}

fs.mkdirSync(outDir, { recursive: true });
const outputs = {
  'initial.coordination-state.json': initialState,
  'pause.coordination-transition.json': pauseTransition,
  'pause.coordination-transition-result.json': pauseResult,
  'paused.context-admission-result.json': pausedAdmission,
  'resume.coordination-transition.json': resumeTransition,
  'resume.coordination-transition-result.json': resumeResult,
  'resume.successor-execution-lease.json': resumeResult.successor_lease,
  'resumed.context-admission-result.json': resumedAdmission,
  'delayed-old.context-admission-result.json': delayedOldAdmission,
  'delayed-old.execution-admission-result.c2.json': staleC2,
  'handoff.coordination-transition.json': handoffTransition,
  'handoff.coordination-transition-result.json': handoffResult,
  'handoff.successor-execution-lease.json': handoffResult.successor_lease,
  'handoff.context-admission-result.json': handoffAdmission,
  'wrong-from.coordination-transition.json': wrongFrom,
  'wrong-from.coordination-transition-result.json': wrongFromResult,
  'resume-while-active.coordination-transition.json': resumeWhileActive,
  'resume-while-active.coordination-transition-result.json': resumeWhileActiveResult,
  'stale-resume.coordination-transition.json': staleResume,
  'stale-resume.coordination-transition-result.json': staleResumeResult,
  'scope-expansion.coordination-transition.json': scopeExpansion,
  'scope-expansion.coordination-transition-result.json': scopeExpansionResult,
  'intent-mismatch.coordination-transition.json': intentMismatch,
  'intent-mismatch.coordination-transition-result.json': intentMismatchResult
};
for (const [name, artifact] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(artifact, null, 2)}\n`);
}

execFileSync('python', [path.resolve(__dirname, 'validate-c4.py'), outDir], { stdio: 'inherit' });

console.log('CCRP/C4 cross-context coordination vectors passed');
console.log('pause != absence_of_activity confirmed');
console.log('resume = reread + successor_epoch + successor_fence confirmed');
console.log('handoff != implicit_context_inheritance confirmed');
console.log('origin_session != current_execution_session confirmed');
console.log('context_admission != execution_admission != materialization confirmed');
