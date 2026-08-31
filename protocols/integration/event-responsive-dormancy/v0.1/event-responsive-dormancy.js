'use strict';

const crypto = require('node:crypto');

const STATES = Object.freeze({
  NO_WAKE_SIGNAL_MATCH: 'NO_WAKE_SIGNAL_MATCH',
  WAKE_ATTENTION_ONLY: 'WAKE_ATTENTION_ONLY',
  RETURN_TO_DORMANCY_EVIDENCE_STALE: 'RETURN_TO_DORMANCY_EVIDENCE_STALE',
  RETURN_TO_DORMANCY_AUTHORITY_STALE: 'RETURN_TO_DORMANCY_AUTHORITY_STALE',
  RETURN_TO_DORMANCY_INTENT_CLOSED: 'RETURN_TO_DORMANCY_INTENT_CLOSED',
  READY_FOR_SEPARATE_ACTION_ADMISSION: 'READY_FOR_SEPARATE_ACTION_ADMISSION'
});

function fail(message) { throw new Error(message); }
function isObject(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
function exactKeys(obj, allowed, label) {
  for (const key of Object.keys(obj)) if (!allowed.has(key)) fail(`${label}: unknown field ${key}`);
}
function nonEmptyString(x, label) { if (typeof x !== 'string' || x.length === 0) fail(`${label} required`); }
function uniqueStrings(x, label, min = 0) {
  if (!Array.isArray(x) || x.length < min || x.some(v => typeof v !== 'string' || !v) || new Set(x).size !== x.length) {
    fail(`${label} must be unique non-empty strings`);
  }
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
function digest(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }

function validateDormantCapability(c) {
  if (!isObject(c)) fail('dormant capability required');
  exactKeys(c, new Set([
    'artifact_type','version','capability_id','context_ref','scope_ref','wake_signal_kinds','state',
    'checkpoint_refs','provenance_refs','predecessor','polling_enabled','background_activity_authorized',
    'active_process','authority_inherited','intent_inherited','action_permit_inherited','external_effect_authority'
  ]), 'dormant capability');
  if (c.artifact_type !== 'EventResponsiveDormantCapability' || c.version !== '0.1' || c.state !== 'DORMANT') {
    fail('dormant capability identity/state invalid');
  }
  for (const [v,l] of [[c.capability_id,'capability_id'],[c.context_ref,'context_ref'],[c.scope_ref,'scope_ref']]) nonEmptyString(v,l);
  uniqueStrings(c.wake_signal_kinds, 'wake_signal_kinds', 1);
  uniqueStrings(c.checkpoint_refs, 'checkpoint_refs');
  uniqueStrings(c.provenance_refs, 'provenance_refs', 1);
  if (!isObject(c.predecessor)) fail('predecessor required');
  exactKeys(c.predecessor, new Set(['run_id','epoch','lease_ref','intent_ref','action_permit_ref']), 'predecessor');
  nonEmptyString(c.predecessor.run_id,'predecessor.run_id');
  if (!Number.isInteger(c.predecessor.epoch) || c.predecessor.epoch < 1) fail('predecessor epoch invalid');
  for (const k of ['lease_ref','intent_ref','action_permit_ref']) {
    if (c.predecessor[k] !== null && (typeof c.predecessor[k] !== 'string' || !c.predecessor[k])) fail(`predecessor.${k} invalid`);
  }
  for (const k of ['polling_enabled','background_activity_authorized','active_process','authority_inherited',
                   'intent_inherited','action_permit_inherited','external_effect_authority']) {
    if (c[k] !== false) fail(`${k} must remain false`);
  }
  return true;
}

function validateWakeSignal(s) {
  if (!isObject(s)) fail('wake signal required');
  exactKeys(s, new Set(['artifact_type','version','signal_id','kind','context_ref','scope_ref','evidence_ref','source_assurance']), 'wake signal');
  if (s.artifact_type !== 'EventResponsiveWakeSignal' || s.version !== '0.1') fail('wake signal identity invalid');
  for (const k of ['signal_id','kind','context_ref','scope_ref','evidence_ref']) nonEmptyString(s[k], k);
  if (!['UNESTABLISHED','EVIDENCE_BOUND'].includes(s.source_assurance)) fail('source_assurance invalid');
  return true;
}

function validateChecks(checks) {
  if (checks === undefined || checks === null) return null;
  if (!isObject(checks)) fail('checks must be object or null');
  exactKeys(checks, new Set(['current_evidence','current_authority','intent_corridor']), 'checks');
  for (const k of ['current_evidence','current_authority','intent_corridor']) {
    if (typeof checks[k] !== 'boolean') fail(`checks.${k} boolean required`);
  }
  return checks;
}

function evaluateWake(input) {
  if (!isObject(input)) fail('input required');
  exactKeys(input, new Set(['dormant_capability','wake_signal','checks']), 'input');
  const c = input.dormant_capability;
  const s = input.wake_signal;
  validateDormantCapability(c);
  validateWakeSignal(s);
  const checks = validateChecks(input.checks);

  const matches = c.context_ref === s.context_ref &&
    c.scope_ref === s.scope_ref &&
    c.wake_signal_kinds.includes(s.kind);

  let state = STATES.NO_WAKE_SIGNAL_MATCH;
  let wakeAttention = false;
  let next = null;
  const outChecks = { current_evidence:null, current_authority:null, intent_corridor:null };

  if (matches) {
    wakeAttention = true;
    if (checks === null) {
      state = STATES.WAKE_ATTENTION_ONLY;
    } else {
      Object.assign(outChecks, checks);
      if (!checks.current_evidence) state = STATES.RETURN_TO_DORMANCY_EVIDENCE_STALE;
      else if (!checks.current_authority) state = STATES.RETURN_TO_DORMANCY_AUTHORITY_STALE;
      else if (!checks.intent_corridor) state = STATES.RETURN_TO_DORMANCY_INTENT_CLOSED;
      else {
        state = STATES.READY_FOR_SEPARATE_ACTION_ADMISSION;
        next = 'PreActionEvidenceBundle';
      }
    }
  }

  return {
    artifact_type:'EventResponsiveDormancyWakeReceipt',
    version:'0.1',
    capability_id:c.capability_id,
    dormant_capability_digest:digest(c),
    wake_signal_digest:digest(s),
    signal_id:s.signal_id,
    signal_matches_contract:matches,
    wake_attention_created:wakeAttention,
    state,
    checks:outChecks,
    preserved:{
      checkpoint_refs:[...c.checkpoint_refs],
      provenance_refs:[...c.provenance_refs],
      predecessor_run_id:c.predecessor.run_id,
      predecessor_epoch:c.predecessor.epoch
    },
    claims:{
      trigger_authorizes_action:false,
      old_authority_restored:false,
      old_intent_restored:false,
      old_action_permit_restored:false,
      background_polling_performed:false,
      background_activity_authorized:false,
      active_process_created:false,
      action_permit_created:false,
      authority_created:false,
      external_effect_authority_created:false,
      responsive_action_performed:false
    },
    next_admissible_interface:next,
    automatic_transition:false
  };
}

module.exports = { evaluateWake, validateDormantCapability, validateWakeSignal, digest, STATES };
