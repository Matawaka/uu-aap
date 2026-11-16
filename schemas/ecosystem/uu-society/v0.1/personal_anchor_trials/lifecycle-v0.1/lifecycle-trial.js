'use strict';

// Repository-owned synthetic experiment. Not an authenticator or live gateway.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../../../../../..');
const integration = path.join(ROOT, 'protocols/integration');
const { validateDecision, hashWithoutContentHash, stable } = require(path.join(
  integration, 'execute-revalidation/v0.1/validate-parameterized-decision.js'));
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const clone = value => structuredClone(value);
const hash = value => 'sha256:' + crypto.createHash('sha256').update(stable(value)).digest('hex');
const START = Date.parse('2026-11-16T12:00:00.000Z');
const fields = ['session_id', 'intent_id', 'target_hash', 'control_epoch'];
const alwaysFalse = Object.freeze({
  identity_established: false, causal_continuity_proven: false,
  guilt_established: false, authority_created: false, live_permit_consumed: false,
  action_performed: false, biometric_model_executed: false,
});

function seal(value) {
  value.content_hash = hashWithoutContentHash(value);
  return value;
}
function check(ok, reason) { if (!ok) throw new Error(reason); }
function integer(value, min, max, label) {
  check(Number.isSafeInteger(value) && value >= min && value <= max, label);
}
function sourceReason(message) {
  if (message.startsWith('stale execute revalidation:')) return 'EXPIRED_SOURCE_BOUND';
  if (message.startsWith('source admission decision:')) return 'CURRENT_ADMISSION_DENIED';
  if (message.startsWith('authorize admission hash:')) return 'CURRENT_ADMISSION_CHANGED';
  if (message.startsWith('freshness ')) return 'CURRENT_FRESHNESS_BINDING_CHANGED';
  if (message.startsWith('action binding ')) return 'CURRENT_ACTION_BINDING_CHANGED';
  return 'OTHER_CONTRACT_REJECTION';
}

class LifecycleTrial {
  constructor(mode = 'fresh_boundary', gate = validateDecision) {
    check(['fresh_boundary', 'cached_boundary'].includes(mode), 'unknown experiment arm');
    this.mode = mode;
    this.gate = gate;
    this.now = 0;
    this.sourceAvailable = true;
    this.requests = new Map();
    this.receipts = [];
    this.context = {
      session_id: 'synthetic-session-1', intent_id: 'synthetic-intent-1',
      target_hash: hash('synthetic-target-1'), control_epoch: 1,
    };
    this.source = read(path.join(integration,
      'pre-action-authorize-admission/v0.1/conformance.fixture.json'));
    this.source.evaluated_at = this.iso();
    for (const field of ['availability_valid_until', 'approval_valid_until',
      'permit_expires_at', 'authorization_must_occur_by']) {
      this.source.freshness_binding[field] = this.iso(60000);
    }
    this.source.action_binding.target_binding_hash = this.context.target_hash;
    seal(this.source);
  }

  iso(now = this.now) { return new Date(START + now).toISOString(); }

  advance(ms) {
    integer(ms, 0, 3600000, 'invalid model-clock increment');
    integer(this.now + ms, 0, 3600000, 'model-clock horizon exceeded');
    this.now += ms;
  }

  boundary() {
    check(this.sourceAvailable, 'CURRENT_SOURCE_UNAVAILABLE');
    return { now: this.now, source: clone(this.source), context: clone(this.context) };
  }

  issue(id, ttl = 30000) {
    check(typeof id === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(id), 'invalid request id');
    check(!this.requests.has(id), 'request id already retained');
    check(this.requests.size < 64, 'retained-request capacity reached');
    integer(ttl, 1, 120000, 'invalid synthetic response TTL');
    const boundary = this.boundary();
    const decision = read(path.join(integration,
      'execute-revalidation/v0.1/conformance.fixture.json'));
    decision.evaluated_at = this.iso();
    decision.authorize_admission_ref.assessment_id = boundary.source.assessment_id;
    decision.authorize_admission_ref.content_hash = boundary.source.content_hash;
    decision.subject = clone(boundary.source.subject);
    decision.action_binding = clone(boundary.source.action_binding);
    decision.freshness_binding = clone(boundary.source.freshness_binding);
    decision.freshness_binding.execute_revalidation_must_occur_by =
      boundary.source.freshness_binding.authorization_must_occur_by;
    seal(decision);
    const publicRequest = {
      request_id: id, ...clone(this.context), issued_ms: this.now,
      expires_ms: this.now + ttl,
      // Deterministic PUBLIC nonce label. No unpredictability/security claim.
      nonce: hash({ id, sequence: this.requests.size, boundary: this.context, now: this.now }),
    };
    this.requests.set(id, { publicRequest, boundary, decision, completed: false });
    return clone(publicRequest);
  }

  revoke() { this.source.decision.status = 'denied'; seal(this.source); }

  rotate() {
    this.context.control_epoch += 1;
    this.source.freshness_binding.approval_hash = hash(['approval', this.context.control_epoch]);
    this.source.freshness_binding.action_permit_hash = hash(['permit', this.context.control_epoch]);
    seal(this.source);
  }

  changeIntent() { this.context.intent_id += '-successor'; }

  changeTarget() {
    this.context.target_hash = hash([this.context.target_hash, 'successor']);
    this.source.action_binding.target_binding_hash = this.context.target_hash;
    seal(this.source);
  }

