'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../../..');
const DELTA_PATH = path.join(__dirname, 'interface-registry-delta.json');
const V02_PATH = 'protocols/interface-registry/v0.2/interface-registry-delta.json';
const V02_BLOB = 'ad705523bada7f64a04e09e34974407725942976';
const PROFILE_PATH = 'protocols/integration/observation-set-calculus-candidate/v0.1/profile.py';
const PROFILE_BLOB = '280624ae6a59fa7a199e3419254765a85e78637a';
const ASSESSMENT_PATH = 'tooling/observation-set-admission-audit/v0.2/assessment.json';
const ASSESSMENT_BLOB = '8404a4d35fa1b6966e418d1c133f4c798e69d8a4';
const PROOF_PATH = 'tooling/observation-set-calculus-two-domain-proof/v0.1/prove.py';
const PROOF_BLOB = '2cd03641d5d17f1122cce97a091fa1bd4dbe5ba3';
const v02 = require('../v0.2/validate-interface-registry-v0.2.js');

const EXPECTED_ENTRY = {
  id: 'ObservationSet',
  version: '0.1',
  status: 'experimental',
  path: 'protocols/integration/observation-set-calculus-candidate/v0.1',
  inputs: [
    'scope_binding_sha256',
    'observations[] { semantic_fingerprint_sha256, source_binding_sha256 }'
  ],
  outputs: [
    'ObservationSet receipt',
    'semantic set fingerprint',
    'exact-input fingerprint',
    'duplicate-safe observation multiplicity'
  ],
  dependencies: [],
  non_effects: [
    'observed set != complete world state',
    'semantic identity != exact source representation',
    'set membership != truth',
    'set membership != authority',
    'set membership != admission or disposition',
    'set membership != action authorization',
    'experimental registry entry != Stable Core',
    'registry entry != published release'
  ],
  next_interfaces: [],
  provider_neutral: true,
  external_effect_emission: false,
  next_interfaces_are_automatic: false
};
const REQUIRED_NON_CLAIMS = [
  'published_release_status',
  'stable_core_membership',
  'automatic_transition_authorized',
  'external_effect_performed',
  'authority_created',
  'transition_interface_admitted',
  'chain_interface_admitted',
  'monolithic_calculus_admitted'
];
const EXPECTED_SCOPE = {
  admitted_interface_id: 'ObservationSet',
  admitted_api: 'evaluate_set',
  implementation_path: PROFILE_PATH,
  implementation_blob: PROFILE_BLOB,
  admission_assessment_path: ASSESSMENT_PATH,
  admission_assessment_blob: ASSESSMENT_BLOB,
  direct_reuse_proof_path: PROOF_PATH,
  direct_reuse_proof_blob: PROOF_BLOB,
  independent_consumer_families: [
    'C2PA_AUTHORITY_OBSERVABILITY',
    'PUBLIC_REVIEW_EXTERNAL_SOURCE_OBSERVATION'
  ],
  deferred_apis: ['evaluate_transition', 'evaluate_chain'],
  monolithic_candidate_admitted: false,
  stable_core_admitted: false
};

