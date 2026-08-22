'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../../docs/poai/binding-receipt.js'));

const ROOT_TYPE = 'PoAIAuthorityRoot';
const GRANT_TYPE = 'PoAIAuthorityGrant';
const RESULT_TYPE = 'PoAIAuthorityVerificationResult';
const VERSION = '0.1-experimental';
const EXECUTE_SCOPE = 'poai.successor.materialization.execute';
const POLICY_CONTROL_SCOPE = 'poai.materialization.policy.control';
const ROOT_MODES = new Set(['self_governed_resource', 'institutional_charter', 'contractual_root', 'registry_root', 'statutory_root', 'quorum_root']);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function isoMs(value) { const n = new Date(value).getTime(); return Number.isFinite(n) ? n : NaN; }
function actorEq(a, b) { return Boolean(a && b && a.id === b.id && a.key_ref === b.key_ref); }
function unique(values) { return Array.from(new Set(values)); }

async function digestJson(value) {
  const bytes = Binding.utf8Bytes(Binding.canonicalize(value, '$'));
  return Binding.sha256Hex(bytes);
}

function activeAt(entity, at) {
  const t = isoMs(at);
  const start = isoMs(entity.valid_from || entity.effective_from);
  if (!Number.isFinite(t) || !Number.isFinite(start) || t < start) return false;
  const until = entity.valid_until !== undefined ? entity.valid_until : entity.effective_until;
  if (until !== null && until !== undefined) {
    const end = isoMs(until);
    if (!Number.isFinite(end) || t > end) return false;
  }
  return true;
}

function intervalWithin(child, parent) {
  const cs = isoMs(child.valid_from);
  const ps = isoMs(parent.valid_from || parent.effective_from);
  if (!Number.isFinite(cs) || !Number.isFinite(ps) || cs < ps) return false;
  const childEndRaw = child.valid_until;
  const parentEndRaw = parent.valid_until !== undefined ? parent.valid_until : parent.effective_until;
  if (parentEndRaw === null || parentEndRaw === undefined) return true;
  const pe = isoMs(parentEndRaw);
  if (!Number.isFinite(pe)) return false;
  if (childEndRaw === null || childEndRaw === undefined) return false;
  const ce = isoMs(childEndRaw);
  return Number.isFinite(ce) && ce <= pe;
}

function validateRoot(root) {
  const errors = [];
  if (!root || typeof root !== 'object' || Array.isArray(root)) return ['root_not_object'];
  if (root.artifact_type !== ROOT_TYPE) errors.push('root_artifact_type');
  if (root.artifact_version !== VERSION) errors.push('root_artifact_version');
  if (typeof root.root_id !== 'string' || !root.root_id.startsWith('urn:poai:authority-root:')) errors.push('root_id');
  if (!Number.isInteger(root.root_version) || root.root_version < 1) errors.push('root_version');
  if (!ROOT_MODES.has(root.root_mode)) errors.push('root_mode');
  if (typeof root.governance_scope !== 'string' || !root.governance_scope) errors.push('governance_scope');
  if (typeof root.target !== 'string' || !root.target) errors.push('root_target');
  if (!asArray(root.accepted_actions).length) errors.push('root_accepted_actions');
  const controller = root.controller_rule || {};
  if (controller.mode !== 'single_controller' || !controller.controller_id || !controller.controller_key_ref) errors.push('root_controller_rule');
  const evidenceRule = root.root_evidence_rule || {};
  if (!evidenceRule.mode || !evidenceRule.resource || !asArray(evidenceRule.accepted_evidence_types).length) errors.push('root_evidence_rule');
  const delegation = root.delegation_policy || {};
  if (!['delegable', 'non_delegable'].includes(delegation.mode) || !Number.isInteger(delegation.max_depth) || delegation.max_depth < 0) errors.push('root_delegation_policy');
  if ((root.policy_control_rule || {}).required_scope !== POLICY_CONTROL_SCOPE) errors.push('root_policy_control_rule');

  if (root.root_mode === 'self_governed_resource') {
    if (evidenceRule.mode !== 'repository_control_publication') errors.push('self_governed_evidence_mode');
    if (root.target !== evidenceRule.resource) errors.push('repository_root_claims_external_target');
    if (root.governance_scope !== root.target) errors.push('root_scope_escape');
  }

  if (!activeAt(root, root.effective_from)) errors.push('root_effective_interval');
  const transition = root.transition || {};
  if (transition.status === 'genesis') {
    if (transition.previous_root_ref !== null) errors.push('genesis_root_has_previous');
  } else if (transition.status === 'superseding' || transition.status === 'revoked') {
    if (!transition.previous_root_ref || transition.authorized_by_previous_controller !== true || !asArray(transition.authorization_evidence_refs).length) {
      errors.push('root_replacement_without_previous_controller_authorization');
    }
  } else {
    errors.push('root_transition_status');
  }

  const claims = root.claims || {};
  if (claims.legal_identity_verified !== false) errors.push('account_control_claimed_as_legal_identity');
  ['legal_authority_established', 'universal_authority_established', 'truth_certified', 'causal_proof_certified', 'legal_responsibility_determined', 'moral_correctness_established', 'poai_v_conformance_established'].forEach((key) => {
    if (claims[key] !== false) errors.push(`prohibited_root_claim_${key}`);
  });
  if (Object.prototype.hasOwnProperty.call(root, 'protocol')) errors.push('root_masquerades_as_genesis');
  return unique(errors);
}

