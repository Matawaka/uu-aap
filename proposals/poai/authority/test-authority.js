'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./tools/authority-core.js');

function read(rel) { return JSON.parse(fs.readFileSync(path.resolve(__dirname, rel), 'utf8')); }
function write(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  const root = read('./examples/self-governed-uu-aap.authority-root.json');
  const policy = read('../materialization/examples/synthetic-shipment.materialization-policy.json');
  const controller = {
    id: root.controller_rule.controller_id,
    key_ref: root.controller_rule.controller_key_ref
  };
  const materializer = { id: 'actor:synthetic-materializer', key_ref: 'key:synthetic-materializer' };
  const delegate = { id: 'actor:synthetic-delegate', key_ref: 'key:synthetic-delegate' };
  const rootEvidence = {
    observed: true,
    evidence_type: 'github_repository_control_publication',
    target: 'github:Matawaka/uu-aap',
    refs: ['urn:poai:root-evidence:synthetic-github-control']
  };
  const at = '2026-07-16T12:00:00Z';

  assert(Core.validateRoot(root).length === 0, `root fixture invalid: ${Core.validateRoot(root).join(', ')}`);

  const directGrant = await Core.buildGrant({
    root,
    issuer: controller,
    subject: materializer,
    actionScope: Core.EXECUTE_SCOPE,
    target: 'github:Matawaka/uu-aap',
    governanceScope: 'github:Matawaka/uu-aap',
    validFrom: '2026-07-01T00:00:00Z',
    validUntil: '2026-08-01T00:00:00Z',
    delegationMode: 'non_delegable',
    remainingDepth: 0,
    policyRef: policy.policy_id,
    issuedAt: '2026-07-01T00:10:00Z'
  });
  assert(Core.validateGrant(directGrant).length === 0, `direct grant invalid: ${Core.validateGrant(directGrant).join(', ')}`);

  const positive = await Core.verifyAuthority({
    root,
    grants: [directGrant],
    policy,
    rootEvidence,
    subject: materializer,
    requiredScope: Core.EXECUTE_SCOPE,
    target: 'github:Matawaka/uu-aap',
    at
  });
  assert(positive.errors.length === 0, `positive authority vector failed: ${positive.errors.join(', ')}`);
  assert(positive.status === 'established', 'positive authority must be established');
  assert(positive.claims.root_evidence_observed === true, 'root evidence must be observed');
  assert(positive.claims.root_accepted_by_policy === true, 'root must be policy-accepted');
  assert(positive.claims.issuer_entitlement_chain_valid === true, 'issuer entitlement chain must validate');
  assert(positive.claims.materialization_authority_established === true, 'materialization authority must be established');
  assert(positive.claims.policy_control_authority_established === false, 'execute authority must not imply policy control');
  assert(positive.claims.legal_identity_verified === false, 'repository governance must not certify legal identity');
  assert(positive.claims.truth_certified === false, 'authority verification must not certify truth');
  assert(Core.validateVerificationResult(positive).length === 0, `positive result invalid: ${Core.validateVerificationResult(positive).join(', ')}`);

  const unacceptedPolicy = clone(policy);
  unacceptedPolicy.authority_verification_rule.root_acceptance_rule.accepted_root_ids = ['urn:poai:authority-root:other:1'];
  const unaccepted = await Core.verifyAuthority({ root, grants: [directGrant], policy: unacceptedPolicy, rootEvidence, subject: materializer, requiredScope: Core.EXECUTE_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(unaccepted.errors.includes('unaccepted_root'), `unaccepted_root not rejected: ${unaccepted.errors.join(', ')}`);

  const scopeEscapeRoot = clone(root);
  scopeEscapeRoot.governance_scope = 'github:Matawaka/*';
  const scopeEscape = await Core.verifyAuthority({ root: scopeEscapeRoot, grants: [directGrant], policy, rootEvidence, subject: materializer, requiredScope: Core.EXECUTE_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(scopeEscape.errors.includes('root_scope_escape'), `root_scope_escape not rejected: ${scopeEscape.errors.join(', ')}`);

  const parentDelegable = await Core.buildGrant({
    root,
    issuer: controller,
    subject: delegate,
    actionScope: Core.EXECUTE_SCOPE,
    target: 'github:Matawaka/uu-aap',
    governanceScope: 'github:Matawaka/uu-aap',
    validFrom: '2026-07-05T00:00:00Z',
    validUntil: '2026-07-25T00:00:00Z',
    delegationMode: 'delegable',
    remainingDepth: 1,
    policyRef: policy.policy_id,
    issuedAt: '2026-07-05T00:00:00Z'
  });
  const child = await Core.buildGrant({
    root,
    parentGrant: parentDelegable,
    issuer: delegate,
    subject: materializer,
    actionScope: Core.EXECUTE_SCOPE,
    target: 'github:Matawaka/uu-aap',
    governanceScope: 'github:Matawaka/uu-aap',
    validFrom: '2026-07-10T00:00:00Z',
    validUntil: '2026-07-20T00:00:00Z',
    delegationMode: 'non_delegable',
    remainingDepth: 0,
    policyRef: policy.policy_id,
    issuedAt: '2026-07-10T00:00:00Z'
  });
  const delegatedPositive = await Core.verifyAuthority({ root, grants: [parentDelegable, child], policy, rootEvidence, subject: materializer, requiredScope: Core.EXECUTE_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(delegatedPositive.errors.length === 0, `delegated positive failed: ${delegatedPositive.errors.join(', ')}`);

  const cycleParent = clone(parentDelegable);
  cycleParent.parent_grant_ref = child.grant_id;
  const cycle = await Core.verifyAuthority({ root, grants: [cycleParent, child], policy, rootEvidence, subject: materializer, requiredScope: Core.EXECUTE_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(cycle.errors.includes('authority_cycle'), `authority_cycle not rejected: ${cycle.errors.join(', ')}`);

  const scopeInflatedChild = clone(child);
  scopeInflatedChild.action_scope = Core.POLICY_CONTROL_SCOPE;
  const scopeInflation = await Core.verifyAuthority({ root, grants: [parentDelegable, scopeInflatedChild], policy, rootEvidence, subject: materializer, requiredScope: Core.POLICY_CONTROL_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(scopeInflation.errors.includes('child_scope_inflation'), `child_scope_inflation not rejected: ${scopeInflation.errors.join(', ')}`);

  const targetInflatedChild = clone(child);
  targetInflatedChild.governance_scope = 'github:Matawaka/*';
  const targetInflation = await Core.verifyAuthority({ root, grants: [parentDelegable, targetInflatedChild], policy, rootEvidence, subject: materializer, requiredScope: Core.EXECUTE_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(targetInflation.errors.includes('child_target_inflation'), `child_target_inflation not rejected: ${targetInflation.errors.join(', ')}`);

  const timeInflatedChild = clone(child);
  timeInflatedChild.valid_from = '2026-07-01T00:00:00Z';
  const timeInflation = await Core.verifyAuthority({ root, grants: [parentDelegable, timeInflatedChild], policy, rootEvidence, subject: materializer, requiredScope: Core.EXECUTE_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(timeInflation.errors.includes('child_validity_inflation'), `child_validity_inflation not rejected: ${timeInflation.errors.join(', ')}`);

  const terminalParent = clone(parentDelegable);
  terminalParent.delegation = { mode: 'non_delegable', remaining_depth: 0 };
  const terminalChild = clone(child);
  terminalChild.parent_grant_ref = terminalParent.grant_id;
  const redelegated = await Core.verifyAuthority({ root, grants: [terminalParent, terminalChild], policy, rootEvidence, subject: materializer, requiredScope: Core.EXECUTE_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(redelegated.errors.includes('non_delegable_parent_redelegated'), `non_delegable_parent_redelegated not rejected: ${redelegated.errors.join(', ')}`);

  const policyControlLeak = await Core.verifyAuthority({ root, grants: [directGrant], policy, rootEvidence, subject: materializer, requiredScope: Core.POLICY_CONTROL_SCOPE, target: 'github:Matawaka/uu-aap', at });
  assert(policyControlLeak.errors.includes('execute_scope_used_as_policy_control'), `execute_scope_used_as_policy_control not rejected: ${policyControlLeak.errors.join(', ')}`);

  const replacementRoot = clone(root);
  replacementRoot.root_version = 2;
  replacementRoot.transition = {
    status: 'superseding',
    previous_root_ref: root.root_id,
    authorized_by_previous_controller: false,
    authorization_evidence_refs: []
  };
  const replacementErrors = Core.validateRoot(replacementRoot);
  assert(replacementErrors.includes('root_replacement_without_previous_controller_authorization'), `unauthorized root replacement not rejected: ${replacementErrors.join(', ')}`);

  const externalRoot = clone(root);
  externalRoot.target = 'github:Other/example';
  const externalErrors = Core.validateRoot(externalRoot);
  assert(externalErrors.includes('repository_root_claims_external_target'), `external repository target not rejected: ${externalErrors.join(', ')}`);

  const identityLaunderingRoot = clone(root);
  identityLaunderingRoot.claims.legal_identity_verified = true;
  const identityErrors = Core.validateRoot(identityLaunderingRoot);
  assert(identityErrors.includes('account_control_claimed_as_legal_identity'), `legal identity laundering not rejected: ${identityErrors.join(', ')}`);

  const truthLaunderingResult = clone(positive);
  truthLaunderingResult.claims.truth_certified = true;
  const truthErrors = Core.validateVerificationResult(truthLaunderingResult);
  assert(truthErrors.includes('authority_verification_claims_truth'), `truth laundering not rejected: ${truthErrors.join(', ')}`);

  const outGrant = process.argv[2] || '/tmp/authority-grant.json';
  const outResult = process.argv[3] || '/tmp/authority-verification.json';
  write(outGrant, directGrant);
  write(outResult, positive);
  console.log(`authority-root tests passed; grant=${outGrant}; result=${outResult}`);
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
