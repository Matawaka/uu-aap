#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const dir = __dirname;
const bundle = JSON.parse(fs.readFileSync(path.join(dir, 'conformance.fixture.json'), 'utf8'));

function fail(msg) { throw new Error(msg); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}
function hashObject(value, prefix = '') {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.content_hash;
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify(canonical(copy)))
    .digest('hex');
  return prefix + digest;
}
function assertHash(value, prefix = '') {
  const expected = hashObject(value, prefix);
  if (value.content_hash !== expected) fail(`content hash mismatch for ${value.receipt_type || value.artifact_type || 'object'}: ${value.content_hash} != ${expected}`);
}
function stripSha256(value) {
  return value.startsWith('sha256:') ? value.slice(7) : value;
}
function refFor(receipt, frontier) {
  return {receipt_type: receipt.receipt_type, content_hash: stripSha256(receipt.content_hash), frontier};
}
function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }

if (bundle.protocol !== 'UU-AAP-AI-GATEWAY-LIVE-PRE-ACTION-BUNDLE') fail('wrong protocol');
if (bundle.version !== '0.1') fail('wrong version');
if (bundle.artifact_type !== 'LivePreActionBundle') fail('wrong artifact type');
if (bundle.experiment_issue !== 339) fail('wrong experiment issue');
if (!['synthetic_conformance','observed_pre_action'].includes(bundle.evidence_class)) fail('invalid evidence class');

assertHash(bundle, 'sha256:');

const state = bundle.core.state_receipt;
const intent = bundle.core.intent_receipt;
const authority = bundle.core.authority_or_responsibility_receipt;
const coordination = bundle.core.coordination_receipt;
const permit = bundle.core.action_permit;
const core = [state,intent,authority,coordination,permit];

const types = core.map(r => r.receipt_type);
if (types[0] !== 'StateReceipt') fail('StateReceipt missing');
if (types[1] !== 'IntentReceipt') fail('IntentReceipt missing');
if (!['AuthorityReceipt','ResponsibilityReceipt'].includes(types[2])) fail('Authority/Responsibility receipt missing');
if (types[3] !== 'CoordinationReceipt') fail('CoordinationReceipt missing');
if (types[4] !== 'ActionPermit') fail('ActionPermit missing');

for (const r of core) {
  if (r.protocol !== 'UU-AAP Core' || r.version !== '0.1') fail(`wrong Core envelope for ${r.receipt_type}`);
  assertHash(r, 'sha256:');
}

const expectedFrontier = `git:${bundle.frontier.repository}@${bundle.frontier.revision}`;
if (bundle.target.repository !== bundle.frontier.repository) fail('target repository/frontier repository mismatch');
if (bundle.target.expected_base_sha !== bundle.frontier.revision) fail('target base/frontier revision mismatch');

for (const r of core) {
  if (r.frontier.revision !== expectedFrontier) fail(`${r.receipt_type} frontier mismatch`);
  if (!same(r.subject, state.subject)) fail(`${r.receipt_type} subject mismatch`);
}

if (!permit.assertions.action_permitted || !permit.assertions.exact_target_bound) fail('ActionPermit not exact-target permitted');
if (!same(permit.payload.target, bundle.target)) fail('ActionPermit target mismatch');
if (permit.payload.gate !== 'fail_closed') fail('ActionPermit must fail closed');
if (permit.payload.one_shot !== true || permit.payload.consumed !== false) fail('ActionPermit one-shot state invalid');
if (permit.payload.expires_at !== bundle.lifetime.expires_at) fail('ActionPermit expiry mismatch');
if (bundle.lifetime.one_shot !== true || bundle.lifetime.consumed !== false) fail('bundle one-shot state invalid');

const issued = Date.parse(bundle.lifetime.issued_at);
const expires = Date.parse(bundle.lifetime.expires_at);
if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) fail('invalid permit lifetime');
if ((expires - issued) > 10 * 60 * 1000) fail('permit lifetime exceeds 10 minutes');

