#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const dir = __dirname;
const fixturePath = path.join(dir, 'conformance.fixture.json');
const record = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}
function hashObject(value) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
function fail(msg) { throw new Error(msg); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function expectReject(name, mutate) {
  const candidate = clone(record);
  mutate(candidate);
  try {
    validate(candidate);
  } catch (_) {
    return;
  }
  fail(`negative test unexpectedly accepted: ${name}`);
}
function parseTime(v, name) {
  const t = Date.parse(v);
  if (!Number.isFinite(t)) fail(`invalid time: ${name}`);
  return t;
}
function sameRef(a, b, label) {
  if (!a || !b || a.receipt_type !== b.receipt_type ||
      a.content_hash !== b.content_hash || a.frontier !== b.frontier) {
    fail(`${label} mismatch`);
  }
}
function assertFalseObject(obj, label) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== false) fail(`${label}.${k} must be false`);
  }
}

function validate(r) {
  if (r.protocol !== 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE') fail('wrong protocol');
  if (r.version !== '0.1') fail('wrong version');
  if (r.artifact_type !== 'BoundedExecutionLifecycleRecord') fail('wrong artifact type');

  const copy = clone(r);
  delete copy.content_hash;
  const computed = hashObject(copy);
  if (r.content_hash !== computed) fail(`content hash mismatch: ${r.content_hash} != ${computed}`);

  if (r.action.effect_class !== 'external_effect') fail('profile is for external effects');
  if (!Array.isArray(r.action.expected_effects) || r.action.expected_effects.length === 0) fail('expected effects missing');
  const overlap = r.action.expected_effects.filter(x => r.action.explicit_non_effects.includes(x));
  if (overlap.length) fail(`effects/non-effects overlap: ${overlap.join(',')}`);
  if (r.action.authority_scope !== r.target.authority_scope) fail('authority scope mismatch');

  const targetCore = clone(r.target);
  delete targetCore.binding_hash;
  if (r.target.binding_hash !== hashObject(targetCore)) fail('target binding hash mismatch');

  const p = r.phases.prepare;
  const a = r.phases.authorize;
  const x = r.phases.execute;
  const o = r.phases.observe;
  const c = r.phases.close;
  if (!p || !a || !x || !o || !c) fail('all five phases are required');

  if (p.status !== 'prepared' || a.status !== 'authorized' || x.status !== 'executed' ||
      o.status !== 'observed' || c.status !== 'completed') fail('wrong phase status');

  const predecessor = r.target.expected_predecessor_frontier;
  if (p.frontier !== predecessor || a.frontier !== predecessor || x.frontier !== predecessor ||
      o.predecessor_frontier !== predecessor) fail('predecessor frontier mismatch');

  for (const [name, ref] of [
    ['StateReceipt', p.state_receipt_ref],
    ['IntentReceipt', p.intent_receipt_ref],
    ['CoordinationReceipt', p.coordination_receipt_ref]
  ]) {
    if (ref.receipt_type !== name || ref.frontier !== predecessor) fail(`${name} preparation ref mismatch`);
  }
  if (!['AuthorityReceipt','ResponsibilityReceipt'].includes(p.authority_or_responsibility_receipt_ref.receipt_type) ||
      p.authority_or_responsibility_receipt_ref.frontier !== predecessor) {
    fail('authority/responsibility preparation ref mismatch');
  }

  if (p.target_binding_hash !== r.target.binding_hash ||
      a.target_binding_hash !== r.target.binding_hash ||
      x.target_binding_hash !== r.target.binding_hash) fail('target substitution detected');

  if (!p.assertions.target_exactly_bound || !p.assertions.evidence_complete) fail('prepare assertions incomplete');
  if (p.non_effects.action_permit_created !== false ||
      p.non_effects.action_performed !== false ||
      p.non_effects.authority_expanded !== false) fail('prepare emitted forbidden effect');

  if (a.action_permit_ref.receipt_type !== 'ActionPermit' || a.action_permit_ref.frontier !== predecessor) fail('ActionPermit ref mismatch');
  if (!a.one_shot || a.consumed) fail('permit must be one-shot and unconsumed before execution');
  if (!a.assertions.action_specific || !a.assertions.exact_target_bound || !a.assertions.permit_preexists_admission) fail('authorize assertions incomplete');
  if (a.non_effects.action_performed !== false ||
      a.non_effects.authority_expanded !== false ||
      a.non_effects.future_action_authorized !== false ||
      a.non_effects.action_permit_created_by_adapter !== false) fail('authorize emitted forbidden effect');
  if (r.action.requires_approval && !a.approval_ref) fail('approval required but missing');
  if (a.approval_ref && a.approval_ref.frontier !== predecessor) fail('approval frontier mismatch');
  if (a.admission_assessment_ref && a.admission_assessment_ref.frontier !== predecessor) fail('admission frontier mismatch');

  sameRef(a.action_permit_ref, x.action_permit_ref, 'ActionPermit authorization/execution');
  if (x.action_receipt_ref.receipt_type !== 'ActionReceipt' || x.action_receipt_ref.frontier !== predecessor) fail('ActionReceipt must remain on predecessor frontier');
  if (!x.actuator.expected_target_guard_used) fail('fail-closed target guard missing');
  if (!x.one_shot_consumed) fail('one-shot permit not consumed by execution');
  if (!x.assertions.exact_target_used || !x.assertions.external_action_emitted) fail('execute assertions incomplete');
  if (x.non_effects.outcome_observed !== false ||
      x.non_effects.authority_expanded !== false ||
      x.non_effects.future_action_authorized !== false) fail('execute non-effects violated');

  if (o.actuator_evidence_ref.frontier !== o.observed_frontier) fail('actuator evidence must use observed frontier');
  if (o.outcome_receipt_ref.receipt_type !== 'OutcomeReceipt' || o.outcome_receipt_ref.frontier !== o.observed_frontier) fail('OutcomeReceipt successor frontier mismatch');
  if (o.successor_state_receipt_ref.receipt_type !== 'SuccessorStateReceipt' || o.successor_state_receipt_ref.frontier !== o.observed_frontier) fail('SuccessorStateReceipt successor frontier mismatch');
  if (!o.assertions.observation_not_execution || !o.assertions.outcome_not_causality) fail('observation boundary assertions missing');
  if (o.non_effects.action_performed_by_observer !== false ||
      o.non_effects.causality_proven !== false ||
      o.non_effects.truth_certified !== false ||
      o.non_effects.liability_established !== false) fail('observe non-effects violated');

  if (c.final_frontier !== o.observed_frontier) fail('closure frontier mismatch');
  if (!c.assertions.lifecycle_closed || !c.assertions.permit_consumed || !c.assertions.target_scope_exhausted) fail('closure assertions incomplete');
  if (c.non_effects.future_action_authorized !== false ||
      c.non_effects.general_authority_created !== false ||
      c.non_effects.liability_established !== false) fail('closure expanded authority or liability');

  const tp = parseTime(p.prepared_at, 'prepared_at');
  const tpi = parseTime(a.action_permit_issued_at, 'action_permit_issued_at');
  const ta = parseTime(a.authorized_at, 'authorized_at');
  const te = parseTime(x.executed_at, 'executed_at');
  const tex = parseTime(a.expires_at, 'expires_at');
  const to = parseTime(o.observed_at, 'observed_at');
  const tc = parseTime(c.closed_at, 'closed_at');
  if (!(tp <= tpi && tpi <= ta && ta < te && te <= to && to <= tc)) fail('phase time ordering invalid');
  if (te > tex) fail('execution occurred after permit expiry');
  if (a.admission_assessment_ref) {
    if (!a.admission_assessed_at) fail('admission assessment time missing');
    const tad = parseTime(a.admission_assessed_at, 'admission_assessed_at');
    if (tpi > tad) fail('adapter admission predates Core ActionPermit');
  }

  assertFalseObject(r.non_effects, 'record.non_effects');

  // Provider neutrality: no mandatory provider field exists and fixture adapter ids are URNs.
  for (const key of Object.keys(r)) {
    if (['provider','vendor','github','openai','kontur','mcp'].includes(key.toLowerCase())) {
      fail(`provider-specific mandatory top-level dependency: ${key}`);
    }
  }

  return true;
}

validate(record);

expectReject('target substitution', r => {
  r.target.operation = 'delete';
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('missing required approval', r => {
  delete r.phases.authorize.approval_ref;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('adapter creates ActionPermit', r => {
  r.phases.authorize.non_effects.action_permit_created_by_adapter = true;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('permit substitution at execution', r => {
  r.phases.execute.action_permit_ref.content_hash = 'sha256:' + 'c'.repeat(64);
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('execution after expiry', r => {
  r.phases.execute.executed_at = '2026-08-24T18:06:00Z';
  r.phases.observe.observed_at = '2026-08-24T18:06:10Z';
  r.phases.close.closed_at = '2026-08-24T18:06:20Z';
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('permit consumed before execution', r => {
  r.phases.authorize.consumed = true;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('prepare performs action', r => {
  r.phases.prepare.non_effects.action_performed = true;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('ActionReceipt relabelled to successor', r => {
  r.phases.execute.action_receipt_ref.frontier = r.phases.observe.observed_frontier;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('OutcomeReceipt relabelled to predecessor', r => {
  r.phases.observe.outcome_receipt_ref.frontier = r.phases.prepare.frontier;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('observer claims execution', r => {
  r.phases.observe.non_effects.action_performed_by_observer = true;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('observer claims causality', r => {
  r.phases.observe.non_effects.causality_proven = true;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('closure grants future authority', r => {
  r.phases.close.non_effects.future_action_authorized = true;
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('effects overlap', r => {
  r.action.explicit_non_effects.push('demo_state_change');
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('phase time reversal', r => {
  r.phases.execute.executed_at = '2026-08-24T17:59:00Z';
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});
expectReject('adapter assessment predates Core permit', r => {
  r.phases.authorize.admission_assessed_at = '2026-08-24T18:00:09Z';
  const copy = clone(r); delete copy.content_hash; r.content_hash = hashObject(copy);
});

console.log('UU_AAP_BOUNDED_EXECUTION_LIFECYCLE_V0_1_PASS');
