'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));
JSON.parse(fs.readFileSync(path.join(root, 'post-checkpoint-successor-evolution.schema.json'), 'utf8'));

function assert(v, m) { if (!v) throw new Error(m); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function exactKeys(obj, keys, label) {
  assert(obj && typeof obj === 'object' && !Array.isArray(obj), `${label}: object required`);
  assert(JSON.stringify(Object.keys(obj).sort()) === JSON.stringify([...keys].sort()), `${label}: exact keys required`);
}

const topKeys = ['$schema','artifact_type','artifact_version','test_id','checkpoint_binding','post_checkpoint_frontier','successor_proposal','inherited_from_checkpoint','claims','non_effects'];
const inheritedKeys = ['intent','authority','identity','action_permit','obligation','liability','canonicality','execution'];
const claimKeys = ['checkpoint_preserved','fresh_successor_evidence_present','post_checkpoint_evolution_test_passed','successor_compatibility_proven','successor_canonical','action_authorized','action_performed','universal_future_safety_proven'];
const nonEffectKeys = ['checkpoint_rewritten','release_or_tag_created','kontur_mutated','authority_transferred','permissions_changed','history_rewritten','canonical_origin_mutated'];

function validate(r) {
  exactKeys(r, topKeys, 'receipt');
  assert(r.$schema === './post-checkpoint-successor-evolution.schema.json', 'schema binding mismatch');
  assert(r.artifact_type === 'PostCheckpointSuccessorEvolutionTest', 'artifact type mismatch');
  assert(r.artifact_version === '0.1', 'artifact version mismatch');
  assert(typeof r.test_id === 'string' && r.test_id.length > 0, 'test_id required');

  exactKeys(r.checkpoint_binding, ['pr_number','fixture_path','validator_path','checkpoint_id','bound_commit_sha','bound_tree_sha'], 'checkpoint_binding');
  assert(r.checkpoint_binding.pr_number === 408, 'checkpoint PR mismatch');
  assert(r.checkpoint_binding.fixture_path === 'protocols/experimental/canonical-stability-checkpoint/v0.1/fixture.json', 'checkpoint fixture path mismatch');
  assert(r.checkpoint_binding.validator_path === 'protocols/experimental/canonical-stability-checkpoint/v0.1/validate.js', 'checkpoint validator path mismatch');
  assert(fs.existsSync(r.checkpoint_binding.fixture_path), 'checkpoint fixture missing');
  assert(fs.existsSync(r.checkpoint_binding.validator_path), 'checkpoint validator missing');
  const checkpoint = JSON.parse(fs.readFileSync(r.checkpoint_binding.fixture_path, 'utf8'));
  assert(checkpoint.checkpoint_id === r.checkpoint_binding.checkpoint_id, 'checkpoint id rebound');
  assert(checkpoint.canonical_frontier.commit_sha === r.checkpoint_binding.bound_commit_sha, 'checkpoint commit rebound');
  assert(checkpoint.canonical_frontier.tree_sha === r.checkpoint_binding.bound_tree_sha, 'checkpoint tree rebound');
  assert(checkpoint.claims.future_successor_authorized === false, 'checkpoint unexpectedly authorizes successor');

  exactKeys(r.post_checkpoint_frontier, ['repository','branch','commit_sha','tree_sha'], 'post_checkpoint_frontier');
  assert(r.post_checkpoint_frontier.repository === 'Matawaka/uu-aap', 'repository mismatch');
  assert(r.post_checkpoint_frontier.branch === 'main', 'branch mismatch');
  assert(r.post_checkpoint_frontier.commit_sha === '4f24a966f70f96673995c775fa350af4e0f8f0f0', 'post-checkpoint commit mismatch');
  assert(r.post_checkpoint_frontier.tree_sha === '696bb0e3db63255ee52b821a47d53c9b5c8897d4', 'post-checkpoint tree mismatch');

  exactKeys(r.successor_proposal, ['proposal_id','synthetic','state','compatibility_state','fresh_evidence_refs','semantic_strengthening'], 'successor_proposal');
  assert(typeof r.successor_proposal.proposal_id === 'string' && r.successor_proposal.proposal_id.length > 0, 'proposal_id required');
  assert(r.successor_proposal.synthetic === true, 'successor must remain synthetic');
  assert(r.successor_proposal.state === 'proposed', 'successor state escalation');
  assert(r.successor_proposal.compatibility_state === 'requires_fresh_validation', 'compatibility must require fresh validation');
  assert(Array.isArray(r.successor_proposal.fresh_evidence_refs) && r.successor_proposal.fresh_evidence_refs.length > 0, 'fresh successor evidence required');
  assert(new Set(r.successor_proposal.fresh_evidence_refs).size === r.successor_proposal.fresh_evidence_refs.length, 'duplicate successor evidence');
  r.successor_proposal.fresh_evidence_refs.forEach((v, i) => assert(typeof v === 'string' && v.length > 0, `fresh_evidence_refs[${i}] invalid`));
  assert(r.successor_proposal.semantic_strengthening === false, 'semantic strengthening prohibited');

  exactKeys(r.inherited_from_checkpoint, inheritedKeys, 'inherited_from_checkpoint');
  inheritedKeys.forEach(k => assert(r.inherited_from_checkpoint[k] === false, `${k}: checkpoint inheritance prohibited`));

  exactKeys(r.claims, claimKeys, 'claims');
  assert(r.claims.checkpoint_preserved === true, 'checkpoint preservation not established');
  assert(r.claims.fresh_successor_evidence_present === true, 'fresh successor evidence claim required');
  assert(r.claims.post_checkpoint_evolution_test_passed === true, 'test pass claim required');
  ['successor_compatibility_proven','successor_canonical','action_authorized','action_performed','universal_future_safety_proven'].forEach(k => assert(r.claims[k] === false, `${k}: prohibited escalation`));

  exactKeys(r.non_effects, nonEffectKeys, 'non_effects');
  nonEffectKeys.forEach(k => assert(r.non_effects[k] === false, `${k}: prohibited effect`));
  return true;
}

validate(fixture);
cp.execFileSync('node', [fixture.checkpoint_binding.validator_path], {stdio: 'inherit'});

const mutations = [
  r => { r.checkpoint_binding.pr_number = 407; },
  r => { r.checkpoint_binding.fixture_path = 'missing.json'; },
  r => { r.checkpoint_binding.checkpoint_id = 'urn:wrong'; },
  r => { r.checkpoint_binding.bound_commit_sha = '0'.repeat(40); },
  r => { r.checkpoint_binding.bound_tree_sha = '0'.repeat(40); },
  r => { r.post_checkpoint_frontier.commit_sha = r.checkpoint_binding.bound_commit_sha; },
  r => { r.post_checkpoint_frontier.tree_sha = '0'.repeat(40); },
  r => { r.successor_proposal.synthetic = false; },
  r => { r.successor_proposal.state = 'canonical'; },
  r => { r.successor_proposal.compatibility_state = 'proven_from_checkpoint'; },
  r => { r.successor_proposal.fresh_evidence_refs = []; },
  r => { r.successor_proposal.semantic_strengthening = true; },
  r => { r.inherited_from_checkpoint.intent = true; },
  r => { r.inherited_from_checkpoint.authority = true; },
  r => { r.inherited_from_checkpoint.action_permit = true; },
  r => { r.inherited_from_checkpoint.obligation = true; },
  r => { r.inherited_from_checkpoint.liability = true; },
  r => { r.claims.successor_compatibility_proven = true; },
  r => { r.claims.successor_canonical = true; },
  r => { r.claims.action_authorized = true; },
  r => { r.claims.action_performed = true; },
  r => { r.claims.universal_future_safety_proven = true; },
  r => { r.non_effects.checkpoint_rewritten = true; },
  r => { r.non_effects.kontur_mutated = true; },
  r => { r.extra = 'unexpected'; }
];

for (const mutate of mutations) {
  const r = clone(fixture);
  mutate(r);
  let rejected = false;
  try { validate(r); } catch (_) { rejected = true; }
  assert(rejected, 'negative mutation accepted');
}

console.log(`UU_AAP_POST_CHECKPOINT_SUCCESSOR_EVOLUTION_V0_1_PASS negative_vectors=${mutations.length}`);
