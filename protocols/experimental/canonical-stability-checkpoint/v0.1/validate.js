'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));
const expectedLayers = [
  'core-v0.1',
  'non-induced-intent-v0.1',
  'ambient-observability-non-identification-v0.1',
  'event-hash-minimalism-v0.1',
  'latent-evidentiary-knowledge-v0.1',
  'three-layer-commitment-root-v0.1',
  'preventive-intent-challenge-v0.1',
  'ambient-pressure-by-uncertainty-v0.1',
  'future-optionality-non-commitment-v0.1'
];

function assert(v, m) { if (!v) throw new Error(m); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

function validate(r) {
  assert(r.$schema === './canonical-stability-checkpoint.schema.json', 'schema binding mismatch');
  assert(r.artifact_type === 'CanonicalStabilityCheckpoint', 'artifact type mismatch');
  assert(r.artifact_version === '0.1', 'artifact version mismatch');
  assert(r.canonical_frontier.repository === 'Matawaka/uu-aap', 'repository mismatch');
  assert(r.canonical_frontier.branch === 'main', 'branch mismatch');
  assert(r.canonical_frontier.commit_sha === '676b8c3bfc7d10595a17f4595a88bf477cf8fc48', 'commit binding mismatch');
  assert(r.canonical_frontier.tree_sha === '2477f354a8fd117108e7108ba4719f9129ef7fe6', 'tree binding mismatch');
  assert(r.predecessor_stability.pr_number === 406, 'predecessor PR mismatch');
  assert(fs.existsSync(r.predecessor_stability.profile_path), 'missing predecessor stability fixture');
  assert(fs.existsSync(r.predecessor_stability.validator_path), 'missing predecessor stability validator');
  assert(r.predecessor_stability.post_merge_green_observed === true, 'post-merge green not bound');
  assert(JSON.stringify(r.representative_layers) === JSON.stringify(expectedLayers), 'representative inventory drift');
  assert(new Set(r.representative_layers).size === r.representative_layers.length, 'duplicate layer id');
  assert(r.claims.tested_frontier_bound === true, 'tested frontier not bound');
  assert(r.claims.representative_stability_preserved === true, 'representative stability not preserved');
  for (const k of ['universal_correctness_proven','complete_historical_coverage_proven','external_runtime_state_proven','future_successor_authorized','release_ready','publication_claim']) assert(r.claims[k] === false, `${k}: prohibited escalation`);
  for (const [k,v] of Object.entries(r.non_effects)) assert(v === false, `${k}: prohibited effect`);
  return true;
}

validate(fixture);
cp.execFileSync('node', [fixture.predecessor_stability.validator_path], {stdio:'inherit'});

const mutations = [
  r => r.canonical_frontier.commit_sha = '0'.repeat(40),
  r => r.canonical_frontier.tree_sha = '0'.repeat(40),
  r => r.predecessor_stability.pr_number = 405,
  r => r.predecessor_stability.profile_path = 'missing.json',
  r => r.representative_layers.pop(),
  r => r.representative_layers.push(r.representative_layers[0]),
  r => r.claims.universal_correctness_proven = true,
  r => r.claims.complete_historical_coverage_proven = true,
  r => r.claims.external_runtime_state_proven = true,
  r => r.claims.future_successor_authorized = true,
  r => r.claims.release_ready = true,
  r => r.claims.publication_claim = true,
  r => r.non_effects.release_or_tag_created = true,
  r => r.non_effects.kontur_mutated = true,
  r => r.non_effects.authority_transferred = true,
  r => r.non_effects.action_authorized = true,
  r => r.non_effects.action_performed = true,
  r => r.non_effects.liability_established = true,
  r => r.non_effects.permissions_changed = true,
  r => r.non_effects.history_rewritten = true,
  r => r.non_effects.canonical_origin_mutated = true
];
for (const mutate of mutations) {
  const r = clone(fixture); mutate(r);
  let rejected = false; try { validate(r); } catch (_) { rejected = true; }
  assert(rejected, 'negative mutation accepted');
}
console.log(`UU_AAP_CANONICAL_STABILITY_CHECKPOINT_V0_1_PASS negative_vectors=${mutations.length}`);
