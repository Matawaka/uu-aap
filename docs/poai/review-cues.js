(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIReviewCues = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PURPOSES = Object.freeze({
    generic: { en: 'General review', ru: 'Общий обзор' },
    operational: { en: 'Operational decision trace', ru: 'Операционное решение' },
    future_intervention: { en: 'Future Target / intervention trace', ru: 'Future Target / вмешательство' },
    historical: { en: 'Historical reconstruction', ru: 'Историческая реконструкция' },
    publication: { en: 'Publication / accountability', ru: 'Публикация / подотчётность' }
  });

  function asArray(value) { return Array.isArray(value) ? value : []; }
  function purposeKey(value) { return Object.prototype.hasOwnProperty.call(PURPOSES, value) ? value : 'generic'; }

  function evaluateCoreCues(record) {
    const cues = [];
    const add = (code, en, ru, meta) => cues.push({ code, en, ru, meta: meta || null });

    const authority = asArray(record.authority);
    if (!authority.length) {
      add('authority_not_declared', 'No authority relation is declared.', 'Отношение полномочий не заявлено.');
    } else {
      const unknownAuthority = authority.filter((item) => !item || item.status === 'unknown' || !item.status).length;
      if (unknownAuthority) add(
        'authority_status_unknown',
        `Authority status remains unknown for ${unknownAuthority} relation(s).`,
        `Статус полномочий остаётся неизвестным для ${unknownAuthority} отношений.`,
        { count: unknownAuthority }
      );
    }

    const resources = asArray(record.intelligence_resources);
    const availability = asArray(record.availability);
    const consideration = asArray(record.consideration);
    const unknownConsideration = consideration.filter((item) => !item || item.status === 'unknown' || !item.status).length;
    if (unknownConsideration) add(
      'consideration_unknown',
      `Consideration state is unknown for ${unknownConsideration} of ${Math.max(resources.length, consideration.length)} resource(s).`,
      `Статус рассмотрения неизвестен для ${unknownConsideration} из ${Math.max(resources.length, consideration.length)} ресурсов.`,
      { count: unknownConsideration, total: Math.max(resources.length, consideration.length) }
    );

    const availabilityByResource = new Map(availability.map((item) => [item && item.resource_id, item]));
    const invokedWithoutAvailability = consideration.filter((item) => {
      if (!item || !['invoked', 'output_received', 'considered', 'relied_upon'].includes(item.status)) return false;
      const claim = availabilityByResource.get(item.resource_id);
      return !claim || claim.overall_status === 'unknown' || !claim.overall_status;
    }).length;
    if (invokedWithoutAvailability) add(
      'used_without_established_availability',
      `${invokedWithoutAvailability} resource(s) were invoked/considered while practical availability remains unknown.`,
      `${invokedWithoutAvailability} ресурсов были вызваны/рассмотрены, хотя практическая доступность остаётся неизвестной.`,
      { count: invokedWithoutAvailability }
    );

    const evidence = asArray(record.evidence);
    const e0Count = evidence.filter((item) => item && item.class === 'E0').length;
    if (e0Count) add(
      'evidence_e0',
      `${e0Count} evidence item(s) remain E0 self-declaration level.`,
      `${e0Count} элементов доказательств остаются на уровне E0 self-declaration.`,
      { count: e0Count }
    );

    return cues;
  }

  function evaluatePurposeCues(record, purpose) {
    const cues = [];
    const add = (code, en, ru, meta) => cues.push({ code, en, ru, meta: meta || null, purpose });
    const bindingMissing = !record.artifact_binding || ['not_bound', 'unknown'].includes(record.artifact_binding.status);
    const contestabilityMissing = !record.contestability || !record.contestability.channel_available || !record.contestability.channel;

    if (purpose === 'generic') {
      if (!record.future_target) add(
        'future_target_not_declared',
        'Future Target is not declared; this may be intentional for this decision.',
        'Future Target не заявлен; для этого решения это может быть намеренно.'
      );
      if (bindingMissing) add('artifact_not_bound', 'Artifact binding is not established.', 'Привязка артефакта не установлена.');
    }

    if (purpose === 'operational') {
      if (!record.decision_boundary || !record.decision_boundary.knowledge_cutoff) add(
        'operational_knowledge_cutoff_expected',
        'Operational review expects an explicit Knowledge Cutoff.',
        'Для операционной проверки ожидается явно заданная Граница знания.'
      );
      if (!asArray(record.consideration).some((item) => item && ['considered', 'relied_upon', 'rejected'].includes(item.status))) add(
        'operational_consideration_trace_expected',
        'Operational review expects at least one resource to have an explicit considered, relied-upon, or rejected state.',
        'Для операционной проверки ожидается хотя бы один ресурс с явным состоянием considered, relied_upon или rejected.'
      );
    }

    if (purpose === 'future_intervention') {
      if (!record.future_target) add(
        'future_target_expected_for_purpose',
        'This review purpose expects a declared Future Target.',
        'Для этой цели проверки ожидается заявленный Future Target.'
      );
      const outcome = record.outcome || {};
      if (!outcome.status || outcome.status === 'not_applicable') add(
        'future_outcome_trace_expected',
        'Future/intervention review expects an outcome tracking state, even if it is not yet observable.',
        'Для проверки будущего/вмешательства ожидается состояние отслеживания исхода, даже если он ещё не наблюдаем.'
      );
      if (contestabilityMissing) add(
        'future_contestability_channel_expected',
        'Future/intervention review expects an explicit contestability channel where feasible.',
        'Для проверки будущего/вмешательства по возможности ожидается явный канал оспаривания.'
      );
    }

    if (purpose === 'historical') {
      const boundaryStatus = record.decision_boundary && record.decision_boundary.status;
      if (!['historical_reconstruction', 'mixed'].includes(boundaryStatus)) add(
        'historical_boundary_status_expected',
        'Historical review expects the Decision Boundary to be marked historical_reconstruction or mixed.',
        'Для исторической проверки ожидается статус Decision Boundary historical_reconstruction или mixed.'
      );
    }

    if (purpose === 'publication') {
      if (bindingMissing) add(
        'publication_artifact_binding_expected',
        'Publication/accountability review expects artifact binding when the canonical artifact is available.',
        'Для проверки публикации/подотчётности ожидается привязка артефакта, когда канонический артефакт доступен.'
      );
      if (contestabilityMissing) add(
        'publication_contestability_channel_expected',
        'Publication/accountability review expects an explicit contestability channel.',
        'Для проверки публикации/подотчётности ожидается явный канал оспаривания.'
      );
    }

    return cues;
  }

  function evaluateReviewCues(record, requestedPurpose) {
    if (!record || typeof record !== 'object') return [];
    const purpose = purposeKey(requestedPurpose);
    return [...evaluateCoreCues(record), ...evaluatePurposeCues(record, purpose)];
  }

  function injectStyles() {
    if (document.getElementById('poai-review-cues-style')) return;
    const style = document.createElement('style');
    style.id = 'poai-review-cues-style';
    style.textContent = `
      .review-cues-panel { margin-top: 18px; }
      .review-cues-head { display:flex; gap:12px; align-items:flex-start; justify-content:space-between; }
      .review-purpose-row { display:grid; grid-template-columns:minmax(180px, 320px) 1fr; gap:12px; align-items:end; margin:14px 0; }
      .review-purpose-row label { display:grid; gap:5px; font-weight:650; }
      .review-cues-list { display:grid; gap:8px; margin:14px 0 0; padding:0; list-style:none; }
      .review-cue { border-left:3px solid var(--warn); background:var(--surface-2); border-radius:8px; padding:10px 12px; }
      .review-cue code { margin-right:8px; }
      .review-cues-note { color:var(--muted); margin:6px 0 0; }
      @media (max-width:820px) { .review-purpose-row { grid-template-columns:1fr; } }
    `;
    document.head.append(style);
  }

  function ensurePanel() {
    let panel = document.getElementById('reviewCuesPanel');
    if (panel) return panel;
    const verifier = document.querySelector('[data-panel="verifier"]');
    const grid = verifier && verifier.querySelector('.grid.two');
    if (!grid) return null;
    panel = document.createElement('section');
    panel.id = 'reviewCuesPanel';
    panel.className = 'panel review-cues-panel';
    panel.hidden = true;
    grid.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function currentLanguage() { return document.documentElement.lang === 'ru' ? 'ru' : 'en'; }
  let currentPurpose = 'generic';

  function renderCues(cues) {
    const panel = ensurePanel();
    if (!panel) return;
    const lang = currentLanguage();
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'review-cues-head';
    const title = document.createElement('div');
    title.innerHTML = lang === 'ru'
      ? '<p class="eyebrow">Проверка достаточности</p><h2>Подсказки для рецензирования</h2>'
      : '<p class="eyebrow">Purpose-relative review</p><h2>Review cues</h2>';
    const badge = document.createElement('span');
    badge.className = 'badge neutral';
    badge.textContent = lang === 'ru' ? 'Не влияет на PASS' : 'Does not affect PASS';
    head.append(title, badge);
    panel.append(head);

    const note = document.createElement('p');
    note.className = 'review-cues-note';
    note.textContent = lang === 'ru'
      ? 'Это не ошибки, не оценка и не подтверждение истины. Цель проверки хранится только в интерфейсе и не изменяет PoAI JSON.'
      : 'These are not errors, a score, or truth certification. Review purpose is interface-local and does not modify the PoAI JSON.';
    panel.append(note);

    const purposeRow = document.createElement('div');
    purposeRow.className = 'review-purpose-row';
    const purposeLabel = document.createElement('label');
    const labelText = document.createElement('span');
    labelText.textContent = lang === 'ru' ? 'Цель проверки' : 'Review purpose';
    const select = document.createElement('select');
    select.id = 'reviewPurpose';
    Object.entries(PURPOSES).forEach(([key, labels]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = labels[lang];
      option.selected = key === currentPurpose;
      select.append(option);
    });
    select.addEventListener('change', () => {
      currentPurpose = purposeKey(select.value);
      syncFromValidatedInput();
    });
    purposeLabel.append(labelText, select);
    const purposeHelp = document.createElement('p');
    purposeHelp.className = 'review-cues-note';
    purposeHelp.textContent = lang === 'ru'
      ? 'Одна и та же валидная запись может иметь разные ожидаемые элементы для разных целей рассмотрения.'
      : 'The same valid record can have different expected elements for different review purposes.';
    purposeRow.append(purposeLabel, purposeHelp);
    panel.append(purposeRow);

    if (!cues.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = lang === 'ru' ? 'Для выбранной цели дополнительных подсказок нет.' : 'No additional cues for the selected review purpose.';
      panel.append(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'review-cues-list';
      cues.forEach((cue) => {
        const item = document.createElement('li');
        item.className = 'review-cue';
        const code = document.createElement('code');
        code.textContent = cue.code;
        const text = document.createElement('span');
        text.textContent = lang === 'ru' ? cue.ru : cue.en;
        item.append(code, text);
        list.append(item);
      });
      panel.append(list);
    }
    panel.hidden = false;
  }

  function hidePanel() {
    const panel = document.getElementById('reviewCuesPanel');
    if (panel) panel.hidden = true;
  }

  function syncFromValidatedInput() {
    const status = document.getElementById('statusBadge');
    const input = document.getElementById('jsonInput');
    if (!status || !input || !status.classList.contains('good')) { hidePanel(); return; }
    try { renderCues(evaluateReviewCues(JSON.parse(input.value), currentPurpose)); }
    catch (_) { hidePanel(); }
  }

  function initBrowser() {
    injectStyles();
    ensurePanel();
    const status = document.getElementById('statusBadge');
    const input = document.getElementById('jsonInput');
    if (status) new MutationObserver(syncFromValidatedInput).observe(status, { childList: true, subtree: true, attributes: true });
    if (input) input.addEventListener('input', hidePanel);
    ['validateBtn', 'demoBtn', 'buildBtn'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.addEventListener('click', () => setTimeout(syncFromValidatedInput, 0));
    });
    const clear = document.getElementById('clearBtn');
    if (clear) clear.addEventListener('click', hidePanel);
    document.addEventListener('poai:languagechange', syncFromValidatedInput);
    syncFromValidatedInput();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrowser);
    else initBrowser();
  }

  return Object.freeze({ PURPOSES, evaluateReviewCues, purposeKey });
});
