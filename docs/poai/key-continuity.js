(function (root, factory) {
  const bindingApi = (typeof module === 'object' && module.exports)
    ? require('./binding-receipt.js')
    : root && root.PoAIBindingReceipt;
  const signatureApi = (typeof module === 'object' && module.exports)
    ? require('./signature-envelope.js')
    : root && root.PoAISignatureEnvelope;
  const api = factory(bindingApi, signatureApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIKeyContinuity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Binding, Signature) {
  'use strict';

  if (!Binding) throw new Error('PoAIBindingReceipt is required before PoAIKeyContinuity.');
  if (!Signature) throw new Error('PoAISignatureEnvelope is required before PoAIKeyContinuity.');

  const ARTIFACT_TYPE = 'PoAIContinuitySignatureEnvelope';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const SIGNATURE_PROFILE = 'PoAI-Ed25519-JCS-Continuity-v0.1';
  const STATEMENT_DOMAIN = 'urn:poai:signature-statement:continuity:v0.1';
  const STORAGE_SCOPE = 'browser_origin_local';
  const CONTINUITY_STATUS = 'locally_established';
  const DB_NAME = 'poai-local-signer-v1';
  const STORE_NAME = 'signer_keys';
  const ACTIVE_SLOT = 'active-ed25519';

  function webCrypto() {
    if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
    if (typeof require === 'function') return require('crypto').webcrypto;
    throw new Error('WebCrypto is unavailable.');
  }

  async function generatePersistentKeyPair() {
    const pair = await webCrypto().subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    if (!pair || !pair.privateKey || !pair.publicKey) throw new Error('Ed25519 key generation failed.');
    if (pair.privateKey.extractable !== false) throw new Error('Persistent private key must be non-extractable.');
    if (pair.publicKey.extractable !== true) throw new Error('Ed25519 public key must remain extractable.');
    return pair;
  }

  async function describeKeyPair(pair, options) {
    if (!pair || !pair.privateKey || !pair.publicKey) throw new Error('CryptoKeyPair is required.');
    if (pair.privateKey.extractable !== false) throw new Error('Private key must be non-extractable.');
    const publicJwk = Signature.publicOnlyJwk(await webCrypto().subtle.exportKey('jwk', pair.publicKey));
    const thumbprint = await Signature.publicJwkThumbprint(publicJwk);
    const opts = options || {};
    const epoch = Number.isInteger(opts.epoch) && opts.epoch > 0 ? opts.epoch : 1;
    const createdAt = opts.created_at || new Date().toISOString();
    const previousThumbprint = opts.previous_thumbprint || null;
    return {
      key_id: `urn:poai:key:ed25519:${thumbprint}`,
      jwk_thumbprint: thumbprint,
      jwk_thumbprint_algorithm: 'RFC7638-SHA-256',
      public_key_jwk: publicJwk,
      storage_scope: STORAGE_SCOPE,
      storage_mechanism: 'IndexedDB',
      continuity_status: CONTINUITY_STATUS,
      continuity_epoch: epoch,
      created_at: createdAt,
      previous_key_thumbprint: previousThumbprint,
      private_key_extractable: false,
      signer_identity_status: 'unknown',
      signer_authority_status: 'unknown',
      materialization_authority_status: 'unknown'
    };
  }

  function openDb() {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'slot' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB.'));
    });
  }

  async function idbGet(slot) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(slot);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Unable to read local signer key.'));
      });
    } finally {
      db.close();
    }
  }

  async function idbPut(record) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Unable to persist local signer key.'));
        tx.onabort = () => reject(tx.error || new Error('Local signer key transaction aborted.'));
      });
    } finally {
      db.close();
    }
  }

  async function normalizeStoredRecord(record) {
    if (!record) return null;
    if (!record.privateKey || !record.publicKey || !record.metadata) throw new Error('Stored signer record is incomplete.');
    if (record.privateKey.extractable !== false) throw new Error('Stored private key unexpectedly became extractable.');
    if (record.privateKey.type !== 'private' || record.publicKey.type !== 'public') throw new Error('Stored key types are invalid.');
    const described = await describeKeyPair({ privateKey: record.privateKey, publicKey: record.publicKey }, {
      epoch: record.metadata.continuity_epoch,
      created_at: record.metadata.created_at,
      previous_thumbprint: record.metadata.previous_key_thumbprint
    });
    if (described.jwk_thumbprint !== record.metadata.jwk_thumbprint) throw new Error('Stored public-key thumbprint does not match metadata.');
    return {
      slot: record.slot,
      privateKey: record.privateKey,
      publicKey: record.publicKey,
      metadata: described
    };
  }

  async function loadPersistentKey() {
    return normalizeStoredRecord(await idbGet(ACTIVE_SLOT));
  }

  async function createPersistentKey(options) {
    const opts = options || {};
    const pair = await generatePersistentKeyPair();
    const metadata = await describeKeyPair(pair, {
      epoch: opts.epoch || 1,
      previous_thumbprint: opts.previous_thumbprint || null
    });
    const record = { slot: ACTIVE_SLOT, privateKey: pair.privateKey, publicKey: pair.publicKey, metadata };
    await idbPut(record);
    return record;
  }

  async function ensurePersistentKey() {
    const existing = await loadPersistentKey();
    if (existing) return existing;
    return createPersistentKey({ epoch: 1 });
  }

  async function rotatePersistentKey() {
    const existing = await loadPersistentKey();
    const nextEpoch = existing ? existing.metadata.continuity_epoch + 1 : 1;
    const previous = existing ? existing.metadata.jwk_thumbprint : null;
    return createPersistentKey({ epoch: nextEpoch, previous_thumbprint: previous });
  }

  function continuityStatement(bindingReceipt, metadata, createdAt) {
    return {
      domain: STATEMENT_DOMAIN,
      signature_profile: SIGNATURE_PROFILE,
      created_at: createdAt,
      purpose: 'artifact_binding_with_local_key_continuity',
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
        algorithm: 'Ed25519',
        key_format: 'JWK',
        jwk_thumbprint_algorithm: metadata.jwk_thumbprint_algorithm,
        jwk_thumbprint: metadata.jwk_thumbprint,
        public_key_jwk: metadata.public_key_jwk
      },
      key_continuity: {
        key_id: metadata.key_id,
        storage_scope: metadata.storage_scope,
        storage_mechanism: metadata.storage_mechanism,
        continuity_status: metadata.continuity_status,
        continuity_epoch: metadata.continuity_epoch,
        key_created_at: metadata.created_at,
        previous_key_thumbprint: metadata.previous_key_thumbprint,
        private_key_extractable: false
      }
    };
  }

  async function signWithPersistentRecord(value, record) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A JSON object artifact is required.');
    const normalized = await normalizeStoredRecord(record);
    const bindingReceipt = await Binding.buildBindingReceipt(value);
    const createdAt = new Date().toISOString();
    const statement = continuityStatement(bindingReceipt, normalized.metadata, createdAt);
    const statementBytes = Binding.utf8Bytes(Binding.canonicalize(statement, '$'));
    const signatureBytes = new Uint8Array(await webCrypto().subtle.sign({ name: 'Ed25519' }, normalized.privateKey, statementBytes));
    const signatureValue = Signature.base64urlEncode(signatureBytes);
    const idSeed = `${normalized.metadata.jwk_thumbprint}|${bindingReceipt.binding.digest}|${signatureValue}`;
    const idDigest = await Binding.sha256Hex(Binding.utf8Bytes(idSeed));
    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      signature_id: `urn:poai:continuity-signature:ed25519:${idDigest.slice(0, 16)}`,
      created_at: createdAt,
      bound_artifact: statement.bound_artifact,
      binding: statement.binding,
      signature_profile: {
        id: SIGNATURE_PROFILE,
        signature_algorithm: 'Ed25519',
        statement_domain: STATEMENT_DOMAIN,
        alignment: ['RFC 8785', 'SHA-256', 'RFC 8032', 'RFC 8037', 'RFC 7638', 'WebCrypto', 'IndexedDB'],
        w3c_data_integrity_conformance: false
      },
      verification_method: {
        key_format: 'JWK',
        public_key_jwk: normalized.metadata.public_key_jwk,
        jwk_thumbprint_algorithm: normalized.metadata.jwk_thumbprint_algorithm,
        jwk_thumbprint: normalized.metadata.jwk_thumbprint,
        signer_identity_status: 'unknown',
        signer_authority_status: 'unknown',
        materialization_authority_status: 'unknown'
      },
      key_continuity: statement.key_continuity,
      signed_statement: statement,
      signature: { algorithm: 'Ed25519', encoding: 'base64url', value: signatureValue },
      claims: {
        signature_present: true,
        local_key_continuity_established: true,
        signer_identity_verified: false,
        signer_authority_verified: false,
        materialization_authority_verified: false,
        truth_certified: false,
        responsibility_determined: false,
        legal_effect_established: false,
        canonical_successor_established: false,
        poai_v_conformance_established: false
      },
      notes: 'Experimental browser-origin-local key continuity. Same-key continuity does not establish human identity, organization identity, authority, truth, materialization authority, or PoAI/V.'
    };
  }

  async function signWithPersistentKey(value) {
    return signWithPersistentRecord(value, await ensurePersistentKey());
  }

  function validateContinuityEnvelope(envelope) {
    const errors = [];
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return ['Continuity signature envelope must be an object.'];
    if (envelope.artifact_type !== ARTIFACT_TYPE) errors.push(`artifact_type must be ${ARTIFACT_TYPE}.`);
    if (envelope.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (!envelope.signature_profile || envelope.signature_profile.id !== SIGNATURE_PROFILE) errors.push('signature profile is invalid.');
    if (!envelope.signature_profile || envelope.signature_profile.w3c_data_integrity_conformance !== false) errors.push('4.0c must not claim W3C Data Integrity conformance.');
    const vm = envelope.verification_method || {};
    if (!vm.public_key_jwk || vm.public_key_jwk.kty !== 'OKP' || vm.public_key_jwk.crv !== 'Ed25519' || typeof vm.public_key_jwk.x !== 'string') errors.push('Public JWK must be OKP/Ed25519.');
    if (vm.public_key_jwk && Object.prototype.hasOwnProperty.call(vm.public_key_jwk, 'd')) errors.push('Private key material must not appear in the envelope.');
    if (vm.signer_identity_status !== 'unknown' || vm.signer_authority_status !== 'unknown' || vm.materialization_authority_status !== 'unknown') errors.push('Identity and authority statuses must remain unknown in 4.0c.');
    const continuity = envelope.key_continuity || {};
    if (continuity.storage_scope !== STORAGE_SCOPE) errors.push('storage_scope must be browser_origin_local.');
    if (continuity.continuity_status !== CONTINUITY_STATUS) errors.push('continuity_status must be locally_established.');
    if (continuity.private_key_extractable !== false) errors.push('private_key_extractable must be false.');
    if (!Number.isInteger(continuity.continuity_epoch) || continuity.continuity_epoch < 1) errors.push('continuity_epoch must be a positive integer.');
    if (!envelope.signed_statement || !envelope.signed_statement.key_continuity) errors.push('signed_statement.key_continuity is required.');
    else if (Binding.canonicalize(envelope.signed_statement.key_continuity, '$') !== Binding.canonicalize(continuity, '$')) errors.push('Top-level key_continuity must match the signed statement.');
    if (!envelope.signature || envelope.signature.algorithm !== 'Ed25519' || envelope.signature.encoding !== 'base64url' || typeof envelope.signature.value !== 'string') errors.push('Ed25519 base64url signature is required.');
    const claims = envelope.claims || {};
    if (claims.signature_present !== true || claims.local_key_continuity_established !== true) errors.push('signature and local continuity claims must be true.');
    ['signer_identity_verified', 'signer_authority_verified', 'materialization_authority_verified', 'truth_certified', 'responsibility_determined', 'legal_effect_established', 'canonical_successor_established', 'poai_v_conformance_established'].forEach((field) => {
      if (claims[field] !== false) errors.push(`${field} must remain false in 4.0c.`);
    });
    if (Object.prototype.hasOwnProperty.call(envelope, 'protocol')) errors.push('Continuity envelope must not masquerade as a Genesis PoAI record.');
    return errors;
  }

  async function verifyContinuityEnvelope(envelope, value, activeRecord) {
    const errors = validateContinuityEnvelope(envelope);
    if (errors.length) return { signature_valid: false, artifact_binding_matches: false, active_local_key_matches: null, errors };
    const publicJwk = Signature.publicOnlyJwk(envelope.verification_method.public_key_jwk);
    const thumbprint = await Signature.publicJwkThumbprint(publicJwk);
    const thumbprintMatches = thumbprint === envelope.verification_method.jwk_thumbprint;
    let signatureValid = false;
    try {
      const publicKey = await webCrypto().subtle.importKey('jwk', publicJwk, { name: 'Ed25519' }, true, ['verify']);
      const statementBytes = Binding.utf8Bytes(Binding.canonicalize(envelope.signed_statement, '$'));
      signatureValid = await webCrypto().subtle.verify({ name: 'Ed25519' }, publicKey, Signature.base64urlDecode(envelope.signature.value), statementBytes);
    } catch (_) {
      signatureValid = false;
    }
    let artifactBindingMatches = null;
    if (value !== undefined && value !== null) {
      try {
        const receipt = await Binding.buildBindingReceipt(value);
        artifactBindingMatches = receipt.binding.digest === envelope.binding.digest && receipt.binding.canonical_byte_length === envelope.binding.canonical_byte_length;
      } catch (_) {
        artifactBindingMatches = false;
      }
    }
    let activeLocalKeyMatches = null;
    if (activeRecord) {
      const normalized = await normalizeStoredRecord(activeRecord);
      activeLocalKeyMatches = normalized.metadata.jwk_thumbprint === envelope.verification_method.jwk_thumbprint;
    }
    return {
      signature_valid: Boolean(signatureValid && thumbprintMatches),
      cryptographic_signature_valid: Boolean(signatureValid),
      key_thumbprint_matches: thumbprintMatches,
      artifact_binding_matches: artifactBindingMatches,
      active_local_key_matches: activeLocalKeyMatches,
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

  function shortThumbprint(value) {
    if (!value) return '—';
    return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-10)}` : value;
  }

  function ensureControls() {
    if (typeof document === 'undefined' || document.getElementById('keyContinuityPanel')) return;
    const signaturePanel = document.getElementById('signatureEnvelopePanel');
    if (!signaturePanel) return;
    const ru = currentLanguage() === 'ru';
    const panel = document.createElement('section');
    panel.id = 'keyContinuityPanel';
    panel.className = 'panel key-continuity-panel';
    panel.innerHTML = `
      <div class="panel-head">
        <div><p class="eyebrow">PoAI · LEVEL 4.0c</p><h2>${ru ? 'Постоянный локальный ключ' : 'Persistent local signer key'}</h2></div>
        <span class="badge neutral">${ru ? 'LOCAL CONTINUITY · НЕ IDENTITY' : 'LOCAL CONTINUITY · NOT IDENTITY'}</span>
      </div>
      <p class="summary">${ru ? 'Non-exportable Ed25519 private key хранится как CryptoKey в IndexedDB этого origin. Совпадение ключа во времени не доказывает личность или полномочия.' : 'A non-exportable Ed25519 private CryptoKey is stored in IndexedDB for this origin. Same-key continuity over time does not prove identity or authority.'}</p>
      <div id="keyContinuityStatus" class="summary">${ru ? 'Проверка локального ключа…' : 'Checking local key…'}</div>
      <div class="actions">
        <button id="ensurePersistentKeyBtn" type="button" class="primary">${ru ? 'Создать / использовать постоянный ключ' : 'Create / use persistent key'}</button>
        <button id="signPersistentBtn" type="button" disabled>${ru ? 'Подписать постоянным ключом' : 'Sign with persistent key'}</button>
        <button id="verifyContinuityBtn" type="button" disabled>${ru ? 'Проверить continuity signature' : 'Verify continuity signature'}</button>
        <button id="downloadContinuityBtn" type="button" disabled>${ru ? 'Скачать Continuity Envelope' : 'Download Continuity Envelope'}</button>
      </div>
      <div class="actions">
        <label class="file-label" for="continuityEnvelopeInput">${ru ? 'Загрузить Continuity Envelope' : 'Load Continuity Envelope'}</label>
        <input id="continuityEnvelopeInput" type="file" accept="application/json,.json" hidden>
        <button id="rotatePersistentKeyBtn" type="button">${ru ? 'Ротировать локальный ключ' : 'Rotate local key'}</button>
      </div>
      <div id="continuityVerificationResult" class="summary"></div>
    `;
    signaturePanel.insertAdjacentElement('afterend', panel);

    let activeRecord = null;
    let latestEnvelope = null;
    const status = panel.querySelector('#keyContinuityStatus');
    const verification = panel.querySelector('#continuityVerificationResult');
    const ensureBtn = panel.querySelector('#ensurePersistentKeyBtn');
    const signBtn = panel.querySelector('#signPersistentBtn');
    const verifyBtn = panel.querySelector('#verifyContinuityBtn');
    const downloadBtn = panel.querySelector('#downloadContinuityBtn');
    const rotateBtn = panel.querySelector('#rotatePersistentKeyBtn');
    const input = panel.querySelector('#continuityEnvelopeInput');

    function renderKey(record) {
      if (!record) {
        status.textContent = ru ? 'Постоянный локальный ключ ещё не создан.' : 'No persistent local signer key exists yet.';
        signBtn.disabled = true;
        return;
      }
      const m = record.metadata;
      status.textContent = `${ru ? 'Ключ' : 'Key'} ${shortThumbprint(m.jwk_thumbprint)} · ${ru ? 'эпоха' : 'epoch'} ${m.continuity_epoch} · ${ru ? 'PRIVATE NON-EXPORTABLE' : 'PRIVATE NON-EXPORTABLE'} · ${ru ? 'identity/authority: не установлены' : 'identity/authority: not established'}`;
      signBtn.disabled = false;
    }

    function renderVerification(result) {
      const sig = result.signature_valid ? 'SIGNATURE VALID' : 'SIGNATURE INVALID';
      const artifact = result.artifact_binding_matches === true ? 'ARTIFACT MATCH' : result.artifact_binding_matches === false ? 'ARTIFACT MISMATCH' : 'ARTIFACT NOT CHECKED';
      const active = result.active_local_key_matches === true ? 'ACTIVE KEY MATCH' : result.active_local_key_matches === false ? 'ACTIVE KEY MISMATCH' : 'ACTIVE KEY NOT CHECKED';
      verification.textContent = `${sig} · ${artifact} · ${active} · ${ru ? 'только локальная continuity; identity/authority не установлены' : 'local continuity only; identity/authority not established'}`;
    }

    async function refresh() {
      try {
        activeRecord = await loadPersistentKey();
        renderKey(activeRecord);
      } catch (error) {
        activeRecord = null;
        status.textContent = `${ru ? 'Локальное хранилище недоступно' : 'Local key storage unavailable'}: ${error.message}`;
      }
    }

    ensureBtn.addEventListener('click', async () => {
      try {
        activeRecord = await ensurePersistentKey();
        renderKey(activeRecord);
      } catch (error) { status.textContent = error.message; }
    });

    signBtn.addEventListener('click', async () => {
      try {
        const value = currentJson();
        if (!value) throw new Error(ru ? 'Текущий ввод не является JSON-объектом.' : 'Current input is not a JSON object.');
        activeRecord = activeRecord || await ensurePersistentKey();
        latestEnvelope = await signWithPersistentRecord(value, activeRecord);
        verifyBtn.disabled = false;
        downloadBtn.disabled = false;
        renderVerification(await verifyContinuityEnvelope(latestEnvelope, value, activeRecord));
      } catch (error) { verification.textContent = error.message; }
    });

    verifyBtn.addEventListener('click', async () => {
      if (!latestEnvelope) return;
      try {
        activeRecord = await loadPersistentKey();
        renderVerification(await verifyContinuityEnvelope(latestEnvelope, currentJson(), activeRecord));
      } catch (error) { verification.textContent = error.message; }
    });

    downloadBtn.addEventListener('click', () => {
      if (!latestEnvelope) return;
      const suffix = latestEnvelope.signature_id.split(':').pop();
      downloadJson(`${suffix}.poai-continuity-signature.json`, latestEnvelope);
    });

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        latestEnvelope = JSON.parse(await file.text());
        const errors = validateContinuityEnvelope(latestEnvelope);
        if (errors.length) throw new Error(errors.join(' '));
        activeRecord = await loadPersistentKey();
        verifyBtn.disabled = false;
        downloadBtn.disabled = false;
        renderVerification(await verifyContinuityEnvelope(latestEnvelope, currentJson(), activeRecord));
      } catch (error) {
        latestEnvelope = null;
        verifyBtn.disabled = true;
        downloadBtn.disabled = true;
        verification.textContent = error.message;
      }
    });

    rotateBtn.addEventListener('click', async () => {
      try {
        const ok = typeof window === 'undefined' || !window.confirm || window.confirm(ru ? 'Создать новый локальный ключ? Старые подписи останутся валидными, но ACTIVE KEY MATCH для них станет MISMATCH.' : 'Create a new local key? Old signatures remain valid, but their ACTIVE KEY MATCH will become MISMATCH.');
        if (!ok) return;
        activeRecord = await rotatePersistentKey();
        renderKey(activeRecord);
        if (latestEnvelope) renderVerification(await verifyContinuityEnvelope(latestEnvelope, currentJson(), activeRecord));
      } catch (error) { status.textContent = error.message; }
    });

    refresh();
  }

  function init() { ensureControls(); }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }

  return {
    ARTIFACT_TYPE,
    ARTIFACT_VERSION,
    SIGNATURE_PROFILE,
    STATEMENT_DOMAIN,
    STORAGE_SCOPE,
    CONTINUITY_STATUS,
    generatePersistentKeyPair,
    describeKeyPair,
    normalizeStoredRecord,
    continuityStatement,
    signWithPersistentRecord,
    signWithPersistentKey,
    validateContinuityEnvelope,
    verifyContinuityEnvelope,
    loadPersistentKey,
    createPersistentKey,
    ensurePersistentKey,
    rotatePersistentKey
  };
});