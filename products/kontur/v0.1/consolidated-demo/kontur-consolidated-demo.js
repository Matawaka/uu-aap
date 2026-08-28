'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ReadinessInterop = require('../readiness-interop/readiness-family-interop.js');

const PROTOCOL = 'KONTUR-CONSOLIDATED-DEMO';
const VERSION = '0.1';
const INPUT_TYPE = 'KONTURConsolidatedDemoInput';
const RECEIPT_TYPE = 'KONTURFamilyConsolidationReceipt';
const STATE = 'CONSOLIDATION_CANDIDATE_READY';
const NEXT_SAFE_ACTION = 'HUMAN_FAMILY_CONSOLIDATION_GATE_REQUIRED';
const PRODUCT_CONTRACT_HASH = 'sha256:21597d591cc4fbe2974c8ac63d669c79158734336c6c64f8ba6a91602835b1b5';
const FAMILY_MANIFEST_HASH = 'sha256:90da81f7c33f44f34410790e9269bf8b05a5ad47db596437b214b8301701a5a1';
const FAMILY_MANIFEST_PATH = 'products/kontur/v0.1/family-manifest.json';
const GAME_CHAIN_PATH = 'pilots/kontur-game-companion/dependency-contract/game-companion-chain.json';
const GAME_CHAIN_CONTRACT = 'KONTUR_GAME_COMPANION_CROSS_LAYER_DEPENDENCY';
const GAME_LAYERS = Object.freeze([
  'observational-lane',
  'assistance-gate',
  'shared-discovery-memory',
  'bounded-initiative',
  'focus-diversity',
  'interaction-receipt',
  'pause-resume'
]);
const MEMBER_IDS = Object.freeze([
  'readiness-aggregator',
  'activation-boundary',
  'responsibility-kernel',
  'responsibility-ledger',
  'live-host-boundary',
  'game-companion'
]);
const TRUE_CLAIMS = Object.freeze([
  'family_packet_complete',
  'all_six_members_bound',
  'member_roles_remain_distinct',
  'non_transfer_edges_preserved',
  'readiness_activation_separation_preserved',
  'kernel_ledger_lineage_reviewed',
  'live_host_boundary_preserved',
  'game_companion_chain_closed',
  'pause_recovery_boundary_preserved',
  'field_evidence_minimized',
  'measurable_demo_completed',
  'human_family_gate_still_required'
]);
const FALSE_CLAIMS = Object.freeze([
  'family_activated',
  'production_ready',
  'activation_authorized',
  'activation_performed',
  'preflight_run',
  'kernel_activated',
  'responsibility_state_created',
  'responsibility_accepted',
  'ledger_mutated',
  'host_designated',
  'executor_bound',
  'runtime_started',
  'cross_member_data_access_admitted',
  'authority_created',
  'action_permit_created',
  'execution_admitted',
  'external_effect_performed',
  'live_response_generated',
  'proactive_message_sent',
  'background_activity_performed',
  'autonomous_gameplay_performed',
  'game_account_controlled',
  'behavioral_profile_built',
  'psychological_inference_performed',
  'attention_profile_built',
  'engagement_optimized',
  'stable_core_promotion_established',
  'successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);
const REQUIRED_NON_EFFECTS = Object.freeze([
  'KONTUR Product Family Contract != KONTUR Activation',
  'Readiness Aggregation != Kernel Activation',
  'Ready Signal != ActionPermit',
  'Responsibility State != Execution Authority',
  'Family Membership != Shared Data Access',
  'Game Companion Pilot != Server Responsibility Holder',
  'Field Evidence != Production Readiness',
  'Live Host Eligibility != Live Host Designation',
  'Designation != Activation',
  'Activation Review != Activation Execution',
  'Observed Runtime != Permitted Runtime Mutation',
  'Pause or Recovery Evidence != Successor Authority',
  'Product Family != Stable Core',
  'Synthetic Demo Metrics != Production Telemetry'
]);
const INPUT_KEYS = [
  'protocol', 'version', 'artifact_type', 'demo_id', 'evaluation_frontier',
  'family_binding', 'component_reviews', 'pause_recovery', 'field_outcomes',
  'metrics', 'controls', 'content_hash'
];
const FRONTIER_KEYS = ['repository', 'revision', 'observed_at'];
const FAMILY_BINDING_KEYS = ['product_contract_hash', 'family_manifest_path', 'family_manifest_hash'];
const COMPONENT_KEYS = ['readiness', 'activation', 'kernel', 'ledger', 'live_host', 'game_companion'];
const COMMON_REVIEW_KEYS = ['member_id', 'conformance_status'];
const METRIC_KEYS = [
  'measurement_class', 'family_member_count', 'established_edge_count', 'planned_edge_count',
  'canonical_path_count', 'game_companion_layer_count', 'human_gate_count',
  'human_interruption_count', 'pause_event_count', 'resume_event_count',
  'network_call_count', 'filesystem_write_count', 'external_effect_count',
  'runtime_start_count', 'ledger_mutation_count', 'host_designation_count'
];
const CONTROL_KEYS = [
  'local_only', 'read_only', 'network_access_required', 'filesystem_write_required',
  'activation_available', 'host_designation_available', 'ledger_write_available',
  'runtime_start_available', 'background_activity_available', 'action_permit_available',
  'execution_available', 'external_effect_available'
];
const RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'receipt_id', 'source_input',
  'evaluation_frontier', 'state', 'family_review', 'readiness_activation_review',
  'responsibility_lineage_review', 'live_host_review', 'game_companion_review',
  'pause_recovery_review', 'field_outcome_review', 'synthetic_demo_metrics',
  'claims', 'non_effects', 'next_safe_action', 'content_hash'
];

class KONTURConsolidatedDemoError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KONTURConsolidatedDemoError';
  }
}

