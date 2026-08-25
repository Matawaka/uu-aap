'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const assert = (v, m) => { if (!v) throw new Error(m); };

const requiredTop = ['artifact_type','artifact_version','canonicalization','digest_algorithm','layers','root_digest','predecessor_root','successor','claims'];
const allowedTop = new Set(requiredTop);
const requiredPlanes = ['knowledge','authority','legitimacy'];
const forbiddenTrueClaims = [
  'mutation_authority_granted','semantic_truth_established','legal_validity_established',
  'human_intent_established','responsibility_assigned','liability_established',
  'universal_legitimacy_established','history_rewritten'
];

function validate(a) {
  assert(a && typeof a === 'object' && !Array.isArray(a), 'artifact object required');
  assert(Object.keys(a).every((k) => allowedTop.has(k)), 'unknown top-level property');
  assert(requiredTop.every((k) => Object.prototype.hasOwnProperty.call(a, k)), 'missing top-level property');
  assert(a.artifact_type === 'ThreeLayerCommitmentRoot', 'artifact_type mismatch');
  assert(a.artifact_version === '0.1', 'artifact_version mismatch');
  assert(a.canonicalization === 'uu-aap-three-layer-root-v0.1', 'canonicalization mismatch');
  assert(a.digest_algorithm === 'SHA-256', 'digest algorithm mismatch');
  assert(Array.isArray(a.layers) && a.layers.length === 3, 'exactly three layers required');

  const planes = a.layers.map((x) => x.plane);
  assert(new Set(planes).size === 3, 'duplicate layer plane');
  assert(requiredPlanes.every((p) => planes.includes(p)), 'required layer missing');
  assert(planes.join('|') === requiredPlanes.join('|'), 'canonical layer order required');

  for (const layer of a.layers) {
    const keys = ['plane','digest','lifecycle_state','transition_reason','successor_ref'];
    assert(Object.keys(layer).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(layer, k)), 'layer contract mismatch');
    assert(/^[0-9a-f]{64}$/.test(layer.digest), 'invalid layer digest');
    assert(['active','deprecated','absorbed'].includes(layer.lifecycle_state), 'invalid lifecycle state');
    if (layer.lifecycle_state === 'active') {
      assert(layer.transition_reason === null && layer.successor_ref === null, 'active layer cannot claim lifecycle transition');
    } else {
      assert(typeof layer.transition_reason === 'string' && layer.transition_reason.trim().length > 0, 'non-active layer requires transition reason');
      assert(typeof layer.successor_ref === 'string' && layer.successor_ref.trim().length > 0, 'non-active layer requires successor reference');
    }
  }

  const input = a.layers.map((x) => `${x.plane}:${x.digest}`).join('|');
  assert(a.root_digest === sha256(input), 'root digest mismatch');
  assert(a.predecessor_root === null || /^[0-9a-f]{64}$/.test(a.predecessor_root), 'invalid predecessor root');

  assert(a.successor && typeof a.successor === 'object', 'successor object required');
  assert(Object.keys(a.successor).sort().join('|') === ['binds_predecessor_root','declared','successor_ref'].sort().join('|'), 'successor contract mismatch');
  if (a.successor.declared) {
    assert(typeof a.successor.successor_ref === 'string' && a.successor.successor_ref.length > 0, 'declared successor requires reference');
    assert(a.successor.binds_predecessor_root === a.root_digest, 'successor must bind exact predecessor root');
  } else {
    assert(a.successor.successor_ref === null && a.successor.binds_predecessor_root === null, 'undeclared successor must be empty');
  }

  assert(a.claims.layer_separation_preserved === true, 'layer separation claim required');
  assert(a.claims.root_integrity_verified === true, 'root integrity claim required');
  for (const key of forbiddenTrueClaims) assert(a.claims[key] === false, `forbidden positive claim: ${key}`);
  return true;
}

function expectReject(name, mutate) {
  const x = clone(fixture);
  mutate(x);
  let rejected = false;
  try { validate(x); } catch (_) { rejected = true; }
  assert(rejected, `${name}: mutation was accepted`);
  return name;
}

validate(fixture);

const negatives = [
  expectReject('missing_knowledge', (x) => x.layers = x.layers.slice(1)),
  expectReject('duplicate_authority', (x) => x.layers[0].plane = 'authority'),
  expectReject('layer_order_swap', (x) => [x.layers[0],x.layers[1]] = [x.layers[1],x.layers[0]]),
  expectReject('knowledge_digest_substitution', (x) => x.layers[0].digest = 'a'.repeat(64)),
  expectReject('authority_digest_substitution', (x) => x.layers[1].digest = 'b'.repeat(64)),
  expectReject('legitimacy_digest_substitution', (x) => x.layers[2].digest = 'c'.repeat(64)),
  expectReject('root_laundering', (x) => x.root_digest = '0'.repeat(64)),
  expectReject('silent_deprecation', (x) => x.layers[0].lifecycle_state = 'deprecated'),
  expectReject('silent_absorption', (x) => x.layers[2].lifecycle_state = 'absorbed'),
  expectReject('active_with_successor', (x) => x.layers[1].successor_ref = 'urn:successor:authority'),
  expectReject('successor_without_binding', (x) => { x.successor.declared = true; x.successor.successor_ref = 'urn:root:next'; }),
  expectReject('wrong_predecessor_binding', (x) => { x.successor.declared = true; x.successor.successor_ref = 'urn:root:next'; x.successor.binds_predecessor_root = '0'.repeat(64); }),
  expectReject('mutation_authority_escalation', (x) => x.claims.mutation_authority_granted = true),
  expectReject('truth_overclaim', (x) => x.claims.semantic_truth_established = true),
  expectReject('legal_overclaim', (x) => x.claims.legal_validity_established = true),
  expectReject('intent_overclaim', (x) => x.claims.human_intent_established = true),
  expectReject('liability_overclaim', (x) => x.claims.liability_established = true),
  expectReject('universal_legitimacy_overclaim', (x) => x.claims.universal_legitimacy_established = true),
  expectReject('history_rewrite_overclaim', (x) => x.claims.history_rewritten = true),
  expectReject('silent_extension_plane', (x) => x.layers.push({plane:'other',digest:'4'.repeat(64),lifecycle_state:'active',transition_reason:null,successor_ref:null})),
  expectReject('unknown_top_level', (x) => x.permission = 'granted')
];

console.log(`PASS Three-Layer Commitment Root v0.1: positive fixture + ${negatives.length} fail-closed mutations`);