const requiredPermitPreds = [state,intent,authority,coordination].map(r => r.content_hash);
for (const h of requiredPermitPreds) if (!permit.predecessor_receipt_hashes.includes(h)) fail(`ActionPermit missing predecessor ${h}`);

if (!coordination.assertions.coordination_established) fail('coordination not established');
if (!coordination.assertions.action_specific_human_approval_bound) fail('action-specific approval not bound');
const cApproval = coordination.payload && coordination.payload.approval;
if (!cApproval) fail('CoordinationReceipt approval payload missing');
if (cApproval.approval_text_sha256 !== bundle.approval.approval_text_sha256) fail('approval hash mismatch');
if (cApproval.evidence_uri !== bundle.approval.evidence_uri) fail('approval evidence URI mismatch');
if (cApproval.action_specific !== true) fail('approval not action-specific');
if (cApproval.general_authority_granted !== false || cApproval.future_action_authorized !== false) fail('approval broadened authority');
if (bundle.approval.protocol_mode_consent_reused !== false) fail('protocol-mode consent reused as approval');

const request = bundle.gateway.request;
const decision = bundle.gateway.decision_receipt;
assertHash(request, '');
assertHash(decision, '');

if (request.protocol !== 'UU-AAP-AI-GATEWAY' || request.artifact_type !== 'GatewayRequest') fail('bad GatewayRequest');
if (request.operation !== 'authorize') fail('GatewayRequest must authorize');
if (request.frontier !== expectedFrontier) fail('GatewayRequest frontier mismatch');
if (request.subject !== state.subject.id) fail('GatewayRequest subject mismatch');
if (!request.action.external_effect || request.action.read_only) fail('live merge request effect classification invalid');
if (!request.action.requires_approval) fail('merge request must require approval');
if (request.protocol_mode_consent.blanket_action_approval !== false) fail('blanket gateway approval forbidden');

const expectedRefs = core.map(r => refFor(r, expectedFrontier));
for (const expected of expectedRefs) {
  const got = request.core_receipts.find(r => r.receipt_type === expected.receipt_type);
  if (!got || !same(got, expected)) fail(`GatewayRequest missing exact ${expected.receipt_type} ref`);
}
const approvalRef = refFor(coordination, expectedFrontier);
if (!same(request.approval_ref, approvalRef)) fail('GatewayRequest approval_ref mismatch');

if (decision.protocol !== 'UU-AAP-AI-GATEWAY' || decision.receipt_type !== 'GatewayDecisionReceipt') fail('bad GatewayDecisionReceipt');
if (decision.result !== 'admissible') fail('GatewayDecisionReceipt must be admissible');
if (decision.request_hash !== request.content_hash) fail('GatewayDecision request hash mismatch');
if (decision.request_id !== request.request_id || decision.frontier !== request.frontier || decision.subject !== request.subject) fail('GatewayDecision request binding mismatch');

for (const expected of expectedRefs) {
  const got = decision.evidence_refs.find(r => r.receipt_type === expected.receipt_type);
  if (!got || !same(got, expected)) fail(`GatewayDecision missing exact ${expected.receipt_type} evidence`);
}
for (const [k,v] of Object.entries(decision.non_effects)) if (v !== false) fail(`GatewayDecision non-effect ${k} must be false`);

if (!bundle.execution_boundary.prepared_before_execution) fail('bundle not marked pre-execution');
for (const k of ['actuator_call_emitted','network_accessed','github_mutation_performed','action_performed']) {
  if (bundle.execution_boundary[k] !== false) fail(`pre-action boundary ${k} must be false`);
}
for (const [k,v] of Object.entries(bundle.non_effects)) if (v !== false) fail(`bundle non-effect ${k} must be false`);

if (bundle.evidence_class === 'synthetic_conformance') {
  if (!bundle.approval.evidence_uri.startsWith('urn:synthetic:')) fail('synthetic fixture must use synthetic approval evidence');
}

console.log('UU_AAP_AI_GATEWAY_LIVE_PRE_ACTION_BUNDLE_V0_1_PASS');
