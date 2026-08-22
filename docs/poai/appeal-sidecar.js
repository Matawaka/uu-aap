(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIAppealSidecar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARTIFACT_TYPE = 'PoAIAppealRequestSidecar';
  const ARTIFACT_VERSION = '0.0.1-experimental';
  const GROUND_CODES = new Set([
    'new_evidence',
    'procedural_issue',
    'authority_dispute',
    'factual_dispute',
    'causal_dispute',
    'completeness_dispute',
    'future_intervention_dispute',
    'other'
  ]);
  const REQUESTED_ACTIONS = new Set([
    'reconsider',
    'correct_record',
    'review_evidence',
    'review_authority',
    'suspend_pending_review',
    'issue_successor_record',
    'other'
  ]);
  const TARGET_TYPES = new Set(['decision_record', 'review_artifact']);
  const PROHIBITED_KEYS = new Set([
    'decision_boundary', 'knowledge_cutoff', 'review_horizon',
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

  function deepHasProhibitedKey(value) {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(deepHasProhibitedKey);
    for (const [key, child] of Object.entries(value)) {
      if (PROHIBITED_KEYS.has(key)) return true;
      if (deepHasProhibitedKey(child)) return true;
    }
    return false;
  }

  function isoTimestamp(value, label) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error(`${label || 'timestamp'} must be valid`);
    return date.toISOString();
  }

  function cleanGrounds(values) {
    const source = Array.isArray(values) ? values : [];
    const cleaned = source
      .filter((value) => typeof value === 'string' && GROUND_CODES.has(value))
      .map((value) => value.trim());
    return Array.from(new Set(cleaned)).sort();
  }

  function cleanEvidenceRefs(values) {
    const source = Array.isArray(values) ? values : [];
    return Array.from(new Set(source
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())))
      .sort();
  }

  function cleanTargets(decisionRecordId, values) {
    const source = Array.isArray(values) && values.length
      ? values
      : [{ target_type: 'decision_record', target_id: decisionRecordId }];
    const seen = new Set();
    const targets = [];
    source.forEach((target) => {
      if (!target || typeof target !== 'object') return;
      const targetType = target.target_type;
      const targetId = typeof target.target_id === 'string' ? target.target_id.trim() : '';
      if (!TARGET_TYPES.has(targetType) || !targetId) return;
      const key = `${targetType}|${targetId}`;
      if (seen.has(key)) return;
      seen.add(key);
      targets.push({ target_type: targetType, target_id: targetId });
    });
    return targets;
  }

  function buildAppealSidecar(record, options) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('A source PoAI record object is required.');
    if (typeof record.record_id !== 'string' || !record.record_id) throw new Error('Source record_id is required.');

    const opts = options || {};
    const filedAt = isoTimestamp(opts.filedAt, 'filed_at');
    const evidenceCutoff = opts.evidenceCutoff ? isoTimestamp(opts.evidenceCutoff, 'appeal evidence cutoff') : null;
    if (evidenceCutoff && Date.parse(evidenceCutoff) > Date.parse(filedAt)) {
      throw new Error('appeal evidence cutoff must not be later than filed_at');
    }

    const appellantLabel = typeof opts.appellantLabel === 'string' && opts.appellantLabel.trim()
      ? opts.appellantLabel.trim()
      : null;
    const grounds = cleanGrounds(opts.grounds);
    const requestedAction = REQUESTED_ACTIONS.has(opts.requestedAction) ? opts.requestedAction : 'reconsider';
    const targets = cleanTargets(record.record_id, opts.targets);
    const notes = typeof opts.notes === 'string' && opts.notes.trim() ? opts.notes.trim() : null;
    const evidenceRefs = cleanEvidenceRefs(opts.additionalEvidenceRefs);
    const seed = `${record.record_id}|${filedAt}|${targets.map((item) => `${item.target_type}:${item.target_id}`).join(',')}|${grounds.join(',')}|${requestedAction}`;

    return {
      artifact_type: ARTIFACT_TYPE,
      artifact_version: ARTIFACT_VERSION,
      appeal_id: `urn:poai:appeal:${stableHash(seed)}`,
      filed_at: filedAt,
      decision_record_id: record.record_id,
      targets,
      appellant: {
        declaration: appellantLabel ? 'self_declared' : 'undisclosed',
        label: appellantLabel,
        authority_status: 'unknown',
        standing_status: 'unknown'
      },
      appeal_horizon: {
        evidence_cutoff: evidenceCutoff
      },
      grounds: grounds.map((code) => ({ code })),
      requested_action: {
        code: requestedAction,
        establishes_effect: false
      },
      additional_evidence_refs: evidenceRefs,
      appeal_notes: notes,
      source_validation: {
        status: opts.sourceValidationStatus === 'PASS' ? 'PASS' : 'unknown',
        profile: typeof record.profile === 'string' ? record.profile : null,
        truth_certified: false
      },
      claims: {
        appeal_accepted: false,
        stay_established: false,
        decision_reversed: false,
        review_reversed: false,
        truth_certified: false,
        causal_proof_certified: false,
        legal_effect_established: false,
        authority_determined: false,
        standing_determined: false,
        canonical_verdict_established: false
      },
      versioning: {
        appeal_artifact_version: 1,
        previous_appeal: null,
        successor_appeal: null
      }
    };
  }

  function validateAppealSidecar(sidecar) {
    const errors = [];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return ['Appeal sidecar must be an object.'];
    if (sidecar.artifact_type !== ARTIFACT_TYPE) errors.push('artifact_type must be PoAIAppealRequestSidecar.');
    if (sidecar.artifact_version !== ARTIFACT_VERSION) errors.push('Unexpected artifact_version.');
    if (typeof sidecar.appeal_id !== 'string' || !sidecar.appeal_id.startsWith('urn:poai:appeal:')) errors.push('appeal_id is invalid.');
    if (typeof sidecar.decision_record_id !== 'string' || !sidecar.decision_record_id) errors.push('decision_record_id is required.');
    if (Number.isNaN(Date.parse(sidecar.filed_at))) errors.push('filed_at is invalid.');

    const cutoff = sidecar.appeal_horizon && sidecar.appeal_horizon.evidence_cutoff;
    if (cutoff && Number.isNaN(Date.parse(cutoff))) errors.push('appeal_horizon.evidence_cutoff is invalid.');
    if (cutoff && !Number.isNaN(Date.parse(sidecar.filed_at)) && Date.parse(cutoff) > Date.parse(sidecar.filed_at)) {
      errors.push('appeal_horizon.evidence_cutoff must not be later than filed_at.');
    }

    if (!Array.isArray(sidecar.targets) || !sidecar.targets.length) {
      errors.push('targets must contain at least one appeal target.');
    } else {
      const seen = new Set();
      sidecar.targets.forEach((target) => {
        if (!target || typeof target !== 'object' || !TARGET_TYPES.has(target.target_type) || typeof target.target_id !== 'string' || !target.target_id) {
          errors.push('Each appeal target must contain a valid target_type and target_id.');
          return;
        }
        const key = `${target.target_type}|${target.target_id}`;
        if (seen.has(key)) errors.push('Duplicate appeal target.');
        seen.add(key);
        if (target.target_type === 'decision_record' && target.target_id !== sidecar.decision_record_id) {
          errors.push('decision_record target must match decision_record_id.');
        }
        if (target.target_type === 'review_artifact' && !target.target_id.startsWith('urn:poai:review:')) {
          errors.push('review_artifact target_id must be a PoAI review URN.');
        }
      });
    }

    if (!sidecar.appellant || sidecar.appellant.authority_status !== 'unknown' || sidecar.appellant.standing_status !== 'unknown') {
      errors.push('appellant authority_status and standing_status must remain unknown in this experiment.');
    }
    if (!Array.isArray(sidecar.grounds) || sidecar.grounds.some((item) => !item || !GROUND_CODES.has(item.code))) {
      errors.push('grounds must contain valid language-neutral codes.');
    }
    if (!sidecar.requested_action || !REQUESTED_ACTIONS.has(sidecar.requested_action.code) || sidecar.requested_action.establishes_effect !== false) {
      errors.push('requested_action must be a valid request and must not establish effect.');
    }
    if (deepHasProhibitedKey(sidecar)) errors.push('Appeal sidecar contains a prohibited historical-context or scalar-score key.');
    if (sidecar.claims && Object.values(sidecar.claims).some((value) => value !== false)) {
      errors.push('Appeal sidecar must not establish acceptance, stay, reversal, truth, causality, legal effect, authority, standing, or a canonical verdict.');
    }
    if (Object.prototype.hasOwnProperty.call(sidecar, 'protocol')) errors.push('Appeal sidecar must not masquerade as a Genesis PoAI record.');
    return errors;
  }

  function currentLanguage() {
    return document.documentElement.lang === 'ru' ? 'ru' : 'en';
  }

  function currentRecord() {
    const input = document.getElementById('jsonInput');
    const status = document.getElementById('statusBadge');
    if (!input || !status || !status.classList.contains('good')) return null;
    try {
      return JSON.parse(input.value);
    } catch (_) {
      return null;
    }
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
    if (!panel || panel.querySelector('#appealSidecarControls')) return;
    const lang = currentLanguage();
    const box = document.createElement('div');
    box.id = 'appealSidecarControls';
    box.className = 'review-sidecar-controls appeal-sidecar-controls';
    box.innerHTML = `
      <div class="review-cues-kicker">${lang === 'ru' ? 'ЭКСПЕРИМЕНТАЛЬНОЕ ОСПАРИВАНИЕ' : 'EXPERIMENTAL CONTEST / APPEAL'}</div>
      <div class="review-cues-title">${lang === 'ru' ? 'Запрос на апелляцию / оспаривание' : 'Appeal / contest request'}</div>
      <div class="review-cues-note">${lang === 'ru' ? 'Это отдельный запрос. Он не отменяет решение, не приостанавливает действие и не устанавливает право заявителя.' : 'This is a separate request. It does not reverse the decision, establish a stay, or establish appellant standing.'}</div>
      <div class="review-sidecar-grid">
        <label><span>${lang === 'ru' ? 'Заявитель / роль (необязательно)' : 'Appellant / role (optional)'}</span><input id="appealSidecarAppellant" type="text"></label>
        <label><span>${lang === 'ru' ? 'Основание' : 'Ground'}</span><select id="appealSidecarGround">
          <option value="new_evidence">${lang === 'ru' ? 'Новые доказательства' : 'New evidence'}</option>
          <option value="procedural_issue">${lang === 'ru' ? 'Процедурная проблема' : 'Procedural issue'}</option>
          <option value="authority_dispute">${lang === 'ru' ? 'Спор о полномочиях' : 'Authority dispute'}</option>
          <option value="factual_dispute">${lang === 'ru' ? 'Спор о фактах' : 'Factual dispute'}</option>
          <option value="causal_dispute">${lang === 'ru' ? 'Спор о причинности' : 'Causal dispute'}</option>
          <option value="completeness_dispute">${lang === 'ru' ? 'Спор о полноте записи' : 'Completeness dispute'}</option>
          <option value="future_intervention_dispute">${lang === 'ru' ? 'Спор о будущем вмешательстве' : 'Future intervention dispute'}</option>
          <option value="other">${lang === 'ru' ? 'Другое' : 'Other'}</option>
        </select></label>
        <label><span>${lang === 'ru' ? 'Запрашиваемое действие' : 'Requested action'}</span><select id="appealSidecarAction">
          <option value="reconsider">${lang === 'ru' ? 'Пересмотреть' : 'Reconsider'}</option>
          <option value="correct_record">${lang === 'ru' ? 'Запросить исправление записи' : 'Request record correction'}</option>
          <option value="review_evidence">${lang === 'ru' ? 'Пересмотреть доказательства' : 'Review evidence'}</option>
          <option value="review_authority">${lang === 'ru' ? 'Проверить полномочия' : 'Review authority'}</option>
          <option value="suspend_pending_review">${lang === 'ru' ? 'Запросить приостановку до проверки' : 'Request suspension pending review'}</option>
          <option value="issue_successor_record">${lang === 'ru' ? 'Запросить successor record' : 'Request successor record'}</option>
          <option value="other">${lang === 'ru' ? 'Другое' : 'Other'}</option>
        </select></label>
        <label><span>${lang === 'ru' ? 'Цель оспаривания' : 'Appeal target'}</span><select id="appealSidecarTargetType">
          <option value="decision_record">${lang === 'ru' ? 'Исходное решение' : 'Decision record'}</option>
          <option value="review_artifact">${lang === 'ru' ? 'Конкретная рецензия' : 'Specific review artifact'}</option>
        </select></label>
        <label><span>${lang === 'ru' ? 'Review ID (если оспаривается рецензия)' : 'Review ID (when targeting a review)'}</span><input id="appealSidecarReviewId" type="text" placeholder="urn:poai:review:..."></label>
        <label><span>${lang === 'ru' ? 'Граница доказательств апелляции (необязательно)' : 'Appeal evidence cutoff (optional)'}</span><input id="appealSidecarEvidenceCutoff" type="datetime-local"></label>
        <label><span>${lang === 'ru' ? 'Примечание (необязательно)' : 'Appeal note (optional)'}</span><input id="appealSidecarNotes" type="text"></label>
      </div>
      <div class="actions">
        <button id="downloadAppealSidecarBtn" type="button">${lang === 'ru' ? 'Скачать Appeal Request Sidecar' : 'Download Appeal Request Sidecar'}</button>
        <span class="review-cues-note">${lang === 'ru' ? 'Исходный PoAI JSON не изменяется.' : 'The source PoAI JSON is not modified.'}</span>
      </div>`;
    panel.append(box);

    box.querySelector('#downloadAppealSidecarBtn').addEventListener('click', () => {
      const record = currentRecord();
      if (!record) return;
      const targetType = box.querySelector('#appealSidecarTargetType').value;
      const reviewId = box.querySelector('#appealSidecarReviewId').value.trim();
      const targets = targetType === 'review_artifact'
        ? [{ target_type: 'review_artifact', target_id: reviewId }]
        : [{ target_type: 'decision_record', target_id: record.record_id }];
      try {
        const appeal = buildAppealSidecar(record, {
          appellantLabel: box.querySelector('#appealSidecarAppellant').value,
          grounds: [box.querySelector('#appealSidecarGround').value],
          requestedAction: box.querySelector('#appealSidecarAction').value,
          targets,
          evidenceCutoff: toIsoFromLocal(box.querySelector('#appealSidecarEvidenceCutoff').value),
          notes: box.querySelector('#appealSidecarNotes').value,
          sourceValidationStatus: 'PASS'
        });
        const validationErrors = validateAppealSidecar(appeal);
        if (validationErrors.length) {
          alert(validationErrors.join('\n'));
          return;
        }
        downloadJson(`${stableHash(appeal.decision_record_id)}.poai-appeal.json`, appeal);
      } catch (error) {
        alert(error && error.message ? error.message : String(error));
      }
    });
  }

  function initBrowser() {
    ensureControls();
    const target = document.querySelector('[data-panel="verifier"]');
    if (target) new MutationObserver(() => ensureControls()).observe(target, { childList: true, subtree: true });
    document.addEventListener('poai:languagechange', () => {
      const existing = document.getElementById('appealSidecarControls');
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
    GROUND_CODES,
    REQUESTED_ACTIONS,
    TARGET_TYPES,
    buildAppealSidecar,
    validateAppealSidecar,
    deepHasProhibitedKey,
    stableHash
  });
});