function validateGrant(grant) {
  const errors = [];
  if (!grant || typeof grant !== 'object' || Array.isArray(grant)) return ['grant_not_object'];
  if (grant.artifact_type !== GRANT_TYPE) errors.push('grant_artifact_type');
  if (grant.artifact_version !== VERSION) errors.push('grant_artifact_version');
  if (typeof grant.grant_id !== 'string' || !grant.grant_id.startsWith('urn:poai:authority-grant:')) errors.push('grant_id');
  if (!grant.root_ref || !grant.root_ref.root_id || !Number.isInteger(grant.root_ref.root_version) || !grant.root_ref.digest || !/^[0-9a-f]{64}$/.test(grant.root_ref.digest.value || '')) errors.push('grant_root_ref');
  if (!grant.issuer || !grant.issuer.id || !grant.issuer.key_ref) errors.push('grant_issuer');
  if (!grant.subject || !grant.subject.id || !grant.subject.key_ref) errors.push('grant_subject');
  if (!grant.action_scope) errors.push('grant_action_scope');
  if (!grant.target) errors.push('grant_target');
  if (!grant.governance_scope) errors.push('grant_governance_scope');
  if (!Number.isFinite(isoMs(grant.issued_at)) || !Number.isFinite(isoMs(grant.valid_from))) errors.push('grant_time');
  if (grant.valid_until !== null && grant.valid_until !== undefined && !Number.isFinite(isoMs(grant.valid_until))) errors.push('grant_valid_until');
  const d = grant.delegation || {};
  if (!['delegable', 'non_delegable'].includes(d.mode) || !Number.isInteger(d.remaining_depth) || d.remaining_depth < 0) errors.push('grant_delegation');
  if (!grant.policy_ref) errors.push('grant_policy_ref');
  const claims = grant.claims || {};
  if (claims.legal_identity_verified !== false) errors.push('account_control_claimed_as_legal_identity');
  ['universal_authority_established', 'truth_certified', 'poai_v_conformance_established'].forEach((key) => { if (claims[key] !== false) errors.push(`prohibited_grant_claim_${key}`); });
  if (Object.prototype.hasOwnProperty.call(grant, 'protocol')) errors.push('grant_masquerades_as_genesis');
  return unique(errors);
}

function rootRule(policy) {
  return policy && policy.authority_verification_rule && policy.authority_verification_rule.root_acceptance_rule;
}

