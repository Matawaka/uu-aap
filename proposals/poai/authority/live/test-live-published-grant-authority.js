'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const Authority = require(path.resolve(__dirname, '../tools/authority-core.js'));

const ROOT_PATH = path.resolve(__dirname, '../roots/github/Matawaka.uu-aap.authority-root.json');
const POLICY_PATH = path.resolve(__dirname, '../../materialization/policies/github/Matawaka.uu-aap.materialization-policy.json');
const GRANT_PATH = path.resolve(__dirname, '../grants/github/Matawaka.uu-aap.execute-grant.json');

const ROOT_COMMIT = '027bcfe354643fb15eb32d5c5c6e6313ab6b7dcb';
const POLICY_COMMIT = '5bde80e83ae6f6d19edf3bd996c35633d1603795';
const GRANT_COMMIT = 'ba6546ae92ce6bc8622983d6105c8d9d8c1a8778';
const ROOT_REL = 'proposals/poai/authority/roots/github/Matawaka.uu-aap.authority-root.json';
const POLICY_REL = 'proposals/poai/materialization/policies/github/Matawaka.uu-aap.materialization-policy.json';
const GRANT_REL = 'proposals/poai/authority/grants/github/Matawaka.uu-aap.execute-grant.json';
const ROOT_URL = `https://raw.githubusercontent.com/Matawaka/uu-aap/${ROOT_COMMIT}/${ROOT_REL}`;
const POLICY_URL = `https://raw.githubusercontent.com/Matawaka/uu-aap/${POLICY_COMMIT}/${POLICY_REL}`;
const GRANT_URL = `https://raw.githubusercontent.com/Matawaka/uu-aap/${GRANT_COMMIT}/${GRANT_REL}`;

const TARGET = 'github:Matawaka/uu-aap';
const EVIDENCE_TYPE = 'github_repository_control_publication';
const VERIFIED_AT = '2026-08-22T22:14:11Z';
const EXPECTED_ROOT_DIGEST = 'cbc28f90591526a3fc180322410d5ad4a1a6ba6ff52806e0f8b3e4411336d79f';
const EXPECTED_GRANT_DIGEST = 'e278c9ce3aafdb64c2b3a536faf9385c6d39cbfa7a685cf8208d3628c24deb84';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'PoAI-live-authority-verification' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Publication fetch returned HTTP ${res.statusCode}: ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error(`Publication fetch timed out: ${url}`)));
  });
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function digest(value) {
  return Authority.digestJson(value);
}

