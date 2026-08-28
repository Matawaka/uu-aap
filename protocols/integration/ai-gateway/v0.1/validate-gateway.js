'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OPS = new Set(['inspect', 'qualify', 'authorize', 'observe']);
const RESULTS = new Set(['inspected', 'qualified', 'admissible', 'denied', 'approval_required']);
const DECISION_NON = [
  'intent_created',
  'intent_inferred',
  'authority_created',
  'authority_expanded',
  'responsibility_accepted',
  'coordination_completed',
  'action_permit_created',
  'action_performed_by_gateway',
  'frontier_refreshed',
  'truth_certified',
  'causality_proven',
  'liability_established',
  'universal_canonicality_established'
];
const OBS_NON = [
  'action_performed_by_gateway',
  'frontier_refreshed',
  'causality_proven',
  'truth_certified',
  'liability_established',
  'universal_canonicality_established'
];

function bad(message) {
  throw Error(message);
}

function obj(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad(`${name} must be object`);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = sortKeys(value[key]);
    return result;
  }
  return value;
}

function hash(value) {
  const projected = JSON.parse(JSON.stringify(value));
  delete projected.content_hash;
  return crypto.createHash('sha256').update(JSON.stringify(sortKeys(projected))).digest('hex');
}

function refsByType(request) {
  const result = new Map();
  for (const ref of request.core_receipts || []) result.set(ref.receipt_type, ref);
  return result;
}

function validateRef(ref, name) {
  obj(ref, name);
  if (!ref.receipt_type || !/^[a-f0-9]{64}$/.test(ref.content_hash || '') || !ref.frontier) {
    bad(`${name} invalid`);
  }
}

function validateCapability(capability) {
  obj(capability, 'capability');
  if (
    capability.protocol !== 'UU-AAP-AI-GATEWAY' ||
    capability.version !== '0.1' ||
    capability.artifact_type !== 'GatewayCapabilityManifest'
  ) bad('capability envelope');
  if (
    !Array.isArray(capability.operations) ||
    !['inspect', 'qualify', 'authorize', 'observe'].every(operation => capability.operations.includes(operation))
  ) bad('operations missing');
  if (capability.provider_neutral !== true || capability.external_actuator_required !== false) {
    bad('provider/runtime dependency');
  }
  if (hash(capability) !== capability.content_hash) bad('capability hash');
}

function validateRequest(request) {
  obj(request, 'request');
  if (
    request.protocol !== 'UU-AAP-AI-GATEWAY' ||
    request.version !== '0.1' ||
    request.artifact_type !== 'GatewayRequest'
  ) bad('request envelope');
  if (!OPS.has(request.operation) || !request.request_id || !request.subject || !request.frontier) {
    bad('request identity');
  }

  obj(request.action, 'action');
  obj(request.protocol_mode_consent, 'protocol consent');

  if (request.protocol_mode_consent.blanket_action_approval !== false) bad('blanket action approval forbidden');
  if (request.action.read_only === true && request.action.external_effect === true) {
    bad('read-only cannot be external effect');
  }

  const expectedEffects = new Set(request.action.expected_effects || []);
  for (const nonEffect of request.action.explicit_non_effects || []) {
    if (expectedEffects.has(nonEffect)) bad('effect/non-effect overlap');
  }

  for (const ref of request.core_receipts || []) validateRef(ref, 'core receipt');
  for (const ref of request.intent_evidence_refs || []) validateRef(ref, 'intent evidence ref');
  if (request.approval_ref !== null) validateRef(request.approval_ref, 'approval ref');

  if (request.operation === 'authorize' && request.action.external_effect === true) {
    const refs = refsByType(request);
    for (const receiptType of ['StateReceipt', 'IntentReceipt', 'CoordinationReceipt', 'ActionPermit']) {
      if (!refs.has(receiptType)) bad(`missing ${receiptType}`);
    }
    if (!refs.has('AuthorityReceipt') && !refs.has('ResponsibilityReceipt')) {
      bad('missing authority/responsibility');
    }
    for (const ref of refs.values()) {
      if (ref.frontier !== request.frontier) bad('core frontier mismatch');
    }
    if (request.action.requires_approval === true && !request.approval_ref) bad('approval required');
    if (request.approval_ref && request.approval_ref.frontier !== request.frontier) {
      bad('approval frontier mismatch');
    }
  }

  if (hash(request) !== request.content_hash) bad('request hash');
}

