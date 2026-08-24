#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const dir = __dirname;
const record = JSON.parse(fs.readFileSync(path.join(dir, 'acceptance-audit.record.json'), 'utf8'));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}
function fail(msg) { throw new Error(msg); }

const copy = JSON.parse(JSON.stringify(record));
delete copy.content_hash;
const computed = 'sha256:' + crypto.createHash('sha256')
  .update(JSON.stringify(canonical(copy)))
  .digest('hex');

if (record.content_hash !== computed) fail(`content hash mismatch: ${record.content_hash} != ${computed}`);
if (record.protocol !== 'UU-AAP-AI-GATEWAY-LIVE-ACCEPTANCE-AUDIT') fail('wrong protocol');
if (record.version !== '0.1') fail('wrong version');
if (record.target.repository !== 'Matawaka/uu-aap') fail('wrong repository');
if (record.target.pr_number !== 338) fail('wrong PR');
if (record.target.merge_method !== 'squash') fail('wrong merge method');
if (record.target.expected_head_sha !== 'c53871937767f33919453c47dc667351455447f2') fail('wrong head');
if (record.target.expected_base_sha !== 'da0f964e39f83849ea9ddb34daef5839cb57f66f') fail('wrong base');
if (record.execution.merge_commit_sha !== '7fc2d1a459fa0e494e97b33491aa9ae984ebe3e5') fail('wrong successor');
if (record.observation.successor_parent !== record.target.expected_base_sha) fail('successor parent mismatch');
if (record.observation.main_after !== record.execution.merge_commit_sha) fail('observed main mismatch');
if (!record.execution.expected_head_guard_used) fail('expected-head guard missing');
if (!record.authorization.action_specific) fail('approval not action-specific');
if (record.authorization.general_authority_granted) fail('approval expanded authority');
if (record.authorization.future_action_authorized) fail('approval authorized future action');
if (record.pre_execution_evidence.persisted_gateway_decision_receipt) fail('post-hoc audit must not claim persisted pre-action GatewayDecisionReceipt');
if (record.pre_execution_evidence.persisted_core_action_permit) fail('post-hoc audit must not claim persisted pre-action ActionPermit');
if (record.pre_execution_evidence.durable_typed_pre_action_bundle_complete) fail('pre-action bundle must remain incomplete');
if (record.assessment.status !== 'partial_acceptance') fail('status must be partial_acceptance');
if (!record.assessment.actuator_frontier_acceptance) fail('actuator/frontier acceptance missing');
if (record.assessment.durable_pre_action_provenance_acceptance) fail('durable provenance cannot be accepted');
if (record.assessment.full_protocol_acceptance) fail('must not claim full protocol acceptance');
if (!record.assessment.post_hoc_permit_forbidden) fail('post-hoc permit prohibition missing');
for (const [k,v] of Object.entries(record.non_effects)) if (v !== false) fail(`non-effect ${k} must be false`);

console.log('UU_AAP_AI_GATEWAY_LIVE_ACCEPTANCE_AUDIT_V0_1_PASS');