(async () => {
  const localRoot = readJson(ROOT_PATH);
  const localPolicy = readJson(POLICY_PATH);
  const localGrant = readJson(GRANT_PATH);

  const [publishedRoot, publishedPolicy, publishedGrant] = await Promise.all([
    fetchJson(ROOT_URL),
    fetchJson(POLICY_URL),
    fetchJson(GRANT_URL)
  ]);

  const [localRootDigest, localPolicyDigest, localGrantDigest, publishedRootDigest, publishedPolicyDigest, publishedGrantDigest] = await Promise.all([
    digest(localRoot), digest(localPolicy), digest(localGrant),
    digest(publishedRoot), digest(publishedPolicy), digest(publishedGrant)
  ]);

  const publicationChecks = {
    root_publication_observed: publishedRootDigest === localRootDigest,
    policy_publication_observed: publishedPolicyDigest === localPolicyDigest,
    grant_publication_observed: publishedGrantDigest === localGrantDigest,
    expected_root_digest_matches: publishedRootDigest === EXPECTED_ROOT_DIGEST,
    expected_grant_digest_matches: publishedGrantDigest === EXPECTED_GRANT_DIGEST,
    grant_issuer_is_root_controller:
      publishedGrant.issuer.id === publishedRoot.controller_rule.controller_id &&
      publishedGrant.issuer.key_ref === publishedRoot.controller_rule.controller_key_ref,
    grant_root_binding_matches:
      publishedGrant.root_ref.root_id === publishedRoot.root_id &&
      publishedGrant.root_ref.root_version === publishedRoot.root_version &&
      publishedGrant.root_ref.digest.value === publishedRootDigest,
    grant_policy_binding_matches: publishedGrant.policy_ref === publishedPolicy.policy_id,
    grant_scope_is_execute_only:
      publishedGrant.action_scope === Authority.EXECUTE_SCOPE &&
      publishedGrant.action_scope === publishedPolicy.required_authority_scope,
    grant_target_contained:
      publishedGrant.target === TARGET &&
      publishedGrant.governance_scope === TARGET &&
      publishedRoot.target === TARGET &&
      publishedRoot.governance_scope === TARGET &&
      publishedPolicy.canonicality_scope === TARGET,
    grant_non_delegable_terminal:
      publishedGrant.delegation.mode === 'non_delegable' &&
      publishedGrant.delegation.remaining_depth === 0
  };

  assert(Object.values(publicationChecks).every(Boolean), `published authority inputs failed: ${JSON.stringify(publicationChecks)}`);

  const rootEvidence = {
    observed: true,
    evidence_type: EVIDENCE_TYPE,
    target: TARGET,
    refs: [ROOT_URL, POLICY_URL, GRANT_URL]
  };

  const verification = await Authority.verifyAuthority({
    root: publishedRoot,
    grants: [publishedGrant],
    policy: publishedPolicy,
    rootEvidence,
    subject: publishedGrant.subject,
    requiredScope: Authority.EXECUTE_SCOPE,
    target: TARGET,
    at: VERIFIED_AT
  });

  const verificationErrors = Authority.validateVerificationResult(verification);
  assert(verificationErrors.length === 0, `live authority result schema semantics failed: ${verificationErrors.join(', ')}`);
  assert(verification.errors.length === 0, `live authority path failed: ${verification.errors.join(', ')}`);
  assert(verification.status === 'established', `unexpected authority status: ${verification.status}`);
  assert(verification.claims.root_declared === true, 'root must be declared');
  assert(verification.claims.root_evidence_observed === true, 'root evidence must be observed');
  assert(verification.claims.root_accepted_by_policy === true, 'root must be accepted by exact policy');
  assert(verification.claims.issuer_entitlement_chain_valid === true, 'issuer entitlement chain must be valid');
  assert(verification.claims.materialization_authority_established === true, 'execute materialization authority must be established');
  assert(verification.claims.policy_control_authority_established === false, 'execute grant must not imply policy control');

  const policyControlAttempt = await Authority.verifyAuthority({
    root: publishedRoot,
    grants: [publishedGrant],
    policy: publishedPolicy,
    rootEvidence,
    subject: publishedGrant.subject,
    requiredScope: Authority.POLICY_CONTROL_SCOPE,
    target: TARGET,
    at: VERIFIED_AT
  });
  assert(policyControlAttempt.status === 'not_established', 'execute grant must not establish policy-control authority');
  assert(policyControlAttempt.claims.issuer_entitlement_chain_valid === false, 'policy-control entitlement must remain false');
  assert(policyControlAttempt.claims.policy_control_authority_established === false, 'policy-control authority must remain false');
  assert(policyControlAttempt.errors.includes('execute_scope_used_as_policy_control'), 'policy-control leakage vector was not detected');

  const prohibited = [
    'legal_identity_verified',
    'legal_authority_established',
    'universal_authority_established',
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_responsibility_determined',
    'moral_correctness_established',
    'legal_effect_established',
    'poai_v_conformance_established'
  ];
  prohibited.forEach((key) => assert(verification.claims[key] === false, `${key} must remain false`));

  const check = {
    check_type: 'PoAILivePublishedGrantAuthorityCheck',
    check_version: '0.1-experimental',
    verified_at: VERIFIED_AT,
    publications: {
      root: { commit: ROOT_COMMIT, url: ROOT_URL, digest: publishedRootDigest },
      policy: { commit: POLICY_COMMIT, url: POLICY_URL, digest: publishedPolicyDigest },
      grant: { commit: GRANT_COMMIT, url: GRANT_URL, digest: publishedGrantDigest }
    },
    issuance_evidence: {
      mode: 'repository_control_publication',
      grant_signature_required_by_this_bootstrap_policy: false,
      grant_signature_verified: false,
      note: 'Repository-scoped bootstrap acceptance only; this does not establish legal identity or universal authority.'
    },
    publication_checks: publicationChecks,
    claims: {
      grant_publication_observed: true,
      issuer_entitlement_chain_valid: true,
      materialization_authority_established: true,
      policy_control_authority_established: false,
      cryptographic_grant_signature_verified: false
    },
    verification
  };

  const verificationOut = process.argv[2] || '/tmp/live-authority-verification.json';
  const checkOut = process.argv[3] || '/tmp/live-published-grant-check.json';
  fs.writeFileSync(verificationOut, `${JSON.stringify(verification, null, 2)}\n`);
  fs.writeFileSync(checkOut, `${JSON.stringify(check, null, 2)}\n`);
  console.log(`live published grant authority established; grant=${publishedGrant.grant_id}; verification=${verification.verification_id}`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
