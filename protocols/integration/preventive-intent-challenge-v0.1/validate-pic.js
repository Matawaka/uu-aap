'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function isoMs(value) { const ms = Date.parse(value); assert(Number.isFinite(ms), `invalid date-time: ${value}`); return ms; }

function validate(doc) {
  assert(doc && typeof doc === 'object' && !Array.isArray(doc), 'artifact must be object');
  assert(doc.artifact_type === 'PreventiveIntentChallenge', 'artifact_type mismatch');
  assert(doc.artifact_version === '0.1', 'artifact_version mismatch');

  assert(doc.baseline && typeof doc.baseline.intent_ref === 'string' && doc.baseline.intent_ref.length > 0, 'baseline required');
  const baselineMs = isoMs(doc.baseline.observed_at);

  assert(doc.drift_window && doc.drift_window.bounded === true, 'drift window must be bounded');
  const startMs = isoMs(doc.drift_window.starts_at);
  const endMs = isoMs(doc.drift_window.ends_at);
  assert(startMs >= baselineMs, 'drift window cannot precede baseline');
  assert(endMs > startMs, 'drift window must have positive duration');
  assert(endMs - startMs <= 24 * 60 * 60 * 1000, 'drift window too broad');
  assert(Array.isArray(doc.drift_window.indicators) && doc.drift_window.indicators.length > 0 && doc.drift_window.indicators.length <= 32, 'bounded drift indicators required');
  assert(new Set(doc.drift_window.indicators).size === doc.drift_window.indicators.length, 'duplicate drift indicators');

  assert(doc.challenge && typeof doc.challenge.challenge_id === 'string' && doc.challenge.challenge_id, 'challenge id required');
  assert(['system','human','mixed'].includes(doc.challenge.text_origin), 'challenge text origin required');
  assert(typeof doc.challenge.provenance_ref === 'string' && doc.challenge.provenance_ref, 'challenge provenance required');
  assert(doc.challenge.leading === false, 'leading challenge prohibited');
  assert(doc.challenge.presented === true, 'challenge must be presented');
  assert(doc.challenge.intent_evidence_weight === 0, 'TEXT_PRESENTED has zero intent evidence weight');

  assert(doc.response && ['responded','no_response','deferred'].includes(doc.response.state), 'response state invalid');
  assert(typeof doc.response.fresh_confirmation === 'boolean', 'fresh confirmation flag required');
  assert(doc.response.silence_is_refusal === false, 'silence cannot equal refusal');
  assert(doc.response.delay_is_intentional_delay === false, 'delay cannot imply intentional delay');
  assert(doc.response.prior_approval_carried_forward === false, 'prior approval cannot carry forward');
  if (doc.response.state !== 'responded') assert(doc.response.fresh_confirmation === false, 'no response/deferred cannot claim fresh confirmation');

  assert(doc.assessment && typeof doc.assessment.scope === 'string' && doc.assessment.scope, 'assessment scope required');
  assert(['no_material_drift','advisory_review','human_gate_required','insufficient_evidence'].includes(doc.assessment.disposition), 'assessment disposition invalid');
  assert(doc.assessment.automatic_block === false, 'automatic blocking prohibited');
  assert(doc.assessment.sanction_recommended === false, 'sanction recommendation prohibited');
  assert(doc.assessment.authority_expanded === false, 'authority expansion prohibited');

  const forbidden = ['malicious_intent_proven','intent_inferred_from_exposure','responsibility_assigned','liability_established','action_executed','permissions_revoked','kontur_mutated'];
  assert(doc.claims && typeof doc.claims === 'object', 'claims required');
  for (const key of forbidden) assert(doc.claims[key] === false, `forbidden claim: ${key}`);
  return true;
}

validate(fixture);

const mutations = [
  ['missing_baseline', d => { delete d.baseline; }],
  ['unbounded_window', d => { d.drift_window.bounded = false; }],
  ['window_too_broad', d => { d.drift_window.ends_at = '2026-08-27T03:30:00Z'; }],
  ['window_before_baseline', d => { d.drift_window.starts_at = '2026-08-25T02:59:00Z'; }],
  ['missing_indicators', d => { d.drift_window.indicators = []; }],
  ['duplicate_indicators', d => { d.drift_window.indicators.push(d.drift_window.indicators[0]); }],
  ['missing_provenance', d => { d.challenge.provenance_ref = ''; }],
  ['leading_challenge', d => { d.challenge.leading = true; }],
  ['unknown_text_origin', d => { d.challenge.text_origin = 'unknown'; }],
  ['exposure_as_intent', d => { d.challenge.intent_evidence_weight = 1; }],
  ['silence_as_refusal', d => { d.response.silence_is_refusal = true; }],
  ['delay_as_intentional', d => { d.response.delay_is_intentional_delay = true; }],
  ['carry_forward_approval', d => { d.response.prior_approval_carried_forward = true; }],
  ['fresh_confirmation_without_response', d => { d.response.state = 'no_response'; d.response.fresh_confirmation = true; }],
  ['automatic_block', d => { d.assessment.automatic_block = true; }],
  ['sanction', d => { d.assessment.sanction_recommended = true; }],
  ['authority_escalation', d => { d.assessment.authority_expanded = true; }],
  ['malicious_intent_overclaim', d => { d.claims.malicious_intent_proven = true; }],
  ['responsibility_assignment', d => { d.claims.responsibility_assigned = true; }],
  ['liability_assignment', d => { d.claims.liability_established = true; }],
  ['action_execution', d => { d.claims.action_executed = true; }],
  ['permission_revocation', d => { d.claims.permissions_revoked = true; }],
  ['kontur_mutation', d => { d.claims.kontur_mutated = true; }]
];

for (const [name, mutate] of mutations) {
  const changed = clone(fixture);
  mutate(changed);
  let rejected = false;
  try { validate(changed); } catch (_) { rejected = true; }
  assert(rejected, `negative mutation accepted: ${name}`);
}

console.log(`VALID Preventive Intent Challenge v0.1; rejected ${mutations.length} negative mutations`);
