(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIReviewSidecar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARTIFACT_TYPE = 'PoAIReviewSidecar';
  const ARTIFACT_VERSION = '0.0.2-experimental';
  const LENS_ID = 'poai-level3.1d-purpose-relative';
  const LENS_VERSION = '0.1';
  const REVIEW_RELATIONS = new Set(['responds_to', 'supports', 'challenges']);
  const PROHIBITED_KEYS = new Set([
    'decision_boundary', 'knowledge_cutoff', 'score', 'percentage', 'rating',
    'intelligence_score', 'trust_score'
  ]);

  function stableHash(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function deepHasProhibitedKey(value) {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(deepHasProhibitedKey);
    for (const [key, child] of Object.entries(value)) {
      if (PROHIBITED_KEYS.has(key)) return true;
      if (deepHasProhibitedKey(child)) return true;
    }
    return false;
  }

  function cleanCueCodes(cueCodes) {
    return Array.from(new Set((Array.isArray(cueCodes) ? cueCodes : [])
      .filter((code) => typeof code === 'string' && code.trim())
      .map((code) => code.trim())))
      .sort();
  }

  function isoTimestamp(value, fieldName) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error(`${fieldName || 'timestamp'} must be a valid timestamp`);
    return date.toISOString();
  }

  function cleanReviewRelations(options) {
    const opts = options || {};
    const relation = typeof opts.relatedReviewRelation === 'string' ? opts.relatedReviewRelation.trim() : '';
    const target = typeof opts.relatedReviewId === 'string' ? opts.relatedReviewId.trim() : '';
    if (!relation || !target) return [];
    return [{ relation, target_review_id: target }];
  }

  function buildReviewSidecar(record, options) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A source PoAI record object is required.');
    if (!record.record_id || typeof record.record_id !== 'string') throw new Error('Source record_id is required.');

    const opts = options || {};
    const reviewedAt = isoTimestamp(opts.reviewedAt, 'reviewed_at');
    const evidenceCutoff = isoTimestamp(opts.evidenceCutoff || reviewedAt, 'review evidence cutoff');
    const purpose = typeof opts.purpose === 'string' && opts.purpose ? opts.purpose : 'generic';
    const cueCodes = cleanCueCodes(opts.cueCodes);
    const reviewerLabel = typeof opts.reviewerLabel === 'string' && opts.reviewerLabel.trim() ? opts.reviewerLabel.trim() : null;
    const notes = typeof opts.notes === 'string' && opts.notes.trim() ? opts.notes.trim() : null;
    const reviewRelations = cleanReviewRelations(opts);
    const sourceBinding = record.artifact_binding || {};
    const seed = [
      record.record_id,
      reviewedAt,
      evidenceCutoff,
      purpose,
      cueCodes.join(','),
      reviewerLabel || '',
      reviewRelations.map((item) => `${item.relation}:${item.target_review_id}`).join(',')
    ].join('|');

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      review_id: `urn:poai:review:${stableHash(seed)}`,
      reviewed_record_id: record.record_id,
      reviewed_at: reviewedAt,
      review_horizon: {
        evidence_cutoff: evidenceCutoff
      },
      review_purpose: purpose,
      review_lens: {
        id: LENS_ID,
        version: LENS_VERSION
      },
      reviewer: {
        declaration: reviewerLabel ? 'self_declared' : 'undisclosed',
        label: reviewerLabel,
        authority_status: 'unknown'
      },
      source_validation: {
        status: opts.sourceValidationStatus === 'PASS' ? 'PASS' : 'unknown',
        profile: typeof record.profile === 'string' ? record.profile : null,
        truth_certified: false
      },
      observed_cues: cueCodes.map((code) => ({ code })),
      additional_evidence_refs: [],
      review_relations: reviewRelations,
      review_notes: notes,
      requested_successor_record: null,
      appeal_or_contestability_ref: null,
      source_binding: {
        status: typeof sourceBinding.status === 'string' ? sourceBinding.status : 'unknown',
        sha256: typeof sourceBinding.sha256 === 'string' ? sourceBinding.sha256 : null
      },
      claims: {
        truth_certified: false,
        causal_proof_certified: false,
        legal_responsibility_determined: false,
        authority_determined: false,
        canonical_verdict_established: false
      },
      versioning: {
        review_artifact_version: 2,
        previous_review: null,
        successor_review: null
      }
    };
  }

  function validateReviewSidecar(sidecar) {
    const errors = [];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return ['Sidecar must be an object.'];
    if (sidecar.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAIReviewSidecar.');
    if (sidecar.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof sidecar.review_id !== 'string' || !sidecar.review_id.startsWith('urn:poai:review:')) errors.push('review_id is invalid.');
    if (typeof sidecar.reviewed_record_id !== 'string' || !sidecar.reviewed_record_id) errors.push('reviewed_record_id is required.');

    const reviewedAt = Date.parse(sidecar.reviewed_at);
    if (Number.isNaN(reviewedAt)) errors.push('reviewed_at is invalid.');

    const evidenceCutoff = sidecar.review_horizon && Date.parse(sidecar.review_horizon.evidence_cutoff);
    if (!sidecar.review_horizon || Number.isNaN(evidenceCutoff)) {
      errors.push('review_horizon.evidence_cutoff is required and must be a valid timestamp.');
    } else if (!Number.isNaN(reviewedAt) && evidenceCutoff > reviewedAt) {
      errors.push('review_horizon.evidence_cutoff must not be later than reviewed_at.');
    }

    if (typeof sidecar.review_purpose !== 'string' || !sidecar.review_purpose) errors.push('review_purpose is required.');
    if (!sidecar.review_lens || sidecar.review_lens.id !== LENS_ID) errors.push('review_lens.id is invalid.');
    if (!Array.isArray(sidecar.observed_cues) || sidecar.observed_cues.some((item) => !item || typeof item.code !== 'string')) errors.push('observed_cues must contain language-neutral cue codes.');

    if (!sidecar.reviewer || sidecar.reviewer.authority_status !== 'unknown') {
      errors.push('reviewer.authority_status must remain unknown in this experiment.');
    }

    if (!Array.isArray(sidecar.review_relations)) {
      errors.push('review_relations must be an array.');
    } else {
      sidecar.review_relations.forEach((item, index) => {
        if (!item || !REVIEW_RELATIONS.has(item.relation)) errors.push(`review_relations[${index}].relation is invalid.`);
        if (!item || typeof item.target_review_id !== 'string' || !item.target_review_id.startsWith('urn:poai:review:')) {
          errors.push(`review_relations[${index}].target_review_id is invalid.`);
        } else if (item.target_review_id === sidecar.review_id) {
          errors.push(`review_relations[${index}] must not target the same review_id.`);
        }
      });
    }

    if (deepHasProhibitedKey(sidecar)) errors.push('Sidecar contains a prohibited decision-context or scalar-score key.');
    if (sidecar.claims && Object.values(sidecar.claims).some((value) => value !== false)) errors.push('Review sidecar must not certify truth, causality, legal responsibility, authority, or a canonical verdict.');
    if (Object.prototype.hasOwnProperty.call(sidecar, 'protocol')) errors.push('Review sidecar must not masquerade as a Genesis PoAI record.');
    return errors;
  }

  function currentLanguage() {
    return document.documentElement.lang === 'ru' ? 'ru' : 'en';
  }

  function currentRecordAndCues() {
    const input = document.getElementById('jsonInput');
    const status = document.getElementById('statusBadge');
    if (!input || !status || !status.classList.contains('good')) return null;
    try {
      const record = JSON.parse(input.value);
      const purposeSelect = document.getElementById('reviewPurpose');
      const purpose = purposeSelect ? purposeSelect.value : 'generic';
      const cueApi = globalThis.PoAIReviewCues;
      const cues = cueApi && typeof cueApi.evaluateReviewCues === 'function'
        ? cueApi.evaluateReviewCues(record, purpose)
        : [];
      return { record, purpose, cueCodes: cues.map((cue) => cue.code) };
    } catch (_) {
      return null;
    }
  }

  function downloadJson(filename, data) {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function ensureControls() {
    const panel = document.getElementById('reviewCuesPanel');
    if (!panel || panel.querySelector('#reviewSidecarControls')) return;
    const lang = currentLanguage();
    const box = document.createElement('div');
    box.id = 'reviewSidecarControls';
    box.className = 'review-sidecar-controls';
    box.innerHTML = `
      <div class="review-sidecar-grid">
        <label><span>${lang === 'ru' ? 'Рецензент / роль (необязательно)' : 'Reviewer / role (optional)'}</span><input id="reviewSidecarReviewer" type="text"></label>
        <label><span>${lang === 'ru' ? 'Примечание рецензента (необязательно)' : 'Reviewer note (optional)'}</span><input id="reviewSidecarNotes" type="text"></label>
        <label><span>${lang === 'ru' ? 'Граница доказательств рецензии (необязательно)' : 'Review evidence cutoff (optional)'}</span><input id="reviewSidecarEvidenceCutoff" type="datetime-local"></label>
        <label><span>${lang === 'ru' ? 'Связь с другой рецензией' : 'Relation to another review'}</span>
          <select id="reviewSidecarRelation"><option value="">—</option><option value="responds_to">responds_to</option><option value="supports">supports</option><option value="challenges">challenges</option></select>
        </label>
        <label class="review-sidecar-wide"><span>${lang === 'ru' ? 'Review ID другой рецензии (необязательно)' : 'Other review ID (optional)'}</span><input id="reviewSidecarRelatedId" type="text" placeholder="urn:poai:review:..."></label>
      </div>
      <p class="review-cues-note">${lang === 'ru' ? 'Граница доказательств относится только к моменту рецензирования и не изменяет исходный Knowledge Cutoff.' : 'The evidence cutoff belongs only to the review horizon and does not change the source Knowledge Cutoff.'}</p>
      <div class="actions">
        <button id="downloadReviewSidecarBtn" type="button">${lang === 'ru' ? 'Скачать Review Sidecar' : 'Download Review Sidecar'}</button>
        <span class="review-cues-note">${lang === 'ru' ? 'Отдельный экспериментальный review artifact; исходный PoAI JSON не изменяется.' : 'Separate experimental review artifact; the source PoAI JSON is not modified.'}</span>
      </div>`;
    panel.append(box);

    const button = box.querySelector('#downloadReviewSidecarBtn');
    button.addEventListener('click', () => {
      const state = currentRecordAndCues();
      if (!state) return;
      const reviewer = box.querySelector('#reviewSidecarReviewer').value;
      const notes = box.querySelector('#reviewSidecarNotes').value;
      const evidenceCutoff = box.querySelector('#reviewSidecarEvidenceCutoff').value;
      const relatedReviewRelation = box.querySelector('#reviewSidecarRelation').value;
      const relatedReviewId = box.querySelector('#reviewSidecarRelatedId').value;
      const sidecar = buildReviewSidecar(state.record, {
        purpose: state.purpose,
        cueCodes: state.cueCodes,
        reviewerLabel: reviewer,
        notes,
        evidenceCutoff: evidenceCutoff || undefined,
        relatedReviewRelation,
        relatedReviewId,
        sourceValidationStatus: 'PASS'
      });
      const validationErrors = validateReviewSidecar(sidecar);
      if (validationErrors.length) {
        alert(validationErrors.join('\n'));
        return;
      }
      downloadJson(`${stableHash(sidecar.reviewed_record_id)}-${stableHash(sidecar.review_id)}.poai-review.json`, sidecar);
    });
  }

  function injectStyles() {
    if (document.getElementById('poai-review-sidecar-style')) return;
    const style = document.createElement('style');
    style.id = 'poai-review-sidecar-style';
    style.textContent = `
      .review-sidecar-controls { margin-top:16px; padding-top:16px; border-top:1px solid var(--line); }
      .review-sidecar-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .review-sidecar-grid label { display:grid; gap:5px; font-weight:650; }
      .review-sidecar-grid .review-sidecar-wide { grid-column:1 / -1; }
      @media (max-width:820px) { .review-sidecar-grid { grid-template-columns:1fr; } .review-sidecar-grid .review-sidecar-wide { grid-column:auto; } }
    `;
    document.head.append(style);
  }

  function initBrowser() {
    injectStyles();
    ensureControls();
    const target = document.querySelector('[data-panel="verifier"]');
    if (target) new MutationObserver(() => ensureControls()).observe(target, { childList: true, subtree: true });
    document.addEventListener('poai:languagechange', () => {
      const existing = document.getElementById('reviewSidecarControls');
      if (existing) existing.remove();
      ensureControls();
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrowser);
    else initBrowser();
  }

  return Object.freeze({
    ARTIFACT_TYPE,
    ARTIFACT_VERSION,
    LENS_ID,
    LENS_VERSION,
    REVIEW_RELATIONS,
    buildReviewSidecar,
    validateReviewSidecar,
    deepHasProhibitedKey,
    stableHash
  });
});
