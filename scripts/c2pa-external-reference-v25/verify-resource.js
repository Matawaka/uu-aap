'use strict';

// Bounded, offline representation probe. Not a C2PA manifest/SDK validator or HTTP client.
const crypto = require('node:crypto');
const zlib = require('node:zlib');

class RepresentationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RepresentationError';
    this.code = code;
  }
}
const DEFAULT_LIMITS = Object.freeze({ maxEncodedBytes: 1024 * 1024, maxDecodedBytes: 1024 * 1024, maxEncodingLayers: 4 });
const KNOWN_25_FORBIDDEN_EXTERNAL_LABELS = new Set(['c2pa.cloud-data', 'c2pa.hash.segment']);
function fail(code) { throw new RepresentationError(code); }
function mediaType(value) {
  if (typeof value !== 'string' || !value.trim()) fail('MEDIA_TYPE_MISSING');
  const baseType = value.split(';', 1)[0].trim().toLowerCase();
  if (!baseType) fail('MEDIA_TYPE_MISSING');
  return baseType;
}
function decodeContentCoding(body, coding, ceiling) {
  try {
    const opts = { maxOutputLength: ceiling };
    if (coding === 'gzip' || coding === 'x-gzip') return zlib.gunzipSync(body, opts);
    if (coding === 'deflate') return zlib.inflateSync(body, opts);
    if (coding === 'br') return zlib.brotliDecompressSync(body, opts);
  } catch (_error) {
    fail('CONTENT_DECODING_FAILED_OR_LIMIT_EXCEEDED');
  }
  fail('CONTENT_ENCODING_UNSUPPORTED');
}

/**
 * bodyAfterTransferDecoding: exact HTTP response body bytes *after* transfer
 * framing has been removed by the caller; never a chunked-wire stream.
 * Remove Content-Encoding, then hash bytes without charset decoding, parsing,
 * canonicalization, or text normalization.
 */
function verifyRetrievedRepresentation({
  bodyAfterTransferDecoding,
  contentEncoding = 'identity',
  expectedHashHex,
  declaredSize,
  mediaTypeHeader,
  declaredMediaType,
  label = null,
  algorithm = 'sha256',
  limits = DEFAULT_LIMITS
}) {
  if (!Buffer.isBuffer(bodyAfterTransferDecoding)) fail('TRANSFER_DECODED_BYTES_REQUIRED');
  if (!limits || !Number.isSafeInteger(limits.maxEncodedBytes) || limits.maxEncodedBytes < 1 ||
      !Number.isSafeInteger(limits.maxDecodedBytes) || limits.maxDecodedBytes < 1) fail('INVALID_LIMITS');
  if (bodyAfterTransferDecoding.length > limits.maxEncodedBytes) fail('ENCODED_BYTE_LIMIT_EXCEEDED');
  if (algorithm !== 'sha256') fail('UNSUPPORTED_HASH_ALGORITHM');
  if (typeof expectedHashHex !== 'string' || !/^[a-fA-F0-9]{64}$/.test(expectedHashHex)) fail('INVALID_SHA256_DIGEST');
  if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) fail('INVALID_DECLARED_SIZE');
  if (label !== null && (typeof label !== 'string' || !label)) fail('INVALID_LABEL');
  if (KNOWN_25_FORBIDDEN_EXTERNAL_LABELS.has(label)) fail('FORBIDDEN_EXTERNAL_ASSERTION_LABEL');
  const maxEncodingLayers = limits.maxEncodingLayers === undefined ? DEFAULT_LIMITS.maxEncodingLayers : limits.maxEncodingLayers;
  if (!Number.isSafeInteger(maxEncodingLayers) || maxEncodingLayers < 1) fail('INVALID_LIMITS');
  if (typeof contentEncoding !== 'string' || contentEncoding.length > 256) fail('CONTENT_ENCODING_UNSUPPORTED');
  const codings = typeof contentEncoding === 'string'
    ? contentEncoding.toLowerCase().split(',').map(v => v.trim()) : [];
  if (codings.length === 0 || codings.some(v => v === '')) fail('CONTENT_ENCODING_UNSUPPORTED');
  if (codings.filter(v => v !== 'identity').length > maxEncodingLayers) fail('CONTENT_ENCODING_DEPTH_EXCEEDED');
  let decoded = bodyAfterTransferDecoding;
  for (const coding of codings.reverse()) {
    if (coding !== 'identity') decoded = decodeContentCoding(decoded, coding, limits.maxDecodedBytes);
    if (decoded.length > limits.maxDecodedBytes) fail('DECODED_BYTE_LIMIT_EXCEEDED');
  }
  // No text/JSON decoding or normalization occurs prior to this comparison.
  if (declaredSize !== decoded.length) fail('DECLARED_SIZE_MISMATCH');
  if (mediaType(mediaTypeHeader) !== mediaType(declaredMediaType)) fail('MEDIA_TYPE_MISMATCH');
  const actual = crypto.createHash('sha256').update(decoded).digest();
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (!crypto.timingSafeEqual(actual, expected)) fail('HASH_MISMATCH');
  return Object.freeze({
    result: 'OFFLINE_HASH_AND_SIZE_MATCH',
    decodedBytes: decoded.length,
    sha256: actual.toString('hex'),
    scope: 'C2PA_2_5_RETRIEVED_REPRESENTATION_PROBE_ONLY',
    c2paManifestValidated: false,
    sdk25ConformanceEstablished: false,
    subjectConformant: false,
    currentAssertionStatusEstablished: false,
    actionAuthorityGranted: false
  });
}
module.exports = { verifyRetrievedRepresentation, RepresentationError, DEFAULT_LIMITS };