function fail(message) { throw new Error(message); }
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function run(cmd, args) {
  const result = cp.spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`${cmd} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return (result.stdout || '').trim();
}
function exactBlob(rel, expected) {
  const actual = run('git', ['rev-parse', `HEAD:${rel}`]);
  if (actual !== expected) fail(`exact blob drift ${rel}: ${actual} != ${expected}`);
}
function assertAdmissionEvidence() {
  exactBlob(V02_PATH, V02_BLOB);
  exactBlob(PROFILE_PATH, PROFILE_BLOB);
  exactBlob(ASSESSMENT_PATH, ASSESSMENT_BLOB);
  exactBlob(PROOF_PATH, PROOF_BLOB);

  const assessment = readJson(ASSESSMENT_PATH);
  const byId = new Map(assessment.api_assessments.map(item => [item.id, item]));
  const set = byId.get('ObservationSet');
  const transition = byId.get('ObservationSetTransition');
  const chain = byId.get('LocalObservationSetChain');
  if (!set || set.decision !== 'ELIGIBLE_EXPERIMENTAL_INTERFACE_ADMISSION' || set.independent_direct_consumer_families !== 2) fail('ObservationSet admission evidence invalid');
  if (!transition || transition.decision !== 'DEFER_SECOND_DOMAIN_DIRECT_REUSE' || transition.independent_direct_consumer_families !== 1) fail('Transition defer evidence invalid');
  if (!chain || chain.decision !== 'DEFER_SECOND_DOMAIN_DIRECT_REUSE' || chain.independent_direct_consumer_families !== 1) fail('Chain defer evidence invalid');
  if (assessment.package_assessment.monolithic_registry_admission_eligible !== false || assessment.package_assessment.set_only_registry_admission_eligible !== true) fail('package split admission evidence invalid');
  if (assessment.overall_result !== 'PARTIAL_ADMISSION_ELIGIBLE_SET_ONLY_NO_CORE_ADMISSION') fail('unexpected #912 overall result');

  const proof = JSON.parse(run('python', [PROOF_PATH]));
  if (proof.direct_reuse.direct_shared_implementation_reuse_proven !== true || proof.direct_reuse.independent_adapter_count !== 2) fail('two-domain direct reuse proof invalid');
  if (proof.adapters.c2pa.set_reuse !== true || proof.adapters.public_review.set_reuse !== true) fail('two independent set consumers not proven');
  if (proof.adapters.public_review.transition_reuse !== false || proof.adapters.public_review.chain_reuse !== false) fail('Public Review must not be promoted to transition/chain consumer');
  if (proof.admission.stable_core_admission_performed !== false || proof.admission.interface_registry_admission_performed !== false) fail('historical proof unexpectedly performed admission');
}
function validateDelta(delta, effectiveV02, { checkPaths = true, checkEvidence = true } = {}) {
  if (delta.artifact_type !== 'ReusableProtocolInterfaceRegistryDelta' || delta.version !== '0.3' || delta.release_registry_equivalent !== false) fail('v0.3 delta identity invalid');
  if (!delta.base_registry || delta.base_registry.version !== '0.2' || delta.base_registry.path !== V02_PATH || delta.base_registry.blob !== V02_BLOB) fail('v0.2 predecessor binding invalid');
  if (!Array.isArray(delta.additions) || delta.additions.length !== 1) fail('exactly one v0.3 addition required');
  const entry = delta.additions[0];
  if (!same(entry, EXPECTED_ENTRY)) fail('ObservationSet typed interface contract drift');
  if (checkPaths && !fs.existsSync(path.join(ROOT, entry.path))) fail('ObservationSet implementation path missing');

  const existing = new Set(effectiveV02.entries.map(item => item.id));
  if (existing.has(entry.id)) fail('ObservationSet duplicates predecessor interface id');
  for (const forbidden of ['ObservationSetTransition', 'LocalObservationSetChain', 'ObservationSetCalculusCandidate']) {
    if (delta.additions.some(item => item.id === forbidden)) fail(`forbidden interface admitted: ${forbidden}`);
  }
  if (!same(delta.admission_scope, EXPECTED_SCOPE)) fail('set-only admission scope drift');
  if (delta.effective_entry_count !== effectiveV02.entries.length + 1 || delta.effective_entry_count !== 18) fail('effective entry count drift');
  if (!Array.isArray(delta.non_claims) || delta.non_claims.length !== REQUIRED_NON_CLAIMS.length || new Set(delta.non_claims).size !== delta.non_claims.length) fail('v0.3 non_claims invalid');
  for (const item of REQUIRED_NON_CLAIMS) if (!delta.non_claims.includes(item)) fail(`missing non-claim ${item}`);
  if (checkEvidence) assertAdmissionEvidence();

  return {
    artifact_type: 'ReusableProtocolInterfaceRegistryEffectiveView',
    version: '0.3',
    predecessor_version: '0.2',
    release_registry_equivalent: false,
    entries: [...effectiveV02.entries, entry],
    admission_scope: delta.admission_scope,
    non_claims: [...new Set([...effectiveV02.non_claims, ...delta.non_claims])]
  };
}
function validateRepository(outputPath) {
  const effectiveV02 = v02.validateRepository();
  exactBlob(V02_PATH, V02_BLOB);
  const delta = readJson('protocols/interface-registry/v0.3/interface-registry-delta.json');
  const effective = validateDelta(delta, effectiveV02, { checkPaths: true, checkEvidence: true });
  if (outputPath) fs.writeFileSync(outputPath, JSON.stringify(effective, null, 2) + '\n');
  console.log(JSON.stringify({
    version: '0.3',
    predecessor_entries: effectiveV02.entries.length,
    additions: 1,
    admitted_interface: 'ObservationSet',
    admitted_api: 'evaluate_set',
    deferred_apis: ['evaluate_transition', 'evaluate_chain'],
    effective_entries: effective.entries.length,
    status: 'experimental',
    stable_core_admitted: false,
    release_registry_equivalent: false
  }, null, 2));
  return effective;
}

if (require.main === module) validateRepository(process.argv[2]);
module.exports = { validateDelta, validateRepository, EXPECTED_ENTRY, EXPECTED_SCOPE, REQUIRED_NON_CLAIMS };
