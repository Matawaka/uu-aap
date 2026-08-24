#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonicalize(value[k])]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function containsSecretLikeKey(value) {
  const banned = /(^|_)(token|secret|password|authorization|credential|private_key|api_key)($|_)/i;
  if (Array.isArray(value)) return value.some(containsSecretLikeKey);
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => banned.test(k) || containsSecretLikeKey(v));
  }
  return false;
}

function hasOverlap(a, b) {
  const seen = new Set(a || []);
  return (b || []).some(x => seen.has(x));
}

function runScenario(s) {
  const reasons = [];
  const a = s.authorized || {};
  const c = s.current_state || {};
  const t = s.transport || {};

  if (s.mode !== 'dry_run') reasons.push('mode_not_dry_run');
  if (s.live_execution_enabled !== false) reasons.push('live_execution_must_be_false');
  if (containsSecretLikeKey(s)) reasons.push('credential_material_forbidden');
  if (a.decision !== 'admissible') reasons.push('gateway_decision_not_admissible');
  if (!a.action_permit_hash) reasons.push('missing_action_permit');
  if (!a.approval_reference) reasons.push('missing_explicit_approval');
  if (a.operation !== 'merge_pr') reasons.push('operation_not_merge_pr');
  if (t.transport_defines_authority !== false) reasons.push('transport_defines_authority');
  if (t.tool_name !== 'uu_aap.github.actuate') reasons.push('unexpected_tool_name');
  if (c.repository !== a.repository) reasons.push('repository_mismatch');
  if (c.pr_number !== a.pr_number) reasons.push('pr_number_mismatch');
  if (c.head_sha !== a.expected_head_sha) reasons.push('stale_or_mismatched_head');
  if (c.base_sha !== a.expected_base_sha) reasons.push('stale_or_mismatched_base');
  if (!['squash','merge','rebase'].includes(a.merge_method)) reasons.push('unsupported_merge_method');
  if (hasOverlap(a.expected_effects, a.explicit_non_effects)) reasons.push('effect_non_effect_overlap');

  let planned_call = null;
  if (reasons.length === 0) {
    planned_call = {
      transport: t.type,
      tool_name: 'uu_aap.github.actuate',
      arguments: {
        provider: 'github',
        repository: a.repository,
        operation: a.operation,
        pr_number: a.pr_number,
        expected_head_sha: a.expected_head_sha,
        expected_base_sha: a.expected_base_sha,
        merge_method: a.merge_method,
        gateway_decision_hash: a.decision_hash,
        action_permit_hash: a.action_permit_hash,
        approval_reference: a.approval_reference
      }
    };
  }

  const report = {
    protocol: 'UU-AAP-AI-GATEWAY-REFERENCE-HARNESS',
    version: '0.1',
    artifact_type: 'HarnessReport',
    scenario_id: s.scenario_id,
    mode: 'dry_run',
    decision: reasons.length === 0 ? 'allow_plan' : 'deny',
    reasons,
    actuator_call_emitted: false,
    planned_call,
    non_effects: {
      network_accessed: false,
      credentials_read: false,
      github_mutation_performed: false,
      intent_created: false,
      authority_created: false,
      authority_expanded: false,
      action_permit_created: false,
      action_performed: false,
      causality_proven: false,
      truth_certified: false,
      liability_established: false
    }
  };
  report.content_hash = sha256(report);
  return report;
}

if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.error('usage: node run-harness.js <scenario-or-fixture.json> [scenario_id]');
    process.exit(2);
  }
  const data = JSON.parse(fs.readFileSync(input, 'utf8'));
  let scenario = data;
  if (Array.isArray(data.scenarios)) {
    const id = process.argv[3];
    scenario = id ? data.scenarios.find(x => x.scenario_id === id) : data.scenarios[0];
    if (!scenario) throw new Error('scenario not found');
  }
  process.stdout.write(JSON.stringify(runScenario(scenario), null, 2) + '\n');
}

module.exports = { runScenario, canonicalize, sha256 };
