const fs = require('fs');
const path = require('path');
const {
  ARTIFACT_TYPE,
  ARTIFACT_VERSION,
  OUTCOME_STATUSES,
  buildOutcomeSidecar,
  validateOutcomeSidecar,
  deepHasProhibitedKey
} = require('./outcome-sidecar.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = {
  protocol: 'PoAI',
  protocol_version: '0.0.1',
  profile: 'T',
  record_id: 'urn:poai:record:test:future-outcome:1'
};

const before = JSON.stringify(source);
const sidecar = buildOutcomeSidecar(source, {
  observedAt: '2026-08-22T17:10:00Z',
  futureTargetId: 'future:test:shipment-window',
  observerLabel: 'Independent outcome observer',
  method: 'multi_source',
  outcomeStatus: 'not_realized_after_intervention',
  causalStatus: 'associated_not_proven',
  evidenceCutoff: '2026-08-22T17:05:00Z',
  executionIds: ['urn:poai:execution:b6afbc99'],
  verificationIds: ['urn:poai:verification:6bbbd019', 'urn:poai:verification:9c8b6f19'],
  notes: 'Synthetic outcome observation after an intervention.',
  sourceValidationStatus: 'PASS'
});

assert(JSON.stringify(source) === before, 'source decision record must remain unchanged');
assert(sidecar.artifact_type === ARTIFACT_TYPE, 'artifact_type mismatch');
assert(sidecar.artifact_version === ARTIFACT_VERSION, 'artifact_version mismatch');
assert(sidecar.decision_record_id === source.record_id, 'decision record ref mismatch');
assert(sidecar.future_target_id === 'future:test:shipment-window', 'future target ref mismatch');
assert(sidecar.declared_outcome.status === 'not_realized_after_intervention', 'outcome status mismatch');
assert(sidecar.declared_outcome.establishes_observed_outcome === false, 'declared outcome must remain non-certifying');
assert(sidecar.causal_status.code === 'associated_not_proven', 'causal status mismatch');
assert(sidecar.causal_status.establishes_causal_proof === false, 'causal status must remain non-certifying');
assert(sidecar.observer.authority_status === 'unknown', 'observer authority must remain unknown');
assert(sidecar.observer.independence_status === 'unknown', 'observer independence must remain unknown');
assert(sidecar.intervention_refs.includes('urn:poai:execution:b6afbc99'), 'execution provenance must be preserved as intervention ref');
assert(sidecar.source_refs.verification_ids.length === 2, 'both conflicting verification refs must coexist');
assert(Object.values(sidecar.claims).every(v => v === false), 'all claims must remain false in v0.0.1 experiment');
assert(validateOutcomeSidecar(sidecar).length === 0, 'valid sidecar should pass local validation');
assert(!deepHasProhibitedKey(sidecar), 'sidecar must not contain prohibited earlier-context/scalar keys');
assert(!Object.prototype.hasOwnProperty.call(sidecar, 'protocol'), 'sidecar must not masquerade as Genesis PoAI record');

for (const status of ['not_yet_observable','realized','not_realized_without_intervention','not_realized_after_intervention','indeterminate','not_applicable']) {
  assert(OUTCOME_STATUSES.has(status), `Genesis outcome status missing: ${status}`);
}

let threw = false;
try {
  buildOutcomeSidecar(source, {
    observedAt: '2026-08-22T17:10:00Z',
    outcomeStatus: 'not_realized_after_intervention',
    causalStatus: 'associated_not_proven'
  });
} catch (e) {
  threw = /requires at least one intervention/.test(String(e.message));
}
assert(threw, 'not_realized_after_intervention without intervention provenance must be rejected');

threw = false;
try {
  buildOutcomeSidecar(source, {
    observedAt: '2026-08-22T17:10:00Z',
    evidenceCutoff: '2026-08-22T17:11:00Z',
    outcomeStatus: 'indeterminate'
  });
} catch (e) {
  threw = /must not be later than observed_at/.test(String(e.message));
}
assert(threw, 'evidence cutoff later than observed_at must be rejected');

const realized = buildOutcomeSidecar(source, {
  observedAt: '2026-08-22T17:20:00Z',
  outcomeStatus: 'realized',
  method: 'system_record',
  causalStatus: 'not_assessed',
  sourceValidationStatus: 'PASS'
});
assert(realized.declared_outcome.status === 'realized', 'realized status should be supported');
assert(realized.causal_status.code === 'not_assessed', 'causality should remain separately not assessed');
assert(realized.claims.causal_proof_certified === false, 'realized outcome must not prove causality');

const out = process.argv[2];
if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(sidecar, null, 2) + '\n');
console.log('Observed Outcome Sidecar tests passed');