'use strict';

const fs = require('fs');
const assert = require('assert');
const {
  ARTIFACT_TYPE,
  ARTIFACT_VERSION,
  buildSuccessorProposal,
  validateSuccessorProposal,
  deepHasProhibitedKey
} = require('./successor-proposal-sidecar.js');

const outputPath = process.argv[2] || '/tmp/successor-proposal-sidecar.json';

const sourceRecord = {
  protocol: 'PoAI',
  protocol_version: '0.0',
  profile: 'T',
  record_id: 'urn:poai:record:synthetic-shipment:delay-risk:1',
  versioning: {
    record_version: 1,
    previous_record: null,
    successor_record: 'urn:poai:record:synthetic-shipment:delay-risk:2'
  }
};

const proposal = buildSuccessorProposal(sourceRecord, {
  outcomeObservationIds: ['urn:poai:outcome-observation:721e0f78'],
  futureTargetId: 'future:synthetic-shipment:missed-window',
  outcomeStatus: 'not_realized_after_intervention',
  proposedObservedAt: '2026-08-22T17:12:48.851Z',
  causalStatus: 'associated_not_proven',
  interventionRefs: ['intervention:synthetic-reroute-expedite'],
  contradictionState: 'none_known',
  proposerLabel: 'Synthetic successor proposer',
  notes: 'Proposal only; source decision boundary and knowledge cutoff must remain unchanged.',
  sourceValidationStatus: 'PASS'
});

assert.strictEqual(proposal.artifact_type, ARTIFACT_TYPE);
assert.strictEqual(proposal.artifact_version, ARTIFACT_VERSION);
assert.strictEqual(proposal.source_record.decision_record_id, sourceRecord.record_id);
assert.strictEqual(proposal.source_record.record_version, 1);
assert.strictEqual(proposal.proposed_successor.decision_record_id, 'urn:poai:record:synthetic-shipment:delay-risk:2');
assert.strictEqual(proposal.proposed_successor.record_version, 2);
assert.deepStrictEqual(proposal.outcome_observation_refs, ['urn:poai:outcome-observation:721e0f78']);
assert.strictEqual(proposal.proposed_successor.proposed_outcome.status, 'not_realized_after_intervention');
assert.strictEqual(proposal.proposed_successor.proposed_outcome.causal_status, 'associated_not_proven');
assert.deepStrictEqual(proposal.proposed_successor.proposed_outcome.intervention_refs, ['intervention:synthetic-reroute-expedite']);
assert.strictEqual(proposal.proposer.authority_status, 'unknown');
assert.strictEqual(proposal.preservation_requirements.decision_boundary, 'must_remain_unchanged');
assert.strictEqual(proposal.preservation_requirements.knowledge_cutoff, 'must_remain_unchanged');
assert.strictEqual(proposal.preservation_requirements.decision_time_future_target_epistemic_status, 'must_remain_unchanged');
assert.strictEqual(proposal.review_cues.source_record_validated, true);
assert.strictEqual(proposal.review_cues.outcome_observations_present, true);
assert.strictEqual(proposal.review_cues.proposed_successor_distinct_from_source, true);
assert.strictEqual(proposal.review_cues.proposed_record_version_is_next, true);
assert.strictEqual(proposal.review_cues.intervention_provenance_present, true);
assert.strictEqual(deepHasProhibitedKey(proposal), false);
assert.ok(Object.values(proposal.claims).every(v => v === false));
assert.deepStrictEqual(validateSuccessorProposal(proposal), []);
assert.strictEqual(Object.prototype.hasOwnProperty.call(proposal, 'protocol'), false);

assert.throws(() => buildSuccessorProposal(sourceRecord, {
  outcomeObservationIds: [],
  outcomeStatus: 'realized'
}), /Outcome Observation ID/);

assert.throws(() => buildSuccessorProposal(sourceRecord, {
  outcomeObservationIds: ['urn:poai:outcome-observation:test'],
  outcomeStatus: 'not_realized_after_intervention',
  causalStatus: 'associated_not_proven',
  interventionRefs: []
}), /intervention provenance/);

assert.throws(() => buildSuccessorProposal(sourceRecord, {
  outcomeObservationIds: ['urn:poai:outcome-observation:test'],
  outcomeStatus: 'indeterminate',
  contradictionState: 'present',
  conflictingObservationIds: []
}), /conflicting Outcome Observation ID/);

const invalidScalar = JSON.parse(JSON.stringify(proposal));
invalidScalar.readiness_score = 0.9;
assert.ok(validateSuccessorProposal(invalidScalar).some(e => e.includes('scalar-score')));

fs.writeFileSync(outputPath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
console.log(`Successor Proposal Sidecar tests passed: ${outputPath}`);
