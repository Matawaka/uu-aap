'use strict';

const fs = require('node:fs');

const VERSION = '0.2';
const ARTIFACT_TYPE = 'UU-AAP-Release-Candidate-Checkpoint';
const INPUT_ARTIFACT_TYPE = 'UU-AAP-Release-Candidate-Checkpoint-Input';

const ENGINEERING_GATES = Object.freeze([
  'component_manifest',
  'dependency_impact_graph',
  'conformance_parity',
  'generated_conformance_runner',
  'execution_evidence_parity',
  'bounded_ci_migration',
  'receipt_runtime',
  'implementation_substitution',
]);

const GOVERNANCE_GATES = Object.freeze([
  'security',
  'privacy',
  'accessibility',
  'contestability',
  'ru_en_semantic_navigation_parity',
]);

const ENGINEERING_STATUSES = new Set(['PASS', 'INSUFFICIENT_EVIDENCE']);
const GOVERNANCE_STATUSES = new Set(['PASS', 'PRESENT_UNVERIFIED', 'MISSING', 'INSUFFICIENT_EVIDENCE']);

const NON_EFFECTS = Object.freeze([
  'checkpoint_assessment_does_not_release',
  'checkpoint_assessment_does_not_publish',
  'checkpoint_assessment_does_not_create_authority',
  'checkpoint_assessment_does_not_certify',
  'readiness_does_not_prove_legal_status',
  'technical_pass_does_not_imply_governance_pass',
  'artifact_presence_does_not_prove_review_outcome',
  'historical_review_does_not_prove_current_frontier_review',
  'checkpoint_assessment_does_not_activate_runtime',
  'checkpoint_assessment_does_not_authorize_ci_narrowing',
]);

class ReleaseCandidateCheckpointError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReleaseCandidateCheckpointError';
    this.code = code;
  }
}

