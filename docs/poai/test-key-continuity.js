'use strict';

const fs = require('fs');
const assert = require('assert');
const Continuity = require('./key-continuity.js');

async function main() {
  const fixture = {
    protocol: 'PoAI',
    protocol_version: '0.0.1',
    profile: 'T',
    record_id: 'urn:poai:record:test:key-continuity:1',
    subject: { type: 'decision', id: 'decision:test:key-continuity', label: 'Persistent key continuity test' }
  };

  const pair1 = await Continuity.generatePersistentKeyPair();
  assert.equal(pair1.privateKey.extractable, false, 'private key must be non-extractable');
  assert.equal(pair1.publicKey.extractable, true, 'public key must remain extractable');

  let privateExportRejected = false;
  try {
    await require('crypto').webcrypto.subtle.exportKey('jwk', pair1.privateKey);
  } catch (_) {
    privateExportRejected = true;
  }
  assert.equal(privateExportRejected, true, 'private key export must be rejected');

  const metadata1 = await Continuity.describeKeyPair(pair1, {
    epoch: 1,
    created_at: '2026-08-22T18:40:00.000Z'
  });
  const record1 = { slot: 'test', privateKey: pair1.privateKey, publicKey: pair1.publicKey, metadata: metadata1 };

  const envelope1 = await Continuity.signWithPersistentRecord(fixture, record1);
  assert.deepEqual(Continuity.validateContinuityEnvelope(envelope1), []);
  assert.equal(envelope1.key_continuity.private_key_extractable, false);
  assert.equal(envelope1.key_continuity.continuity_epoch, 1);
  assert.equal(envelope1.claims.local_key_continuity_established, true);
  assert.equal(envelope1.claims.signer_identity_verified, false);
  assert.equal(envelope1.claims.signer_authority_verified, false);
  assert.equal(envelope1.claims.materialization_authority_verified, false);
  assert.equal(JSON.stringify(envelope1).includes('"d"'), false, 'private JWK material must not be exported');

  const verify1 = await Continuity.verifyContinuityEnvelope(envelope1, fixture, record1);
  assert.equal(verify1.signature_valid, true);
  assert.equal(verify1.artifact_binding_matches, true);
  assert.equal(verify1.active_local_key_matches, true);

  const envelope2 = await Continuity.signWithPersistentRecord(fixture, record1);
  assert.equal(envelope2.verification_method.jwk_thumbprint, envelope1.verification_method.jwk_thumbprint, 'same persistent key must preserve thumbprint');
  assert.notEqual(envelope2.signature_id, envelope1.signature_id, 'separate signatures should remain separate events');

  const semanticChange = { ...fixture, subject: { ...fixture.subject, label: 'Changed semantic value' } };
  const changedStatus = await Continuity.verifyContinuityEnvelope(envelope1, semanticChange, record1);
  assert.equal(changedStatus.signature_valid, true);
  assert.equal(changedStatus.artifact_binding_matches, false);
  assert.equal(changedStatus.active_local_key_matches, true);

  const tampered = JSON.parse(JSON.stringify(envelope1));
  const first = tampered.signature.value[0];
  tampered.signature.value = (first === 'A' ? 'B' : 'A') + tampered.signature.value.slice(1);
  const tamperedStatus = await Continuity.verifyContinuityEnvelope(tampered, fixture, record1);
  assert.equal(tamperedStatus.signature_valid, false);
  assert.equal(tamperedStatus.artifact_binding_matches, true);
  assert.equal(tamperedStatus.active_local_key_matches, true);

  const pair2 = await Continuity.generatePersistentKeyPair();
  const metadata2 = await Continuity.describeKeyPair(pair2, {
    epoch: 2,
    created_at: '2026-08-22T18:45:00.000Z',
    previous_thumbprint: metadata1.jwk_thumbprint
  });
  assert.notEqual(metadata2.jwk_thumbprint, metadata1.jwk_thumbprint, 'rotation must create a new thumbprint');
  assert.equal(metadata2.previous_key_thumbprint, metadata1.jwk_thumbprint);
  const record2 = { slot: 'test', privateKey: pair2.privateKey, publicKey: pair2.publicKey, metadata: metadata2 };
  const oldAfterRotation = await Continuity.verifyContinuityEnvelope(envelope1, fixture, record2);
  assert.equal(oldAfterRotation.signature_valid, true, 'old signature remains cryptographically valid after rotation');
  assert.equal(oldAfterRotation.artifact_binding_matches, true);
  assert.equal(oldAfterRotation.active_local_key_matches, false, 'old key must not match the new active key');

  const envelope3 = await Continuity.signWithPersistentRecord(fixture, record2);
  assert.equal(envelope3.key_continuity.continuity_epoch, 2);
  assert.equal(envelope3.key_continuity.previous_key_thumbprint, metadata1.jwk_thumbprint);
  assert.equal(envelope3.verification_method.jwk_thumbprint, metadata2.jwk_thumbprint);

  const output = process.argv[2];
  if (output) fs.writeFileSync(output, `${JSON.stringify(envelope1, null, 2)}\n`);

  console.log('PoAI Level 4.0c key continuity tests passed');
  console.log(`thumbprint_epoch_1=${metadata1.jwk_thumbprint}`);
  console.log(`thumbprint_epoch_2=${metadata2.jwk_thumbprint}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
