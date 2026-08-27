'use strict';

const fs = require('fs');
const path = require('path');
const {
  IALCompactError,
  computeContentHash,
  rehash,
  parseText,
  validateEnvelope,
  inspectEnvelope,
  validationReceipt,
  runCli
} = require('./ial-compact.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(__dirname, 'examples');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readExample(name) {
  return readJson(path.join(EXAMPLES, name));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function byId(items, id) {
  return items.find(item => item.id === id);
}

function expectReject(base, name, mutate, rehashAfter = true) {
  const candidate = clone(base);
  mutate(candidate);
  if (rehashAfter) rehash(candidate);
  let rejected = false;
  try {
    validateEnvelope(candidate);
  } catch (error) {
    rejected = error instanceof IALCompactError;
  }
  assert(rejected, `unsafe mutation unexpectedly passed: ${name}`);
}

function buildE2(base) {
  const envelope = clone(base);
  envelope.envelope_id = 'synthetic-e2-responsibility-handoff-001';
  envelope.intent.statement = 'Offer one exact bounded analysis responsibility scope to a named receiving party for separate acceptance.';
  envelope.target.kind = 'external_resource_candidate';
  envelope.target.identifier = 'urn:uu-aap:synthetic:handoff-candidate:001';
  envelope.boundary = {
    elevation_level: 'E2',
    effect_class: 'responsibility_handoff',
    observable_effect: true,
    responsibility_handoff: true,
    materialization_commitment: false
  };
  envelope.responsibility.receiving_party_id = 'urn:uu-aap:party:synthetic-receiver';
  envelope.responsibility.handoff_scope = [
    'Prepare one bounded candidate under the unchanged product contract and frontier'
  ];
  envelope.requested_operation = {
    operation_class: 'handoff_candidate',
    verb: 'offer-responsibility-handoff',
    description: 'Inspect whether the exact responsibility handoff requires the full IAL handoff chain and explicit acceptance.',
    external_mutation_requested: false
  };
  return rehash(envelope);
}

function buildE3(base, withHandoff = false) {
  const envelope = clone(base);
  envelope.envelope_id = withHandoff
    ? 'synthetic-e3-materialization-handoff-001'
    : 'synthetic-e3-materialization-candidate-001';
  envelope.intent.statement = 'Inspect one exact materialization candidate without granting execution admission or materialization permission.';
  envelope.target.kind = 'canonical_state_candidate';
  envelope.target.identifier = 'urn:uu-aap:synthetic:canonical-state-candidate:001';
  envelope.boundary = {
    elevation_level: 'E3',
    effect_class: 'materialization_candidate',
    observable_effect: true,
    responsibility_handoff: withHandoff,
    materialization_commitment: true
  };
  envelope.responsibility.receiving_party_id = withHandoff
    ? 'urn:uu-aap:party:synthetic-materializer'
    : null;
  envelope.responsibility.handoff_scope = withHandoff
    ? ['Attempt one separately permitted exact materialization after full downstream admission']
    : [];
  envelope.requested_operation = {
    operation_class: 'materialization_candidate',
    verb: 'inspect-materialization-candidate',
    description: 'Inspect downstream handoff, Action Gate, permission and observation requirements without executing the candidate.',
    external_mutation_requested: true
  };
  return rehash(envelope);
}

const marketer = readExample('marketer-pessimist-e0.envelope.json');
const hiring = readExample('honest-hiring-e1.envelope.json');

// Positive exact consumer bindings.
for (const envelope of [marketer, hiring]) {
  validateEnvelope(envelope);
  assert(envelope.identity.content_hash === computeContentHash(envelope), `${envelope.envelope_id}: hash mismatch`);
  const contractPath = path.join(ROOT, envelope.consumer.product_contract_path);
  const contract = readJson(contractPath);
  assert(contract.product.id === envelope.consumer.product_id, `${envelope.envelope_id}: product id binding mismatch`);
  assert(contract.product.version === envelope.consumer.product_version, `${envelope.envelope_id}: product version binding mismatch`);
  assert(contract.identity.content_hash === envelope.consumer.product_contract_hash, `${envelope.envelope_id}: product contract hash mismatch`);
}

const marketerInspection = inspectEnvelope(marketer);
assert(marketerInspection.status === 'IAL_NOT_REQUIRED', 'E0 status must be IAL_NOT_REQUIRED');
assert(marketerInspection.elevation_level === 'E0', 'E0 level drift');
assert(marketerInspection.requirements.full_handoff_chain_required === false, 'E0 must not require handoff chain');
assert(marketerInspection.requirements.downstream_action_gate_required === false, 'E0 must not infer downstream action gate');
assert(marketerInspection.claims.responsibility_boundary_required === false, 'E0 must not establish responsibility boundary');
assert(marketerInspection.claims.execution_admitted === false, 'E0 must not admit execution');

const hiringInspection = inspectEnvelope(hiring);
assert(hiringInspection.status === 'ELEVATED', 'E1 status must be ELEVATED');
assert(hiringInspection.elevation_level === 'E1', 'E1 level drift');
assert(hiringInspection.requirements.full_handoff_chain_required === false, 'E1 must not require handoff chain');
assert(hiringInspection.requirements.downstream_action_gate_required === true, 'E1 must preserve downstream action gate');
assert(hiringInspection.claims.responsibility_boundary_required === true, 'E1 must identify observable boundary');
assert(hiringInspection.claims.responsibility_handoff_requested === false, 'E1 must not infer handoff');
assert(hiringInspection.claims.execution_admitted === false, 'E1 must not admit execution');

const e2 = buildE2(marketer);
validateEnvelope(e2);
const e2Inspection = inspectEnvelope(e2);
assert(e2Inspection.status === 'ELEVATED', 'E2 status must be ELEVATED');
assert(e2Inspection.requirements.full_handoff_chain_required === true, 'E2 must require full handoff chain');
assert(e2Inspection.requirements.explicit_responsibility_acceptance_required === true, 'E2 must require explicit acceptance');
assert(e2Inspection.claims.responsibility_handoff_requested === true, 'E2 handoff candidate missing');
assert(e2Inspection.claims.responsibility_accepted === false, 'E2 compact envelope must not accept responsibility');

const e3 = buildE3(hiring, false);
validateEnvelope(e3);
const e3Inspection = inspectEnvelope(e3);
assert(e3Inspection.status === 'ELEVATED', 'E3 status must be ELEVATED');
assert(e3Inspection.requirements.materialization_permission_required === true, 'E3 must require materialization permission');
assert(e3Inspection.requirements.downstream_action_gate_required === true, 'E3 must require downstream Action Gate');
assert(e3Inspection.claims.materialization_candidate === true, 'E3 materialization candidate missing');
assert(e3Inspection.claims.materialization_permitted === false, 'E3 compact envelope must not permit materialization');
assert(e3Inspection.claims.canonical_state_established === false, 'E3 compact envelope must not establish canonical state');

const e3Handoff = buildE3(hiring, true);
validateEnvelope(e3Handoff);
const e3HandoffInspection = inspectEnvelope(e3Handoff);
assert(e3HandoffInspection.requirements.full_handoff_chain_required === true, 'E3 handoff must require full handoff chain');
assert(e3HandoffInspection.requirements.explicit_responsibility_acceptance_required === true, 'E3 handoff must require explicit acceptance');

// CLI is parse/validate/inspect only.
const validation = validationReceipt(marketer);
assert(validation.valid === true, 'validation receipt must be valid');
assert(validation.action_permit_created === false, 'validation must not create ActionPermit');
assert(validation.execution_admitted === false, 'validation must not admit execution');
const help = runCli(['help']);
assert(help.exitCode === 0 && /no execute command/i.test(help.text), 'help must state no execute command');
let executeRejected = false;
try {
  runCli(['execute', path.join(EXAMPLES, 'marketer-pessimist-e0.envelope.json')]);
} catch (error) {
  executeRejected = error instanceof IALCompactError && /unsupported command/.test(error.message);
}
assert(executeRejected, 'execute command must be rejected');
let malformedRejected = false;
try {
  parseText('{not-json');
} catch (error) {
  malformedRejected = error instanceof IALCompactError;
}
assert(malformedRejected, 'malformed JSON must be rejected');

const mutations = [
  ['protocol drift', marketer, d => { d.protocol = 'OTHER'; }, true],
  ['version drift', marketer, d => { d.version = '0.2'; }, true],
  ['profile drift', marketer, d => { d.profile = 'execute-profile'; }, true],
  ['extra top-level key', marketer, d => { d.execute = true; }, true],
  ['invalid envelope id', marketer, d => { d.envelope_id = 'INVALID ID'; }, true],
  ['content hash mismatch', marketer, d => { d.identity.content_hash = `sha256:${'0'.repeat(64)}`; }, false],
  ['frontier revision format drift', marketer, d => { d.frontier.revision = '0'.repeat(39); }, true],
  ['consumer product substitution', marketer, d => { d.consumer.product_id = 'other-product'; }, true],
  ['consumer contract path substitution', marketer, d => { d.consumer.product_contract_path = 'products/honest-hiring/v0.1/product-contract.json'; }, true],
  ['consumer contract digest substitution', marketer, d => { d.consumer.product_contract_hash = `sha256:${'1'.repeat(64)}`; }, true],
  ['remove product contract evidence', marketer, d => { d.evidence.refs = d.evidence.refs.filter(ref => ref.kind !== 'product_contract'); }, true],
  ['duplicate product contract evidence', marketer, d => { d.evidence.refs.push(clone(d.evidence.refs[0])); d.evidence.refs[2].id = 'duplicate-contract'; }, true],
  ['product contract evidence digest mismatch', marketer, d => { byId(d.evidence.refs, 'marketer-pessimist-contract').digest = `sha256:${'2'.repeat(64)}`; }, true],
  ['duplicate evidence id', marketer, d => { d.evidence.refs[1].id = d.evidence.refs[0].id; }, true],
  ['private reasoning included', marketer, d => { d.evidence.private_reasoning_included = true; }, true],
  ['authority evidence injected', marketer, d => { d.authority_refs.authority_evidence_ref = 'authority:1'; }, true],
  ['ActionPermit injected', marketer, d => { d.authority_refs.action_permit_ref = 'permit:1'; }, true],
  ['execution admission injected', marketer, d => { d.authority_refs.execution_admission_ref = 'admission:1'; }, true],
  ['materialization permission injected', marketer, d => { d.authority_refs.materialization_permission_ref = 'permission:1'; }, true],
  ['acceptance ref injected', marketer, d => { d.responsibility.acceptance_ref = 'acceptance:1'; }, true],
  ['execute command enabled', marketer, d => { d.controls.execute_command_available = true; }, true],
  ['network required', marketer, d => { d.controls.network_access_required = true; }, true],
  ['filesystem write required', marketer, d => { d.controls.filesystem_write_required = true; }, true],
  ['responsibility accepted', marketer, d => { d.controls.responsibility_accepted = true; }, true],
  ['execution admitted', marketer, d => { d.controls.execution_admitted = true; }, true],
  ['materialization permitted', marketer, d => { d.controls.materialization_permitted = true; }, true],
  ['separate gate removed', marketer, d => { d.controls.external_effect_requires_separate_gate = false; }, true],
  ['observe-before-retry removed', marketer, d => { d.controls.observe_before_retry = false; }, true],
  ['automatic retry enabled', marketer, d => { d.controls.automatic_retry_on_unknown = true; }, true],
  ['required assertion removed', marketer, d => { d.assertions.shift(); }, true],
  ['required non-effect removed', marketer, d => { d.non_effects.shift(); }, true],
  ['invalid intent origin', marketer, d => { d.intent.origin = 'inferred_authority'; }, true],
  ['empty intent scope', marketer, d => { d.intent.scope = []; }, true],
  ['empty non-goals', marketer, d => { d.intent.non_goals = []; }, true],
  ['invalid target kind', marketer, d => { d.target.kind = 'live_actuator'; }, true],
  ['invalid evidence digest', marketer, d => { d.evidence.refs[1].digest = 'not-a-digest'; }, true],
  ['E0 observable effect', marketer, d => { d.boundary.observable_effect = true; }, true],
  ['E0 responsibility handoff', marketer, d => { d.boundary.responsibility_handoff = true; }, true],
  ['E0 materialization', marketer, d => { d.boundary.materialization_commitment = true; }, true],
  ['E0 effect class drift', marketer, d => { d.boundary.effect_class = 'observable_output'; }, true],
  ['E0 operation class drift', marketer, d => { d.requested_operation.operation_class = 'display_candidate'; }, true],
  ['E0 external mutation', marketer, d => { d.requested_operation.external_mutation_requested = true; }, true],
  ['E0 receiving party', marketer, d => { d.responsibility.receiving_party_id = 'urn:party:receiver'; }, true],
  ['E0 handoff scope', marketer, d => { d.responsibility.handoff_scope = ['scope']; }, true],
  ['E1 not observable', hiring, d => { d.boundary.observable_effect = false; }, true],
  ['E1 responsibility handoff', hiring, d => { d.boundary.responsibility_handoff = true; }, true],
  ['E1 materialization', hiring, d => { d.boundary.materialization_commitment = true; }, true],
  ['E1 effect class drift', hiring, d => { d.boundary.effect_class = 'internal_analysis'; }, true],
  ['E1 operation class drift', hiring, d => { d.requested_operation.operation_class = 'local_analysis'; }, true],
  ['E1 receiving party', hiring, d => { d.responsibility.receiving_party_id = 'urn:party:receiver'; }, true],
  ['E1 handoff scope', hiring, d => { d.responsibility.handoff_scope = ['scope']; }, true],
  ['E2 receiving party removed', e2, d => { d.responsibility.receiving_party_id = null; }, true],
  ['E2 empty handoff scope', e2, d => { d.responsibility.handoff_scope = []; }, true],
  ['E2 handoff flag removed', e2, d => { d.boundary.responsibility_handoff = false; }, true],
  ['E2 materialization added', e2, d => { d.boundary.materialization_commitment = true; }, true],
  ['E2 effect class drift', e2, d => { d.boundary.effect_class = 'observable_output'; }, true],
  ['E2 operation class drift', e2, d => { d.requested_operation.operation_class = 'display_candidate'; }, true],
  ['E3 materialization removed', e3, d => { d.boundary.materialization_commitment = false; }, true],
  ['E3 observable effect removed', e3, d => { d.boundary.observable_effect = false; }, true],
  ['E3 effect class drift', e3, d => { d.boundary.effect_class = 'responsibility_handoff'; }, true],
  ['E3 operation class drift', e3, d => { d.requested_operation.operation_class = 'handoff_candidate'; }, true],
  ['E3 receiver without handoff', e3, d => { d.responsibility.receiving_party_id = 'urn:party:receiver'; }, true],
  ['E3 scope without handoff', e3, d => { d.responsibility.handoff_scope = ['scope']; }, true],
  ['E3 handoff without receiver', e3Handoff, d => { d.responsibility.receiving_party_id = null; }, true],
  ['E3 handoff without scope', e3Handoff, d => { d.responsibility.handoff_scope = []; }, true]
];

for (const [name, base, mutate, rehashAfter] of mutations) {
  expectReject(base, name, mutate, rehashAfter);
}

const outputDirectory = process.argv[2] || '/tmp/ial-compact';
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'marketer-pessimist-e0.inspection.json'), `${JSON.stringify(marketerInspection, null, 2)}\n`);
fs.writeFileSync(path.join(outputDirectory, 'honest-hiring-e1.inspection.json'), `${JSON.stringify(hiringInspection, null, 2)}\n`);
fs.writeFileSync(path.join(outputDirectory, 'synthetic-e2.inspection.json'), `${JSON.stringify(e2Inspection, null, 2)}\n`);
fs.writeFileSync(path.join(outputDirectory, 'synthetic-e3.inspection.json'), `${JSON.stringify(e3Inspection, null, 2)}\n`);

console.log(JSON.stringify({
  suite: 'IAL Compact Envelope and read-only CLI v0.1',
  positive_product_consumers: ['marketer-pessimist', 'honest-hiring'],
  positive_elevation_levels: ['E0', 'E1', 'E2', 'E3'],
  fail_closed_mutations_rejected: mutations.length,
  execute_command_available: false,
  network_access_required: false,
  output_directory: outputDirectory,
  stronger_claims_preserved_false: true
}, null, 2));
