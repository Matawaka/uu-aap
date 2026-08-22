'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const Binding = require(path.resolve(__dirname, '../../../../docs/poai/binding-receipt.js'));

const ROOT_PATH = path.resolve(__dirname, '../roots/github/Matawaka.uu-aap.authority-root.json');
const POLICY_PATH = path.resolve(__dirname, '../../materialization/policies/github/Matawaka.uu-aap.materialization-policy.json');
const PUBLISHED_COMMIT = '027bcfe354643fb15eb32d5c5c6e6313ab6b7dcb';
const PUBLISHED_URL = `https://raw.githubusercontent.com/Matawaka/uu-aap/${PUBLISHED_COMMIT}/proposals/poai/authority/roots/github/Matawaka.uu-aap.authority-root.json`;
const EVIDENCE_TYPE = 'github_repository_control_publication';
const TARGET = 'github:Matawaka/uu-aap';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'PoAI-live-acceptance' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Publication fetch returned HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Publication fetch timed out')));
  });
}

async function digestJson(value) {
  const canonical = Binding.canonicalize(value, '$');
  const bytes = Binding.utf8Bytes(canonical);
  return {
    digest: await Binding.sha256Hex(bytes),
    canonical_byte_length: bytes.length
  };
}

(async () => {
  const root = readJson(ROOT_PATH);
  const policy = readJson(POLICY_PATH);
  const local = await digestJson(root);

  const publishedText = await fetchText(PUBLISHED_URL);
  const publishedRoot = JSON.parse(publishedText);
  const published = await digestJson(publishedRoot);

  const rule = policy.authority_verification_rule.root_acceptance_rule;
  const checks = {
    root_declared: root.artifact_type === 'PoAIAuthorityRoot' && root.root_version === 1,
    publication_retrieved_from_pinned_main_commit: true,
    publication_digest_matches_local_root: published.digest === local.digest,
    publication_canonical_length_matches_local_root: published.canonical_byte_length === local.canonical_byte_length,
    root_id_accepted_by_policy: rule.accepted_root_ids.includes(root.root_id),
    root_digest_accepted_by_policy: Array.isArray(rule.accepted_root_digests) && rule.accepted_root_digests.includes(local.digest),
    root_mode_accepted_by_policy: rule.allowed_root_modes.includes(root.root_mode),
    evidence_type_accepted_by_policy: rule.allowed_evidence_types.includes(EVIDENCE_TYPE),
    root_evidence_required_by_policy: rule.require_root_evidence === true,
    target_matches: root.target === TARGET && root.governance_scope === TARGET && policy.canonicality_scope === TARGET && policy.authority_verification_rule.required_target === TARGET,
    exact_scope_match_required: rule.exact_scope_match === true
  };

  const rootEvidenceObserved = checks.publication_retrieved_from_pinned_main_commit &&
    checks.publication_digest_matches_local_root &&
    checks.publication_canonical_length_matches_local_root &&
    root.root_evidence_rule.mode === 'repository_control_publication' &&
    root.root_evidence_rule.resource === TARGET &&
    root.root_evidence_rule.accepted_evidence_types.includes(EVIDENCE_TYPE);

  const rootAcceptedByPolicy = rootEvidenceObserved && Object.values(checks).every(Boolean);

  assert(local.digest === 'cbc28f90591526a3fc180322410d5ad4a1a6ba6ff52806e0f8b3e4411336d79f', `unexpected live root digest: ${local.digest}`);
  assert(rootEvidenceObserved, 'live repository-control publication evidence was not observed');
  assert(rootAcceptedByPolicy, `live root was not accepted by exact policy: ${JSON.stringify(checks)}`);

  const result = {
    check_type: 'PoAILiveRootAcceptanceCheck',
    check_version: '0.1-experimental',
    root: {
      root_id: root.root_id,
      root_version: root.root_version,
      digest: {
        canonicalization: 'RFC8785-JCS',
        digest_algorithm: 'SHA-256',
        digest_encoding: 'hex',
        value: local.digest,
        canonical_byte_length: local.canonical_byte_length
      }
    },
    publication: {
      method: 'github_repository_control_publication',
      commit: PUBLISHED_COMMIT,
      url: PUBLISHED_URL,
      digest_matches: true
    },
    policy: {
      policy_id: policy.policy_id,
      policy_version: policy.policy_version
    },
    checks,
    claims: {
      root_declared: true,
      root_evidence_observed: true,
      root_accepted_by_policy: true,
      issuer_entitlement_chain_valid: false,
      materialization_authority_established: false,
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

  const out = process.argv[2] || '/tmp/live-root-acceptance.json';
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`live root acceptance passed; digest=${local.digest}; result=${out}`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
