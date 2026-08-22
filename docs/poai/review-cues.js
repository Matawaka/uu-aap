(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIReviewCues = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function asArray(value) { return Array.isArray(value) ? value : []; }

  function evaluateReviewCues(record) {
    if (!record || typeof record !== 'object') return [];
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

    if (!record.future_target) add(
      'future_target_not_declared',
      'Future Target is not declared; this may be intentional for this decision.',
      'Future Target не заявлен; для этого решения это может быть намеренно.'
    );

    const evidence = asArray(record.evidence);
    const e0Count = evidence.filter((item) => item && item.class === 'E0').length;
    if (e0Count) add(
      'evidence_e0',
      `${e0Count} evidence item(s) remain E0 self-declaration level.`,
      `${e0Count} элементов доказательств остаются на уровне E0 self-declaration.`,
      { count: e0Count }
    );

    if (!record.artifact_binding || record.artifact_binding.status === 'not_bound' || record.artifact_binding.status === 'unknown') add(
      'artifact_not_bound',
      'Artifact binding is not established.',
      'Привязка артефакта не установлена.'
    );

    return cues;
  }

  function injectStyles() {
    if (document.getElementById('poai-review-cues-style')) return;
    const style = document.createElement('style');
    style.id = 'poai-review-cues-style';
    style.textContent = `
      .review-cues-panel { margin-top: 18px; }
      .review-cues-head { display:flex; gap:12px; align-items:flex-start; justify-content:space-between; }
      .review-cues-list { display:grid; gap:8px; margin:14px 0 0; padding:0; list-style:none; }
      .review-cue { border-left:3px solid var(--warn); background:var(--surface-2); border-radius:8px; padding:10px 12px; }
      .review-cue code { margin-right:8px; }
      .review-cues-note { color:var(--muted); margin:6px 0 0; }
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

  function renderCues(cues) {
    const panel = ensurePanel();
    if (!panel) return;
    const lang = currentLanguage();
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'review-cues-head';
    const title = document.createElement('div');
    title.innerHTML = lang === 'ru'
      ? '<p class="eyebrow">Проверка полноты</p><h2>Подсказки для рецензирования</h2>'
      : '<p class="eyebrow">Completeness review</p><h2>Review cues</h2>';
    const badge = document.createElement('span');
    badge.className = 'badge neutral';
    badge.textContent = lang === 'ru' ? 'Не влияет на PASS' : 'Does not affect PASS';
    head.append(title, badge);
    panel.append(head);

    const note = document.createElement('p');
    note.className = 'review-cues-note';
    note.textContent = lang === 'ru'
      ? 'Это не ошибки, не оценка и не подтверждение истины. Подсказки лишь показывают неизвестные или неустановленные отношения в валидной записи.'
      : 'These are not errors, a score, or truth certification. They only surface unknown or unestablished relations in an otherwise valid record.';
    panel.append(note);

    if (!cues.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = lang === 'ru' ? 'Общих подсказок для этой записи нет.' : 'No generic review cues for this record.';
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
    try { renderCues(evaluateReviewCues(JSON.parse(input.value))); }
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

  return Object.freeze({ evaluateReviewCues });
});
