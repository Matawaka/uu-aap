'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class DLCSIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DLCSIError';
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new DLCSIError(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, expectedKeys, label) {
  requireCondition(isObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys mismatch: expected ${expected.join(', ')}, got ${actual.join(', ')}`);
}

function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}

function assertStringArray(value, label, { minItems = 1, requireValue = null } = {}) {
  requireCondition(Array.isArray(value), `${label} must be an array`);
  requireCondition(value.length >= minItems, `${label} requires at least ${minItems} item(s)`);
  value.forEach((item, index) => assertString(item, `${label}[${index}]`));
  requireCondition(new Set(value).size === value.length, `${label} must contain unique values`);
  if (requireValue !== null) requireCondition(value.includes(requireValue), `${label} must contain ${requireValue}`);
}

function isRfc3339(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const hour = Number(match[4]); const minute = Number(match[5]); const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function parseInstant(value, label) {
  requireCondition(isRfc3339(value), `${label} must be RFC 3339 date-time`);
  const ms = Date.parse(value);
  requireCondition(Number.isFinite(ms), `${label} must be a valid instant`);
  return ms;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}
function canonicalFingerprint(receipt) {
  const projected = clone(receipt);
  projected.fingerprint_sha256 = '';
  const canonical = JSON.stringify(canonicalize(projected));
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}
function sortedUnique(values) { return [...new Set(values)].sort(); }
function canonicalLease(lease) {
  if (lease === null) return null;
  return {
    authority_ref: lease.authority_ref,
    scope: sortedUnique(lease.scope),
    starts_at: lease.starts_at,
    expires_at: lease.expires_at,
    revocation_conditions: sortedUnique(lease.revocation_conditions),
    revisit_triggers: sortedUnique(lease.revisit_triggers),
    successor_state_constraints: sortedUnique(lease.successor_state_constraints)
  };
}

const TOP_LEVEL_KEYS = ['protocol', 'version', 'profile', 'contention_id', 'source_conflict_refs', 'claims', 'interface', 'conflict', 'proposed_resolution', 'safe_work', 'evaluated_at'];

function validateContention(contention) {
  assertExactKeys(contention, TOP_LEVEL_KEYS, 'contention');
  requireCondition(contention.protocol === 'DLC-SI', 'protocol must be DLC-SI');
  requireCondition(contention.version === '0.1', 'version must be 0.1');
  requireCondition(contention.profile === 'dual-legitimacy-singular-interface-v0.1', 'profile mismatch');
  assertString(contention.contention_id, 'contention_id', /^[a-z][a-z0-9-]{2,95}$/);
  assertStringArray(contention.source_conflict_refs, 'source_conflict_refs');

  requireCondition(Array.isArray(contention.claims), 'claims must be an array');
  requireCondition(contention.claims.length >= 2, 'claims requires at least two legitimate claims');
  const claimIds = [];
  contention.claims.forEach((claim, index) => {
    assertExactKeys(claim, ['claim_id', 'legitimacy_ref', 'successor_state_ref'], `claims[${index}]`);
    assertString(claim.claim_id, `claims[${index}].claim_id`, /^[a-z][a-z0-9-]{1,95}$/);
    assertString(claim.legitimacy_ref, `claims[${index}].legitimacy_ref`);
    assertString(claim.successor_state_ref, `claims[${index}].successor_state_ref`);
    claimIds.push(claim.claim_id);
  });
  requireCondition(new Set(claimIds).size === claimIds.length, 'claim_id values must be unique');

  assertExactKeys(contention.interface, ['interface_id', 'output_capacity'], 'interface');
  assertString(contention.interface.interface_id, 'interface.interface_id', /^[a-z][a-z0-9-]{1,95}$/);
  requireCondition(contention.interface.output_capacity === 1, 'first slice requires interface.output_capacity = 1');

  assertExactKeys(contention.conflict, ['type', 'claim_relation', 'successor_relation'], 'conflict');
  requireCondition(['epistemic', 'normative', 'resource', 'temporal', 'interface_capacity', 'referential'].includes(contention.conflict.type), 'conflict.type invalid');
  requireCondition(contention.conflict.claim_relation === 'INCOMPARABLE', 'first slice requires INCOMPARABLE claims');
  requireCondition(contention.conflict.successor_relation === 'INCOMPATIBLE', 'first slice requires INCOMPATIBLE successor states');

  assertExactKeys(contention.proposed_resolution, ['mode', 'selected_claim_id', 'justification', 'lease', 'revisit_triggers'], 'proposed_resolution');
  const resolution = contention.proposed_resolution;
  requireCondition(['TEMPORARY_PRECEDENCE', 'DEFERRED', 'UNRESOLVED'].includes(resolution.mode), 'proposed_resolution.mode invalid');
  assertString(resolution.justification, 'proposed_resolution.justification');
  assertStringArray(resolution.revisit_triggers, 'proposed_resolution.revisit_triggers');

  if (resolution.mode === 'TEMPORARY_PRECEDENCE') {
    assertString(resolution.selected_claim_id, 'proposed_resolution.selected_claim_id');
    requireCondition(claimIds.includes(resolution.selected_claim_id), 'selected_claim_id must reference an existing claim');
    assertExactKeys(resolution.lease, ['authority_ref', 'scope', 'starts_at', 'expires_at', 'revocation_conditions', 'revisit_triggers', 'successor_state_constraints'], 'proposed_resolution.lease');
    assertString(resolution.lease.authority_ref, 'proposed_resolution.lease.authority_ref');
    assertStringArray(resolution.lease.scope, 'proposed_resolution.lease.scope');
    const startsAt = parseInstant(resolution.lease.starts_at, 'proposed_resolution.lease.starts_at');
    const expiresAt = parseInstant(resolution.lease.expires_at, 'proposed_resolution.lease.expires_at');
    requireCondition(expiresAt > startsAt, 'precedence lease expires_at must be after starts_at');
    assertStringArray(resolution.lease.revocation_conditions, 'proposed_resolution.lease.revocation_conditions');
    assertStringArray(resolution.lease.revisit_triggers, 'proposed_resolution.lease.revisit_triggers', { requireValue: 'lease_expiry' });
    assertStringArray(resolution.lease.successor_state_constraints, 'proposed_resolution.lease.successor_state_constraints');
    requireCondition(resolution.revisit_triggers.includes('lease_expiry'), 'TEMPORARY_PRECEDENCE proposed_resolution.revisit_triggers must contain lease_expiry');
  } else {
    requireCondition(resolution.selected_claim_id === null, `${resolution.mode} must not select a claim`);
    requireCondition(resolution.lease === null, `${resolution.mode} must not contain a lease`);
  }

  assertStringArray(contention.safe_work, 'safe_work');
  parseInstant(contention.evaluated_at, 'evaluated_at');
  return true;
}

function buildReceipt(contention) {
  validateContention(contention);
  const claims = [...contention.claims].map(claim => ({ claim_id: claim.claim_id, legitimacy_ref: claim.legitimacy_ref, successor_state_ref: claim.successor_state_ref })).sort((a, b) => a.claim_id.localeCompare(b.claim_id));
  const resolution = contention.proposed_resolution;
  const evaluatedAt = parseInstant(contention.evaluated_at, 'evaluated_at');
  let status = resolution.mode;
  let selectedClaimId = null;
  let formerSelectedClaimId = null;
  let precedenceEffective = false;
  let actionGateCandidate = false;
  let irreversibleConflictFrozen = true;
  let lease = null;
  let reopenedBy = [];

  if (resolution.mode === 'TEMPORARY_PRECEDENCE') {
    const startsAt = parseInstant(resolution.lease.starts_at, 'proposed_resolution.lease.starts_at');
    const expiresAt = parseInstant(resolution.lease.expires_at, 'proposed_resolution.lease.expires_at');
    lease = canonicalLease(resolution.lease);
    if (evaluatedAt >= expiresAt) {
      status = 'UNRESOLVED';
      formerSelectedClaimId = resolution.selected_claim_id;
      reopenedBy = ['lease_expiry'];
    } else if (evaluatedAt < startsAt) {
      throw new DLCSIError('TEMPORARY_PRECEDENCE lease is not active at evaluated_at');
    } else {
      selectedClaimId = resolution.selected_claim_id;
      precedenceEffective = true;
      actionGateCandidate = true;
      irreversibleConflictFrozen = false;
    }
  }

  const receipt = {
    protocol: 'DLC-SI', version: '0.1', receipt_type: 'ContestedActionReceipt', contention_id: contention.contention_id,
    status, contest_visible: true, source_conflict_refs: sortedUnique(contention.source_conflict_refs), claim_refs: claims,
    selected_claim_id: selectedClaimId, former_selected_claim_id: formerSelectedClaimId,
    preserved_claim_ids: claims.map(claim => claim.claim_id), precedence_effective: precedenceEffective,
    action_gate_candidate: actionGateCandidate, execution_admitted: false,
    irreversible_conflict_frozen: irreversibleConflictFrozen, safe_work_allowed: sortedUnique(contention.safe_work),
    revisit_triggers: sortedUnique([...resolution.revisit_triggers, ...(lease === null ? [] : lease.revisit_triggers)]),
    lease, reopened_by: sortedUnique(reopenedBy), evaluated_at: contention.evaluated_at, fingerprint_sha256: ''
  };
  receipt.fingerprint_sha256 = canonicalFingerprint(receipt);
  return receipt;
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try { return JSON.parse(text); } catch (error) { throw new DLCSIError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  requireCondition(typeof inputPath === 'string' && inputPath.length > 0, 'input path is required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function printJson(value) { process.stdout.write(`${JSON.stringify(canonicalize(value), null, 2)}\n`); }
function helpText() {
  return ['DLC-SI v0.1 read-only CLI', '', 'Usage:', '  node dlc-si.js validate <contention.json|->', '  node dlc-si.js resolve <contention.json|->', '  node dlc-si.js help', '', 'No execute command exists. ContestedActionReceipt != ActionPermit.'].join('\n');
}
function main(argv) {
  const [command, inputPath, ...extra] = argv;
  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    requireCondition(inputPath === undefined && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write(`${helpText()}\n`); return 0;
  }
  requireCondition(extra.length === 0, 'unexpected extra arguments');
  requireCondition(['validate', 'resolve'].includes(command), `unsupported command: ${command}`);
  requireCondition(inputPath !== undefined, `${command} requires an input path`);
  const contention = readInput(inputPath);
  if (command === 'validate') {
    validateContention(contention);
    printJson({ protocol: 'DLC-SI', version: '0.1', status: 'VALID', contention_id: contention.contention_id, execution_admitted: false });
    return 0;
  }
  printJson(buildReceipt(contention)); return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof DLCSIError) { process.stderr.write(`DLC-SI validation error: ${error.message}\n`); process.exitCode = 1; }
    else throw error;
  }
}

module.exports = { DLCSIError, buildReceipt, canonicalFingerprint, canonicalize, validateContention };