async function buildGrant({ root, parentGrant = null, issuer, subject, actionScope, target, governanceScope, validFrom, validUntil = null, delegationMode = 'non_delegable', remainingDepth = 0, policyRef, issuedAt }) {
  const rootErrors = validateRoot(root);
  if (rootErrors.length) throw new Error(`Invalid root: ${rootErrors.join(', ')}`);
  const rootDigest = await digestJson(root);
  const at = new Date(issuedAt || Date.now()).toISOString();
  const seed = [root.root_id, parentGrant && parentGrant.grant_id, issuer.id, issuer.key_ref, subject.id, subject.key_ref, actionScope, target, validFrom, validUntil, at].join('|');
  const grantId = `urn:poai:authority-grant:${(await Binding.sha256Hex(Binding.utf8Bytes(seed))).slice(0, 16)}`;
  return {
    artifact_type: GRANT_TYPE,
    artifact_version: VERSION,
    grant_id: grantId,
    issued_at: at,
    root_ref: {
      root_id: root.root_id,
      root_version: root.root_version,
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: rootDigest }
    },
    parent_grant_ref: parentGrant ? parentGrant.grant_id : null,
    issuer: clone(issuer),
    subject: clone(subject),
    action_scope: actionScope,
    target,
    governance_scope: governanceScope,
    valid_from: validFrom,
    valid_until: validUntil,
    delegation: { mode: delegationMode, remaining_depth: remainingDepth },
    policy_ref: policyRef,
    evidence_refs: [],
    claims: {
      legal_identity_verified: false,
      universal_authority_established: false,
      truth_certified: false,
      poai_v_conformance_established: false
    }
  };
}

