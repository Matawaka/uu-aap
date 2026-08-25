'use strict';

const fs = require('fs');
const path = require('path');

const base = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(base, 'fixture.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(base, 'personal-sovereign-root.schema.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(xs) {
  return new Set(xs).size === xs.length;
}

function validate(r) {
  assert(schema.additionalProperties === false, 'schema must be closed');
  assert(r.profile === 'uu-aap.personal-sovereign-root.v0.1', 'profile');
  assert(r.origin_frontier === '75c150a192db68d0c167d2408bd436e54b71d475', 'origin frontier');
  assert(r.root_id, 'root id');

  const rm = r.root_model;
  assert(rm.single_secret === false, 'root must not be a single secret');
  assert(rm.person_equated_to_key === false, 'person must not be equated to key');
  assert(rm.centralized_identity_database_required === false, 'centralized identity database must not be required');
  assert(rm.cryptography_creates_human_uniqueness === false, 'cryptography must not claim to create human uniqueness');

  const sources = r.evidence_fabric.sources;
  assert(Array.isArray(sources) && sources.length >= 2, 'plural evidence sources required');
  assert(r.evidence_fabric.opaque_trust_score_used === false, 'opaque trust score forbidden');
  const sourceIds = sources.map(s => s.source_id);
  assert(unique(sourceIds), 'duplicate evidence source id');
  const independenceGroups = sources.map(s => s.independence_group);
  assert(new Set(independenceGroups).size >= 2, 'evidence independence collapsed');
  for (const s of sources) {
    assert(s.source_id && s.source_class && s.commitment_ref && s.provenance_ref && s.independence_group, 'incomplete evidence source');
    assert(s.universally_sufficient_identity_proof === false, 'single evidence source promoted to universal identity proof');
  }

  const current = r.current_root_state;
  assert(current.root_state_id, 'current root state id');
  assert(Array.isArray(current.active_control_refs) && current.active_control_refs.length >= 1, 'active control refs required');
  assert(unique(current.active_control_refs), 'duplicate control refs');
  assert(current.personhood_claimed_by_root === false, 'root must not claim personhood');
  assert(current.legal_identity_claimed_by_root === false, 'root must not claim legal identity');

  const transition = r.successor_transition;
  assert(transition.predecessor_root_state_id, 'predecessor root missing');
  assert(transition.successor_root_state_id, 'successor root missing');
  assert(transition.predecessor_root_state_id !== transition.successor_root_state_id, 'rotation must change root state');
  assert(transition.successor_root_state_id === current.root_state_id, 'current state must equal accepted successor');
  assert(transition.continuity_policy_ref, 'continuity policy missing');
  assert(transition.accepted === true, 'positive transition must be accepted');
  assert(transition.new_person_claimed === false, 'rotation must not claim a new person');
  assert(Array.isArray(transition.continuity_evidence_source_ids) && transition.continuity_evidence_source_ids.length >= 2, 'insufficient continuity evidence');
  assert(unique(transition.continuity_evidence_source_ids), 'duplicate continuity evidence refs');
  for (const id of transition.continuity_evidence_source_ids) {
    assert(sourceIds.includes(id), `unknown continuity evidence source: ${id}`);
  }
  const continuityGroups = new Set(
    sources
      .filter(s => transition.continuity_evidence_source_ids.includes(s.source_id))
      .map(s => s.independence_group)
  );

  const recovery = r.recovery_policy;
  assert(recovery.key_loss_means_personhood_loss === false, 'key loss must not mean personhood loss');
  assert(recovery.single_compromised_key_means_conclusive_takeover === false, 'single compromised key must not prove takeover');
  assert(recovery.continuity_assessment_required === true, 'continuity assessment required');
  assert(Number.isInteger(recovery.minimum_independence_groups) && recovery.minimum_independence_groups >= 2, 'recovery independence threshold');
  assert(continuityGroups.size >= recovery.minimum_independence_groups, 'continuity evidence lacks required independence');

  const retention = r.retention_policy;
  assert(retention.full_history_required === false, 'full history must not be required');
  assert(retention.commitment_only_permitted === true, 'commitment-only evidence must remain permitted');
  assert(retention.total_telemetry_required === false, 'total telemetry must not be required');

  const correlation = r.correlation_policy;
  assert(correlation.cross_context_default_allowed === false, 'cross-context correlation must be denied by default');
  assert(correlation.purpose_bounded === true, 'correlation must remain purpose bounded');
  assert(correlation.performed === false, 'validator profile must not correlate');

  const disclosure = r.disclosure_policy;
  assert(disclosure.right_to_inspect_all_sources === false, 'root control must not grant inspection right over all sources');
  assert(disclosure.default_disclosure === false, 'default disclosure forbidden');
  assert(disclosure.performed === false, 'validator profile must not disclose');

  const claims = r.claims;
  assert(claims.bounded_continuity_established === true, 'bounded continuity claim expected');
  for (const k of [
    'legal_identity_established',
    'universal_identity_proof',
    'authority_established',
    'intent_established',
    'action_established',
    'authorship_established',
    'responsibility_established',
    'liability_established'
  ]) {
    assert(claims[k] === false, `unsupported claim: ${k}`);
  }

  const ne = r.non_effects;
  for (const k of [
    'identity_lookup_performed',
    'biometric_processing_performed',
    'profile_constructed',
    'external_correlation_performed',
    'credential_issued',
    'account_recovered',
    'legal_identity_determined',
    'authority_expanded',
    'actuator_invoked',
    'kontur_mutated'
  ]) {
    assert(ne[k] === false, `forbidden effect: ${k}`);
  }

  return true;
}

validate(fixture);

const mutations = [
  r => { r.profile = 'uu-aap.other'; },
  r => { r.origin_frontier = '0000000000000000000000000000000000000000'; },
  r => { r.root_model.single_secret = true; },
  r => { r.root_model.person_equated_to_key = true; },
  r => { r.root_model.centralized_identity_database_required = true; },
  r => { r.root_model.cryptography_creates_human_uniqueness = true; },
  r => { r.evidence_fabric.sources = [r.evidence_fabric.sources[0]]; },
  r => { r.evidence_fabric.sources[1].source_id = r.evidence_fabric.sources[0].source_id; },
  r => { r.evidence_fabric.sources[0].universally_sufficient_identity_proof = true; },
  r => { r.evidence_fabric.opaque_trust_score_used = true; },
  r => { for (const s of r.evidence_fabric.sources) s.independence_group = 'one-group'; },
  r => { r.current_root_state.active_control_refs = []; },
  r => { r.current_root_state.personhood_claimed_by_root = true; },
  r => { r.current_root_state.legal_identity_claimed_by_root = true; },
  r => { r.successor_transition.predecessor_root_state_id = r.successor_transition.successor_root_state_id; },
  r => { r.successor_transition.successor_root_state_id = 'different-from-current'; },
  r => { r.successor_transition.continuity_evidence_source_ids = ['src-origin-record-commitment']; },
  r => { r.successor_transition.continuity_evidence_source_ids[0] = 'unknown-source'; },
  r => { r.successor_transition.accepted = false; },
  r => { r.successor_transition.new_person_claimed = true; },
  r => { r.recovery_policy.key_loss_means_personhood_loss = true; },
  r => { r.recovery_policy.single_compromised_key_means_conclusive_takeover = true; },
  r => { r.recovery_policy.continuity_assessment_required = false; },
  r => { r.recovery_policy.minimum_independence_groups = 4; },
  r => { r.retention_policy.full_history_required = true; },
  r => { r.retention_policy.commitment_only_permitted = false; },
  r => { r.retention_policy.total_telemetry_required = true; },
  r => { r.correlation_policy.cross_context_default_allowed = true; },
  r => { r.correlation_policy.purpose_bounded = false; },
  r => { r.correlation_policy.performed = true; },
  r => { r.disclosure_policy.right_to_inspect_all_sources = true; },
  r => { r.disclosure_policy.default_disclosure = true; },
  r => { r.disclosure_policy.performed = true; },
  r => { r.claims.legal_identity_established = true; },
  r => { r.claims.universal_identity_proof = true; },
  r => { r.claims.authority_established = true; },
  r => { r.claims.intent_established = true; },
  r => { r.claims.action_established = true; },
  r => { r.claims.responsibility_established = true; },
  r => { r.claims.liability_established = true; },
  r => { r.non_effects.profile_constructed = true; },
  r => { r.non_effects.external_correlation_performed = true; },
  r => { r.non_effects.legal_identity_determined = true; },
  r => { r.non_effects.authority_expanded = true; },
  r => { r.non_effects.kontur_mutated = true; }
];

for (let i = 0; i < mutations.length; i++) {
  const candidate = structuredClone(fixture);
  mutations[i](candidate);
  let rejected = false;
  try { validate(candidate); } catch (_) { rejected = true; }
  assert(rejected, `negative mutation ${i + 1} was accepted`);
}

console.log(`Personal Sovereign Root / PEF v0.1: PASS (${mutations.length} negative mutations rejected)`);