function validateDecision(decision, request) {
  obj(decision, 'decision');
  if (
    decision.protocol !== 'UU-AAP-AI-GATEWAY' ||
    decision.version !== '0.1' ||
    decision.receipt_type !== 'GatewayDecisionReceipt'
  ) bad('decision envelope');
  if (
    decision.request_hash !== request.content_hash ||
    decision.request_id !== request.request_id ||
    decision.operation !== request.operation ||
    decision.subject !== request.subject ||
    decision.frontier !== request.frontier
  ) bad('decision request binding');
  if (!RESULTS.has(decision.result)) bad('unknown result');

  obj(decision.assertions, 'assertions');
  obj(decision.non_effects, 'non_effects');

  if (
    decision.assertions.exact_frontier_bound !== true ||
    decision.assertions.core_action_gate_preserved !== true ||
    decision.assertions.intent_evidence_not_substituted !== true ||
    decision.assertions.protocol_mode_consent_not_blanket_approval !== true
  ) bad('decision assertions');

  for (const name of DECISION_NON) {
    if (decision.non_effects[name] !== false) bad(`decision non_effect ${name}`);
  }

  if (decision.result === 'admissible' && request.action.external_effect === true) {
    const refs = refsByType(request);
    if (!refs.has('ActionPermit') || refs.get('ActionPermit').frontier !== request.frontier) {
      bad('admissible without matching ActionPermit');
    }
    if (!refs.has('IntentReceipt')) bad('IntentEvidenceReceipt cannot substitute for IntentReceipt');
    if (request.action.requires_approval === true && !request.approval_ref) {
      bad('admissible without approval');
    }
  }

  if (
    request.action.requires_approval === true &&
    !request.approval_ref &&
    decision.result !== 'approval_required' &&
    decision.result !== 'denied'
  ) bad('missing approval must not be admissible');

  if (hash(decision) !== decision.content_hash) bad('decision hash');
}

function validateObservation(observation, request) {
  obj(observation, 'observation');
  if (
    observation.protocol !== 'UU-AAP-AI-GATEWAY' ||
    observation.version !== '0.1' ||
    observation.receipt_type !== 'GatewayObservationReceipt'
  ) bad('observation envelope');
  if (
    observation.request_hash !== request.content_hash ||
    observation.request_id !== request.request_id ||
    observation.subject !== request.subject ||
    observation.predecessor_frontier !== request.frontier
  ) bad('observation request binding');

  obj(observation.assertions, 'observation assertions');
  obj(observation.non_effects, 'observation non_effects');
  if (
    observation.assertions.observation_not_execution !== true ||
    observation.assertions.actuator_evidence_not_core_receipt !== true ||
    observation.assertions.outcome_not_causality !== true
  ) bad('observation assertions');

  for (const name of OBS_NON) {
    if (observation.non_effects[name] !== false) bad(`observation non_effect ${name}`);
  }

  if (observation.external_effect_observed === true) {
    if (!Array.isArray(observation.actuator_evidence_refs) || observation.actuator_evidence_refs.length === 0) {
      bad('performed effect without actuator evidence');
    }
    if (
      !observation.core_action_receipt_ref ||
      observation.core_action_receipt_ref.receipt_type !== 'ActionReceipt'
    ) bad('performed effect without Core ActionReceipt');

    for (const ref of observation.actuator_evidence_refs) validateRef(ref, 'actuator evidence');
    validateRef(observation.core_action_receipt_ref, 'core action receipt');

    if (observation.core_action_receipt_ref.frontier !== observation.predecessor_frontier) {
      bad('Core ActionReceipt predecessor frontier mismatch');
    }
    for (const ref of observation.actuator_evidence_refs) {
      if (ref.frontier !== observation.observed_frontier) bad('actuator evidence observed frontier mismatch');
    }

    if (observation.outcome_receipt_ref) {
      validateRef(observation.outcome_receipt_ref, 'outcome receipt');
      if (observation.outcome_receipt_ref.frontier !== observation.observed_frontier) {
        bad('OutcomeReceipt observed frontier mismatch');
      }
    }
    if (observation.successor_state_receipt_ref) {
      validateRef(observation.successor_state_receipt_ref, 'successor state receipt');
      if (observation.successor_state_receipt_ref.frontier !== observation.observed_frontier) {
        bad('SuccessorStateReceipt observed frontier mismatch');
      }
    }
  }

  if (hash(observation) !== observation.content_hash) bad('observation hash');
}