  response(id, overrides = {}) {
    const request = this.requests.get(id);
    check(request, 'unknown request');
    const p = request.publicRequest;
    return { request_id: id, nonce: p.nonce,
      ...Object.fromEntries(fields.map(field => [field, p[field]])),
      assessment: 'consistent', confidence: 0.99,
      response_commitment: hash('all synthetic historical answers may be public'),
      ...overrides,
    };
  }

  complete(id, response) {
    check(this.receipts.length < 256, 'receipt capacity reached');
    const allowedKeys = new Set(['request_id', 'nonce', ...fields,
      'assessment', 'confidence', 'response_commitment', 'claimed_at']);
    check(response && typeof response === 'object' && !Array.isArray(response), 'invalid response');
    check(Object.keys(response).every(key => allowedKeys.has(key)), 'unexpected response field');
    for (const key of ['request_id', 'nonce', 'session_id', 'intent_id', 'target_hash', 'response_commitment']) {
      check(typeof response[key] === 'string' && response[key].length > 0 &&
        response[key].length <= 128, `invalid ${key}`);
    }
    check(/^sha256:[0-9a-f]{64}$/.test(response.response_commitment), 'invalid response commitment');
    integer(response.control_epoch, 1, 1000, 'invalid control epoch');
    check(['consistent', 'inconsistent', 'unknown'].includes(response.assessment), 'invalid assessment');
    check(response.confidence === null || (Number.isFinite(response.confidence) &&
      response.confidence >= 0 && response.confidence <= 1), 'invalid confidence');
    if ('claimed_at' in response) check(typeof response.claimed_at === 'string' &&
      response.claimed_at.length <= 64, 'invalid client timestamp');

    const request = this.requests.get(id);
    const receipt = {
      request_id: id, actual_model_clock_ms: this.now, boundary_clock_ms: null,
      response_status: 'UNKNOWN_REQUEST', response_assessment: response.assessment,
      evidence_commitment: hash(response), contract_status: 'NOT_EVALUATED',
      contract_reason: null, source_hash_observed: null, source_status_observed: null,
      input_time_ignored: true, ...alwaysFalse,
    };
    if (request?.completed) receipt.response_status = 'LOCAL_REPLAY_REJECTED';
    else if (request) {
      let boundary;
      try {
        boundary = this.mode === 'fresh_boundary' ? this.boundary() : clone(request.boundary);
      } catch (error) {
        if (error.message !== 'CURRENT_SOURCE_UNAVAILABLE') throw error;
        receipt.response_status = 'CURRENT_SOURCE_UNAVAILABLE';
      }
      if (boundary) {
        const p = request.publicRequest;
        receipt.boundary_clock_ms = boundary.now;
        receipt.source_hash_observed = boundary.source.content_hash;
        receipt.source_status_observed = boundary.source.decision.status;
        if (response.request_id !== id || response.nonce !== p.nonce ||
          fields.some(field => response[field] !== p[field])) {
          receipt.response_status = 'RESPONSE_BINDING_MISMATCH';
        } else if (boundary.now >= p.expires_ms) {
          receipt.response_status = 'RESPONSE_EXPIRED';
        } else if (fields.some(field => boundary.context[field] !== p[field])) {
          receipt.response_status = 'CURRENT_CONTEXT_CHANGED';
        } else {
          receipt.response_status = 'RECORDED_EVIDENCE_ONLY';
          request.completed = true;
        }
        // Separate plane: contract consistency is not person/intent proof.
        // Even a rejected response can have a currently consistent admission.
        const candidate = clone(request.decision);
        candidate.evaluated_at = this.iso(boundary.now);
        // A new audit cites its observed source; old inner bindings remain
        // unchanged. The retained first-phase record is never rewritten.
        candidate.authorize_admission_ref.content_hash = boundary.source.content_hash;
        seal(candidate);
        try {
          this.gate(candidate, boundary.source);
          receipt.contract_status = 'READY';
        } catch (error) {
          receipt.contract_status = 'REJECTED';
          receipt.contract_reason = sourceReason(error.message);
        }
      }
    }
    receipt.receipt_hash = hash(receipt);
    this.receipts.push(clone(receipt));
    return clone(receipt);
  }
}

function runScenario(scenario, mode = 'fresh_boundary') {
  check(Array.isArray(scenario.events) && scenario.events.length <= 128, 'invalid event tape');
  const trial = new LifecycleTrial(mode);
  for (const e of scenario.events) {
    switch (e.type) {
      case 'issue': trial.issue(e.id, e.ttl_ms); break;
      case 'backlog':
        integer(e.count, 1, 63, 'invalid backlog size');
        for (let i = 0; i < e.count; i++) trial.issue(`backlog-${i}`);
        break;
      case 'advance': trial.advance(e.ms); break;
      case 'revoke': trial.revoke(); break;
      case 'rotate': trial.rotate(); break;
      case 'change_intent': trial.changeIntent(); break;
      case 'change_target': trial.changeTarget(); break;
      case 'source_unavailable': trial.sourceAvailable = false; break;
      case 'complete': trial.complete(e.id, trial.response(e.id, e.response)); break;
      default: throw new Error('unknown event type');
    }
  }
  return { scenario_id: scenario.id, arm: mode, scenario_hash: hash(scenario),
    retained_request_count: trial.requests.size, receipts: clone(trial.receipts), ...alwaysFalse };
}

module.exports = { LifecycleTrial, runScenario, hash, alwaysFalse, ROOT };
