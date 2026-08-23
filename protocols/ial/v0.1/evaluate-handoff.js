'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { verifyAttestation } = require('../../attestation/v0.1/verify-attestation.js');

const here = __dirname;
const repoRoot = path.resolve(here, '../../..');
const registryPath = path.resolve(repoRoot, 'protocols/registry/v0.1/registry.json');

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function safePath(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.split('/').includes('..');
}

function exactKeys(object, keys, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label}: expected object`);
  for (const key of keys) assert(Object.prototype.hasOwnProperty.call(object, key), `${label}: missing ${key}`);
  for (const key of Object.keys(object)) assert(keys.includes(key), `${label}: unexpected property ${key}`);
}

function nonEmptyString(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label}: expected non-empty string`);
}

function stringSet(value, label, allowEmpty = false) {
  assert(Array.isArray(value), `${label}: expected array`);
  if (!allowEmpty) assert(value.length > 0, `${label}: must not be empty`);
  for (const item of value) nonEmptyString(item, label);
  assert(new Set(value).size === value.length, `${label}: duplicates are forbidden`);
}

function setEqual(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function subset(required, available) {
  const set = new Set(available);
  return required.filter((item) => !set.has(item));
}

function baseClaims(overrides = {}) {
  return {
    boundary_assessed: true,
    responsibility_boundary_required: false,
    capability_attestation_verified: false,
    responsibility_transfer_established: false,
    responsibility_accepted: false,
    authority_established: false,
    context_admission_established: false,
    execution_admitted: false,
    materialization_permitted: false,
    commit_performed: false,
    outcome_observed: false,
    canonical_state_established: false,
    poai_v_conformance_established: false,
    ...overrides
  };
}

function result(assessment, status, reasonCodes, offer, acceptance, assignmentAfterHandoff, claims) {
  return {
    $schema: './responsibility-handoff-result.schema.json',
    artifact_type: 'ResponsibilityHandoffResult',
    artifact_version: '0.1',
    assessment_id: assessment.assessment_id,
    offer_id: offer ? offer.offer_id : null,
    acceptance_id: acceptance ? acceptance.acceptance_id : null,
    status,
    reason_codes: [...new Set(reasonCodes)],
    assignment_after_handoff: assignmentAfterHandoff,
    claims
  };
}

const LEVEL_BY_EFFECT = Object.freeze({
  internal_no_external_effect: 'E0',
  externally_observable_effect: 'E1',
  responsibility_transfer: 'E2',
  materialization_or_canonical_commitment: 'E3'
});

function validateAssessment(assessment) {
  exactKeys(assessment, [
    '$schema', 'artifact_type', 'artifact_version', 'assessment_id', 'subject_ref', 'effect_class',
    'elevation_level', 'state', 'responsibility_boundary_required', 'reason_codes', 'claims'
  ], 'BoundaryAssessment');
  assert(assessment.$schema === '../boundary-assessment.schema.json', 'BoundaryAssessment: schema binding mismatch');
  assert(assessment.artifact_type === 'BoundaryAssessment', 'BoundaryAssessment: artifact_type mismatch');
  assert(assessment.artifact_version === '0.1', 'BoundaryAssessment: artifact_version mismatch');
  nonEmptyString(assessment.assessment_id, 'BoundaryAssessment.assessment_id');
  exactKeys(assessment.subject_ref, ['intent_id', 'action', 'target'], 'BoundaryAssessment.subject_ref');
  for (const key of ['intent_id', 'action', 'target']) nonEmptyString(assessment.subject_ref[key], `BoundaryAssessment.subject_ref.${key}`);
  assert(Object.prototype.hasOwnProperty.call(LEVEL_BY_EFFECT, assessment.effect_class), 'BoundaryAssessment: unknown effect_class');
  assert(assessment.elevation_level === LEVEL_BY_EFFECT[assessment.effect_class], 'BoundaryAssessment: effect_class/elevation_level mismatch');
  stringSet(assessment.reason_codes, 'BoundaryAssessment.reason_codes');

  if (assessment.elevation_level === 'E0') {
    assert(assessment.state === 'IAL_NOT_REQUIRED', 'BoundaryAssessment:E0 must be IAL_NOT_REQUIRED');
    assert(assessment.responsibility_boundary_required === false, 'BoundaryAssessment:E0 must not require responsibility boundary');
  } else {
    assert(assessment.state === 'ELEVATED', 'BoundaryAssessment:E1-E3 must be ELEVATED');
    assert(assessment.responsibility_boundary_required === true, 'BoundaryAssessment:E1-E3 must require responsibility boundary');
  }

  exactKeys(assessment.claims, [
    'private_reasoning_required', 'private_reasoning_disclosed', 'responsibility_transfer_established',
    'authority_established', 'execution_admitted', 'materialization_permitted', 'outcome_observed'
  ], 'BoundaryAssessment.claims');
  for (const key of Object.keys(assessment.claims)) assert(assessment.claims[key] === false, `BoundaryAssessment.claims.${key} must be false`);
}

function validateReceipt(receipt, assessment) {
  exactKeys(receipt, [
    '$schema', 'artifact_type', 'artifact_version', 'receipt_id', 'assessment_id', 'elevation_level',
    'effect_class', 'elevated_by', 'semantic_basis', 'private_reasoning_disclosed', 'claims'
  ], 'ElevationReceipt');
  assert(receipt.$schema === '../elevation-receipt.schema.json', 'ElevationReceipt: schema binding mismatch');
  assert(receipt.artifact_type === 'ElevationReceipt', 'ElevationReceipt: artifact_type mismatch');
  assert(receipt.artifact_version === '0.1', 'ElevationReceipt: artifact_version mismatch');
  nonEmptyString(receipt.receipt_id, 'ElevationReceipt.receipt_id');
  assert(receipt.assessment_id === assessment.assessment_id, 'ElevationReceipt: assessment_id mismatch');
  assert(receipt.elevation_level === assessment.elevation_level, 'ElevationReceipt: elevation_level mismatch');
  assert(receipt.effect_class === assessment.effect_class, 'ElevationReceipt: effect_class mismatch');
  nonEmptyString(receipt.elevated_by, 'ElevationReceipt.elevated_by');
  exactKeys(receipt.semantic_basis, ['intent_id', 'action', 'target'], 'ElevationReceipt.semantic_basis');
  for (const key of ['intent_id', 'action', 'target']) {
    assert(receipt.semantic_basis[key] === assessment.subject_ref[key], `ElevationReceipt.semantic_basis.${key} mismatch`);
  }
  assert(receipt.private_reasoning_disclosed === false, 'ElevationReceipt: private reasoning disclosure is forbidden in v0.1');
}

function validateAssignment(assignment, assessment) {
  exactKeys(assignment, [
    '$schema', 'artifact_type', 'artifact_version', 'assignment_id', 'assessment_id', 'responsible_party_id',
    'responsibility_scope', 'assignment_kind', 'claims'
  ], 'ResponsibilityAssignment');
  assert(assignment.$schema === '../responsibility-assignment.schema.json', 'ResponsibilityAssignment: schema binding mismatch');
  assert(assignment.artifact_type === 'ResponsibilityAssignment', 'ResponsibilityAssignment: artifact_type mismatch');
  assert(assignment.artifact_version === '0.1', 'ResponsibilityAssignment: artifact_version mismatch');
  nonEmptyString(assignment.assignment_id, 'ResponsibilityAssignment.assignment_id');
  assert(assignment.assessment_id === assessment.assessment_id, 'ResponsibilityAssignment: assessment_id mismatch');
  nonEmptyString(assignment.responsible_party_id, 'ResponsibilityAssignment.responsible_party_id');
  stringSet(assignment.responsibility_scope, 'ResponsibilityAssignment.responsibility_scope');
  assert(['current_owner', 'accepted_handoff'].includes(assignment.assignment_kind), 'ResponsibilityAssignment: invalid assignment_kind');
}

function validateOffer(offer, assessment, receipt, assignment, registry) {
  exactKeys(offer, [
    '$schema', 'artifact_type', 'artifact_version', 'offer_id', 'boundary_assessment_id', 'elevation_receipt_id',
    'responsibility_assignment_id', 'source_responsible_party_id', 'receiving_party_id', 'executor_implementation_id',
    'effect_ref', 'responsibility_scope', 'required_capability', 'attestation_policy', 'claims'
  ], 'ResponsibilityHandoffOffer');
  assert(offer.$schema === '../responsibility-handoff-offer.schema.json', 'ResponsibilityHandoffOffer: schema binding mismatch');
  assert(offer.artifact_type === 'ResponsibilityHandoffOffer', 'ResponsibilityHandoffOffer: artifact_type mismatch');
  assert(offer.artifact_version === '0.1', 'ResponsibilityHandoffOffer: artifact_version mismatch');
  nonEmptyString(offer.offer_id, 'ResponsibilityHandoffOffer.offer_id');
  assert(offer.boundary_assessment_id === assessment.assessment_id, 'ResponsibilityHandoffOffer: boundary_assessment_id mismatch');
  assert(offer.elevation_receipt_id === receipt.receipt_id, 'ResponsibilityHandoffOffer: elevation_receipt_id mismatch');
  assert(offer.responsibility_assignment_id === assignment.assignment_id, 'ResponsibilityHandoffOffer: responsibility_assignment_id mismatch');
  assert(offer.source_responsible_party_id === assignment.responsible_party_id, 'ResponsibilityHandoffOffer: source is not current responsible party');
  nonEmptyString(offer.receiving_party_id, 'ResponsibilityHandoffOffer.receiving_party_id');
  assert(offer.receiving_party_id !== offer.source_responsible_party_id, 'ResponsibilityHandoffOffer: responsibility transfer requires a distinct receiving party');
  nonEmptyString(offer.executor_implementation_id, 'ResponsibilityHandoffOffer.executor_implementation_id');
  exactKeys(offer.effect_ref, ['intent_id', 'action', 'target'], 'ResponsibilityHandoffOffer.effect_ref');
  for (const key of ['intent_id', 'action', 'target']) {
    assert(offer.effect_ref[key] === assessment.subject_ref[key], `ResponsibilityHandoffOffer.effect_ref.${key} mismatch`);
  }
  stringSet(offer.responsibility_scope, 'ResponsibilityHandoffOffer.responsibility_scope');
  assert(setEqual(offer.responsibility_scope, assignment.responsibility_scope), 'ResponsibilityHandoffOffer: offered scope must equal current assignment scope in v0.1');
  assert(offer.attestation_policy === 'reproducible_attestation_required', 'ResponsibilityHandoffOffer: unsupported attestation policy');

  exactKeys(offer.required_capability, [
    'registry_id', 'protocol_id', 'version', 'logical_uri', 'release_commit', 'required_conformance_levels'
  ], 'ResponsibilityHandoffOffer.required_capability');
  assert(offer.required_capability.registry_id === registry.registry_id, 'ResponsibilityHandoffOffer: registry_id mismatch');
  stringSet(offer.required_capability.required_conformance_levels, 'ResponsibilityHandoffOffer.required_capability.required_conformance_levels');
  const matches = registry.entries.filter((entry) =>
    entry.protocol_id === offer.required_capability.protocol_id && entry.version === offer.required_capability.version
  );
  assert(matches.length === 1, 'ResponsibilityHandoffOffer: exact protocol/version is not uniquely registered');
  const entry = matches[0];
  assert(offer.required_capability.logical_uri === entry.logical_uri, 'ResponsibilityHandoffOffer: logical_uri drift');
  assert(offer.required_capability.release_commit === entry.release_commit, 'ResponsibilityHandoffOffer: release_commit drift');
  const unavailable = subset(offer.required_capability.required_conformance_levels, entry.conformance_levels);
  assert(unavailable.length === 0, `ResponsibilityHandoffOffer: required levels not present in registered release: ${unavailable.join(',')}`);
}

function validateAcceptance(acceptance, offer) {
  exactKeys(acceptance, [
    '$schema', 'artifact_type', 'artifact_version', 'acceptance_id', 'offer_id', 'receiving_party_id',
    'executor_implementation_id', 'decision', 'accepted_responsibility_scope', 'attestation_ref', 'claims'
  ], 'ResponsibilityHandoffAcceptance');
  assert(acceptance.$schema === '../responsibility-handoff-acceptance.schema.json', 'ResponsibilityHandoffAcceptance: schema binding mismatch');
  assert(acceptance.artifact_type === 'ResponsibilityHandoffAcceptance', 'ResponsibilityHandoffAcceptance: artifact_type mismatch');
  assert(acceptance.artifact_version === '0.1', 'ResponsibilityHandoffAcceptance: artifact_version mismatch');
  nonEmptyString(acceptance.acceptance_id, 'ResponsibilityHandoffAcceptance.acceptance_id');
  assert(acceptance.offer_id === offer.offer_id, 'ResponsibilityHandoffAcceptance: offer_id mismatch');
  assert(acceptance.receiving_party_id === offer.receiving_party_id, 'ResponsibilityHandoffAcceptance: receiving_party_id mismatch');
  assert(acceptance.executor_implementation_id === offer.executor_implementation_id, 'ResponsibilityHandoffAcceptance: executor implementation mismatch');
  assert(['accepted', 'rejected'].includes(acceptance.decision), 'ResponsibilityHandoffAcceptance: invalid decision');
  stringSet(acceptance.accepted_responsibility_scope, 'ResponsibilityHandoffAcceptance.accepted_responsibility_scope', acceptance.decision === 'rejected');

  if (acceptance.decision === 'rejected') {
    assert(acceptance.accepted_responsibility_scope.length === 0, 'ResponsibilityHandoffAcceptance: rejected offer must accept no scope');
    assert(acceptance.attestation_ref === null, 'ResponsibilityHandoffAcceptance: rejected offer must not attach attestation as acceptance evidence');
    assert(acceptance.claims.responsibility_accepted === false, 'ResponsibilityHandoffAcceptance: rejected offer cannot claim accepted responsibility');
  } else {
    assert(acceptance.attestation_ref && typeof acceptance.attestation_ref === 'object', 'ResponsibilityHandoffAcceptance: accepted offer requires attestation_ref');
    assert(acceptance.claims.responsibility_accepted === true, 'ResponsibilityHandoffAcceptance: accepted decision must explicitly claim responsibility acceptance');
  }
}

function verifyAcceptanceAttestation(acceptance, offer, options) {
  const ref = acceptance.attestation_ref;
  exactKeys(ref, ['path', 'git_blob_sha', 'attestation_id', 'subject_id'], 'ResponsibilityHandoffAcceptance.attestation_ref');
  assert(safePath(ref.path), 'ResponsibilityHandoffAcceptance.attestation_ref: unsafe path');
  assert(/^[0-9a-f]{40}$/.test(ref.git_blob_sha), 'ResponsibilityHandoffAcceptance.attestation_ref: invalid blob SHA');
  const absolute = path.resolve(repoRoot, ref.path);
  assert(absolute.startsWith(repoRoot + path.sep), 'ResponsibilityHandoffAcceptance.attestation_ref: path escapes repository');
  assert(fs.existsSync(absolute), 'ResponsibilityHandoffAcceptance.attestation_ref: file does not exist');
  const actualBlob = git(['hash-object', ref.path]);
  assert(actualBlob === ref.git_blob_sha, `ResponsibilityHandoffAcceptance.attestation_ref: blob drift; expected ${ref.git_blob_sha}, got ${actualBlob}`);

  const attestation = readJson(absolute);
  assert(attestation.attestation_id === ref.attestation_id, 'ResponsibilityHandoffAcceptance.attestation_ref: attestation_id mismatch');
  assert(attestation.subject.subject_id === ref.subject_id, 'ResponsibilityHandoffAcceptance.attestation_ref: subject_id mismatch');
  assert(attestation.subject.subject_id === offer.executor_implementation_id, 'ResponsibilityHandoffAcceptance: attested subject is not offered executor implementation');

  const required = offer.required_capability;
  assert(attestation.protocol_binding.protocol_id === required.protocol_id, 'ResponsibilityHandoffAcceptance: attestation protocol mismatch');
  assert(attestation.protocol_binding.version === required.version, 'ResponsibilityHandoffAcceptance: attestation version mismatch');
  assert(attestation.protocol_binding.logical_uri === required.logical_uri, 'ResponsibilityHandoffAcceptance: attestation logical_uri mismatch');
  assert(attestation.protocol_binding.release_commit === required.release_commit, 'ResponsibilityHandoffAcceptance: attestation release_commit mismatch');
  const missing = subset(required.required_conformance_levels, attestation.attested_conformance_levels);
  assert(missing.length === 0, `ResponsibilityHandoffAcceptance: attestation missing required conformance levels ${missing.join(',')}`);

  const verification = verifyAttestation(attestation, { rerunTests: options.rerunAttestation !== false });
  if (options.rerunAttestation === false) {
    assert(verification.status === 'binding_verification_passed', 'ResponsibilityHandoffAcceptance: attestation binding verification failed');
    return { verified: false, verification };
  }
  assert(verification.status === 'reproducible_conformance_evidence', 'ResponsibilityHandoffAcceptance: reproducible attestation verification failed');
  return { verified: true, verification };
}

function evaluateHandoff(input, options = {}) {
  const { assessment, elevationReceipt = null, assignment = null, offer = null, acceptance = null } = input;
  const registry = readJson(registryPath);
  validateAssessment(assessment);

  if (assessment.elevation_level === 'E0') {
    if (elevationReceipt || assignment || offer || acceptance) {
      return result(
        assessment,
        'blocked',
        ['ial_artifacts_for_e0_forbidden'],
        offer,
        acceptance,
        null,
        baseClaims()
      );
    }
    return result(assessment, 'not_required', ['internal_no_external_effect'], null, null, null, baseClaims());
  }

  assert(elevationReceipt, 'IAL:E1-E3 require ElevationReceipt');
  assert(assignment, 'IAL:E1-E3 require ResponsibilityAssignment');
  validateReceipt(elevationReceipt, assessment);
  validateAssignment(assignment, assessment);

  if (assessment.elevation_level === 'E1') {
    if (offer || acceptance) {
      return result(
        assessment,
        'blocked',
        ['responsibility_handoff_not_applicable_to_e1'],
        offer,
        acceptance,
        null,
        baseClaims({ responsibility_boundary_required: true })
      );
    }
    return result(
      assessment,
      'not_required',
      ['responsibility_retained_by_current_owner'],
      null,
      null,
      null,
      baseClaims({ responsibility_boundary_required: true })
    );
  }

  assert(offer, 'IAL:E2-E3 require ResponsibilityHandoffOffer');
  assert(acceptance, 'IAL:E2-E3 require ResponsibilityHandoffAcceptance');
  validateOffer(offer, assessment, elevationReceipt, assignment, registry);
  validateAcceptance(acceptance, offer);

  if (acceptance.decision === 'rejected') {
    return result(
      assessment,
      'rejected',
      ['responsibility_handoff_explicitly_rejected'],
      offer,
      acceptance,
      null,
      baseClaims({ responsibility_boundary_required: true })
    );
  }

  if (!setEqual(acceptance.accepted_responsibility_scope, offer.responsibility_scope)) {
    return result(
      assessment,
      'blocked',
      ['partial_or_changed_responsibility_scope'],
      offer,
      acceptance,
      null,
      baseClaims({ responsibility_boundary_required: true })
    );
  }

  const attestation = verifyAcceptanceAttestation(acceptance, offer, options);
  if (!attestation.verified) {
    return result(
      assessment,
      'blocked',
      ['attestation_not_reproduced'],
      offer,
      acceptance,
      null,
      baseClaims({ responsibility_boundary_required: true })
    );
  }

  const newAssignment = {
    responsible_party_id: offer.receiving_party_id,
    responsibility_scope: offer.responsibility_scope,
    basis: 'explicit_handoff_acceptance'
  };

  return result(
    assessment,
    'accepted',
    [],
    offer,
    acceptance,
    newAssignment,
    baseClaims({
      responsibility_boundary_required: true,
      capability_attestation_verified: true,
      responsibility_transfer_established: true,
      responsibility_accepted: true
    })
  );
}

if (require.main === module) {
  const [, , assessmentFile, receiptFile, assignmentFile, offerFile, acceptanceFile] = process.argv;
  if (!assessmentFile || !receiptFile || !assignmentFile || !offerFile || !acceptanceFile) {
    console.error('Usage: node protocols/ial/v0.1/evaluate-handoff.js <assessment.json> <receipt.json> <assignment.json> <offer.json> <acceptance.json>');
    process.exit(64);
  }

  const output = evaluateHandoff({
    assessment: readJson(path.resolve(process.cwd(), assessmentFile)),
    elevationReceipt: readJson(path.resolve(process.cwd(), receiptFile)),
    assignment: readJson(path.resolve(process.cwd(), assignmentFile)),
    offer: readJson(path.resolve(process.cwd(), offerFile)),
    acceptance: readJson(path.resolve(process.cwd(), acceptanceFile))
  }, { rerunAttestation: true });

  console.log(JSON.stringify(output, null, 2));
  if (output.status !== 'accepted') process.exitCode = 2;
}

module.exports = {
  evaluateHandoff,
  validateAssessment,
  validateReceipt,
  validateAssignment,
  validateOffer,
  validateAcceptance
};
