'use strict';

const fs = require('fs');
const path = require('path');
const Authority = require(path.resolve(__dirname, '../tools/authority-core.js'));

const ROOT_PATH = path.resolve(__dirname, '../roots/github/Matawaka.uu-aap.authority-root.json');
const POLICY_PATH = path.resolve(__dirname, '../../materialization/policies/github/Matawaka.uu-aap.materialization-policy.json');
const GRANT_PATH = path.resolve(__dirname, '../grants/github/Matawaka.uu-aap.execute-grant.json');
const EXPECTED_KEY = 'urn:poai:key:ed25519:6bASxF6xsQnlOXgzXo6hMC_t0leOFhKfGrULkqM660A';
const EXPECTED_SUBJECT = 'urn:poai:actor:materializer:github-matawaka-uu-aap';
const TARGET = 'github:Matawaka/uu-aap';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ms(value) {
  const n = new Date(value).getTime();
  if (!Number.isFinite(n)) throw new Error(`invalid date-time: ${value}`);
  return n;
}

(async () => {
  const root = readJson(ROOT_PATH);
  const policy = readJson(POLICY_PATH);
  const grant = readJson(GRANT_PATH);
  const rootDigest = await Authority.digestJson(root);
  const grantErrors = Authority.validateGrant(grant);
  const rule = policy.authority_verification_rule.root_acceptance_rule;

  const checks = {
    grant_structure_valid: grantErrors.length === 0,
    direct_grant_has_no_parent: grant.parent_grant_ref === null,
    root_id_matches: grant.root_ref.root_id === root.root_id,
    root_version_matches: grant.root_ref.root_version === root.root_version,
    root_digest_matches: grant.root_ref.digest.value === rootDigest,
    exact_root_digest_is_policy_accepted: Array.isArray(rule.accepted_root_digests) && rule.accepted_root_digests.includes(rootDigest),
    issuer_is_root_controller: grant.issuer.id === root.controller_rule.controller_id && grant.issuer.key_ref === root.controller_rule.controller_key_ref,
    subject_is_declared_materializer_role: grant.subject.id === EXPECTED_SUBJECT,
    subject_uses_persistent_key: grant.subject.key_ref === EXPECTED_KEY,
    execute_scope_only: grant.action_scope === policy.required_authority_scope && grant.action_scope === Authority.EXECUTE_SCOPE,
    target_is_exact_repository: grant.target === TARGET && grant.governance_scope === TARGET && root.target === TARGET && root.governance_scope === TARGET && policy.canonicality_scope === TARGET,
    policy_binding_matches: grant.policy_ref === policy.policy_id,
    non_delegable_terminal: grant.delegation.mode === 'non_delegable' && grant.delegation.remaining_depth === 0,
    grant_starts_after_root: ms(grant.valid_from) >= ms(root.effective_from),
    grant_starts_after_policy: ms(grant.valid_from) >= ms(policy.effective_from),
    issued_at_not_after_valid_from: ms(grant.issued_at) <= ms(grant.valid_from)
  };

  assert(Object.values(checks).every(Boolean), `live grant declaration failed: ${JSON.stringify({ checks, grantErrors })}`);

  const result = {
    check_type: 'PoAILiveGrantDeclarationCheck',
    check_version: '0.1-experimental',
    grant: {
      grant_id: grant.grant_id,
      issuer: grant.issuer,
      subject: grant.subject,
      action_scope: grant.action_scope,
      target: grant.target,
      policy_ref: grant.policy_ref,
      root_ref: grant.root_ref
    },
    checks,
    claims: {
      grant_declared: true,
      grant_root_binding_valid: true,
      grant_policy_binding_valid: true,
      grant_scope_contained: true,
      grant_publication_observed: false,
      issuer_entitlement_chain_valid: false,
      materialization_authority_established: false,
      policy_control_authority_established: false,
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
    }
  };

  const out = process.argv[2] || '/tmp/live-grant-declaration.json';
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`live grant declaration passed; grant=${grant.grant_id}; result=${out}`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
