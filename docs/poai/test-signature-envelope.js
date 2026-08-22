'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const Binding = require('./binding-receipt.js');
const Signature = require('./signature-envelope.js');

async function main() {
  const rfc8037PublicJwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo'
  };
  const knownThumbprint = await Signature.publicJwkThumbprint(rfc8037PublicJwk);
  assert.strictEqual(knownThumbprint, 'kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k', 'RFC 8037 / RFC 7638 thumbprint vector mismatch');

  const artifactA = {
    protocol: 'PoAI',
    protocol_version: '0.0.1',
    profile: 'T',
    record_id: 'urn:poai:record:signature-test:1',
    subject: { type: 'decision', id: 'decision:signature-test', label: 'Signature test' },
    nested: { z: 2, a: ['one', 'two'] }
  };
  const artifactEquivalent = {
    nested: { a: ['one', 'two'], z: 2 },
    subject: { label: 'Signature test', id: 'decision:signature-test', type: 'decision' },
    record_id: 'urn:poai:record:signature-test:1',
    profile: 'T',
    protocol_version: '0.0.1',
    protocol: 'PoAI'
  };

  const signed = await Signature.signArtifact(artifactA);
  const envelope = signed.envelope;
  const validationErrors = Signature.validateSignatureEnvelope(envelope);
  assert.deepStrictEqual(validationErrors, [], validationErrors.join('\n'));
  assert.strictEqual(envelope.artifact_type, 'PoAISignatureEnvelope');
  assert.strictEqual(envelope.signature_profile.w3c_data_integrity_conformance, false);
  assert.strictEqual(envelope.verification_method.public_key_jwk.kty, 'OKP');
  assert.strictEqual(envelope.verification_method.public_key_jwk.crv, 'Ed25519');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(envelope.verification_method.public_key_jwk, 'd'), false, 'private JWK parameter must not be exported');
  assert.strictEqual(envelope.claims.signature_present, true);
  assert.strictEqual(envelope.claims.signer_identity_verified, false);
  assert.strictEqual(envelope.claims.signer_authority_verified, false);
  assert.strictEqual(envelope.claims.materialization_authority_verified, false);
  assert.strictEqual(envelope.claims.poai_v_conformance_established, false);

  const equivalentStatus = await Signature.verifySignatureEnvelope(envelope, artifactEquivalent);
  assert.strictEqual(equivalentStatus.signature_valid, true, 'signature must verify');
  assert.strictEqual(equivalentStatus.artifact_binding_matches, true, 'reordered equivalent artifact must match binding');
  assert.strictEqual(equivalentStatus.signer_identity_verified, false);
  assert.strictEqual(equivalentStatus.signer_authority_verified, false);

  const statementCanonical = Binding.canonicalize(envelope.signed_statement, '$');
  const publicKeyObject = crypto.createPublicKey({ key: envelope.verification_method.public_key_jwk, format: 'jwk' });
  const independentlyValid = crypto.verify(
    null,
    Buffer.from(Binding.utf8Bytes(statementCanonical)),
    publicKeyObject,
    Buffer.from(Signature.base64urlDecode(envelope.signature.value))
  );
  assert.strictEqual(independentlyValid, true, 'independent Node Ed25519 verification failed');

  const changedArtifact = JSON.parse(JSON.stringify(artifactA));
  changedArtifact.subject.label = 'Signature test changed';
  const changedStatus = await Signature.verifySignatureEnvelope(envelope, changedArtifact);
  assert.strictEqual(changedStatus.signature_valid, true, 'signature over stored statement must remain valid');
  assert.strictEqual(changedStatus.artifact_binding_matches, false, 'semantic artifact change must break binding match');

  const tampered = JSON.parse(JSON.stringify(envelope));
  const first = tampered.signature.value[0];
  tampered.signature.value = (first === 'A' ? 'B' : 'A') + tampered.signature.value.slice(1);
  const tamperedStatus = await Signature.verifySignatureEnvelope(tampered, artifactA);
  assert.strictEqual(tamperedStatus.signature_valid, false, 'signature-byte tamper must fail cryptographic verification');
  assert.strictEqual(tamperedStatus.artifact_binding_matches, true, 'artifact itself still matches the signed digest');

  const out = process.argv[2];
  if (out) fs.writeFileSync(out, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  console.log('PoAI Level 4.0b signature envelope tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
