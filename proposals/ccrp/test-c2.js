'use strict';

const fs = require('fs');
const path = require('path');
const Core = require(path.resolve(__dirname, 'tools/ccrp-core.js'));
const C2 = require(path.resolve(__dirname, 'tools/ccrp-c2.js'));

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeResult(outDir, name, value) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${name}.execution-admission-result.json`), `${JSON.stringify(value, null, 2)}\n`);
}

const outDir = process.argv[2] || '/tmp/ccrp-c2';
const evaluatedAt = '2026-08-22T23:16:30Z';
const currentRevision = 'git:108a83b97c11306061e6463fa1a171aa15bfb4e1';

const chatA = readJson('examples/c0-same-actor-chat-a.work-context.json');
const chatB = readJson('examples/c0-same-actor-chat-b.work-context.json');
const baseOperationA = readJson('examples/c1-chat-a-exclusive.operation-intent.json');
const baseOperationB = readJson('examples/c1-chat-b-exclusive.operation-intent.json');
const oldLeaseA = readJson('examples/c2-chat-a-superseded.execution-lease.json');
const currentLeaseB = readJson('examples/c2-chat-b-current.execution-lease.json');
const contexts = [chatA, chatB];

assert(oldLeaseA.execution_lineage_id === currentLeaseB.execution_lineage_id, 'C2 vector must keep one execution lineage');
assert(oldLeaseA.epoch < currentLeaseB.epoch, 'successor epoch must increase monotonically');
assert(oldLeaseA.fencing_token < currentLeaseB.fencing_token, 'successor fencing token must increase monotonically');
assert(oldLeaseA.superseded_by_lease_ref === currentLeaseB.lease_id, 'old lease must reference its successor');
assert(currentLeaseB.supersedes_lease_ref === oldLeaseA.lease_id, 'current lease must reference predecessor');
assert(oldLeaseA.claims.historical_provenance_preserved === true, 'supersession must preserve old lease history');
assert(oldLeaseA.claims.current_execution_owner_established === false, 'superseded lease must not remain current owner');
assert(currentLeaseB.claims.current_execution_owner_established === true, 'current active lease must identify current owner');

const operationA = Core.clone(baseOperationA);
operationA.base_revision = currentRevision;
operationA.observed_current_revision = currentRevision;
operationA.operation_id = 'urn:ccrp:operation:uu-aap:chat-a:delayed-after-handoff:1';
operationA.idempotency_key = 'ccrp-c2-chat-a-delayed-after-handoff-1';

const operationB = Core.clone(baseOperationB);
operationB.base_revision = currentRevision;
operationB.observed_current_revision = currentRevision;
operationB.operation_id = 'urn:ccrp:operation:uu-aap:chat-b:current-owner-update:1';
operationB.idempotency_key = 'ccrp-c2-chat-b-current-owner-update-1';

const clearA = Core.detectC1Collision({
  operation: operationA,
  contexts,
  currentRevision,
  evaluatedAt
});
const clearB = Core.detectC1Collision({
  operation: operationB,
  contexts,
  currentRevision,
  evaluatedAt
});
assert(clearA.collision_type === 'no_collision', 'stale-executor vector must isolate fencing from C1 stale-base detection');
assert(clearB.collision_type === 'no_collision', 'current-owner vector must be collision clear');

const admitted = C2.evaluateC2ExecutionAdmission({
  operation: operationB,
  presentedLease: currentLeaseB,
  currentLease: currentLeaseB,
  collisionResult: clearB,
  currentRevision,
  evaluatedAt
});
assert(admitted.decision === 'admitted', 'current Chat B owner must be admitted');
assert(admitted.claims.execution_admitted === true, 'positive C2 result must establish execution admission');
assert(admitted.claims.current_execution_owner_established === true, 'positive C2 result must establish current execution owner');
assert(admitted.claims.lease_established === true, 'positive C2 result must establish lease presence');
assert(admitted.claims.materialization_permitted === false, 'C2 admission must not become materialization permission');
assert(admitted.reason_codes.length === 0, 'admitted result must have no rejection reasons');
assert(Object.values(admitted.checks).every(Boolean), 'all C2 admission checks must pass for current owner');
assert(C2.validateC2AdmissionBoundary(admitted).length === 0, 'positive C2 boundary must validate');
writeResult(outDir, 'admitted', admitted);

const staleExecutor = C2.evaluateC2ExecutionAdmission({
  operation: operationA,
  presentedLease: oldLeaseA,
  currentLease: currentLeaseB,
  collisionResult: clearA,
  currentRevision,
  evaluatedAt
});
assert(staleExecutor.decision === 'not_admitted', 'superseded Chat A executor must be rejected');
assert(staleExecutor.reason_codes.includes('stale_epoch'), 'stale executor must expose stale epoch');
assert(staleExecutor.reason_codes.includes('stale_fencing_token'), 'stale executor must expose stale fencing token');
assert(staleExecutor.reason_codes.includes('presented_lease_not_active'), 'superseded lease must not remain active');
assert(staleExecutor.reason_codes.includes('operation_not_owned_by_current_lease'), 'old context must not inherit current execution ownership');
assert(staleExecutor.claims.execution_admitted === false, 'stale executor must not be admitted');
assert(staleExecutor.claims.current_execution_owner_established === true, 'rejection may coexist with another current owner');
assert(staleExecutor.claims.historical_provenance_preserved === true, 'stale rejection must preserve history');
assert(C2.validateC2AdmissionBoundary(staleExecutor).length === 0, 'stale-executor C2 boundary must validate');
writeResult(outDir, 'staleExecutor', staleExecutor);

const wrongSessionOperation = Core.clone(operationB);
wrongSessionOperation.operation_id = 'urn:ccrp:operation:uu-aap:chat-b:wrong-session:1';
wrongSessionOperation.context_ref.session_id = 'urn:ccrp:session:chat-a';
wrongSessionOperation.idempotency_key = 'ccrp-c2-wrong-session-1';
const wrongSessionCollision = Core.detectC1Collision({
  operation: wrongSessionOperation,
  contexts,
  currentRevision,
  evaluatedAt
});
const wrongSession = C2.evaluateC2ExecutionAdmission({
  operation: wrongSessionOperation,
  presentedLease: currentLeaseB,
  currentLease: currentLeaseB,
  collisionResult: wrongSessionCollision,
  currentRevision,
  evaluatedAt
});
assert(wrongSession.decision === 'not_admitted', 'wrong session must be rejected');
assert(wrongSession.reason_codes.includes('presented_lease_does_not_bind_operation'), 'wrong session must fail presented lease binding');
assert(wrongSession.reason_codes.includes('operation_not_owned_by_current_lease'), 'wrong session must fail current ownership binding');
assert(wrongSession.reason_codes.includes('collision_not_clear'), 'C1 wrong-context result must block C2 admission');
assert(C2.validateC2AdmissionBoundary(wrongSession).length === 0, 'wrong-session C2 boundary must validate');
writeResult(outDir, 'wrongSession', wrongSession);

const expiredLease = Core.clone(currentLeaseB);
expiredLease.expires_at = '2026-08-22T23:15:00Z';
const expired = C2.evaluateC2ExecutionAdmission({
  operation: operationB,
  presentedLease: expiredLease,
  currentLease: expiredLease,
  collisionResult: clearB,
  currentRevision,
  evaluatedAt
});
assert(expired.decision === 'not_admitted', 'expired lease must be rejected');
assert(expired.reason_codes.includes('presented_lease_expired_or_not_yet_valid'), 'expired presented lease must be explicit');
assert(expired.reason_codes.includes('current_lease_expired_or_not_yet_valid'), 'expired current lease must be explicit');
assert(expired.claims.current_execution_owner_established === false, 'expired lease must not establish current owner');
assert(C2.validateC2AdmissionBoundary(expired).length === 0, 'expired-lease C2 boundary must validate');
writeResult(outDir, 'expired', expired);

const outOfScopeOperation = Core.clone(operationB);
outOfScopeOperation.operation_id = 'urn:ccrp:operation:uu-aap:chat-b:settings-update:1';
outOfScopeOperation.action = 'repository.settings.update';
outOfScopeOperation.idempotency_key = 'ccrp-c2-out-of-scope-1';
const outOfScopeCollision = Core.detectC1Collision({
  operation: outOfScopeOperation,
  contexts,
  currentRevision,
  evaluatedAt
});
const outOfScope = C2.evaluateC2ExecutionAdmission({
  operation: outOfScopeOperation,
  presentedLease: currentLeaseB,
  currentLease: currentLeaseB,
  collisionResult: outOfScopeCollision,
  currentRevision,
  evaluatedAt
});
assert(outOfScope.decision === 'not_admitted', 'out-of-scope action must be rejected');
assert(outOfScope.reason_codes.includes('action_outside_lease_scope'), 'scope expansion must be explicit');
assert(C2.validateC2AdmissionBoundary(outOfScope).length === 0, 'out-of-scope C2 boundary must validate');
writeResult(outDir, 'outOfScope', outOfScope);

const blockingCollision = Core.detectC1Collision({
  operation: operationB,
  peerOperation: operationA,
  contexts,
  currentRevision,
  evaluatedAt
});
assert(blockingCollision.collision_type === 'exclusive_operation_collision', 'blocking vector must preserve C1 exclusive collision');
const blocked = C2.evaluateC2ExecutionAdmission({
  operation: operationB,
  presentedLease: currentLeaseB,
  currentLease: currentLeaseB,
  collisionResult: blockingCollision,
  currentRevision,
  evaluatedAt
});
assert(blocked.decision === 'not_admitted', 'blocking C1 collision must prevent C2 admission');
assert(blocked.reason_codes.includes('collision_not_clear'), 'blocking collision reason must be explicit');
assert(C2.validateC2AdmissionBoundary(blocked).length === 0, 'blocking-collision C2 boundary must validate');
writeResult(outDir, 'blockingCollision', blocked);

const staleRevisionOperation = Core.clone(operationB);
staleRevisionOperation.operation_id = 'urn:ccrp:operation:uu-aap:chat-b:stale-revision:1';
staleRevisionOperation.base_revision = 'git:cacf6eb53ea52a25f0d3aef88a36d323c32ea996';
staleRevisionOperation.observed_current_revision = 'git:cacf6eb53ea52a25f0d3aef88a36d323c32ea996';
staleRevisionOperation.idempotency_key = 'ccrp-c2-stale-revision-1';
const staleRevisionCollision = Core.detectC1Collision({
  operation: staleRevisionOperation,
  contexts,
  currentRevision,
  evaluatedAt
});
assert(staleRevisionCollision.collision_type === 'stale_base', 'stale revision must remain a C1 collision');
const staleRevision = C2.evaluateC2ExecutionAdmission({
  operation: staleRevisionOperation,
  presentedLease: currentLeaseB,
  currentLease: currentLeaseB,
  collisionResult: staleRevisionCollision,
  currentRevision,
  evaluatedAt
});
assert(staleRevision.decision === 'not_admitted', 'stale revision must be rejected');
assert(staleRevision.reason_codes.includes('collision_not_clear'), 'stale C1 collision must block C2');
assert(staleRevision.reason_codes.includes('revision_not_current'), 'C2 must independently retain current-revision check');
assert(C2.validateC2AdmissionBoundary(staleRevision).length === 0, 'stale-revision C2 boundary must validate');
writeResult(outDir, 'staleRevision', staleRevision);

console.log('CCRP/C2 execution fencing vectors passed');
console.log('old epoch/token rejected; current owner admitted');
console.log('execution admission != materialization permission confirmed');
