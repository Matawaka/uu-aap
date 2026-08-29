'use strict';

const crypto = require('crypto');

const VERSION = '0.1';
const PROFILE_ZERO_CONTENT_HASH = 'content-hash-zero-field-v0.1';
const PROFILE_OMIT_CONTENT_HASH = 'content-hash-omit-field-v0.1';
const PROFILE_IDS = Object.freeze([
  PROFILE_ZERO_CONTENT_HASH,
  PROFILE_OMIT_CONTENT_HASH
]);

const NON_EFFECTS = Object.freeze([
  'Shared Runtime != Universal Canonicalization Algorithm',
  'Same SHA-256 Primitive != Same Identity Projection',
  'Profile Selection != Semantic Compatibility',
  'Hash Equality != Receipt Truth',
  'Hash Equality != Authority',
  'Runtime Reuse != Core Promotion',
  'Refactor Success != Historical Receipt Rewrite'
]);

class ReceiptRuntimeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReceiptRuntimeError';
  }
}

function fail(message) {
  throw new ReceiptRuntimeError(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    fail(`value is not JSON-cloneable: ${error.message}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}

function requireProfile(profile) {
  if (!PROFILE_IDS.includes(profile)) fail(`unknown receipt identity profile: ${profile}`);
  return profile;
}

function project(profile, value) {
  requireProfile(profile);
  if (!isObject(value)) fail('receipt identity value must be an object');
  const projected = cloneJson(value);
  if (profile === PROFILE_ZERO_CONTENT_HASH) {
    projected.content_hash = '';
    return projected;
  }
  delete projected.content_hash;
  return projected;
}

function canonicalJson(profile, value) {
  return JSON.stringify(canonicalize(project(profile, value)));
}

function computeContentHash(profile, value) {
  const canonical = canonicalJson(profile, value);
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

function verifyContentHash(profile, value) {
  if (!isObject(value)) fail('receipt identity value must be an object');
  if (typeof value.content_hash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value.content_hash)) return false;
  return value.content_hash === computeContentHash(profile, value);
}

function rehash(profile, value) {
  if (!isObject(value)) fail('receipt identity value must be an object');
  value.content_hash = computeContentHash(profile, value);
  return value;
}

function deepEqualCanonical(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

module.exports = {
  VERSION,
  PROFILE_ZERO_CONTENT_HASH,
  PROFILE_OMIT_CONTENT_HASH,
  PROFILE_IDS,
  NON_EFFECTS,
  ReceiptRuntimeError,
  canonicalize,
  project,
  canonicalJson,
  computeContentHash,
  verifyContentHash,
  rehash,
  deepEqualCanonical
};
