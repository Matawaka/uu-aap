'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../../../..');
const fixturePath = path.join(__dirname, 'stability.fixture.json');
const schemaPath = path.join(__dirname, 'cross-layer-invariant-stability.schema.json');
const EXPECTED_BASELINE = '79e18451985963ed93ac0a9a7d1df93da2108ff7';
const EXPECTED_LAYERS = new Map([
  ['core-v0.1', 'protocols/core/v0.1/validate-core.js'],
  ['non-induced-intent-v0.1', 'protocols/core/extensions/intent-evidence/v0.1/validate-intent-evidence.js'],
  ['ambient-observability-non-identification-v0.1', 'protocols/integration/ambient-observability-non-identification/v0.1/validate-ambient-observability.js'],
  ['event-hash-minimalism-v0.1', 'protocols/integration/event-hash-minimalism/v0.1/validate-event-hash-minimalism.js'],
  ['latent-evidentiary-knowledge-v0.1', 'protocols/integration/latent-evidentiary-knowledge/v0.1/validate-latent-evidentiary-knowledge.js'],
  ['three-layer-commitment-root-v0.1', 'protocols/integration/three-layer-commitment-root/v0.1/validate-three-layer-commitment-root.js'],
  ['preventive-intent-challenge-v0.1', 'protocols/integration/preventive-intent-challenge-v0.1/validate-pic.js'],
  ['ambient-pressure-by-uncertainty-v0.1', 'protocols/experimental/ambient-pressure-by-uncertainty/v0.1/validate.js'],
  ['future-optionality-non-commitment-v0.1', 'protocols/experimental/future-optionality-non-commitment/v0.1/validate.js']
]);
const REQUIRED_EDGES = new Set([
  'possibility->intent', 'intent->action', 'action->liability', 'text_exposure->intent',
  'observation->identification', 'event_hash->stored_action_trace',
  'available_evidence->active_personalized_knowledge', 'preventive_challenge->blocking_authority',
  'uncertainty->refusal', 'forecast->obligation', 'future_target->required_successor',
  'layer_commitment->rewrite_other_planes'
]);

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function assert(v, m) { if (!v) throw new Error(m); }
function exactKeys(obj, keys, label) {
  assert(obj && typeof obj === 'object' && !Array.isArray(obj), `${label}: object required`);
  const a = Object.keys(obj).sort();
  const b = [...keys].sort();
  assert(JSON.stringify(a) === JSON.stringify(b), `${label}: exact keys required`);
}
function nonEmpty(v, label) { assert(typeof v === 'string' && v.length > 0, `${label}: non-empty string required`); }

function validateMatrix(m, runLayers = false) {
  exactKeys(m, ['$schema','artifact_type','artifact_version','checkpoint_id','baseline_main_sha','scope_class','layers','forbidden_implications','non_effects','claims'], 'matrix');
  assert(m.$schema === './cross-layer-invariant-stability.schema.json', 'schema binding mismatch');
  assert(m.artifact_type === 'CrossLayerInvariantStabilityMatrix', 'artifact type mismatch');
  assert(m.artifact_version === '0.1', 'artifact version mismatch');
  nonEmpty(m.checkpoint_id, 'checkpoint_id');
  assert(m.baseline_main_sha === EXPECTED_BASELINE, 'baseline main binding mismatch');
  assert(m.scope_class === 'representative_cross_layer', 'scope class mismatch');

  assert(Array.isArray(m.layers) && m.layers.length === EXPECTED_LAYERS.size, 'exact representative layer count required');
  const ids = new Set();
  for (const layer of m.layers) {
    exactKeys(layer, ['layer_id','validator_path','required'], 'layer');
    nonEmpty(layer.layer_id, 'layer_id');
    nonEmpty(layer.validator_path, 'validator_path');
    assert(layer.required === true, `${layer.layer_id}: required must be true`);
    assert(!ids.has(layer.layer_id), `duplicate layer: ${layer.layer_id}`);
    ids.add(layer.layer_id);
    assert(EXPECTED_LAYERS.get(layer.layer_id) === layer.validator_path, `${layer.layer_id}: validator path mismatch`);
    const abs = path.join(root, layer.validator_path);
    assert(fs.existsSync(abs) && fs.statSync(abs).isFile(), `${layer.layer_id}: validator missing`);
  }
  for (const id of EXPECTED_LAYERS.keys()) assert(ids.has(id), `missing representative layer: ${id}`);

  assert(Array.isArray(m.forbidden_implications), 'forbidden_implications: array required');
  const edges = new Set();
  for (const edge of m.forbidden_implications) {
    exactKeys(edge, ['from','to','allowed'], 'forbidden implication');
    nonEmpty(edge.from, 'implication.from'); nonEmpty(edge.to, 'implication.to');
    assert(edge.allowed === false, `${edge.from}->${edge.to}: semantic strengthening prohibited`);
    const key = `${edge.from}->${edge.to}`;
    assert(!edges.has(key), `duplicate implication edge: ${key}`);
    edges.add(key);
  }
  for (const edge of REQUIRED_EDGES) assert(edges.has(edge), `missing forbidden implication: ${edge}`);

  const nonEffects = ['external_observation_performed','profiling_performed','actuator_invoked','kontur_mutated','authority_transferred','permissions_changed','protection_changed','release_or_tag_created','sanction_authorized','history_rewritten','canonical_origin_mutated'];
  exactKeys(m.non_effects, nonEffects, 'non_effects');
  nonEffects.forEach(k => assert(m.non_effects[k] === false, `${k}: non-effect violated`));

  const claimKeys = ['stability_check_passed','universal_correctness_proven','all_historical_states_verified','external_runtime_verified','legal_validity_proven','future_successors_safe_by_default'];
  exactKeys(m.claims, claimKeys, 'claims');
  assert(m.claims.stability_check_passed === true, 'representative stability result must be explicit');
  claimKeys.filter(k => k !== 'stability_check_passed').forEach(k => assert(m.claims[k] === false, `${k}: prohibited overclaim`));

  if (runLayers) {
    for (const [id, rel] of EXPECTED_LAYERS) {
      execFileSync(process.execPath, [path.join(root, rel)], { cwd: root, stdio: 'pipe', env: process.env });
      process.stdout.write(`LAYER_PASS ${id}\n`);
    }
  }
  return true;
}

