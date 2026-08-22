'use strict';

const fs = require('fs');
const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../../docs/poai/binding-receipt.js'));

const POLICY_TYPE = 'PoAIMaterializationPolicy';
const EVENT_TYPE = 'PoAIMaterializationEvent';
const VERSION = '0.1-experimental';
const EXECUTE_SCOPE = 'poai.successor.materialization.execute';
const DISPOSITIONS = new Set(['materialized', 'rejected', 'deferred', 'stayed', 'conflicted', 'indeterminate']);
const CANONICALITY_STATES = new Set(['unmaterialized', 'materialized', 'contested', 'superseded', 'unresolved']);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function eq(a, b) { return Binding.canonicalize(a, '$') === Binding.canonicalize(b, '$'); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function isoMs(value) { const n = new Date(value).getTime(); return Number.isFinite(n) ? n : NaN; }

async function digestJson(value) {
  const bytes = Binding.utf8Bytes(Binding.canonicalize(value, '$'));
  return Binding.sha256Hex(bytes);
}

function validatePolicy(policy) {
  const errors = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return ['policy_not_object'];
  if (policy.artifact_type !== POLICY_TYPE) errors.push('policy_artifact_type');
  if (policy.artifact_version !== VERSION) errors.push('policy_artifact_version');
  if (typeof policy.policy_id !== 'string' || !policy.policy_id.startsWith('urn:poai:materialization-policy:')) errors.push('policy_id');
  if (!Number.isInteger(policy.policy_version) || policy.policy_version < 1) errors.push('policy_version');
  if (typeof policy.canonicality_scope !== 'string' || !policy.canonicality_scope) errors.push('canonicality_scope');
  if (!policy.applies_to || typeof policy.applies_to.target !== 'string' || !policy.applies_to.target) errors.push('policy_target');
  if (policy.required_authority_scope !== EXECUTE_SCOPE) errors.push('required_authority_scope');
  const binding = policy.candidate_binding_rule || {};
  if (binding.canonicalization !== 'RFC8785-JCS' || binding.digest_algorithm !== 'SHA-256' || binding.digest_encoding !== 'hex') errors.push('candidate_binding_rule');
  const auth = policy.authority_verification_rule || {};
  if (auth.require_verified_authority !== true || auth.require_issuer_entitlement !== true) errors.push('authority_verification_rule');
  if (auth.required_target !== policy.applies_to.target) errors.push('authority_required_target');
  if (!asArray(auth.allowed_delegation_modes).includes('non_delegable')) errors.push('authority_delegation_rule');
  if (!policy.conflict_rule || !['single_head_no_unresolved_conflict', 'allow_multiple_heads', 'defer_on_conflict'].includes(policy.conflict_rule.mode)) errors.push('conflict_rule');
  if (!policy.appeal_or_stay_rule || typeof policy.appeal_or_stay_rule.active_stay_blocks_materialization !== 'boolean') errors.push('stay_rule');
  const claims = policy.claims || {};
  ['truth_certified', 'causal_proof_certified', 'legal_responsibility_determined', 'universal_canonicality_established', 'poai_v_conformance_established'].forEach((k) => {
    if (claims[k] !== false) errors.push(`policy_claim_${k}`);
  });
  if (Object.prototype.hasOwnProperty.call(policy, 'protocol')) errors.push('policy_masquerades_as_genesis');
  return errors;
}

function normalizedSuccessorCandidate(source, successor) {
  if (!source || !successor) throw new Error('source and successor are required');
  const candidate = clone(successor);
  candidate.decision_boundary = clone(source.decision_boundary);
  candidate.future_target = clone(source.future_target);
  candidate.availability = clone(source.availability);
  candidate.consideration = clone(source.consideration);
  candidate.authority = clone(source.authority);
  return candidate;
}

function decisionTimeStatePreserved(source, candidate) {
  return Boolean(
    source && candidate &&
    eq(source.decision_boundary, candidate.decision_boundary) &&
    eq(source.future_target, candidate.future_target) &&
    eq(source.availability, candidate.availability) &&
    eq(source.consideration, candidate.consideration) &&
    eq(source.authority, candidate.authority)
  );
}

function timeWindowActive(authority, at) {
  const t = isoMs(at);
  const start = isoMs(authority.valid_from);
  if (!Number.isFinite(t) || !Number.isFinite(start) || t < start) return false;
  if (authority.valid_until !== null && authority.valid_until !== undefined) {
    const end = isoMs(authority.valid_until);
    if (!Number.isFinite(end) || t > end) return false;
  }
  return true;
}

async function buildMaterializationEvent({ source, candidate, policy, successorProposalRef, authority, contest, conflict, recordedAt }) {
  const policyErrors = validatePolicy(policy);
  if (policyErrors.length) throw new Error(`Invalid policy: ${policyErrors.join(', ')}`);
  if (!source || !candidate) throw new Error('source and candidate are required');
  const candidateDigest = await digestJson(candidate);
  const policyDigest = await digestJson(policy);
  const at = new Date(recordedAt || Date.now()).toISOString();
  const contestState = contest || { active_stay: false, refs: [] };
  const conflictState = conflict || { status: 'none', candidate_refs: [candidate.record_id] };
  const authorityEval = clone(authority || {});

  const checks = {
    candidate_digest_matches: true,
    policy_digest_matches: true,
    required_scope_matches: authorityEval.scope === policy.required_authority_scope,
    target_matches: authorityEval.target === policy.authority_verification_rule.required_target,
    time_active: timeWindowActive(authorityEval, at),
    delegation_allowed: asArray(policy.authority_verification_rule.allowed_delegation_modes).includes(authorityEval.delegation_mode) && !(authorityEval.delegation_mode === 'non_delegable' && authorityEval.delegated_from),
    issuer_entitlement_verified: authorityEval.issuer_entitlement_verified === true,
    authority_verified: authorityEval.authority_verified === true,
    no_active_stay: contestState.active_stay !== true,
    conflict_rule_satisfied: policy.conflict_rule.mode !== 'single_head_no_unresolved_conflict' || (conflictState.status !== 'unresolved' && asArray(conflictState.candidate_refs).length <= 1),
    decision_time_state_preserved: decisionTimeStatePreserved(source, candidate)
  };
  const canMaterialize = Object.values(checks).every(Boolean);
  const disposition = canMaterialize ? 'materialized' : (contestState.active_stay ? 'stayed' : (checks.conflict_rule_satisfied ? 'rejected' : 'conflicted'));
  const canonicalityStatus = canMaterialize ? 'materialized' : (disposition === 'conflicted' ? 'unresolved' : 'unmaterialized');
  const seed = `${source.record_id}|${candidate.record_id}|${candidateDigest}|${policy.policy_id}|${policyDigest}|${at}`;
  const eventId = `urn:poai:materialization:${(await Binding.sha256Hex(Binding.utf8Bytes(seed))).slice(0, 16)}`;

  return {
    artifact_type: EVENT_TYPE,
    artifact_version: VERSION,
    materialization_event_id: eventId,
    recorded_at: at,
    source_record_ref: { record_id: source.record_id, record_version: source.versioning && source.versioning.record_version },
    successor_proposal_ref: successorProposalRef || 'urn:poai:successor-proposal:synthetic-shipment-r2',
    candidate_successor: {
      record_id: candidate.record_id,
      record_version: candidate.versioning && candidate.versioning.record_version,
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: candidateDigest }
    },
    materialization_policy: {
      policy_id: policy.policy_id,
      policy_version: policy.policy_version,
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: policyDigest }
    },
    authority_evaluation: authorityEval,
    contest_or_stay: { active_stay: Boolean(contestState.active_stay), refs: asArray(contestState.refs) },
    conflict_state: { status: conflictState.status || 'none', candidate_refs: asArray(conflictState.candidate_refs) },
    preservation_check: {
      decision_boundary_unchanged: eq(source.decision_boundary, candidate.decision_boundary),
      future_target_unchanged: eq(source.future_target, candidate.future_target),
      availability_unchanged: eq(source.availability, candidate.availability),
      consideration_unchanged: eq(source.consideration, candidate.consideration),
      authority_mapping_unchanged: eq(source.authority, candidate.authority)
    },
    verification_results: checks,
    declared_disposition: disposition,
    canonicality_claim: {
      status: canonicalityStatus,
      scope: policy.canonicality_scope,
      policy_ref: policy.policy_id,
      materialization_event_ref: eventId
    },
    claims: {
      materialization_event_recorded: true,
      policy_evaluation_passed: canMaterialize,
      policy_relative_canonicality_established: canMaterialize,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      poai_v_conformance_established: false
    }
  };
}

