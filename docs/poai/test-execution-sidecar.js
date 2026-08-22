const fs = require('fs');
const api = require('./execution-sidecar.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const record = {
  protocol: 'PoAI',
  protocol_version: '0.0.1',
  profile: 'T',
  record_id: 'urn:poai:record:test:augmented-routing:1'
};
const snapshot = JSON.stringify(record);

const sidecar = api.buildExecutionSidecar(record, {
  adjudicationId: 'urn:poai:adjudication:85d81be0',
  appealRequestId: 'urn:poai:appeal:02ff526c',
  executorLabel: 'Synthetic execution operator',
  directiveCode: 'suspend_pending_review',
  status: 'completed',
  recordedAt: '2026-08-22T16:30:00Z',
  evidenceCutoff: '2026-08-22T16:29:00Z',
  notes: 'Synthetic Level 3.1g execution report.',
  sourceValidationStatus: 'PASS'
});

assert(JSON.stringify(record) === snapshot, 'Source decision record must remain unchanged.');
assert(sidecar.artifact_type === 'PoAIExecutionSidecar', 'Unexpected artifact type.');
assert(sidecar.decision_record_id === record.record_id, 'Root decision reference must be preserved.');
assert(sidecar.adjudication_id === 'urn:poai:adjudication:85d81be0', 'Adjudication reference mismatch.');
assert(sidecar.appeal_request_id === 'urn:poai:appeal:02ff526c', 'Appeal reference mismatch.');
assert(sidecar.directive_ref.code === 'suspend_pending_review', 'Directive reference mismatch.');
assert(sidecar.executor.authority_status === 'unknown', 'Executor label must not establish authority.');
assert(sidecar.declared_execution_status.code === 'completed', 'Expected completed declaration.');
assert(sidecar.declared_execution_status.establishes_verified_execution === false, 'Completed declaration must not establish verified execution.');
Object.values(sidecar.claims).forEach((value) => assert(value === false, 'All execution claims must remain false in this experiment.'));
assert(api.validateExecutionSidecar(sidecar).length === 0, 'Generated execution sidecar should pass its own validator.');
assert(!Object.prototype.hasOwnProperty.call(sidecar, 'protocol'), 'Execution sidecar must not masquerade as Genesis record.');
assert(!api.deepHasProhibitedKey(sidecar), 'Execution sidecar must not contain earlier-context or scalar-score keys.');

const blocked = api.buildExecutionSidecar(record, {
  adjudicationId: 'urn:poai:adjudication:85d81be0',
  directiveCode: 'suspend_pending_review',
  status: 'blocked',
  recordedAt: '2026-08-22T16:31:00Z'
});
assert(blocked.claims.responsibility_determined === false, 'Blocked execution must not assign responsibility.');

let rejectedFutureCutoff = false;
try {
  api.buildExecutionSidecar(record, {
    adjudicationId: 'urn:poai:adjudication:85d81be0',
    directiveCode: 'suspend_pending_review',
    status: 'completed',
    recordedAt: '2026-08-22T16:30:00Z',
    evidenceCutoff: '2026-08-22T16:31:00Z'
  });
} catch (_) { rejectedFutureCutoff = true; }
assert(rejectedFutureCutoff, 'Evidence cutoff later than recorded_at must be rejected.');

if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');
console.log('Execution Sidecar tests passed.');
