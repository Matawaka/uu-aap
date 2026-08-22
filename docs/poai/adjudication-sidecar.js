(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIAdjudicationSidecar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARTIFACT_TYPE = 'PoAIAdjudicationSidecar';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const DISPOSITIONS = new Set([
    'accepted',
    'rejected',
    'partially_accepted',
    'returned_for_review',
    'no_determination'
  ]);
  const DIRECTIVES = new Set([
    'reconsider',
    'correct_record',
    'review_evidence',
    'review_authority',
    'suspend_pending_review',
    'issue_successor_record'
  ]);
  const PROHIBITED_KEYS = new Set([
    'decision_boundary', 'knowledge_cutoff', 'review_horizon', 'appeal_horizon',
    'score', 'percentage', 'rating', 'intelligence_score', 'trust_score'
  ]);

  function stableHash(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function isoTimestamp(value, label) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error(`${label || 'timestamp'} must be valid`);
    return date.toISOString();
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

  function cleanStrings(values) {
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())))
      .sort();
  }

  function cleanReviewRefs(values) {
    return cleanStrings(values).filter((value) => value.startsWith('urn:poai:review:'));
  }

  function cleanDirectives(values) {
    return cleanStrings(values)
      .filter((value) => DIRECTIVES.has(value))
      .map((code) => ({ code, establishes_execution: false }));
  }

  function buildAdjudicationSidecar(record, options) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A source PoAI decision record object is required.');
    if (typeof record.record_id !== 'string' || !record.record_id) throw new Error('Source record_id is required.');

    const opts = options || {};
    const appealRequestId = typeof opts.appealRequestId === 'string' ? opts.appealRequestId.trim() : '';
    if (!appealRequestId.startsWith('urn:poai:appeal:')) throw new Error('A valid appeal_request_id is required.');

    const decidedAt = isoTimestamp(opts.decidedAt, 'decided_at');
    const evidenceCutoff = opts.evidenceCutoff ? isoTimestamp(opts.evidenceCutoff, 'adjudication evidence cutoff') : null;
    if (evidenceCutoff && Date.parse(evidenceCutoff) > Date.parse(decidedAt)) {
      throw new Error('adjudication evidence cutoff must not be later than decided_at');
    }

    const adjudicatorLabel = typeof opts.adjudicatorLabel === 'string' && opts.adjudicatorLabel.trim()
      ? opts.adjudicatorLabel.trim()
      : null;
    const disposition = DISPOSITIONS.has(opts.disposition) ? opts.disposition : 'no_determination';
    const directives = cleanDirectives(opts.directives);
    const targetedReviewRefs = cleanReviewRefs(opts.targetedReviewRefs);
    const evidenceRefs = cleanStrings(opts.additionalEvidenceRefs);
    const notes = typeof opts.notes === 'string' && opts.notes.trim() ? opts.notes.trim() : null;
    const seed = `${record.record_id}|${appealRequestId}|${decidedAt}|${disposition}|${directives.map((item) => item.code).join(',')}|${targetedReviewRefs.join(',')}`;

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      adjudication_id: `urn:poai:adjudication:${stableHash(seed)}`,
      decided_at: decidedAt,
      decision_record_id: record.record_id,
      appeal_request_id: appealRequestId,
      targeted_review_refs: targetedReviewRefs,
      adjudicator: {
        declaration: adjudicatorLabel ? 'self_declared' : 'undisclosed',
        label: adjudicatorLabel,
        authority_status: 'unknown',
        jurisdiction_status: 'unknown'
      },
      adjudication_horizon: {
        evidence_cutoff: evidenceCutoff
      },
      declared_disposition: {
        code: disposition,
        establishes_implementation: false
      },
      declared_directives: directives,
      additional_evidence_refs: evidenceRefs,
      adjudication_notes: notes,
      source_validation: {
        status: opts.sourceValidationStatus === 'PASS' ? 'PASS' : 'unknown',
        profile: typeof record.profile === 'string' ? record.profile : null,
        truth_certified: false
      },
      claims: {
        implementation_established: false,
        execution_established: false,
        observed_outcome_established: false,
        truth_certified: false,
        causal_proof_certified: false,
        legal_effect_established: false,
        authority_determined: false,
        jurisdiction_determined: false,
        canonical_verdict_established: false
      },
      versioning: {
        adjudication_artifact_version: 1,
        previous_adjudication: null,
        successor_adjudication: null
      }
    };
  }

  function validateAdjudicationSidecar(sidecar) {
    const errors = [];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return ['Adjudication sidecar must be an object.'];
    if (sidecar.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAIAdjudicationSidecar.');
    if (sidecar.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof sidecar.adjudication_id !== 'string' || !sidecar.adjudication_id.startsWith('urn:poai:adjudication:')) errors.push('adjudication_id is invalid.');
    if (typeof sidecar.decision_record_id !== 'string' || !sidecar.decision_record_id) errors.push('decision_record_id is required.');
    if (typeof sidecar.appeal_request_id !== 'string' || !sidecar.appeal_request_id.startsWith('urn:poai:appeal:')) errors.push('appeal_request_id is invalid.');
    if (Number.isNaN(Date.parse(sidecar.decided_at))) errors.push('decided_at is invalid.');

    const cutoff = sidecar.adjudication_horizon && sidecar.adjudication_horizon.evidence_cutoff;
    if (cutoff && Number.isNaN(Date.parse(cutoff))) errors.push('adjudication_horizon.evidence_cutoff is invalid.');
    if (cutoff && !Number.isNaN(Date.parse(sidecar.decided_at)) && Date.parse(cutoff) > Date.parse(sidecar.decided_at)) {
      errors.push('adjudication_horizon.evidence_cutoff must not be later than decided_at.');
    }

    if (!sidecar.adjudicator || sidecar.adjudicator.authority_status !== 'unknown' || sidecar.adjudicator.jurisdiction_status !== 'unknown') {
      errors.push('adjudicator authority_status and jurisdiction_status must remain unknown in this experiment.');
    }
    if (!sidecar.declared_disposition || !DISPOSITIONS.has(sidecar.declared_disposition.code) || sidecar.declared_disposition.establishes_implementation !== false) {
      errors.push('declared_disposition must be valid and must not establish implementation.');
    }
    if (!Array.isArray(sidecar.declared_directives) || sidecar.declared_directives.some((item) => !item || !DIRECTIVES.has(item.code) || item.establishes_execution !== false)) {
      errors.push('declared_directives must contain valid non-executing directive codes.');
    }
    if (!Array.isArray(sidecar.targeted_review_refs) || sidecar.targeted_review_refs.some((value) => typeof value !== 'string' || !value.startsWith('urn:poai:review:'))) {
      errors.push('targeted_review_refs must contain valid review URNs.');
    }
    if (deepHasProhibitedKey(sidecar)) errors.push('Adjudication sidecar contains a prohibited earlier-context or scalar-score key.');
    if (sidecar.claims && Object.values(sidecar.claims).some((value) => value !== false)) {
      errors.push('Adjudication sidecar must not establish implementation, execution, outcome, truth, causality, legal effect, authority, jurisdiction, or a canonical verdict.');
    }
    if (Object.prototype.hasOwnProperty.call(sidecar, 'protocol')) errors.push('Adjudication sidecar must not masquerade as a Genesis PoAI record.');
    return errors;
  }

  function currentLanguage() {
    return document.documentElement.lang === 'ru' ? 'ru' : 'en';
  }

  function currentRecord() {
    const input = document.getElementById('jsonInput');
    const status = document.getElementById('statusBadge');
    if (!input || !status || !status.classList.contains('good')) return null;
    try { return JSON.parse(input.value); } catch (_) { return null; }
  }

  function toIsoFromLocal(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    if (!panel || panel.querySelector('#adjudicationSidecarControls')) return;
    const lang = currentLanguage();
    const box = document.createElement('div');
    box.id = 'adjudicationSidecarControls';
    box.className = 'review-sidecar-controls adjudication-sidecar-controls';
    box.innerHTML = `
      <div class="review-cues-kicker">${lang === 'ru' ? 'ЭКСПЕРИМЕНТАЛЬНОЕ РАЗРЕШЕНИЕ' : 'EXPERIMENTAL ADJUDICATION'}</div>
      <div class="review-cues-title">${lang === 'ru' ? 'Решение по запросу на апелляцию' : 'Adjudication / resolution artifact'}</div>
      <div class="review-cues-note">${lang === 'ru' ? 'Фиксирует заявленное решение по апелляции, но не доказывает его исполнение, обязательность или фактический исход.' : 'Records a declared appeal resolution but does not prove execution, binding effect, or observed outcome.'}</div>
      <div class="review-sidecar-grid">
        <label><span>${lang === 'ru' ? 'Appeal Request ID (обязательно)' : 'Appeal Request ID (required)'}</span><input id="adjudicationAppealId" type="text" placeholder="urn:poai:appeal:..."></label>
        <label><span>${lang === 'ru' ? 'Рассматривающий / роль (необязательно)' : 'Adjudicator / role (optional)'}</span><input id="adjudicationActor" type="text"></label>
        <label><span>${lang === 'ru' ? 'Заявленное решение' : 'Declared disposition'}</span><select id="adjudicationDisposition">
          <option value="no_determination">${lang === 'ru' ? 'Нет определения' : 'No determination'}</option>
          <option value="accepted">${lang === 'ru' ? 'Апелляция принята' : 'Accepted'}</option>
          <option value="rejected">${lang === 'ru' ? 'Апелляция отклонена' : 'Rejected'}</option>
          <option value="partially_accepted">${lang === 'ru' ? 'Частично принята' : 'Partially accepted'}</option>
          <option value="returned_for_review">${lang === 'ru' ? 'Возвращено на дополнительное рассмотрение' : 'Returned for review'}</option>
        </select></label>
        <label><span>${lang === 'ru' ? 'Заявленная директива (необязательно)' : 'Declared directive (optional)'}</span><select id="adjudicationDirective">
          <option value="">${lang === 'ru' ? 'Без директивы' : 'No directive'}</option>
          <option value="reconsider">${lang === 'ru' ? 'Пересмотреть' : 'Reconsider'}</option>
          <option value="correct_record">${lang === 'ru' ? 'Исправить запись' : 'Correct record'}</option>
          <option value="review_evidence">${lang === 'ru' ? 'Пересмотреть доказательства' : 'Review evidence'}</option>
          <option value="review_authority">${lang === 'ru' ? 'Проверить полномочия' : 'Review authority'}</option>
          <option value="suspend_pending_review">${lang === 'ru' ? 'Приостановить до проверки' : 'Suspend pending review'}</option>
          <option value="issue_successor_record">${lang === 'ru' ? 'Выпустить successor record' : 'Issue successor record'}</option>
        </select></label>
        <label><span>${lang === 'ru' ? 'Adjudication evidence cutoff (необязательно)' : 'Adjudication evidence cutoff (optional)'}</span><input id="adjudicationEvidenceCutoff" type="datetime-local"></label>
        <label><span>${lang === 'ru' ? 'Связанный Review ID (необязательно)' : 'Related Review ID (optional)'}</span><input id="adjudicationReviewId" type="text" placeholder="urn:poai:review:..."></label>
        <label class="review-sidecar-wide"><span>${lang === 'ru' ? 'Примечание (необязательно)' : 'Note (optional)'}</span><input id="adjudicationNotes" type="text"></label>
      </div>
      <div class="actions">
        <button id="downloadAdjudicationBtn" type="button">${lang === 'ru' ? 'Скачать Adjudication Sidecar' : 'Download Adjudication Sidecar'}</button>
        <span class="review-cues-note">${lang === 'ru' ? 'Заявленное решение ≠ исполненный эффект ≠ наблюдаемый исход.' : 'Declared resolution ≠ executed effect ≠ observed outcome.'}</span>
      </div>`;
    panel.append(box);

    box.querySelector('#downloadAdjudicationBtn').addEventListener('click', () => {
      const record = currentRecord();
      if (!record) return;
      const directive = box.querySelector('#adjudicationDirective').value;
      const reviewId = box.querySelector('#adjudicationReviewId').value.trim();
      try {
        const sidecar = buildAdjudicationSidecar(record, {
          appealRequestId: box.querySelector('#adjudicationAppealId').value,
          adjudicatorLabel: box.querySelector('#adjudicationActor').value,
          disposition: box.querySelector('#adjudicationDisposition').value,
          directives: directive ? [directive] : [],
          evidenceCutoff: toIsoFromLocal(box.querySelector('#adjudicationEvidenceCutoff').value),
          targetedReviewRefs: reviewId ? [reviewId] : [],
          notes: box.querySelector('#adjudicationNotes').value,
          sourceValidationStatus: 'PASS'
        });
        const errors = validateAdjudicationSidecar(sidecar);
        if (errors.length) { alert(errors.join('\n')); return; }
        downloadJson(`${stableHash(sidecar.decision_record_id)}.poai-adjudication.json`, sidecar);
      } catch (error) {
        alert(error.message || String(error));
      }
    });
  }

  function initBrowser() {
    ensureControls();
    const target = document.querySelector('[data-panel="verifier"]');
    if (target) new MutationObserver(() => ensureControls()).observe(target, { childList: true, subtree: true });
    document.addEventListener('poai:languagechange', () => {
      const existing = document.getElementById('adjudicationSidecarControls');
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
    DISPOSITIONS,
    DIRECTIVES,
    buildAdjudicationSidecar,
    validateAdjudicationSidecar,
    deepHasProhibitedKey,
    stableHash
  });
});
