(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIBindingReceipt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARTIFACT_TYPE = 'PoAIBindingReceipt';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const CANONICALIZATION_ID = 'RFC8785-JCS';
  const DIGEST_ALGORITHM = 'SHA-256';
  const DIGEST_ENCODING = 'hex';

  function compareUtf16(a, b) {
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      const av = a.charCodeAt(i);
      const bv = b.charCodeAt(i);
      if (av !== bv) return av < bv ? -1 : 1;
    }
    if (a.length === b.length) return 0;
    return a.length < b.length ? -1 : 1;
  }

  function assertValidUnicodeString(value, path) {
    for (let i = 0; i < value.length; i += 1) {
      const unit = value.charCodeAt(i);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        if (i + 1 >= value.length) throw new Error(`${path} contains an unpaired high surrogate.`);
        const next = value.charCodeAt(i + 1);
        if (next < 0xdc00 || next > 0xdfff) throw new Error(`${path} contains an unpaired high surrogate.`);
        i += 1;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) {
        throw new Error(`${path} contains an unpaired low surrogate.`);
      }
    }
  }

  function canonicalize(value, path) {
    const at = path || '$';
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`${at} contains a non-finite number.`);
      if (Object.is(value, -0)) throw new Error(`${at} contains negative zero, rejected by the PoAI RFC8785 profile.`);
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      assertValidUnicodeString(value, at);
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item, index) => canonicalize(item, `${at}[${index}]`)).join(',')}]`;
    }
    if (typeof value === 'object') {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) throw new Error(`${at} must contain JSON objects only.`);
      const keys = Object.keys(value);
      keys.forEach((key) => assertValidUnicodeString(key, `${at} property name`));
      keys.sort(compareUtf16);
      const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${at}.${key}`)}`);
      return `{${entries.join(',')}}`;
    }
    throw new Error(`${at} contains a non-JSON value.`);
  }

  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(text, 'utf8'));
    throw new Error('UTF-8 encoder is unavailable.');
  }

  async function sha256Hex(bytes) {
    if (typeof require === 'function' && typeof module === 'object' && module.exports) {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    }
    if (!globalThis.crypto || !globalThis.crypto.subtle) throw new Error('WebCrypto SHA-256 is unavailable.');
    const result = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(result)).map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function artifactDescriptor(value) {
    const idFields = ['record_id', 'review_id', 'appeal_id', 'adjudication_id', 'execution_id', 'verification_id', 'observation_id', 'proposal_id', 'binding_id'];
    let id = null;
    for (const field of idFields) {
      if (value && typeof value[field] === 'string' && value[field]) {
        id = value[field];
        break;
      }
    }
    let type = 'JSONArtifact';
    if (value && typeof value.artifact_type === 'string' && value.artifact_type) type = value.artifact_type;
    else if (value && value.protocol === 'PoAI') type = 'PoAIDecisionRecord';
    return {
      artifact_type: type,
      artifact_id: id,
      poai_profile: value && typeof value.profile === 'string' ? value.profile : null
    };
  }

  async function buildBindingReceipt(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A JSON object artifact is required.');
    const canonical = canonicalize(value, '$');
    const bytes = utf8Bytes(canonical);
    const digest = await sha256Hex(bytes);
    const descriptor = artifactDescriptor(value);
    const seed = `${descriptor.artifact_type}|${descriptor.artifact_id || ''}|${digest}`;
    const receiptId = `urn:poai:binding:sha256:${digest.slice(0, 16)}`;
    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      binding_id: receiptId,
      created_at: new Date().toISOString(),
      bound_artifact: descriptor,
      binding: {
        canonicalization: CANONICALIZATION_ID,
        digest_algorithm: DIGEST_ALGORITHM,
        digest_encoding: DIGEST_ENCODING,
        digest,
        canonical_byte_length: bytes.length
      },
      interoperability: {
        canonicalization_reference: 'RFC 8785',
        digest_reference: 'SHA-256',
        signature_layer: 'not_present'
      },
      claims: {
        signature_present: false,
        signature_verified: false,
        signer_identity_verified: false,
        signer_authority_verified: false,
        truth_certified: false,
        responsibility_determined: false,
        legal_effect_established: false,
        canonical_successor_established: false,
        poai_v_conformance_established: false
      },
      notes: 'Digest-only experimental binding. Recompute from the original artifact; this receipt is not itself signed.'
    };
  }

  function validateBindingReceipt(receipt) {
    const errors = [];
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return ['Binding receipt must be an object.'];
    if (receipt.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAIBindingReceipt.');
    if (receipt.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof receipt.binding_id !== 'string' || !receipt.binding_id.startsWith('urn:poai:binding:sha256:')) errors.push('binding_id is invalid.');
    if (!receipt.bound_artifact || typeof receipt.bound_artifact.artifact_type !== 'string') errors.push('bound_artifact is required.');
    if (!receipt.binding || receipt.binding.canonicalization !== CANONICALIZATION_ID) errors.push('canonicalization identifier is invalid.');
    if (!receipt.binding || receipt.binding.digest_algorithm !== DIGEST_ALGORITHM) errors.push('digest algorithm must be SHA-256.');
    if (!receipt.binding || receipt.binding.digest_encoding !== DIGEST_ENCODING) errors.push('digest encoding must be hex.');
    if (!receipt.binding || typeof receipt.binding.digest !== 'string' || !/^[0-9a-f]{64}$/.test(receipt.binding.digest)) errors.push('SHA-256 digest is invalid.');
    if (!receipt.binding || !Number.isInteger(receipt.binding.canonical_byte_length) || receipt.binding.canonical_byte_length < 2) errors.push('canonical byte length is invalid.');
    if (!receipt.claims || Object.values(receipt.claims).some((v) => v !== false)) errors.push('Digest-only receipt must not establish signature, identity, authority, truth, responsibility, legal effect, canonical successor, or PoAI/V conformance.');
    if (Object.prototype.hasOwnProperty.call(receipt, 'protocol')) errors.push('Binding receipt must not masquerade as a Genesis PoAI record.');
    return errors;
  }

  async function verifyReceiptAgainstArtifact(receipt, value) {
    const validationErrors = validateBindingReceipt(receipt);
    if (validationErrors.length) return { matches: false, errors: validationErrors };
    const canonical = canonicalize(value, '$');
    const bytes = utf8Bytes(canonical);
    const digest = await sha256Hex(bytes);
    return {
      matches: digest === receipt.binding.digest && bytes.length === receipt.binding.canonical_byte_length,
      errors: [],
      digest,
      canonical_byte_length: bytes.length
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
    if (document.getElementById('bindingReceiptPanel')) return;
    const verifier = document.querySelector('[data-panel="verifier"]');
    const grid = verifier && verifier.querySelector('.grid.two');
    if (!verifier || !grid) return;
    const ru = currentLanguage() === 'ru';
    const panel = document.createElement('section');
    panel.id = 'bindingReceiptPanel';
    panel.className = 'panel binding-receipt-panel';
    panel.innerHTML = `
      <div class="panel-head">
        <div><p class="eyebrow">${ru ? 'PoAI · LEVEL 4.0a' : 'PoAI · LEVEL 4.0a'}</p><h2>${ru ? 'Детерминированная привязка' : 'Deterministic binding'}</h2></div>
        <span class="badge neutral">${ru ? 'DIGEST ONLY · НЕ ПОДПИСЬ' : 'DIGEST ONLY · NOT A SIGNATURE'}</span>
      </div>
      <p class="summary">${ru ? 'RFC 8785 JCS → UTF-8 → SHA-256. Привязка не подтверждает личность, полномочие, истинность или PoAI/V.' : 'RFC 8785 JCS → UTF-8 → SHA-256. A digest does not establish identity, authority, truth, or PoAI/V.'}</p>
      <div class="actions">
        <button id="computeBindingBtn" type="button" class="primary">${ru ? 'Вычислить SHA-256' : 'Compute SHA-256'}</button>
        <button id="downloadBindingBtn" type="button" disabled>${ru ? 'Скачать Binding Receipt' : 'Download Binding Receipt'}</button>
      </div>
      <div id="bindingReceiptResult" class="summary">${ru ? 'Загрузите или вставьте JSON выше.' : 'Load or paste JSON above.'}</div>
    `;
    grid.insertAdjacentElement('afterend', panel);
    let latestReceipt = null;
    const compute = panel.querySelector('#computeBindingBtn');
    const download = panel.querySelector('#downloadBindingBtn');
    const result = panel.querySelector('#bindingReceiptResult');
    compute.addEventListener('click', async () => {
      try {
        const value = currentJson();
        if (!value) throw new Error(ru ? 'Текущий ввод не является JSON-объектом.' : 'Current input is not a JSON object.');
        latestReceipt = await buildBindingReceipt(value);
        const shortDigest = latestReceipt.binding.digest;
        result.textContent = `${CANONICALIZATION_ID} · ${DIGEST_ALGORITHM} · ${latestReceipt.binding.canonical_byte_length} bytes · ${shortDigest}`;
        download.disabled = false;
      } catch (error) {
        latestReceipt = null;
        download.disabled = true;
        result.textContent = error.message;
      }
    });
    download.addEventListener('click', () => {
      if (!latestReceipt) return;
      const suffix = latestReceipt.binding.digest.slice(0, 12);
      downloadJson(`${suffix}.poai-binding.json`, latestReceipt);
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
    CANONICALIZATION_ID,
    DIGEST_ALGORITHM,
    compareUtf16,
    canonicalize,
    utf8Bytes,
    sha256Hex,
    artifactDescriptor,
    buildBindingReceipt,
    validateBindingReceipt,
    verifyReceiptAgainstArtifact,
    assertValidUnicodeString
  };
});