function mustReject(name, mutate) {
  const candidate = clone(fixture);
  mutate(candidate);
  let rejected = false;
  try { validateMatrix(candidate, false); } catch (_) { rejected = true; }
  assert(rejected, `${name}: mutation was accepted`);
}

JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
validateMatrix(fixture, true);

const cases = [
  ['wrong baseline', m => { m.baseline_main_sha = '0'.repeat(40); }],
  ['universal correctness escalation', m => { m.claims.universal_correctness_proven = true; }],
  ['all history escalation', m => { m.claims.all_historical_states_verified = true; }],
  ['external runtime escalation', m => { m.claims.external_runtime_verified = true; }],
  ['legal validity escalation', m => { m.claims.legal_validity_proven = true; }],
  ['future successor safety escalation', m => { m.claims.future_successors_safe_by_default = true; }],
  ['KONTUR mutation', m => { m.non_effects.kontur_mutated = true; }],
  ['actuator invocation', m => { m.non_effects.actuator_invoked = true; }],
  ['authority transfer', m => { m.non_effects.authority_transferred = true; }],
  ['history rewrite', m => { m.non_effects.history_rewritten = true; }],
  ['missing layer', m => { m.layers.pop(); }],
  ['duplicate layer', m => { m.layers[8] = clone(m.layers[0]); }],
  ['validator substitution', m => { m.layers[0].validator_path = m.layers[1].validator_path; }],
  ['optional required layer', m => { m.layers[2].required = false; }],
  ['allow possibility to intent', m => { m.forbidden_implications.find(e => e.from === 'possibility' && e.to === 'intent').allowed = true; }],
  ['allow observation to identification', m => { m.forbidden_implications.find(e => e.from === 'observation').allowed = true; }],
  ['allow forecast to obligation', m => { m.forbidden_implications.find(e => e.from === 'forecast').allowed = true; }],
  ['missing uncertainty boundary', m => { m.forbidden_implications = m.forbidden_implications.filter(e => !(e.from === 'uncertainty' && e.to === 'refusal')); }],
  ['duplicate implication', m => { m.forbidden_implications.push(clone(m.forbidden_implications[0])); }],
  ['scope strengthening', m => { m.scope_class = 'universal'; }],
  ['unexpected field', m => { m.correctness_score = 1; }]
];
for (const [name, mutate] of cases) mustReject(name, mutate);

console.log(`UU_AAP_CROSS_LAYER_INVARIANT_STABILITY_V0_1_PASS layers=${EXPECTED_LAYERS.size} forbidden_edges=${REQUIRED_EDGES.size} negative_vectors=${cases.length}`);
