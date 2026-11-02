'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { verifyRetrievedRepresentation, RepresentationError } = require('./verify-resource');

const original = Buffer.from('{"status":"provisional","origin":"café"}\n', 'utf8');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const input = (bytes = original) => ({
  bodyAfterTransferDecoding: bytes,
  contentEncoding: 'identity',
  expectedHashHex: sha256(original),
  declaredSize: original.length,
  mediaTypeHeader: 'application/json; charset=utf-8',
  declaredMediaType: 'application/json',
  label: null,
  algorithm: 'sha256'
});
function expectReject(code, obj) {
  assert.throws(() => verifyRetrievedRepresentation(obj),
    error => error instanceof RepresentationError && error.code === code);
}

test('raw representation exact-byte match does not imply conformance or authority', () => {
  const result = verifyRetrievedRepresentation(input());
  assert.equal(result.result, 'OFFLINE_HASH_AND_SIZE_MATCH');
  assert.equal(result.c2paManifestValidated, false);
  assert.equal(result.sdk25ConformanceEstablished, false);
  assert.equal(result.currentAssertionStatusEstablished, false);
  assert.equal(result.actionAuthorityGranted, false);
});
test('gzip Content-Encoding is removed before hashing (not hash of wire body)', () => {
  const packed = zlib.gzipSync(original);
  assert.equal(verifyRetrievedRepresentation({ ...input(packed), contentEncoding: 'gzip' }).sha256, sha256(original));
  expectReject('HASH_MISMATCH', { ...input(packed), contentEncoding: 'gzip', expectedHashHex: sha256(packed) });
});
test('brotli and deflate decode before hashing', () => {
  for (const [bytes, contentEncoding] of [[zlib.brotliCompressSync(original), 'br'], [zlib.deflateSync(original), 'deflate']]) {
    assert.equal(verifyRetrievedRepresentation({ ...input(bytes), contentEncoding }).decodedBytes, original.length);
  }
});
test('multiple content-codings are undone in reverse order', () => {
  const encoded = zlib.brotliCompressSync(zlib.gzipSync(original));
  assert.equal(verifyRetrievedRepresentation({ ...input(encoded), contentEncoding: 'gzip, br' }).sha256, sha256(original));
});
test('no charset canonicalization, whitespace normalization or JSON reserialization', () => {
  const reserialized = Buffer.from(JSON.stringify(JSON.parse(original.toString('utf8'))));
  expectReject('DECLARED_SIZE_MISMATCH', input(reserialized));
  const differentEqualLength = Buffer.from(original);
  differentEqualLength[2] = 'S'.charCodeAt(0);
  expectReject('HASH_MISMATCH', input(differentEqualLength));
});
test('invalid digest hex and unsupported algorithm fail closed', () => {
  expectReject('INVALID_SHA256_DIGEST', { ...input(), expectedHashHex: 'abc' });
  expectReject('UNSUPPORTED_HASH_ALGORITHM', { ...input(), algorithm: 'sha512' });
});
test('forbidden 2.5 external labels blocked in this bounded candidate', () => {
  for (const label of ['c2pa.cloud-data', 'c2pa.hash.segment']) {
    expectReject('FORBIDDEN_EXTERNAL_ASSERTION_LABEL', { ...input(), label });
  }
});
test('unrelated label is not automatically qualified as allowed', () => {
  assert.equal(verifyRetrievedRepresentation({ ...input(), label: 'example.test' }).subjectConformant, false);
});
test('declared-size and media type mismatches fail closed', () => {
  expectReject('DECLARED_SIZE_MISMATCH', { ...input(), declaredSize: original.length + 1 });
  expectReject('MEDIA_TYPE_MISMATCH', { ...input(), mediaTypeHeader: 'text/html' });
});
test('no raw network wire framing or unsupported content coding is guessed', () => {
  expectReject('TRANSFER_DECODED_BYTES_REQUIRED', { ...input(), bodyAfterTransferDecoding: original.toString('utf8') });
  expectReject('CONTENT_ENCODING_UNSUPPORTED', { ...input(), contentEncoding: 'compress' });
});
test('corrupted compressed data fails closed', () => {
  expectReject('CONTENT_DECODING_FAILED_OR_LIMIT_EXCEEDED', {
    ...input(Buffer.from('not-gzip')), contentEncoding: 'gzip'
  });
});
test('bounded decompression rejects amplified body', () => {
  const expanded = Buffer.alloc(2048, 0x61);
  const packed = zlib.gzipSync(expanded);
  expectReject('CONTENT_DECODING_FAILED_OR_LIMIT_EXCEEDED', {
    ...input(packed), contentEncoding: 'gzip', limits: { maxEncodedBytes: 4096, maxDecodedBytes: 1024 }
  });
});
test('oversized encoded payload fails before decoding', () => {
  expectReject('ENCODED_BYTE_LIMIT_EXCEEDED', {
    ...input(), limits: { maxEncodedBytes: 8, maxDecodedBytes: 4096 }
  });
});
test('missing/invalid limits cannot disable hard limits', () => {
  expectReject('INVALID_LIMITS', { ...input(), limits: { maxEncodedBytes: 0, maxDecodedBytes: 0 } });
});