function fail(message) { throw new KONTURConsolidatedDemoError(message); }
function requireCondition(condition, message) { if (!condition) fail(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function assertObject(value, label) { requireCondition(isObject(value), `${label} must be an object`); }
function assertExactKeys(value, keys, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys mismatch`);
}
function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}
function assertBoolean(value, label) { requireCondition(typeof value === 'boolean', `${label} must be boolean`); }
function assertInteger(value, label, min = 0) { requireCondition(Number.isInteger(value) && value >= min, `${label} must be integer >= ${min}`); }
function assertStringArray(value, label, { minItems = 0 } = {}) {
  requireCondition(Array.isArray(value) && value.length >= minItems, `${label} must be an array with at least ${minItems} item(s)`);
  const seen = new Set();
  value.forEach((item, index) => {
    assertString(item, `${label}[${index}]`);
    requireCondition(!seen.has(item), `${label} must contain unique items`);
    seen.add(item);
  });
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
  return out;
}
function computeContentHash(value) {
  const projected = clone(value);
  projected.content_hash = '';
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(projected)), 'utf8').digest('hex')}`;
}
function rehash(value) { value.content_hash = computeContentHash(value); return value; }
function deterministicId(prefix, value) {
  return `${prefix}${crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex').slice(0, 24)}`;
}
function readJson(repoRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}
function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function assertExactStringSet(value, expected, label) {
  assertStringArray(value, label, { minItems: expected.length });
  requireCondition(value.length === expected.length, `${label} size mismatch`);
  requireCondition(JSON.stringify([...value].sort()) === JSON.stringify([...expected].sort()), `${label} set mismatch`);
}

function loadCanonicalEvidence(repoRoot) {
  const manifest = readJson(repoRoot, FAMILY_MANIFEST_PATH);
  ReadinessInterop.validateFamilyManifest(manifest);
  const chain = readJson(repoRoot, GAME_CHAIN_PATH);
  requireCondition(chain.contract === GAME_CHAIN_CONTRACT, 'Game Companion chain contract mismatch');
  requireCondition(Array.isArray(chain.layers), 'Game Companion layers must be an array');
  const layerIds = chain.layers.map(layer => layer.id);
  requireCondition(sameArray(layerIds, GAME_LAYERS), 'Game Companion seven-layer chain mismatch');
  requireCondition(Array.isArray(chain.edges) && chain.edges.length === GAME_LAYERS.length - 1, 'Game Companion chain edge count mismatch');
  assertObject(chain.non_effects, 'Game Companion non_effects');
  for (const [key, value] of Object.entries(chain.non_effects)) {
    requireCondition(value === false, `Game Companion non-effect ${key} must remain false`);
  }
  return { manifest, chain };
}

function validateFamilyBinding(binding) {
  assertExactKeys(binding, FAMILY_BINDING_KEYS, 'family_binding');
  requireCondition(binding.product_contract_hash === PRODUCT_CONTRACT_HASH, 'KONTUR Product Contract hash mismatch');
  requireCondition(binding.family_manifest_path === FAMILY_MANIFEST_PATH, 'family manifest path mismatch');
  requireCondition(binding.family_manifest_hash === FAMILY_MANIFEST_HASH, 'family manifest hash mismatch');
}

function validateCommonReview(review, memberId, label) {
  assertObject(review, label);
  for (const key of COMMON_REVIEW_KEYS) requireCondition(Object.prototype.hasOwnProperty.call(review, key), `${label}.${key} required`);
  requireCondition(review.member_id === memberId, `${label} member id mismatch`);
  requireCondition(review.conformance_status === 'PASS', `${label} conformance status must be PASS`);
}

function validateComponentReviews(reviews, manifest, chain) {
  assertExactKeys(reviews, COMPONENT_KEYS, 'component_reviews');
  const memberMap = new Map(manifest.members.map(member => [member.id, member]));
  requireCondition(memberMap.size === 6, 'family manifest must contain exactly six unique members');
  requireCondition(MEMBER_IDS.every(id => memberMap.has(id)), 'family member coverage incomplete');

  validateCommonReview(reviews.readiness, 'readiness-aggregator', 'component_reviews.readiness');
  assertExactKeys(reviews.readiness, [...COMMON_REVIEW_KEYS, 'readiness_evidence_available', 'activation_authorized', 'human_activation_step_required'], 'component_reviews.readiness');
  requireCondition(reviews.readiness.readiness_evidence_available === true, 'readiness evidence must be available');
  requireCondition(reviews.readiness.activation_authorized === false, 'readiness cannot authorize activation');
  requireCondition(reviews.readiness.human_activation_step_required === true, 'human activation step must remain required');

  validateCommonReview(reviews.activation, 'activation-boundary', 'component_reviews.activation');
  assertExactKeys(reviews.activation, [...COMMON_REVIEW_KEYS, 'human_review_required', 'preflight_run', 'activation_performed'], 'component_reviews.activation');
  requireCondition(reviews.activation.human_review_required === true, 'activation human review must remain required');
  requireCondition(reviews.activation.preflight_run === false, 'demo cannot claim preflight run');
  requireCondition(reviews.activation.activation_performed === false, 'demo cannot claim activation');

  validateCommonReview(reviews.kernel, 'responsibility-kernel', 'component_reviews.kernel');
  assertExactKeys(reviews.kernel, [...COMMON_REVIEW_KEYS, 'structural_lineage_reviewed', 'kernel_activated', 'responsibility_accepted'], 'component_reviews.kernel');
  requireCondition(reviews.kernel.structural_lineage_reviewed === true, 'kernel structural lineage must be reviewed');
  requireCondition(reviews.kernel.kernel_activated === false, 'kernel must remain not activated');
  requireCondition(reviews.kernel.responsibility_accepted === false, 'responsibility must remain unaccepted');

  validateCommonReview(reviews.ledger, 'responsibility-ledger', 'component_reviews.ledger');
  assertExactKeys(reviews.ledger, [...COMMON_REVIEW_KEYS, 'append_only_continuity_reviewed', 'recovery_lineage_reviewed', 'ledger_mutated'], 'component_reviews.ledger');
  requireCondition(reviews.ledger.append_only_continuity_reviewed === true, 'ledger continuity must be reviewed');
  requireCondition(reviews.ledger.recovery_lineage_reviewed === true, 'ledger recovery lineage must be reviewed');
  requireCondition(reviews.ledger.ledger_mutated === false, 'demo cannot mutate ledger');

  validateCommonReview(reviews.live_host, 'live-host-boundary', 'component_reviews.live_host');
  assertExactKeys(reviews.live_host, [...COMMON_REVIEW_KEYS, 'observation_designation_separation_preserved', 'designation_binding_separation_preserved', 'binding_activation_separation_preserved', 'host_designated', 'executor_bound'], 'component_reviews.live_host');
  requireCondition(reviews.live_host.observation_designation_separation_preserved === true, 'host observation/designation separation required');
  requireCondition(reviews.live_host.designation_binding_separation_preserved === true, 'host designation/binding separation required');
  requireCondition(reviews.live_host.binding_activation_separation_preserved === true, 'host binding/activation separation required');
  requireCondition(reviews.live_host.host_designated === false, 'demo cannot designate host');
  requireCondition(reviews.live_host.executor_bound === false, 'demo cannot bind executor');

  validateCommonReview(reviews.game_companion, 'game-companion', 'component_reviews.game_companion');
  assertExactKeys(reviews.game_companion, [...COMMON_REVIEW_KEYS, 'chain_path', 'layer_ids', 'chain_closed', 'pilot_evidence_only'], 'component_reviews.game_companion');
  requireCondition(reviews.game_companion.chain_path === GAME_CHAIN_PATH, 'Game Companion chain path mismatch');
  requireCondition(sameArray(reviews.game_companion.layer_ids, GAME_LAYERS), 'Game Companion layer ordering mismatch');
  requireCondition(reviews.game_companion.chain_closed === true, 'Game Companion chain must be closed');
  requireCondition(reviews.game_companion.pilot_evidence_only === true, 'Game Companion must remain pilot evidence only');

  for (const id of MEMBER_IDS) {
    const member = memberMap.get(id);
    requireCondition(member.core_member === false, `${id} cannot become Core member`);
    requireCondition(member.authority_source === false, `${id} cannot become authority source`);
    requireCondition(member.responsibility_holder === false, `${id} cannot become responsibility holder`);
    requireCondition(member.shared_data_access === false, `${id} cannot gain shared data access`);
    requireCondition(member.external_effect_authorized === false, `${id} cannot authorize external effect`);
  }
  requireCondition(chain.non_effects.background_activity === false, 'Game Companion background activity must remain false');
  return memberMap;
}

function validatePauseRecovery(value) {
  assertExactKeys(value, ['measurement_class', 'sequence', 'background_activity_during_pause', 'pause_creates_successor_authority', 'resume_creates_successor_authority', 'minimal_state_resume'], 'pause_recovery');
  requireCondition(value.measurement_class === 'synthetic_pause_recovery_demo', 'pause/recovery measurement class mismatch');
  const expected = ['ACTIVE_LOCAL_REVIEW', 'PAUSE_REQUESTED', 'PAUSED_NO_BACKGROUND_ACTIVITY', 'RESUME_FROM_MINIMAL_STATE', 'LOCAL_REVIEW_RESUMED'];
  requireCondition(sameArray(value.sequence, expected), 'pause/recovery sequence mismatch');
  requireCondition(value.background_activity_during_pause === false, 'background activity during pause forbidden');
  requireCondition(value.pause_creates_successor_authority === false, 'pause cannot create successor authority');
  requireCondition(value.resume_creates_successor_authority === false, 'resume cannot create successor authority');
  requireCondition(value.minimal_state_resume === true, 'minimal-state resume required');
}

function validateFieldOutcomes(value) {
  assertExactKeys(value, ['measurement_class', 'record_count', 'aggregates', 'excluded_data'], 'field_outcomes');
  requireCondition(value.measurement_class === 'synthetic_privacy_minimized_demo', 'field outcome measurement class mismatch');
  assertInteger(value.record_count, 'field_outcomes.record_count', 1);
  assertExactKeys(value.aggregates, ['bounded_assistance_opportunity_count', 'attention_cue_count', 'pause_count', 'resume_count', 'explicit_human_interruption_count'], 'field_outcomes.aggregates');
  for (const [key, count] of Object.entries(value.aggregates)) assertInteger(count, `field_outcomes.aggregates.${key}`, 0);
  assertExactKeys(value.excluded_data, ['raw_game_history', 'transcripts', 'identity_correlation', 'behavioral_profile', 'psychological_profile', 'mood_profile', 'attention_profile', 'engagement_optimization', 'cross_game_preference_profile', 'total_history_capture'], 'field_outcomes.excluded_data');
  for (const [key, flag] of Object.entries(value.excluded_data)) requireCondition(flag === false, `field_outcomes.excluded_data.${key} must remain false`);
}

function validateMetrics(metrics, manifest) {
  assertExactKeys(metrics, METRIC_KEYS, 'metrics');
  requireCondition(metrics.measurement_class === 'synthetic_demo_metrics', 'metrics must be synthetic_demo_metrics');
  const established = manifest.edges.filter(edge => edge.status === 'established_evidence_dependency').length;
  const planned = manifest.edges.filter(edge => edge.status === 'planned_interface').length;
  const canonicalPathCount = manifest.members.reduce((sum, member) => sum + member.canonical_paths.length, 0);
  requireCondition(metrics.family_member_count === 6, 'family_member_count must equal 6');
  requireCondition(metrics.established_edge_count === established && established === 4, 'established_edge_count mismatch');
  requireCondition(metrics.planned_edge_count === planned && planned === 2, 'planned_edge_count mismatch');
  requireCondition(metrics.canonical_path_count === canonicalPathCount, 'canonical_path_count mismatch');
  requireCondition(metrics.game_companion_layer_count === 7, 'game_companion_layer_count mismatch');
  requireCondition(metrics.human_gate_count === 3, 'human_gate_count must equal 3');
  assertInteger(metrics.human_interruption_count, 'human_interruption_count', 1);
  assertInteger(metrics.pause_event_count, 'pause_event_count', 1);
  assertInteger(metrics.resume_event_count, 'resume_event_count', 1);
  for (const key of ['network_call_count', 'filesystem_write_count', 'external_effect_count', 'runtime_start_count', 'ledger_mutation_count', 'host_designation_count']) {
    requireCondition(metrics[key] === 0, `metrics.${key} must remain zero`);
  }
}

function validateControls(controls) {
  assertExactKeys(controls, CONTROL_KEYS, 'controls');
  requireCondition(controls.local_only === true, 'controls.local_only must be true');
  requireCondition(controls.read_only === true, 'controls.read_only must be true');
  for (const key of CONTROL_KEYS.filter(key => !['local_only', 'read_only'].includes(key))) requireCondition(controls[key] === false, `controls.${key} must remain false`);
}

function validateInput(input, repoRoot = path.resolve(__dirname, '../../../..')) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(input.version === VERSION, `version must be ${VERSION}`);
  requireCondition(input.artifact_type === INPUT_TYPE, `artifact_type must be ${INPUT_TYPE}`);
  assertString(input.demo_id, 'demo_id', /^urn:uu-aap:kontur:consolidated-demo:[a-z0-9][a-z0-9:-]{2,191}$/);
  assertExactKeys(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  requireCondition(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'evaluation repository mismatch');
  assertString(input.evaluation_frontier.revision, 'evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  assertString(input.evaluation_frontier.observed_at, 'evaluation_frontier.observed_at');
  validateFamilyBinding(input.family_binding);
  const { manifest, chain } = loadCanonicalEvidence(repoRoot);
  validateComponentReviews(input.component_reviews, manifest, chain);
  validatePauseRecovery(input.pause_recovery);
  validateFieldOutcomes(input.field_outcomes);
  validateMetrics(input.metrics, manifest);
  validateControls(input.controls);
  requireCondition(input.content_hash === computeContentHash(input), 'input content hash mismatch');
  return { input, manifest, chain };
}

function deriveReceipt(input, repoRoot = path.resolve(__dirname, '../../../..')) {
  const { manifest, chain } = validateInput(input, repoRoot);
  const claims = {};
  for (const key of TRUE_CLAIMS) claims[key] = true;
  for (const key of FALSE_CLAIMS) claims[key] = false;
  const establishedEdges = manifest.edges.filter(edge => edge.status === 'established_evidence_dependency');
  const plannedEdges = manifest.edges.filter(edge => edge.status === 'planned_interface');
  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: deterministicId('urn:uu-aap:kontur:family-consolidation:', { demo_id: input.demo_id, input_hash: input.content_hash }),
    source_input: { demo_id: input.demo_id, input_hash: input.content_hash },
    evaluation_frontier: clone(input.evaluation_frontier),
    state: STATE,
    family_review: {
      family_id: manifest.family.id,
      family_version: manifest.family.version,
      product_contract_hash: PRODUCT_CONTRACT_HASH,
      family_manifest_hash: FAMILY_MANIFEST_HASH,
      member_ids: [...MEMBER_IDS],
      member_count: manifest.members.length,
      established_edge_count: establishedEdges.length,
      planned_edge_count: plannedEdges.length,
      member_roles_remain_distinct: true,
      cross_member_data_access_default: manifest.consolidation_policy.cross_member_data_access_default
    },
    readiness_activation_review: {
      readiness_evidence_available: true,
      readiness_activation_separation_preserved: true,
      human_activation_step_required: true,
      activation_authorized: false,
      activation_performed: false,
      preflight_run: false
    },
    responsibility_lineage_review: {
      kernel_structural_lineage_reviewed: true,
      ledger_append_only_continuity_reviewed: true,
      ledger_recovery_lineage_reviewed: true,
      kernel_activated: false,
      responsibility_accepted: false,
      ledger_mutated: false
    },
    live_host_review: {
      observation_designation_separation_preserved: true,
      designation_binding_separation_preserved: true,
      binding_activation_separation_preserved: true,
      host_designated: false,
      executor_bound: false,
      runtime_started: false
    },
    game_companion_review: {
      chain_contract: chain.contract,
      chain_path: GAME_CHAIN_PATH,
      layer_ids: [...GAME_LAYERS],
      layer_count: GAME_LAYERS.length,
      chain_closed: true,
      pilot_evidence_only: true,
      live_behavior_enabled: false
    },
    pause_recovery_review: clone(input.pause_recovery),
    field_outcome_review: clone(input.field_outcomes),
    synthetic_demo_metrics: clone(input.metrics),
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: NEXT_SAFE_ACTION,
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  assertExactKeys(receipt, RECEIPT_KEYS, 'receipt');
  requireCondition(receipt.protocol === PROTOCOL && receipt.version === VERSION, 'receipt protocol/version mismatch');
  requireCondition(receipt.receipt_type === RECEIPT_TYPE, 'receipt type mismatch');
  assertString(receipt.receipt_id, 'receipt.receipt_id', /^urn:uu-aap:kontur:family-consolidation:[0-9a-f]{24}$/);
  assertExactKeys(receipt.source_input, ['demo_id', 'input_hash'], 'receipt.source_input');
  assertString(receipt.source_input.demo_id, 'receipt.source_input.demo_id');
  assertString(receipt.source_input.input_hash, 'receipt.source_input.input_hash', /^sha256:[0-9a-f]{64}$/);
  assertExactKeys(receipt.evaluation_frontier, FRONTIER_KEYS, 'receipt.evaluation_frontier');
  requireCondition(receipt.evaluation_frontier.repository === 'Matawaka/uu-aap', 'receipt evaluation repository mismatch');
  assertString(receipt.evaluation_frontier.revision, 'receipt.evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  assertString(receipt.evaluation_frontier.observed_at, 'receipt.evaluation_frontier.observed_at');
  requireCondition(receipt.state === STATE, 'receipt state mismatch');
  requireCondition(receipt.next_safe_action === NEXT_SAFE_ACTION, 'receipt next_safe_action mismatch');

  assertExactKeys(receipt.family_review, ['family_id', 'family_version', 'product_contract_hash', 'family_manifest_hash', 'member_ids', 'member_count', 'established_edge_count', 'planned_edge_count', 'member_roles_remain_distinct', 'cross_member_data_access_default'], 'receipt.family_review');
  requireCondition(receipt.family_review.family_id === 'kontur' && receipt.family_review.family_version === '0.1', 'receipt family identity mismatch');
  requireCondition(receipt.family_review.product_contract_hash === PRODUCT_CONTRACT_HASH, 'receipt Product Contract hash mismatch');
  requireCondition(receipt.family_review.family_manifest_hash === FAMILY_MANIFEST_HASH, 'receipt manifest hash mismatch');
  requireCondition(sameArray(receipt.family_review.member_ids, MEMBER_IDS), 'receipt member ids mismatch');
  requireCondition(receipt.family_review.member_count === 6, 'receipt member count mismatch');
  requireCondition(receipt.family_review.established_edge_count === 4 && receipt.family_review.planned_edge_count === 2, 'receipt edge counts mismatch');
  requireCondition(receipt.family_review.member_roles_remain_distinct === true, 'receipt member role distinction lost');
  requireCondition(receipt.family_review.cross_member_data_access_default === 'denied', 'receipt cross-member data default mismatch');

  assertExactKeys(receipt.readiness_activation_review, ['readiness_evidence_available', 'readiness_activation_separation_preserved', 'human_activation_step_required', 'activation_authorized', 'activation_performed', 'preflight_run'], 'receipt.readiness_activation_review');
  requireCondition(receipt.readiness_activation_review.readiness_evidence_available === true, 'receipt readiness evidence missing');
  requireCondition(receipt.readiness_activation_review.readiness_activation_separation_preserved === true, 'receipt readiness/activation separation missing');
  requireCondition(receipt.readiness_activation_review.human_activation_step_required === true, 'receipt human activation step missing');
  for (const key of ['activation_authorized', 'activation_performed', 'preflight_run']) requireCondition(receipt.readiness_activation_review[key] === false, `receipt.${key} must remain false`);

  assertExactKeys(receipt.responsibility_lineage_review, ['kernel_structural_lineage_reviewed', 'ledger_append_only_continuity_reviewed', 'ledger_recovery_lineage_reviewed', 'kernel_activated', 'responsibility_accepted', 'ledger_mutated'], 'receipt.responsibility_lineage_review');
  for (const key of ['kernel_structural_lineage_reviewed', 'ledger_append_only_continuity_reviewed', 'ledger_recovery_lineage_reviewed']) requireCondition(receipt.responsibility_lineage_review[key] === true, `receipt.${key} must be true`);
  for (const key of ['kernel_activated', 'responsibility_accepted', 'ledger_mutated']) requireCondition(receipt.responsibility_lineage_review[key] === false, `receipt.${key} must remain false`);

  assertExactKeys(receipt.live_host_review, ['observation_designation_separation_preserved', 'designation_binding_separation_preserved', 'binding_activation_separation_preserved', 'host_designated', 'executor_bound', 'runtime_started'], 'receipt.live_host_review');
  for (const key of ['observation_designation_separation_preserved', 'designation_binding_separation_preserved', 'binding_activation_separation_preserved']) requireCondition(receipt.live_host_review[key] === true, `receipt.${key} must be true`);
  for (const key of ['host_designated', 'executor_bound', 'runtime_started']) requireCondition(receipt.live_host_review[key] === false, `receipt.${key} must remain false`);

  assertExactKeys(receipt.game_companion_review, ['chain_contract', 'chain_path', 'layer_ids', 'layer_count', 'chain_closed', 'pilot_evidence_only', 'live_behavior_enabled'], 'receipt.game_companion_review');
  requireCondition(receipt.game_companion_review.chain_contract === GAME_CHAIN_CONTRACT, 'receipt Game Companion contract mismatch');
  requireCondition(receipt.game_companion_review.chain_path === GAME_CHAIN_PATH, 'receipt Game Companion path mismatch');
  requireCondition(sameArray(receipt.game_companion_review.layer_ids, GAME_LAYERS), 'receipt Game Companion layer mismatch');
  requireCondition(receipt.game_companion_review.layer_count === 7 && receipt.game_companion_review.chain_closed === true, 'receipt Game Companion chain closure mismatch');
  requireCondition(receipt.game_companion_review.pilot_evidence_only === true, 'receipt Game Companion must remain pilot evidence only');
  requireCondition(receipt.game_companion_review.live_behavior_enabled === false, 'receipt cannot enable live Game Companion behavior');

  validatePauseRecovery(receipt.pause_recovery_review);
  validateFieldOutcomes(receipt.field_outcome_review);
  assertExactKeys(receipt.synthetic_demo_metrics, METRIC_KEYS, 'receipt.synthetic_demo_metrics');
  requireCondition(receipt.synthetic_demo_metrics.measurement_class === 'synthetic_demo_metrics', 'receipt metrics class mismatch');
  for (const key of ['network_call_count', 'filesystem_write_count', 'external_effect_count', 'runtime_start_count', 'ledger_mutation_count', 'host_designation_count']) requireCondition(receipt.synthetic_demo_metrics[key] === 0, `receipt metric ${key} must remain zero`);

  assertExactKeys(receipt.claims, CLAIM_KEYS, 'receipt.claims');
  for (const key of TRUE_CLAIMS) requireCondition(receipt.claims[key] === true, `required claim ${key} must be true`);
  for (const key of FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited claim ${key} must remain false`);
  assertExactStringSet(receipt.non_effects, REQUIRED_NON_EFFECTS, 'receipt.non_effects');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'receipt content hash mismatch');
  return receipt;
}

function validationReceipt(input, repoRoot) {
  const receipt = deriveReceipt(input, repoRoot);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'KONTURConsolidatedDemoValidationReceipt',
    demo_id: input.demo_id,
    input_hash: input.content_hash,
    consolidation_receipt_hash: receipt.content_hash,
    valid: true,
    state: receipt.state,
    next_safe_action: receipt.next_safe_action,
    activation_performed: false,
    runtime_started: false,
    ledger_mutated: false,
    external_effect_performed: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new KONTURConsolidatedDemoError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  assertString(inputPath, 'input path');
  return parseText(inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8'));
}
function usage() {
  return [
    'KONTUR Consolidated Measurable Demo v0.1', '',
    'Usage:',
    '  node products/kontur/v0.1/consolidated-demo/kontur-consolidated-demo.js validate <file|->',
    '  node products/kontur/v0.1/consolidated-demo/kontur-consolidated-demo.js consolidate <file|->',
    '  node products/kontur/v0.1/consolidated-demo/kontur-consolidated-demo.js inspect <file|->',
    '  node products/kontur/v0.1/consolidated-demo/kontur-consolidated-demo.js help', '',
    'Repository-backed read-only evidence consolidation only. No KONTUR activation, runtime start, ledger mutation, host designation or live Game Companion behavior.'
  ].join('\n');
}
function runCli(argv, repoRoot) {
  const command = argv[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  requireCondition(['validate', 'consolidate', 'inspect'].includes(command), `unsupported command: ${command}; allowed commands are validate, consolidate, inspect and help`);
  requireCondition(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input, repoRoot) : deriveReceipt(input, repoRoot);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: 'KONTUR_CONSOLIDATED_DEMO_REJECTED', message: error.message || String(error) })}\n`);
    process.exitCode = 1;
  }
}
if (require.main === module) main();

module.exports = {
  KONTURConsolidatedDemoError,
  PROTOCOL, VERSION, INPUT_TYPE, RECEIPT_TYPE, STATE, NEXT_SAFE_ACTION,
  PRODUCT_CONTRACT_HASH, FAMILY_MANIFEST_HASH, FAMILY_MANIFEST_PATH,
  GAME_CHAIN_PATH, GAME_CHAIN_CONTRACT, GAME_LAYERS, MEMBER_IDS,
  TRUE_CLAIMS, FALSE_CLAIMS, CLAIM_KEYS, REQUIRED_NON_EFFECTS,
  INPUT_KEYS, FRONTIER_KEYS, FAMILY_BINDING_KEYS, COMPONENT_KEYS,
  METRIC_KEYS, CONTROL_KEYS, RECEIPT_KEYS,
  canonicalize, computeContentHash, rehash, loadCanonicalEvidence,
  validateInput, deriveReceipt, validateReceipt, validationReceipt,
  parseText, readInput, usage, runCli
};