function mutate(value, mutation) {
  const result = JSON.parse(JSON.stringify(value));
  mutation(result);
  result.content_hash = hash(result);
  return result;
}

function reject(name, operation) {
  try {
    operation();
  } catch {
    return;
  }
  bad(`negative accepted: ${name}`);
}

function loadConformanceFixture() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'conformance.fixture.json'), 'utf8'));
}

function runConformance(fixture = loadConformanceFixture()) {
  const F = fixture;
  validateCapability(F.capability_manifest);
  validateRequest(F.authorize_request);
  validateDecision(F.decision_receipt, F.authorize_request);
  validateObservation(F.observation_receipt, F.authorize_request);

  const R = F.authorize_request;
  const D = F.decision_receipt;
  const O = F.observation_receipt;
  const C = F.capability_manifest;

  reject('authorize without ActionPermit', () =>
    validateRequest(mutate(R, value => {
      value.core_receipts = value.core_receipts.filter(ref => ref.receipt_type !== 'ActionPermit');
    }))
  );
  reject('authorize without IntentReceipt', () =>
    validateRequest(mutate(R, value => {
      value.core_receipts = value.core_receipts.filter(ref => ref.receipt_type !== 'IntentReceipt');
    }))
  );
  reject('IntentEvidence substitutes IntentReceipt', () =>
    validateRequest(mutate(R, value => {
      value.core_receipts = value.core_receipts.filter(ref => ref.receipt_type !== 'IntentReceipt');
      value.core_receipts.push({
        receipt_type: 'IntentEvidenceReceipt',
        content_hash: 'c'.repeat(64),
        frontier: value.frontier
      });
    }))
  );
  reject('approval required missing', () =>
    validateRequest(mutate(R, value => {
      value.approval_ref = null;
    }))
  );
  reject('stale frontier', () =>
    validateRequest(mutate(R, value => {
      value.core_receipts[0].frontier = 'sha256:stale';
    }))
  );
  reject('effect non-effect overlap', () =>
    validateRequest(mutate(R, value => {
      value.action.explicit_non_effects.push('demo_state_change');
    }))
  );
  reject('read-only external effect', () =>
    validateRequest(mutate(R, value => {
      value.action.read_only = true;
    }))
  );
  reject('decision creates authority', () =>
    validateDecision(mutate(D, value => {
      value.non_effects.authority_created = true;
    }), R)
  );
  reject('decision creates ActionPermit', () =>
    validateDecision(mutate(D, value => {
      value.non_effects.action_permit_created = true;
    }), R)
  );

  const noPermit = mutate(R, value => {
    value.core_receipts = value.core_receipts.filter(ref => ref.receipt_type !== 'ActionPermit');
  });
  reject('admissible without matching permit', () =>
    validateDecision(mutate(D, value => {
      value.request_hash = noPermit.content_hash;
    }), noPermit)
  );

  reject('observe without actuator evidence', () =>
    validateObservation(mutate(O, value => {
      value.actuator_evidence_refs = [];
    }), R)
  );
  reject('observe without Core ActionReceipt', () =>
    validateObservation(mutate(O, value => {
      value.core_action_receipt_ref = null;
    }), R)
  );
  reject('ActionReceipt successor frontier substitution', () =>
    validateObservation(mutate(O, value => {
      value.core_action_receipt_ref.frontier = value.observed_frontier;
    }), R)
  );
  reject('actuator evidence predecessor frontier substitution', () =>
    validateObservation(mutate(O, value => {
      value.actuator_evidence_refs[0].frontier = value.predecessor_frontier;
    }), R)
  );
  reject('gateway claims action performance', () =>
    validateObservation(mutate(O, value => {
      value.non_effects.action_performed_by_gateway = true;
    }), R)
  );
  reject('observation proves causality', () =>
    validateObservation(mutate(O, value => {
      value.non_effects.causality_proven = true;
    }), R)
  );
  reject('blanket protocol consent', () =>
    validateRequest(mutate(R, value => {
      value.protocol_mode_consent.blanket_action_approval = true;
    }))
  );
  reject('provider-specific mandatory dependency', () =>
    validateCapability(mutate(C, value => {
      value.provider_neutral = false;
    }))
  );

  return true;
}

if (require.main === module) {
  runConformance();
  console.log('UU_AAP_AI_GATEWAY_CONTRACT_V0_1_PASS');
}

module.exports = {
  validateCapability,
  validateRequest,
  validateDecision,
  validateObservation,
  hash,
  runConformance
};