async function verifyAuthority({ root, grants, policy, rootEvidence, subject, requiredScope, target, at }) {
  const errors = [];
  const checks = {};
  const when = new Date(at || Date.now()).toISOString();
  const rootErrors = validateRoot(root);
  errors.push(...rootErrors);
  checks.root_structure_valid = rootErrors.length === 0;
  checks.root_time_active = activeAt(root, when);
  if (!checks.root_time_active) errors.push('root_outside_validity_window');

  const rule = rootRule(policy) || {};
  checks.root_declared = Boolean(root && root.root_id);
  checks.root_id_accepted = asArray(rule.accepted_root_ids).includes(root && root.root_id);
  if (!checks.root_id_accepted) errors.push('unaccepted_root');
  checks.root_mode_accepted = asArray(rule.allowed_root_modes).includes(root && root.root_mode);
  if (!checks.root_mode_accepted) errors.push('unaccepted_root_mode');
  checks.root_evidence_observed = Boolean(rootEvidence && rootEvidence.observed === true);
  if (rule.require_root_evidence === true && !checks.root_evidence_observed) errors.push('root_evidence_not_observed');
  checks.root_evidence_type_accepted = Boolean(rootEvidence && asArray(rule.allowed_evidence_types).includes(rootEvidence.evidence_type));
  if (rule.require_root_evidence === true && !checks.root_evidence_type_accepted) errors.push('root_evidence_type_not_accepted');
  checks.root_evidence_target_matches = Boolean(rootEvidence && rootEvidence.target === root.target && rootEvidence.target === root.root_evidence_rule.resource);
  if (rule.require_root_evidence === true && !checks.root_evidence_target_matches) errors.push('root_evidence_target_mismatch');
  checks.root_target_matches_policy = Boolean(policy && policy.authority_verification_rule && root.target === policy.authority_verification_rule.required_target && root.target === target);
  if (!checks.root_target_matches_policy) errors.push('root_target_policy_mismatch');
  checks.root_scope_matches_policy = rule.exact_scope_match !== true || (root.governance_scope === policy.canonicality_scope && root.governance_scope === target);
  if (!checks.root_scope_matches_policy) errors.push('root_scope_policy_mismatch');
  const rootAccepted = [checks.root_structure_valid, checks.root_time_active, checks.root_id_accepted, checks.root_mode_accepted, checks.root_target_matches_policy, checks.root_scope_matches_policy].every(Boolean) && (rule.require_root_evidence !== true || (checks.root_evidence_observed && checks.root_evidence_type_accepted && checks.root_evidence_target_matches));
  checks.root_accepted_by_policy = rootAccepted;

  const grantList = asArray(grants);
  const grantMap = new Map(grantList.map(g => [g.grant_id, g]));
  grantList.forEach(g => errors.push(...validateGrant(g)));
  const exact = grantList.filter(g => actorEq(g.subject, subject) && g.action_scope === requiredScope && g.target === target && g.policy_ref === policy.policy_id);
  let terminal = exact[0] || null;
  if (!terminal && requiredScope === POLICY_CONTROL_SCOPE) {
    const executeOnly = grantList.find(g => actorEq(g.subject, subject) && g.action_scope === EXECUTE_SCOPE && g.target === target);
    if (executeOnly) errors.push('execute_scope_used_as_policy_control');
  }
  if (!terminal) errors.push('required_authority_grant_not_found');

  const rootDigest = await digestJson(root);
  const pathIds = [];
  const visiting = new Set();
  const visited = new Set();

  function walk(grant) {
    if (!grant) return false;
    if (visiting.has(grant.grant_id)) { errors.push('authority_cycle'); return false; }
    if (visited.has(grant.grant_id)) return true;
    visiting.add(grant.grant_id);
    pathIds.push(grant.grant_id);

    if (grant.root_ref.root_id !== root.root_id || grant.root_ref.root_version !== root.root_version || grant.root_ref.digest.value !== rootDigest) errors.push('grant_root_binding_mismatch');
    if (!activeAt(grant, when)) errors.push('grant_outside_validity_window');
    if (grant.policy_ref !== policy.policy_id) errors.push('grant_policy_mismatch');
    if (grant.target !== target) errors.push('authority_target_mismatch');
    if (grant.governance_scope !== root.governance_scope) errors.push('child_target_inflation');
    if (!asArray(root.accepted_actions).includes(grant.action_scope)) errors.push('root_action_not_accepted');
    if (!intervalWithin(grant, root)) errors.push('grant_validity_outside_root');

    if (grant.parent_grant_ref === null) {
      const controller = root.controller_rule || {};
      const rootActor = { id: controller.controller_id, key_ref: controller.controller_key_ref };
      if (!actorEq(grant.issuer, rootActor)) errors.push('issuer_not_root_controller');
      if (grant.delegation.remaining_depth > root.delegation_policy.max_depth) errors.push('delegation_depth_inflation');
      if (root.delegation_policy.mode === 'non_delegable' && grant.delegation.mode === 'delegable') errors.push('root_non_delegable_grant_delegable');
    } else {
      const parent = grantMap.get(grant.parent_grant_ref);
      if (!parent) errors.push('parent_grant_missing');
      else {
        walk(parent);
        if (!actorEq(grant.issuer, parent.subject)) errors.push('child_issuer_not_parent_subject');
        if (grant.action_scope !== parent.action_scope) errors.push('child_scope_inflation');
        if (grant.target !== parent.target || grant.governance_scope !== parent.governance_scope) errors.push('child_target_inflation');
        if (!intervalWithin(grant, parent)) errors.push('child_validity_inflation');
        if (parent.delegation.mode !== 'delegable' || parent.delegation.remaining_depth < 1) errors.push('non_delegable_parent_redelegated');
        if (grant.delegation.remaining_depth > Math.max(0, parent.delegation.remaining_depth - 1)) errors.push('child_delegation_depth_inflation');
      }
    }
    visiting.delete(grant.grant_id);
    visited.add(grant.grant_id);
    return true;
  }

  if (terminal) walk(terminal);
  checks.authority_graph_acyclic = !errors.includes('authority_cycle');
  checks.grant_path_valid = terminal !== null && !errors.some(e => [
    'authority_cycle', 'grant_root_binding_mismatch', 'grant_outside_validity_window', 'grant_policy_mismatch', 'authority_target_mismatch', 'child_target_inflation', 'root_action_not_accepted', 'grant_validity_outside_root', 'issuer_not_root_controller', 'delegation_depth_inflation', 'root_non_delegable_grant_delegable', 'parent_grant_missing', 'child_issuer_not_parent_subject', 'child_scope_inflation', 'child_validity_inflation', 'non_delegable_parent_redelegated', 'child_delegation_depth_inflation'
  ].includes(e));
  checks.required_scope_matches = Boolean(terminal && terminal.action_scope === requiredScope);
  checks.required_target_matches = Boolean(terminal && terminal.target === target);
  checks.policy_binding_matches = Boolean(terminal && terminal.policy_ref === policy.policy_id);

  const issuerChainValid = rootAccepted && checks.grant_path_valid && checks.required_scope_matches && checks.required_target_matches && checks.policy_binding_matches && checks.authority_graph_acyclic;
  const materializationAuthority = issuerChainValid && requiredScope === EXECUTE_SCOPE;
  const policyControlAuthority = issuerChainValid && requiredScope === POLICY_CONTROL_SCOPE;
  const policyDigest = await digestJson(policy);
  const seed = `${root.root_id}|${terminal ? terminal.grant_id : 'none'}|${subject && subject.key_ref}|${requiredScope}|${target}|${policy.policy_id}|${when}`;
  const verificationId = `urn:poai:authority-verification:${(await Binding.sha256Hex(Binding.utf8Bytes(seed))).slice(0, 16)}`;

  const result = {
    artifact_type: RESULT_TYPE,
    artifact_version: VERSION,
    verification_id: verificationId,
    verified_at: when,
    policy: {
      policy_id: policy.policy_id,
      policy_version: policy.policy_version,
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: policyDigest }
    },
    root: {
      root_id: root.root_id,
      root_version: root.root_version,
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: rootDigest }
    },
    grant_path: pathIds.length ? pathIds : ['urn:poai:authority-grant:none'],
    subject: clone(subject),
    required_scope: requiredScope,
    target,
    status: issuerChainValid ? 'established' : 'not_established',
    checks,
    claims: {
      root_declared: checks.root_declared,
      root_evidence_observed: checks.root_evidence_observed,
      root_accepted_by_policy: rootAccepted,
      issuer_entitlement_chain_valid: issuerChainValid,
      materialization_authority_established: materializationAuthority,
      policy_control_authority_established: policyControlAuthority,
      legal_identity_verified: false,
      legal_authority_established: false,
      universal_authority_established: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    },
    errors: unique(errors)
  };
  return result;
}

