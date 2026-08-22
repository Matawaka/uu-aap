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

const chatA = readJson('examples/c0-same-actor-chat-a.work-context.json');
const chatB = readJson('examples/c0-same-actor-chat-b.work-context.json');

assert(Core.validateC0Boundary(chatA).length === 0, 'chat A must preserve the C0 boundary');
assert(Core.validateC0Boundary(chatB).length === 0, 'chat B must preserve the C0 boundary');

assert(chatA.origin.actor_id === chatB.origin.actor_id, 'fixture must use the same actor');
assert(chatA.origin.session_id !== chatB.origin.session_id, 'fixture must use different sessions');
assert(chatA.context_id !== chatB.context_id, 'different sessions/intents must retain different context ids');

const distinct = Core.compareContextIdentity(chatA, chatB);
assert(distinct.relation === 'distinct_contexts', 'same actor must not collapse distinct context ids');
assert(distinct.compatible === true, 'distinct context identification itself is not a conflict');
assert(distinct.same_actor === true, 'fixture must demonstrate same actor');
assert(distinct.same_session === false, 'fixture must demonstrate different sessions');
assert(distinct.same_target_scope === true, 'fixture must demonstrate collision potential over the same target');

const silentSessionInheritance = Core.clone(chatA);
silentSessionInheritance.origin.session_id = chatB.origin.session_id;
const sessionReuse = Core.compareContextIdentity(chatA, silentSessionInheritance);
assert(sessionReuse.compatible === false, 'one context id must not silently inherit another session in C0');
assert(sessionReuse.errors.includes('context_identity_reuse_mismatch'), 'session reuse mismatch must be explicit');
assert(sessionReuse.mismatches.includes('origin_session_id'), 'session mismatch must be identified');

const silentIntentReplacement = Core.clone(chatA);
silentIntentReplacement.intent.intent_id = chatB.intent.intent_id;
silentIntentReplacement.intent.digest = chatB.intent.digest;
const intentReuse = Core.compareContextIdentity(chatA, silentIntentReplacement);
assert(intentReuse.compatible === false, 'one context id must not silently replace its intent identity');
assert(intentReuse.mismatches.includes('intent_id'), 'intent id mismatch must be identified');
assert(intentReuse.mismatches.includes('intent_digest'), 'intent digest mismatch must be identified');

const prematureAdmission = Core.clone(chatA);
prematureAdmission.claims.execution_admitted = true;
const admissionErrors = Core.validateC0Boundary(prematureAdmission);
assert(admissionErrors.includes('c0_claim_must_remain_false:execution_admitted'), 'C0 must not establish execution admission');

const prematureOwner = Core.clone(chatA);
prematureOwner.owner = {
  actor_id: chatA.origin.actor_id,
  session_id: chatA.origin.session_id
};
const ownerErrors = Core.validateC0Boundary(prematureOwner);
assert(ownerErrors.includes('c0_owner_must_be_unestablished'), 'C0 must not establish an execution owner');

console.log('CCRP/C0 context identification vectors passed');
console.log('same_actor != same_context confirmed');
console.log('context identification != execution admission confirmed');