async function validateMaterializationEvent(event, { source, candidate, policy }) {
  const errors = [];
  if (!event || typeof event !== 'object' || Array.isArray(event)) return ['event_not_object'];
  if (event.artifact_type !== EVENT_TYPE) errors.push('event_artifact_type');
  if (event.artifact_version !== VERSION) errors.push('event_artifact_version');
  if (!DISPOSITIONS.has(event.declared_disposition)) errors.push('declared_disposition');
  if (!event.canonicality_claim || !CANONICALITY_STATES.has(event.canonicality_claim.status)) errors.push('canonicality_status');
  if (Object.prototype.hasOwnProperty.call(event, 'protocol')) errors.push('event_masquerades_as_genesis');

  const policyErrors = validatePolicy(policy);
  if (policyErrors.length) errors.push(...policyErrors.map(e => `policy:${e}`));

  if (!event.source_record_ref || event.source_record_ref.record_id !== source.record_id) errors.push('source_record_mismatch');
  if (!event.candidate_successor || event.candidate_successor.record_id !== candidate.record_id) errors.push('candidate_record_mismatch');
  if (candidate.versioning && event.candidate_successor && event.candidate_successor.record_version !== candidate.versioning.record_version) errors.push('candidate_version_mismatch');

  const computedCandidateDigest = await digestJson(candidate);
  if (!event.candidate_successor || !event.candidate_successor.digest || event.candidate_successor.digest.value !== computedCandidateDigest) errors.push('candidate_digest_substitution');
  const computedPolicyDigest = await digestJson(policy);
  if (!event.materialization_policy || !event.materialization_policy.digest || event.materialization_policy.digest.value !== computedPolicyDigest) errors.push('policy_digest_substitution');
  if (!event.materialization_policy || event.materialization_policy.policy_id !== policy.policy_id || event.materialization_policy.policy_version !== policy.policy_version) errors.push('policy_version_substitution');

  const authority = event.authority_evaluation || {};
  if (authority.scope !== policy.required_authority_scope) {
    if (authority.scope === 'poai.successor.materialization.propose') errors.push('proposal_scope_used_as_execute_scope');
    else errors.push('authority_scope_mismatch');
  }
  if (authority.target !== policy.authority_verification_rule.required_target) errors.push('authority_target_mismatch');
  if (!timeWindowActive(authority, event.recorded_at)) errors.push('authority_outside_validity_window');
  if (!asArray(policy.authority_verification_rule.allowed_delegation_modes).includes(authority.delegation_mode)) errors.push('authority_delegation_mode_not_allowed');
  if (authority.delegation_mode === 'non_delegable' && authority.delegated_from) errors.push('non_delegable_authority_redelegated');
  if (policy.authority_verification_rule.require_issuer_entitlement && authority.issuer_entitlement_verified !== true) errors.push('issuer_entitlement_not_verified');
  if (policy.authority_verification_rule.require_verified_authority && authority.authority_verified !== true) errors.push('materialization_authority_not_verified');

  const contest = event.contest_or_stay || {};
  if (policy.appeal_or_stay_rule.active_stay_blocks_materialization && contest.active_stay === true && event.declared_disposition === 'materialized') errors.push('active_stay_ignored');

  const conflict = event.conflict_state || {};
  if (policy.conflict_rule.mode === 'single_head_no_unresolved_conflict' && (conflict.status === 'unresolved' || asArray(conflict.candidate_refs).length > 1) && event.declared_disposition === 'materialized') errors.push('single_head_conflict_silently_selected');

  if (!decisionTimeStatePreserved(source, candidate)) errors.push('decision_boundary_rewritten_in_successor');

  const claims = event.claims || {};
  ['universal_canonicality_established', 'truth_certified', 'causal_proof_certified', 'legal_responsibility_determined', 'moral_correctness_established', 'poai_v_conformance_established'].forEach((key) => {
    if (claims[key] !== false) errors.push(key === 'truth_certified' ? 'materialization_claims_truth_certified' : `prohibited_claim_${key}`);
  });

  if (event.declared_disposition === 'materialized') {
    if (event.canonicality_claim.status !== 'materialized') errors.push('materialized_without_canonicality_claim');
    if (event.canonicality_claim.scope !== policy.canonicality_scope) errors.push('canonicality_scope_mismatch');
    if (event.canonicality_claim.policy_ref !== policy.policy_id) errors.push('canonicality_policy_mismatch');
  }
  return Array.from(new Set(errors));
}

function loadJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

module.exports = {
  POLICY_TYPE, EVENT_TYPE, VERSION, EXECUTE_SCOPE,
  digestJson, validatePolicy, normalizedSuccessorCandidate,
  decisionTimeStatePreserved, buildMaterializationEvent,
  validateMaterializationEvent, loadJson
};
