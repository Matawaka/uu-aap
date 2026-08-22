'use strict';

const fs = require('fs');
const path = require('path');
const Core = require(path.resolve(__dirname, 'tools/ccrp-core.js'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, file), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const contexts = [
  readJson('examples/c0-same-actor-chat-a.work-context.json'),
  readJson('examples/c0-same-actor-chat-b.work-context.json')
];
const operationA = readJson('examples/c1-chat-a-exclusive.operation-intent.json');
const operationB = readJson('examples/c1-chat-b-exclusive.operation-intent.json');
const currentRevision = 'git:cacf6eb53ea52a25f0d3aef88a36d323c32ea996';
const evaluatedAt = '2026-08-22T23:10:00Z';

assert(Core.validateC1IntentBoundary(operationA).length === 0, 'operation A must preserve C1 intent boundary');
assert(Core.validateC1IntentBoundary(operationB).length === 0, 'operation B must preserve C1 intent boundary');
assert(operationA.context_ref.actor_id === operationB.context_ref.actor_id, 'C1 fixture must preserve same actor');
assert(operationA.context_ref.context_id !== operationB.context_ref.context_id, 'C1 fixture must preserve distinct contexts');
assert(operationA.context_ref.session_id !== operationB.context_ref.session_id, 'C1 fixture must preserve distinct sessions');

const originalA = JSON.stringify(operationA);
const originalB = JSON.stringify(operationB);

const exclusive = Core.detectC1Collision({
  operation: operationA,
  peerOperation: operationB,
  contexts,
  currentRevision,
  evaluatedAt
});
assert(exclusive.collision_type === 'exclusive_operation_collision', 'overlapping exclusive intents must collide');
assert(exclusive.blocking === true, 'exclusive collision must block in C1');
assert(exclusive.claims.collision_detected === true, 'exclusive collision must be observable');
assert(exclusive.claims.collision_resolved === false, 'C1 must not silently resolve collision');
assert(exclusive.operation_refs.length === 2, 'both source intents must remain referenced');
assert(Core.validateC1ResultBoundary(exclusive).length === 0, 'exclusive result boundary must hold');

const staleOperation = Core.clone(operationA);
staleOperation.operation_id = 'urn:ccrp:operation:uu-aap:chat-a:stale-main-update:1';
staleOperation.base_revision = 'git:1007d5a41f66d5b8ee8222682511563a9dc37b90';
staleOperation.observed_current_revision = 'git:1007d5a41f66d5b8ee8222682511563a9dc37b90';
const stale = Core.detectC1Collision({
  operation: staleOperation,
  contexts,
  currentRevision,
  evaluatedAt
});
assert(stale.collision_type === 'stale_base', 'older relevant revision must be detected as stale');
assert(stale.reason_codes.includes('relevant_revision_changed'), 'stale reason must be explicit');
assert(Core.validateC1ResultBoundary(stale).length === 0, 'stale result boundary must hold');

const duplicateOperation = Core.clone(operationA);
duplicateOperation.operation_id = 'urn:ccrp:operation:uu-aap:chat-a:main-update:redelivery';
const duplicate = Core.detectC1Collision({
  operation: duplicateOperation,
  contexts,
  currentRevision,
  seenIdempotencyKeys: [operationA.idempotency_key],
  evaluatedAt
});
assert(duplicate.collision_type === 'duplicate_operation', 're-delivered idempotency key must be detected');
assert(duplicate.reason_codes.includes('idempotency_key_already_observed'), 'duplicate reason must be explicit');
assert(Core.validateC1ResultBoundary(duplicate).length === 0, 'duplicate result boundary must hold');

const wrongContextOperation = Core.clone(operationA);
wrongContextOperation.operation_id = 'urn:ccrp:operation:uu-aap:chat-a:wrong-session:1';
wrongContextOperation.context_ref.session_id = operationB.context_ref.session_id;
const wrongContext = Core.detectC1Collision({
  operation: wrongContextOperation,
  contexts,
  currentRevision,
  evaluatedAt
});
assert(wrongContext.collision_type === 'wrong_context', 'session/context mismatch must be detected');
assert(wrongContext.reason_codes.includes('context_binding_mismatch:origin_session_id'), 'wrong-context field must be explicit');
assert(Core.validateC1ResultBoundary(wrongContext).length === 0, 'wrong-context result boundary must hold');

const commutativePeer = Core.clone(operationB);
commutativePeer.operation_id = 'urn:ccrp:operation:uu-aap:chat-b:issue-note:1';
commutativePeer.action = 'repository.issue.annotation.add';
commutativePeer.target = 'github:Matawaka/uu-aap:issue/130';
commutativePeer.concurrency_class = 'commutative';
commutativePeer.idempotency_key = 'ccrp-c1-chat-b-issue-note-1';
commutativePeer.read_set = ['issue:130'];
commutativePeer.write_set = ['issue:130:annotation:chat-b'];
const noCollision = Core.detectC1Collision({
  operation: operationA,
  peerOperation: commutativePeer,
  contexts,
  currentRevision,
  evaluatedAt
});
assert(noCollision.collision_type === 'no_collision', 'non-overlapping operation may coexist');
assert(noCollision.blocking === false, 'no-collision result must not block');
assert(noCollision.claims.collision_detected === false, 'no-collision result must remain explicit');
assert(Core.validateC1ResultBoundary(noCollision).length === 0, 'no-collision result boundary must hold');

assert(JSON.stringify(operationA) === originalA, 'collision detection must not rewrite source intent A');
assert(JSON.stringify(operationB) === originalB, 'collision detection must not rewrite source intent B');

const results = { exclusive, stale, duplicate, wrongContext, noCollision };
const outputDir = process.argv[2];
if (outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, result] of Object.entries(results)) {
    fs.writeFileSync(path.join(outputDir, `${name}.collision-result.json`), `${JSON.stringify(result, null, 2)}\n`);
  }
}

console.log('CCRP/C1 collision detection vectors passed');
console.log('historically_valid != currently_executable confirmed');
console.log('duplicate_delivery != permission_to_execute_twice confirmed');
console.log('collision_detected != collision_resolved confirmed');
