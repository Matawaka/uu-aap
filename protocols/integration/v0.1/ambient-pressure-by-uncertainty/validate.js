'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const fixturePath = path.join(root, 'positive.fixture.json');
const schemaPath = path.join(root, 'ambient-pressure-by-uncertainty.schema.json');

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function assert(v, m) { if (!v) throw new Error(m); }
function exactKeys(obj, keys, label) {
  assert(obj && typeof obj === 'object' && !Array.isArray(obj), `${label}: object required`);
  const actual = Object.keys(obj).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}: exact keys required`);
}
function nonEmpty(v, label) { assert(typeof v === 'string' && v.length > 0, `${label}: non-empty string required`); }
function validTime(v, label) { nonEmpty(v, label); assert(!Number.isNaN(Date.parse(v)), `${label}: invalid date-time`); }

const TOP = ['$schema','artifact_type','artifact_version','receipt_id','possibility_binding','observer_context','uncertainty_interval','observable_effects','interpretation','interpretation_evidence_ref','claims'];
const CLAIMS = ['causal_state_observed','refusal_established','intentional_delay_established','negative_intent_established','coercive_purpose_established','responsibility_assigned','liability_established','authority_granted','sanction_authorized','action_authorized','external_effect_performed'];
const FORBIDDEN_TRUE = CLAIMS.filter(k => k !== 'causal_state_observed');
const INTERPRETATIONS = new Set(['no_response','unknown','delay','unavailable','abstention','refusal']);
const STRONG = new Set(['unavailable','abstention','refusal']);

function validate(r) {
  exactKeys(r, TOP, 'receipt');
  assert(r.$schema === './ambient-pressure-by-uncertainty.schema.json', 'schema binding mismatch');
  assert(r.artifact_type === 'AmbientPressureByUncertaintyReceipt', 'artifact type mismatch');
  assert(r.artifact_version === '0.1', 'artifact version mismatch');
  nonEmpty(r.receipt_id, 'receipt_id');

  exactKeys(r.possibility_binding, ['possibility_ref','expectation_created_at','basis_ref'], 'possibility_binding');
  nonEmpty(r.possibility_binding.possibility_ref, 'possibility_ref');
  nonEmpty(r.possibility_binding.basis_ref, 'basis_ref');
  validTime(r.possibility_binding.expectation_created_at, 'expectation_created_at');

  exactKeys(r.observer_context, ['observer_ref','context_ref'], 'observer_context');
  nonEmpty(r.observer_context.observer_ref, 'observer_ref');
  nonEmpty(r.observer_context.context_ref, 'context_ref');

  exactKeys(r.uncertainty_interval, ['started_at','ended_at','bounded'], 'uncertainty_interval');
  validTime(r.uncertainty_interval.started_at, 'started_at');
  validTime(r.uncertainty_interval.ended_at, 'ended_at');
  assert(r.uncertainty_interval.bounded === true, 'uncertainty interval must be bounded');
  const start = Date.parse(r.uncertainty_interval.started_at);
  const end = Date.parse(r.uncertainty_interval.ended_at);
  assert(end > start, 'uncertainty interval must end after start');
  assert(start >= Date.parse(r.possibility_binding.expectation_created_at), 'interval cannot predate expectation');

  exactKeys(r.observable_effects, ['attention_held','resources_reserved','alternative_decision_deferred','effect_evidence_refs'], 'observable_effects');
  for (const k of ['attention_held','resources_reserved','alternative_decision_deferred']) assert(typeof r.observable_effects[k] === 'boolean', `${k}: boolean required`);
  assert(Array.isArray(r.observable_effects.effect_evidence_refs), 'effect_evidence_refs: array required');
  assert(new Set(r.observable_effects.effect_evidence_refs).size === r.observable_effects.effect_evidence_refs.length, 'duplicate effect evidence ref');
  r.observable_effects.effect_evidence_refs.forEach((v, i) => nonEmpty(v, `effect_evidence_refs[${i}]`));
  const anyEffect = r.observable_effects.attention_held || r.observable_effects.resources_reserved || r.observable_effects.alternative_decision_deferred;
  if (anyEffect) assert(r.observable_effects.effect_evidence_refs.length > 0, 'observable effect requires evidence');

  assert(INTERPRETATIONS.has(r.interpretation), 'unsupported interpretation');
  assert(r.interpretation_evidence_ref === null || (typeof r.interpretation_evidence_ref === 'string' && r.interpretation_evidence_ref.length > 0), 'invalid interpretation_evidence_ref');
  if (STRONG.has(r.interpretation)) assert(typeof r.interpretation_evidence_ref === 'string' && r.interpretation_evidence_ref.length > 0, 'strong interpretation requires separate evidence');
  if (['unknown','no_response','delay'].includes(r.interpretation)) assert(r.interpretation_evidence_ref === null || typeof r.interpretation_evidence_ref === 'string', 'invalid weak interpretation evidence');

  exactKeys(r.claims, CLAIMS, 'claims');
  assert(typeof r.claims.causal_state_observed === 'boolean', 'causal_state_observed: boolean required');
  FORBIDDEN_TRUE.forEach(k => assert(r.claims[k] === false, `${k}: prohibited escalation`));
  if (r.claims.causal_state_observed) assert(anyEffect, 'causal state claim requires observable effect');
  return true;
}

function mustReject(name, mutate) {
  const candidate = clone(fixture);
  mutate(candidate);
  let rejected = false;
  try { validate(candidate); } catch (_) { rejected = true; }
  assert(rejected, `${name}: mutation was accepted`);
}

JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
validate(fixture);

const cases = [
  ['missing possibility', r => { r.possibility_binding.possibility_ref = ''; }],
  ['missing possibility basis', r => { r.possibility_binding.basis_ref = ''; }],
  ['unbounded interval', r => { r.uncertainty_interval.bounded = false; }],
  ['reversed interval', r => { r.uncertainty_interval.ended_at = r.uncertainty_interval.started_at; }],
  ['interval before expectation', r => { r.uncertainty_interval.started_at = '2026-08-25T02:59:00Z'; }],
  ['effect without evidence', r => { r.observable_effects.effect_evidence_refs = []; }],
  ['duplicate evidence', r => { r.observable_effects.effect_evidence_refs.push(r.observable_effects.effect_evidence_refs[0]); }],
  ['silence to refusal interpretation', r => { r.interpretation = 'refusal'; r.interpretation_evidence_ref = null; }],
  ['abstention without evidence', r => { r.interpretation = 'abstention'; r.interpretation_evidence_ref = null; }],
  ['unavailable without evidence', r => { r.interpretation = 'unavailable'; r.interpretation_evidence_ref = null; }],
  ['refusal claim escalation', r => { r.claims.refusal_established = true; }],
  ['intentional delay escalation', r => { r.claims.intentional_delay_established = true; }],
  ['negative intent escalation', r => { r.claims.negative_intent_established = true; }],
  ['coercive purpose escalation', r => { r.claims.coercive_purpose_established = true; }],
  ['responsibility escalation', r => { r.claims.responsibility_assigned = true; }],
  ['liability escalation', r => { r.claims.liability_established = true; }],
  ['authority escalation', r => { r.claims.authority_granted = true; }],
  ['sanction escalation', r => { r.claims.sanction_authorized = true; }],
  ['action escalation', r => { r.claims.action_authorized = true; }],
  ['external effect overclaim', r => { r.claims.external_effect_performed = true; }],
  ['invented causal state', r => { r.observable_effects.attention_held = false; r.observable_effects.resources_reserved = false; r.observable_effects.alternative_decision_deferred = false; r.observable_effects.effect_evidence_refs = []; }],
  ['unexpected field', r => { r.intent = 'inferred'; }]
];

for (const [name, mutate] of cases) mustReject(name, mutate);
console.log(`UU_AAP_AMBIENT_PRESSURE_BY_UNCERTAINTY_V0_1_PASS negative_vectors=${cases.length}`);
