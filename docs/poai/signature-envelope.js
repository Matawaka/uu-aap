(function (root, factory) {
  const bindingApi = (typeof module === 'object' && module.exports)
    ? require('./binding-receipt.js')
    : root && root.PoAIBindingReceipt;
  const api = factory(bindingApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAISignatureEnvelope = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Binding) {
  'use strict';

  if (!Binding) throw new Error('PoAIBindingReceipt is required before PoAISignatureEnvelope.');

  const ARTIFACT_TYPE = 'PoAISignatureEnvelope';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const SIGNATURE_ALGORITHM = 'Ed25519';
  const SIGNATURE_ENCODING = 'base64url';
  const SIGNATURE_PROFILE = 'PoAI-Ed25519-JCS-v0.1';
  const STATEMENT_DOMAIN = 'urn:poai:signature-statement:v0.1';
  const KEY_FORMAT = 'JWK';
  const KEY_THUMBPRINT_ALGORITHM = 'RFC7638-SHA-256';

  function webCrypto() {
    if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
    if (typeof require === 'function') return require('crypto').webcrypto;
    throw new Error('WebCrypto is unavailable.');
  }

  function base64urlEncode(bytes) {
    let base64;
    if (typeof Buffer !== 'undefined') base64 = Buffer.from(bytes).toString('base64');
    else {
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      base64 = btoa(binary);
    }
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  function base64urlDecode(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url value.');
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
    if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(padded, 'base64'));
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function hexToBytes(hex) {
    if (typeof hex !== 'string' || !/^[0-9a-f]+$/i.test(hex) || hex.length % 2) throw new Error('Invalid hex value.');
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  async function publicJwkThumbprint(publicJwk) {
    if (!publicJwk || publicJwk.kty !== 'OKP' || publicJwk.crv !== 'Ed25519' || typeof publicJwk.x !== 'string') {
      throw new Error('Public JWK must be OKP/Ed25519 with x.');
    }
    const canonical = Binding.canonicalize({ crv: 'Ed25519', kty: 'OKP', x: publicJwk.x }, '$');
    const hex = await Binding.sha256Hex(Binding.utf8Bytes(canonical));
    return base64urlEncode(hexToBytes(hex));
  }

  function publicOnlyJwk(jwk) {
    return { kty: 'OKP', crv: 'Ed25519', x: jwk.x };
  }

  async function generateEphemeralKeyPair() {
    return webCrypto().subtle.generateKey({ name: SIGNATURE_ALGORITHM }, true, ['sign', 'verify']);
  }

  function buildSignatureStatement(bindingReceipt, publicJwk, thumbprint, createdAt) {
    return {
      domain: STATEMENT_DOMAIN,
      signature_profile: SIGNATURE_PROFILE,
      created_at: createdAt,
      purpose: 'artifact_binding',
      bound_artifact: {
        artifact_type: bindingReceipt.bound_artifact.artifact_type,
        artifact_id: bindingReceipt.bound_artifact.artifact_id,
        poai_profile: bindingReceipt.bound_artifact.poai_profile
      },
      binding: {
        canonicalization: bindingReceipt.binding.canonicalization,
        digest_algorithm: bindingReceipt.binding.digest_algorithm,
        digest_encoding: bindingReceipt.binding.digest_encoding,
        digest: bindingReceipt.binding.digest,
        canonical_byte_length: bindingReceipt.binding.canonical_byte_length
      },
      verification_key: {
        algorithm: SIGNATURE_ALGORITHM,
        key_format: KEY_FORMAT,
        jwk_thumbprint_algorithm: KEY_THUMBPRINT_ALGORITHM,
        jwk_thumbprint: thumbprint,
        public_key_jwk: publicOnlyJwk(publicJwk)
      }
    };
  }

  async function signArtifact(value, keyPair) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A JSON object artifact is required.');
    const pair = keyPair || await generateEphemeralKeyPair();
    const publicJwk = publicOnlyJwk(await webCrypto().subtle.exportKey('jwk', pair.publicKey));
    const thumbprint = await publicJwkThumbprint(publicJwk);
    const bindingReceipt = await Binding.buildBindingReceipt(value);
    const createdAt = new Date().toISOString();
    const statement = buildSignatureStatement(bindingReceipt, publicJwk, thumbprint, createdAt);
    const statementBytes = Binding.utf8Bytes(Binding.canonicalize(statement, '$'));
    const signatureBytes = new Uint8Array(await webCrypto().subtle.sign({ name: SIGNATURE_ALGORITHM }, pair.privateKey, statementBytes));
    const signatureValue = base64urlEncode(signatureBytes);
    const idSeed = `${thumbprint}|${bindingReceipt.binding.digest}|${signatureValue}`;
    const idDigest = await Binding.sha256Hex(Binding.utf8Bytes(idSeed));
    const envelope = {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      signature_id: `urn:poai:signature:ed25519:${idDigest.slice(0, 16)}`,
      created_at: createdAt,
      bound_artifact: statement.bound_artifact,
      binding: statement.binding,
      signature_profile: {
        id: SIGNATURE_PROFILE,
        signature_algorithm: SIGNATURE_ALGORITHM,
        statement_domain: STATEMENT_DOMAIN,
        alignment: ['RFC 8785', 'SHA-256', 'RFC 8032', 'RFC 8037', 'RFC 7638', 'W3C eddsa-jcs-2022'],
        w3c_data_integrity_conformance: false
      },
      verification_method: {
        key_format: KEY_FORMAT,
        public_key_jwk: publicJwk,
        jwk_thumbprint_algorithm: KEY_THUMBPRINT_ALGORITHM,
        jwk_thumbprint: thumbprint,
        signer_identity_status: 'unknown',
        signer_authority_status: 'unknown',
        materialization_authority_status: 'unknown'
      },
      signed_statement: statement,
      signature: {
        algorithm: SIGNATURE_ALGORITHM,
        encoding: SIGNATURE_ENCODING,
        value: signatureValue
      },
      claims: {
        signature_present: true,
        signer_identity_verified: false,
        signer_authority_verified: false,
        materialization_authority_verified: false,
        truth_certified: false,
        responsibility_determined: false,
        legal_effect_established: false,
        canonical_successor_established: false,
        poai_v_conformance_established: false
      },
      notes: 'Experimental detached-style signature envelope. A valid Ed25519 signature does not establish signer identity, authority, truth, materialization authority, or PoAI/V.'
    };
    return { envelope, keyPair: pair };
  }

  function sameJson(a, b) {
    try { return Binding.canonicalize(a, '$') === Binding.canonicalize(b, '$'); }
    catch (_) { return false; }
  }

  function validateSignatureEnvelope(envelope) {
    const errors = [];
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return ['Signature envelope must be an object.'];
    if (envelope.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAISignatureEnvelope.');
    if (envelope.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof envelope.signature_id !== 'string' || !envelope.signature_id.startsWith('urn:poai:signature:ed25519:')) errors.push('signature_id is invalid.');
    if (!envelope.bound_artifact || typeof envelope.bound_artifact.artifact_type !== 'string') errors.push('bound_artifact is required.');
    if (!envelope.binding || envelope.binding.canonicalization !== Binding.CANONICALIZATION_ID) errors.push('binding canonicalization is invalid.');
    if (!envelope.binding || envelope.binding.digest_algorithm !== Binding.DIGEST_ALGORITHM) errors.push('binding digest algorithm must be SHA-256.');
    if (!envelope.binding || typeof envelope.binding.digest !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.binding.digest)) errors.push('binding digest is invalid.');
    if (!envelope.signature_profile || envelope.signature_profile.id !== SIGNATURE_PROFILE) errors.push('signature profile is invalid.');
    if (!envelope.signature_profile || envelope.signature_profile.w3c_data_integrity_conformance !== false) errors.push('4.0b must not claim W3C Data Integrity conformance.');
    const vm = envelope.verification_method;
    if (!vm || vm.key_format !== KEY_FORMAT) errors.push('verification method key format must be JWK.');
    if (!vm || !vm.public_key_jwk || vm.public_key_jwk.kty !== 'OKP' || vm.public_key_jwk.crv !== 'Ed25519' || typeof vm.public_key_jwk.x !== 'string') errors.push('public JWK must be OKP/Ed25519.');
    if (vm && vm.public_key_jwk && Object.prototype.hasOwnProperty.call(vm.public_key_jwk, 'd')) errors.push('Private key material must not appear in the signature envelope.');
    if (!vm || typeof vm.jwk_thumbprint !== 'string') errors.push('JWK thumbprint is required.');
    if (!vm || vm.signer_identity_status !== 'unknown' || vm.signer_authority_status !== 'unknown' || vm.materialization_authority_status !== 'unknown') errors.push('Identity and authority statuses must remain unknown in 4.0b.');
    if (!envelope.signature || envelope.signature.algorithm !== SIGNATURE_ALGORITHM || envelope.signature.encoding !== SIGNATURE_ENCODING) errors.push('signature metadata is invalid.');
    if (!envelope.signature || typeof envelope.signature.value !== 'string') errors.push('signature value is required.');
    const claims = envelope.claims || {};
    const requiredFalse = ['signer_identity_verified', 'signer_authority_verified', 'materialization_authority_verified', 'truth_certified', 'responsibility_determined', 'legal_effect_established', 'canonical_successor_established', 'poai_v_conformance_established'];
    requiredFalse.forEach((field) => { if (claims[field] !== false) errors.push(`${field} must remain false in 4.0b.`); });
    if (claims.signature_present !== true) errors.push('signature_present must be true.');
    if (Object.prototype.hasOwnProperty.call(envelope, 'protocol')) errors.push('Signature envelope must not masquerade as a Genesis PoAI record.');
    if (envelope.signed_statement) {
      if (!sameJson(envelope.signed_statement.bound_artifact, envelope.bound_artifact)) errors.push('signed_statement bound_artifact does not match envelope.');
      if (!sameJson(envelope.signed_statement.binding, envelope.binding)) errors.push('signed_statement binding does not match envelope.');
      if (!envelope.signed_statement.verification_key || envelope.signed_statement.verification_key.jwk_thumbprint !== (vm && vm.jwk_thumbprint)) errors.push('signed_statement key thumbprint does not match envelope.');
    } else errors.push('signed_statement is required.');
    return errors;
  }

  async function verifySignatureEnvelope(envelope, value) {
    const errors = validateSignatureEnvelope(envelope);
    if (errors.length) return { signature_valid: false, artifact_binding_matches: false, key_thumbprint_matches: false, errors };
    const publicJwk = publicOnlyJwk(envelope.verification_method.public_key_jwk);
    const thumbprint = await publicJwkThumbprint(publicJwk);
    const keyThumbprintMatches = thumbprint === envelope.verification_method.jwk_thumbprint;
    let signatureValid = false;
    try {
      const publicKey = await webCrypto().subtle.importKey('jwk', publicJwk, { name: SIGNATURE_ALGORITHM }, true, ['verify']);
      const statementBytes = Binding.utf8Bytes(Binding.canonicalize(envelope.signed_statement, '$'));
      const signatureBytes = base64urlDecode(envelope.signature.value);
      signatureValid = await webCrypto().subtle.verify({ name: SIGNATURE_ALGORITHM }, publicKey, signatureBytes, statementBytes);
    } catch (_) {
      signatureValid = false;
    }
    let artifactBindingMatches = null;
    let recomputedDigest = null;
    if (value !== undefined && value !== null) {
      try {
        const receipt = await Binding.buildBindingReceipt(value);
        recomputedDigest = receipt.binding.digest;
        artifactBindingMatches = receipt.binding.digest === envelope.binding.digest && receipt.binding.canonical_byte_length === envelope.binding.canonical_byte_length;
      } catch (_) {
        artifactBindingMatches = false;
      }
    }
    return {
      signature_valid: Boolean(signatureValid && keyThumbprintMatches),
      cryptographic_signature_valid: Boolean(signatureValid),
      key_thumbprint_matches: keyThumbprintMatches,
      artifact_binding_matches: artifactBindingMatches,
      recomputed_digest: recomputedDigest,
      signer_identity_verified: false,
      signer_authority_verified: false,
      materialization_authority_verified: false,
      errors: []
    };
  }

  function currentJson() {
    const input = document.getElementById('jsonInput');
    if (!input || !input.value.trim()) return null;
    try { return JSON.parse(input.value); } catch (_) { return null; }
  }

  function currentLanguage() { return document.documentElement.lang === 'ru' ? 'ru' : 'en'; }

  function downloadJson(filename, data) {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function ensureControls() {
    if (document.getElementById('signatureEnvelopePanel')) return;
    const bindingPanel = document.getElementById('bindingReceiptPanel');
    if (!bindingPanel) return;
    const ru = currentLanguage() === 'ru';
    const panel = document.createElement('section');
    panel.id = 'signatureEnvelopePanel';
    panel.className = 'panel signature-envelope-panel';
    panel.innerHTML = `
      <div class="panel-head">
        <div><p class="eyebrow">PoAI · LEVEL 4.0b</p><h2>${ru ? 'Подпись Ed25519' : 'Ed25519 signature binding'}</h2></div>
        <span class="badge neutral">${ru ? 'EPHEMERAL KEY · НЕ IDENTITY' : 'EPHEMERAL KEY · NOT IDENTITY'}</span>
      </div>
      <p class="summary">${ru ? 'RFC 8785 + SHA-256 → domain-separated statement → Ed25519. Корректная подпись не доказывает личность, полномочие, истинность или PoAI/V.' : 'RFC 8785 + SHA-256 → domain-separated statement → Ed25519. A valid signature does not prove identity, authority, truth, or PoAI/V.'}</p>
      <div class="actions">
        <button id="signArtifactBtn" type="button" class="primary">${ru ? 'Создать временный ключ и подписать' : 'Generate ephemeral key & sign'}</button>
        <button id="verifySignatureBtn" type="button" disabled>${ru ? 'Проверить подпись' : 'Verify signature'}</button>
        <button id="downloadSignatureBtn" type="button" disabled>${ru ? 'Скачать Signature Envelope' : 'Download Signature Envelope'}</button>
      </div>
      <div class="actions">
        <label class="file-label" for="signatureEnvelopeInput">${ru ? 'Загрузить Signature Envelope' : 'Load Signature Envelope'}</label>
        <input id="signatureEnvelopeInput" type="file" accept="application/json,.json" hidden>
      </div>
      <div id="signatureEnvelopeResult" class="summary">${ru ? 'Приватный ключ остаётся только в памяти этой вкладки и не включается в скачиваемый envelope.' : 'The private key remains only in this tab memory and is not included in the downloaded envelope.'}</div>
    `;
    bindingPanel.insertAdjacentElement('afterend', panel);
    let latestEnvelope = null;
    let latestKeyPair = null;
    const sign = panel.querySelector('#signArtifactBtn');
    const verify = panel.querySelector('#verifySignatureBtn');
    const download = panel.querySelector('#downloadSignatureBtn');
    const input = panel.querySelector('#signatureEnvelopeInput');
    const result = panel.querySelector('#signatureEnvelopeResult');

    function renderVerification(status) {
      const sig = status.signature_valid ? (ru ? 'ПОДПИСЬ VALID' : 'SIGNATURE VALID') : (ru ? 'ПОДПИСЬ INVALID' : 'SIGNATURE INVALID');
      let binding = ru ? 'ARTIFACT НЕ ПРОВЕРЕН' : 'ARTIFACT NOT CHECKED';
      if (status.artifact_binding_matches === true) binding = ru ? 'ARTIFACT MATCH' : 'ARTIFACT MATCH';
      else if (status.artifact_binding_matches === false) binding = ru ? 'ARTIFACT MISMATCH' : 'ARTIFACT MISMATCH';
      result.textContent = `${sig} · ${binding} · ${ru ? 'identity/authority: не установлены' : 'identity/authority: not established'}`;
    }

    sign.addEventListener('click', async () => {
      try {
        const value = currentJson();
        if (!value) throw new Error(ru ? 'Текущий ввод не является JSON-объектом.' : 'Current input is not a JSON object.');
        const signed = await signArtifact(value);
        latestEnvelope = signed.envelope;
        latestKeyPair = signed.keyPair;
        verify.disabled = false;
        download.disabled = false;
        const status = await verifySignatureEnvelope(latestEnvelope, value);
        renderVerification(status);
      } catch (error) {
        latestEnvelope = null;
        latestKeyPair = null;
        verify.disabled = true;
        download.disabled = true;
        result.textContent = error.message;
      }
    });

    verify.addEventListener('click', async () => {
      if (!latestEnvelope) return;
      const status = await verifySignatureEnvelope(latestEnvelope, currentJson());
      renderVerification(status);
    });

    download.addEventListener('click', () => {
      if (!latestEnvelope) return;
      const suffix = latestEnvelope.signature_id.split(':').pop();
      downloadJson(`${suffix}.poai-signature.json`, latestEnvelope);
    });

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        latestEnvelope = JSON.parse(await file.text());
        latestKeyPair = null;
        const errors = validateSignatureEnvelope(latestEnvelope);
        if (errors.length) throw new Error(errors.join(' '));
        verify.disabled = false;
        download.disabled = false;
        const status = await verifySignatureEnvelope(latestEnvelope, currentJson());
        renderVerification(status);
      } catch (error) {
        latestEnvelope = null;
        verify.disabled = true;
        download.disabled = true;
        result.textContent = error.message;
      }
    });
  }

  function init() { ensureControls(); }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }

  return {
    ARTIFACT_TYPE,
    ARTIFACT_VERSION,
    SIGNATURE_ALGORITHM,
    SIGNATURE_ENCODING,
    SIGNATURE_PROFILE,
    STATEMENT_DOMAIN,
    KEY_FORMAT,
    KEY_THUMBPRINT_ALGORITHM,
    base64urlEncode,
    base64urlDecode,
    publicJwkThumbprint,
    generateEphemeralKeyPair,
    buildSignatureStatement,
    signArtifact,
    validateSignatureEnvelope,
    verifySignatureEnvelope,
    publicOnlyJwk
  };
});