function assert(condition, code, message) {
  if (!condition) throw new ReleaseCandidateCheckpointError(code, message);
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function assertExactGateSet(items, expectedIds, label) {
  assert(Array.isArray(items), 'INVALID_GATE_LIST', `${label} must be an array`);
  const ids = items.map((item) => item && item.gate_id);
  assert(ids.every((id) => typeof id === 'string'), 'INVALID_GATE_ID', `${label} gate_id must be a string`);
  assert(new Set(ids).size === ids.length, 'DUPLICATE_GATE', `${label} contains a duplicate gate_id`);
  const expected = new Set(expectedIds);
  const unknown = ids.filter((id) => !expected.has(id));
  const missing = expectedIds.filter((id) => !ids.includes(id));
  assert(unknown.length === 0, 'UNKNOWN_GATE', `${label} contains unknown gates: ${unknown.join(', ')}`);
  assert(missing.length === 0, 'MISSING_GATE', `${label} is missing gates: ${missing.join(', ')}`);
}

function validateEngineeringGate(gate, frontier) {
  assert(ENGINEERING_STATUSES.has(gate.status), 'INVALID_ENGINEERING_STATUS', `invalid engineering status for ${gate.gate_id}`);
  assert(typeof gate.blocking === 'boolean', 'INVALID_BLOCKING_FLAG', `blocking must be boolean for ${gate.gate_id}`);
  assert(typeof gate.source_path === 'string' && gate.source_path.length > 0, 'INVALID_SOURCE_PATH', `source_path required for ${gate.gate_id}`);
  assert(isSha(gate.source_revision), 'INVALID_SOURCE_REVISION', `source_revision must be 40-hex for ${gate.gate_id}`);
  assert(gate.observed_at_revision === frontier, 'STALE_ENGINEERING_OBSERVATION', `engineering observation is not bound to frontier for ${gate.gate_id}`);
  assert(typeof gate.source_present_at_frontier === 'boolean', 'INVALID_SOURCE_PRESENCE', `source_present_at_frontier must be boolean for ${gate.gate_id}`);
  assert(typeof gate.source_ancestor_verified === 'boolean', 'INVALID_ANCESTRY_EVIDENCE', `source_ancestor_verified must be boolean for ${gate.gate_id}`);
  assert(typeof gate.conformance_evidence_verified === 'boolean', 'INVALID_CONFORMANCE_EVIDENCE', `conformance_evidence_verified must be boolean for ${gate.gate_id}`);
  if (gate.status === 'PASS') {
    assert(gate.source_present_at_frontier, 'ENGINEERING_PASS_WITHOUT_SOURCE', `PASS requires source presence for ${gate.gate_id}`);
    assert(gate.source_ancestor_verified, 'ENGINEERING_PASS_WITHOUT_ANCESTRY', `PASS requires verified ancestry for ${gate.gate_id}`);
    assert(gate.conformance_evidence_verified, 'ENGINEERING_PASS_WITHOUT_CONFORMANCE', `PASS requires conformance evidence for ${gate.gate_id}`);
  }
}

function validateGovernanceGate(gate, frontier) {
  assert(GOVERNANCE_STATUSES.has(gate.status), 'INVALID_GOVERNANCE_STATUS', `invalid governance status for ${gate.gate_id}`);
  assert(typeof gate.blocking === 'boolean', 'INVALID_BLOCKING_FLAG', `blocking must be boolean for ${gate.gate_id}`);
  assert(gate.observed_at_revision === frontier, 'STALE_GOVERNANCE_OBSERVATION', `governance observation is not bound to frontier for ${gate.gate_id}`);
  assert(typeof gate.explicit_review_outcome === 'boolean', 'INVALID_REVIEW_OUTCOME_FLAG', `explicit_review_outcome must be boolean for ${gate.gate_id}`);
  if (gate.status === 'MISSING') {
    assert(gate.source_path === null, 'MISSING_WITH_SOURCE', `MISSING must not claim source_path for ${gate.gate_id}`);
    assert(gate.reviewed_revision === null, 'MISSING_WITH_REVIEW_REVISION', `MISSING must not claim reviewed_revision for ${gate.gate_id}`);
    assert(gate.explicit_review_outcome === false, 'MISSING_WITH_OUTCOME', `MISSING must not claim explicit outcome for ${gate.gate_id}`);
    return;
  }
  assert(typeof gate.source_path === 'string' && gate.source_path.length > 0, 'INVALID_SOURCE_PATH', `source_path required for ${gate.gate_id}`);
  if (gate.status === 'PRESENT_UNVERIFIED') {
    assert(gate.explicit_review_outcome === false, 'UNVERIFIED_WITH_OUTCOME', `PRESENT_UNVERIFIED cannot claim explicit outcome for ${gate.gate_id}`);
  }
  if (gate.status === 'PASS') {
    assert(gate.explicit_review_outcome === true, 'PASS_WITHOUT_REVIEW_OUTCOME', `PASS requires explicit review outcome for ${gate.gate_id}`);
    assert(gate.reviewed_revision === frontier, 'HISTORICAL_REVIEW_AS_CURRENT', `PASS requires review bound to exact current frontier for ${gate.gate_id}`);
  } else if (gate.reviewed_revision !== null) {
    assert(isSha(gate.reviewed_revision), 'INVALID_REVIEW_REVISION', `reviewed_revision must be null or 40-hex for ${gate.gate_id}`);
  }
}

function validateInput(input) {
  assert(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_INPUT', 'input must be an object');
  assert(input.artifact_type === INPUT_ARTIFACT_TYPE, 'INVALID_ARTIFACT_TYPE', `artifact_type must be ${INPUT_ARTIFACT_TYPE}`);
  assert(input.version === VERSION, 'INVALID_VERSION', `version must be ${VERSION}`);
  assert(isSha(input.git_revision), 'INVALID_GIT_REVISION', 'git_revision must be a lowercase 40-hex SHA');
  assertExactGateSet(input.engineering_evidence, ENGINEERING_GATES, 'engineering_evidence');
  assertExactGateSet(input.governance_evidence, GOVERNANCE_GATES, 'governance_evidence');
  for (const gate of input.engineering_evidence) validateEngineeringGate(gate, input.git_revision);
  for (const gate of input.governance_evidence) validateGovernanceGate(gate, input.git_revision);
  return input;
}

function ordered(items, order) {
  const byId = new Map(items.map((item) => [item.gate_id, item]));
  return order.map((id) => ({ ...byId.get(id) }));
}

function assess(input) {
  validateInput(input);
  const engineering = ordered(input.engineering_evidence, ENGINEERING_GATES);
  const governance = ordered(input.governance_evidence, GOVERNANCE_GATES);
  const blockingFindings = [...engineering, ...governance].filter((gate) => gate.blocking).map((gate) => gate.gate_id);
  const engineeringStatus = engineering.every((gate) => gate.status === 'PASS') ? 'PASS' : 'INSUFFICIENT_EVIDENCE';
  const governanceStatus = governance.every((gate) => gate.status === 'PASS') ? 'PASS' : 'REVIEW_PENDING';
  let decision;
  if (blockingFindings.length > 0) decision = 'BLOCKED';
  else if (engineeringStatus !== 'PASS') decision = 'INSUFFICIENT_EVIDENCE';
  else if (governanceStatus !== 'PASS') decision = 'RELEASE_CANDIDATE_REVIEW_PENDING';
  else decision = 'READY';
  return {
    artifact_type: ARTIFACT_TYPE,
    version: VERSION,
    git_revision: input.git_revision,
    predecessor_checkpoint: 'docs/PROJECT-READINESS-CHECKPOINT-v0.1.md',
    engineering: { status: engineeringStatus, gates: engineering },
    governance: { status: governanceStatus, gates: governance },
    blocking_findings: blockingFindings,
    decision,
    assurance_escalated: false,
    release_authorized: false,
    publication_authorized: false,
    certification_granted: false,
    legal_status_established: false,
    authority_created: false,
    runtime_activated: false,
    ci_narrowing_authorized: false,
    future_evolution_allowed: true,
    non_effects: [...NON_EFFECTS],
  };
}

function runCli(argv = process.argv.slice(2)) {
  assert(argv.length === 1, 'USAGE', 'usage: node release-candidate-checkpoint.js <input.json>');
  const input = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
  process.stdout.write(`${JSON.stringify(assess(input), null, 2)}\n`);
}

if (require.main === module) {
  try { runCli(); }
  catch (error) {
    process.stderr.write(`${error.code || error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { VERSION, ARTIFACT_TYPE, INPUT_ARTIFACT_TYPE, ENGINEERING_GATES, GOVERNANCE_GATES, NON_EFFECTS, ReleaseCandidateCheckpointError, validateInput, assess, runCli };