function validateVerificationResult(result) {
  const errors = [];
  if (!result || typeof result !== 'object' || Array.isArray(result)) return ['verification_result_not_object'];
  if (result.artifact_type !== RESULT_TYPE) errors.push('verification_result_artifact_type');
  if (result.artifact_version !== VERSION) errors.push('verification_result_artifact_version');
  const claims = result.claims || {};
  if (claims.truth_certified !== false) errors.push('authority_verification_claims_truth');
  ['legal_identity_verified', 'legal_authority_established', 'universal_authority_established', 'universal_canonicality_established', 'causal_proof_certified', 'legal_responsibility_determined', 'moral_correctness_established', 'legal_effect_established', 'poai_v_conformance_established'].forEach((key) => {
    if (claims[key] !== false) errors.push(`prohibited_verification_claim_${key}`);
  });
  if (claims.materialization_authority_established === true && (result.required_scope !== EXECUTE_SCOPE || claims.issuer_entitlement_chain_valid !== true || claims.root_accepted_by_policy !== true || result.status !== 'established')) errors.push('materialization_authority_without_valid_chain');
  if (claims.policy_control_authority_established === true && (result.required_scope !== POLICY_CONTROL_SCOPE || claims.issuer_entitlement_chain_valid !== true || result.status !== 'established')) errors.push('policy_control_authority_without_valid_chain');
  if (claims.materialization_authority_established === true && claims.policy_control_authority_established === true) errors.push('authority_scope_collapse');
  if (Object.prototype.hasOwnProperty.call(result, 'protocol')) errors.push('verification_result_masquerades_as_genesis');
  return unique(errors);
}

function materializationAuthorityView(result, grant) {
  const resultErrors = validateVerificationResult(result);
  if (resultErrors.length) throw new Error(`Invalid authority verification result: ${resultErrors.join(', ')}`);
  return {
    subject: result.subject.key_ref,
    scope: result.required_scope,
    target: result.target,
    valid_from: grant.valid_from,
    valid_until: grant.valid_until,
    delegation_mode: grant.delegation.mode,
    delegated_from: grant.parent_grant_ref,
    issuer_entitlement_verified: result.claims.issuer_entitlement_chain_valid === true,
    authority_verified: result.claims.materialization_authority_established === true,
    evidence_refs: [result.verification_id, result.root.root_id, ...result.grant_path],
    authority_verification_ref: result.verification_id,
    root_ref: result.root.root_id,
    grant_ref: grant.grant_id
  };
}

module.exports = {
  ROOT_TYPE, GRANT_TYPE, RESULT_TYPE, VERSION, EXECUTE_SCOPE, POLICY_CONTROL_SCOPE,
  digestJson, validateRoot, validateGrant, buildGrant, verifyAuthority,
  validateVerificationResult, materializationAuthorityView, activeAt, intervalWithin
};
