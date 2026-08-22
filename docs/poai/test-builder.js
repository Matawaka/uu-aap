const assert = require('assert');
const { buildRecord } = require('./builder-core.js');
const { validatePoAI } = require('./validator.js');

function baseInput() {
  return {
    label: 'Reroute shipment before delay window',
    actorName: 'Synthetic Logistics Planner',
    subjectId: 'decision:test:shipment-reroute',
    recordId: 'urn:poai:record:test:shipment-reroute:1',
    description: 'Non-authorship test decision for the deeper Builder.',
    opened: '2026-08-22T12:00',
    cutoff: '2026-08-22T12:10',
    closed: '2026-08-22T12:15',
    resourceLabel: 'Shipment delay forecast',
    resourceType: 'forecasting_model',
    availabilityOverall: 'available',
    availabilityIdentity: 'available',
    availabilityDiscoverability: 'available',
    availabilityReachability: 'available',
    availabilityAuthorization: 'available',
    availabilityTemporalFit: 'available',
    availabilityContextSufficiency: 'partial',
    availabilityExecutionCapability: 'not_applicable',
    availabilityDelivery: 'available',
    considerationStatus: 'relied_upon',
    considerationSummary: 'Forecast was used to decide whether to reroute.',
    evidenceClass: 'E0',
    evidenceType: 'self_declaration',
    evidenceAvailability: 'builder_session',
    authorityStatus: 'accepted',
    authorityScopes: ['observe', 'request_analysis', 'decide', 'execute'],
    alternativeLabel: 'Keep original route',
    constraintLabel: 'Delivery window must be protected',
    futureEnabled: true,
    futureLabel: 'Shipment misses planned delivery window',
    futureEpistemicStatus: 'probable',
    futureProbability: '0.72',
    outcomeStatus: 'not_yet_observable',
    contestabilityChannel: 'https://github.com/Matawaka/uu-aap/issues/24',
    appealAvailable: false
  };
}

const record = buildRecord(baseInput());
const validation = validatePoAI(record);
assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
assert.strictEqual(record.future_target.epistemic_status, 'probable');
assert.strictEqual(record.future_target.probability, 0.72);
assert.strictEqual(record.intelligence_resources[0].resource_type, 'forecasting_model');
assert.strictEqual(record.consideration[0].status, 'relied_upon');
assert.deepStrictEqual(record.authority[0].scopes, ['observe', 'request_analysis', 'decide', 'execute']);
assert.strictEqual(record.artifact_binding.status, 'not_bound');
assert.strictEqual(record.evidence[0].class, 'E0');

const defaults = buildRecord({ label: 'Unknowns stay unknown', actorName: 'Tester' });
assert.strictEqual(defaults.availability[0].overall_status, 'unknown');
assert.strictEqual(defaults.availability[0].dimensions.authorization, 'unknown');
assert.strictEqual(defaults.authority[0].status, 'unknown');
assert.strictEqual(defaults.consideration[0].status, 'unknown');
assert.strictEqual(defaults.evidence[0].class, 'E0');
assert.strictEqual(validatePoAI(defaults).valid, true);

const invalidIntervention = buildRecord({
  ...baseInput(),
  outcomeStatus: 'not_realized_after_intervention',
  interventionPresent: false
});
const invalidResult = validatePoAI(invalidIntervention);
assert.strictEqual(invalidResult.valid, false);
assert(invalidResult.errors.some((item) => item.code === 'missing_intervention'));

const withIntervention = buildRecord({
  ...baseInput(),
  outcomeStatus: 'not_realized_after_intervention',
  interventionPresent: true,
  interventionDescription: 'Rerouted shipment to an alternate route.',
  causalStatus: 'associated_not_proven',
  outcomeObservedAt: '2026-08-23T18:30',
  successorRecord: 'urn:poai:record:test:shipment-reroute:2'
});
assert.strictEqual(validatePoAI(withIntervention).valid, true);
assert.strictEqual(withIntervention.outcome.intervention.causal_status, 'associated_not_proven');

const en = buildRecord({ ...baseInput(), uiLanguage: 'en' });
const ru = buildRecord({ ...baseInput(), uiLanguage: 'ru' });
assert.deepStrictEqual(en, ru, 'UI language must not affect machine record output');

console.log('PoAI deeper Builder tests passed.');
