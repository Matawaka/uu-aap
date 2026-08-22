(function () {
  'use strict';

  const STORAGE_KEY = 'poai-ui-language';
  const supported = new Set(['en', 'ru']);
  let language = supported.has(localStorage.getItem(STORAGE_KEY)) ? localStorage.getItem(STORAGE_KEY) : 'en';
  let observer = null;
  let applying = false;

  const staticBindings = [
    ['.hero .eyebrow', 'Proof of Available Intelligence · Level 3', 'Proof of Available Intelligence · Уровень 3'],
    ['.hero h1', 'Web Verifier & Record Builder', 'Веб-верификатор и конструктор записей'],
    ['.hero .lede', 'Inspect a PoAI record as a decision-time intelligence horizon: availability, consideration, authority, evidence, Future Target and outcome — without uploading your JSON to a server.', 'Исследуйте запись PoAI как горизонт доступного интеллекта на момент решения: доступность, рассмотрение, полномочия, доказательства, Future Target и исход — без загрузки JSON на сервер.'],
    ['.principles span:nth-child(1)', 'availability ≠ use', 'доступность ≠ использование'],
    ['.principles span:nth-child(2)', 'use ≠ authority', 'использование ≠ полномочие'],
    ['.principles span:nth-child(3)', 'authority ≠ responsibility', 'полномочие ≠ ответственность'],
    ['.principles span:nth-child(4)', 'proof ≠ truth', 'доказательство ≠ истина'],
    ['main > .notice:first-of-type strong', 'Local-first experimental interface.', 'Экспериментальный интерфейс local-first.'],
    ['main > .notice:first-of-type span', 'Your selected file is read by JavaScript in this browser. This interface does not send the record to a PoAI server. Browser validation is a usability layer; repository JSON Schema + Python semantic validation remain the machine-layer reference.', 'Выбранный файл читается JavaScript только в этом браузере. Интерфейс не отправляет запись на сервер PoAI. Браузерная проверка — слой удобства; эталоном машинного уровня остаются JSON Schema репозитория и семантическая проверка Python.'],
    ['.alpha-scope strong', 'Level 3.1 successor scope: bilingual EN/RU presentation.', 'Граница Level 3.1: двуязычное представление EN/RU.'],
    ['.alpha-scope span', 'Displayed labels may be translated or simplified for readability, but raw protocol values remain unchanged. Language selection affects presentation only and does not change validation results, Builder JSON or downloaded artifacts. This interface does not certify factual truth, legal responsibility, causal proof, signatures or C2PA.', 'Отображаемые подписи могут переводиться или упрощаться для чтения, но исходные значения протокола остаются неизменными. Выбор языка влияет только на представление и не меняет результат проверки, JSON конструктора или скачиваемые артефакты. Интерфейс не подтверждает фактическую истину, юридическую ответственность, причинность, подписи или C2PA.'],
    ['[data-tab="verifier"]', 'Verifier', 'Верификатор'],
    ['[data-tab="builder"]', 'Record Builder', 'Конструктор записи'],
    ['[data-panel="verifier"] .panel:first-child .eyebrow', 'Input', 'Ввод'],
    ['[data-panel="verifier"] .panel:first-child h2', 'PoAI JSON', 'PoAI JSON'],
    ['label[for="fileInput"]', 'Choose a .json file', 'Выбрать файл .json'],
    ['#validateBtn', 'Validate', 'Проверить'],
    ['#demoBtn', 'Load demo', 'Загрузить пример'],
    ['#downloadBtn', 'Download current JSON', 'Скачать текущий JSON'],
    ['#clearBtn', 'Clear', 'Очистить'],
    ['[data-panel="verifier"] .panel:nth-child(2) .eyebrow', 'Browser validation', 'Браузерная проверка'],
    ['[data-panel="verifier"] .panel:nth-child(2) h2', 'Result', 'Результат'],
    ['[data-panel="verifier"] .panel:nth-child(2) h3:nth-of-type(1)', 'Errors', 'Ошибки'],
    ['[data-panel="verifier"] .panel:nth-child(2) h3:nth-of-type(2)', 'Warnings', 'Предупреждения'],
    ['.visualizer .eyebrow', 'Human-readable view', 'Человекочитаемое представление'],
    ['.visualizer .panel-head h2', 'Decision intelligence map', 'Карта интеллекта решения'],
    ['.visualizer .grid.three article:nth-child(1) h3', 'Decision Boundary', 'Граница решения'],
    ['.visualizer .grid.three article:nth-child(2) h3', 'Future Target', 'Future Target'],
    ['.visualizer .grid.three article:nth-child(3) h3', 'Outcome & successor', 'Исход и преемник'],
    ['.visualizer .grid.two article:nth-child(1) h3', 'Intelligence resources', 'Ресурсы интеллекта'],
    ['.visualizer .grid.two article:nth-child(2) h3', 'Authority', 'Полномочия'],
    ['.visualizer > article.card h3', 'Evidence & contestability', 'Доказательства и оспариваемость'],
    ['[data-panel="builder"] .eyebrow', 'Guided authoring', 'Пошаговое создание'],
    ['[data-panel="builder"] h2', 'Start a PoAI/T record', 'Создать запись PoAI/T'],
    ['[data-panel="builder"] .panel-head .badge', 'Starts at E0 self-declaration', 'Начинается с E0 self-declaration'],
    ['[data-panel="builder"] > .panel > .summary', 'The builder intentionally defaults uncertain fields to unknown. It does not upgrade evidence, authority or availability merely because a field can be filled in.', 'Конструктор намеренно оставляет неопределённые поля как unknown. Сам факт заполнения поля не повышает уровень доказательств, полномочий или доступности.'],
    ['#buildBtn', 'Generate draft and validate', 'Создать черновик и проверить'],
    ['[data-panel="builder"] .footnote', 'Generated records are drafts. Add actual intelligence resources, evidence references, authority facts, alternatives, constraints and successor semantics before making stronger claims.', 'Созданные записи являются черновиками. Перед более сильными утверждениями добавьте реальные ресурсы интеллекта, ссылки на доказательства, факты полномочий, альтернативы, ограничения и семантику преемников.'],
    ['footer p:first-child', 'PoAI Genesis v0.0 · Machine Layer v0.0.1 · Level 3.1 successor human interface.', 'PoAI Genesis v0.0 · Machine Layer v0.0.1 · human interface Level 3.1 — линия-преемник.']
  ];

  const labelMap = {
    'Subject': 'Субъект',
    'Opened': 'Открыто',
    'Knowledge cutoff': 'Граница знания',
    'Closed': 'Закрыто',
    'Boundary status': 'Статус границы',
    'Future Target': 'Future Target',
    'Epistemic status': 'Эпистемический статус',
    'Probability': 'Вероятность',
    'Outcome status': 'Статус исхода',
    'Observed at': 'Наблюдалось',
    'Intervention': 'Вмешательство',
    'Causal status': 'Статус причинности',
    'Successor': 'Преемник',
    'Evidence items': 'Элементы доказательств',
    'Artifact binding': 'Привязка артефакта',
    'Contestability channel': 'Канал оспаривания'
  };

  const enumMap = {
    'Associated, not proven': 'Связано, но не доказано',
    'Not realized after intervention': 'Не реализовалось после вмешательства',
    'Not yet observable': 'Пока не наблюдаемо',
    'Not applicable': 'Неприменимо',
    'Live record': 'Текущая запись',
    'Partially available': 'Частично доступно',
    'Available': 'Доступно',
    'Considered': 'Рассмотрено',
    'Relied upon': 'Использовано как основание',
    'Accepted': 'Принято',
    'Limited': 'Ограничено',
    'Unknown': 'Неизвестно',
    'Not bound': 'Не привязано',
    'Present': 'Присутствует',
    'None': 'Нет',
    'Not confirmed': 'Не подтверждено',
    'Probable': 'Вероятно'
  };

  const reverseLabelMap = Object.fromEntries(Object.entries(labelMap).map(([en, ru]) => [ru, en]));
  const reverseEnumMap = Object.fromEntries(Object.entries(enumMap).map(([en, ru]) => [ru, en]));

  function choose(en, ru) { return language === 'ru' ? ru : en; }
  function canonicalLabel(value) { return reverseLabelMap[value] || value; }
  function canonicalEnum(value) { return reverseEnumMap[value] || value; }
  function enumText(value) {
    const canonical = canonicalEnum(String(value || ''));
    return language === 'ru' ? (enumMap[canonical] || canonical) : canonical;
  }

  function setText(selector, en, ru) {
    const element = document.querySelector(selector);
    if (element) element.textContent = choose(en, ru);
  }

  function translateStatic() {
    staticBindings.forEach(([selector, en, ru]) => setText(selector, en, ru));

    const builderLabels = [
      ['#builderLabel', 'Decision label', 'Название решения', 'Approve publication of canonical artifact', 'Одобрить публикацию канонического артефакта'],
      ['#builderActor', 'Human actor', 'Человек-участник', 'Decision-maker name or disclosed role', 'Имя принимающего решение или раскрытая роль'],
      ['#builderSubjectId', 'Subject ID', 'ID субъекта', 'decision:canonical-publication', 'decision:canonical-publication'],
      ['#builderRecordId', 'Record ID', 'ID записи', 'urn:poai:record:canonical-publication:1', 'urn:poai:record:canonical-publication:1'],
      ['#builderDescription', 'Description', 'Описание', 'What decision is being bounded and why?', 'Какое решение ограничивается во времени и почему?'],
      ['#builderOpened', 'Opened at', 'Открыто', '', ''],
      ['#builderCutoff', 'Knowledge cutoff', 'Граница знания', '', ''],
      ['#builderClosed', 'Closed at', 'Закрыто', '', '']
    ];
    builderLabels.forEach(([selector, enLabel, ruLabel, enPlaceholder, ruPlaceholder]) => {
      const input = document.querySelector(selector);
      const label = input && input.closest('label');
      if (label) Array.from(label.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => { node.textContent = choose(enLabel, ruLabel); });
      if (input && (enPlaceholder || ruPlaceholder)) input.placeholder = choose(enPlaceholder, ruPlaceholder);
    });

    const resourceHeaders = document.querySelectorAll('.table-head:not(.authority) span');
    const resourceNames = language === 'ru' ? ['Ресурс', 'Тип', 'Доступность', 'Рассмотрение'] : ['Resource', 'Type', 'Availability', 'Consideration'];
    resourceHeaders.forEach((node, index) => { if (resourceNames[index]) node.textContent = resourceNames[index]; });
    const authorityHeaders = document.querySelectorAll('.table-head.authority span');
    const authorityNames = language === 'ru' ? ['Участник', 'Области полномочий', 'Статус'] : ['Actor', 'Scopes', 'Status'];
    authorityHeaders.forEach((node, index) => { if (authorityNames[index]) node.textContent = authorityNames[index]; });

    document.title = language === 'ru' ? 'PoAI Level 3.1 — Веб-верификатор и конструктор записей' : 'PoAI Level 3.1 — Web Verifier & Record Builder';
    document.documentElement.lang = language;
  }

  function translateSummary() {
    const summary = document.getElementById('summaryLine');
    if (!summary) return;
    const enMatch = summary.textContent.match(/^(\d+) error\(s\), (\d+) warning\(s\) · profile (.+)$/);
    const ruMatch = summary.textContent.match(/^(\d+) ошибок, (\d+) предупреждений · профиль (.+)$/);
    const match = enMatch || ruMatch;
    if (match) summary.textContent = language === 'ru' ? `${match[1]} ошибок, ${match[2]} предупреждений · профиль ${match[3]}` : `${match[1]} error(s), ${match[2]} warning(s) · profile ${match[3]}`;
    else if (summary.textContent === 'Paste or load a PoAI JSON record.' || summary.textContent === 'Вставьте или загрузите запись PoAI JSON.') summary.textContent = language === 'ru' ? 'Вставьте или загрузите запись PoAI JSON.' : 'Paste or load a PoAI JSON record.';
  }

  function translateBadges() {
    const status = document.getElementById('statusBadge');
    if (status) {
      if (status.textContent === 'WAITING' || status.textContent === 'ОЖИДАНИЕ') status.textContent = language === 'ru' ? 'ОЖИДАНИЕ' : 'WAITING';
      if (status.textContent === 'INVALID JSON' || status.textContent === 'НЕКОРРЕКТНЫЙ JSON') status.textContent = language === 'ru' ? 'НЕКОРРЕКТНЫЙ JSON' : 'INVALID JSON';
    }
    const privacy = document.getElementById('privacyBadge');
    if (privacy) privacy.textContent = language === 'ru' ? 'Назначение загрузки: только этот браузер' : 'Upload destination: this browser only';
    const truth = document.getElementById('truthBadge');
    if (truth) truth.textContent = language === 'ru' ? 'Истина подтверждена? НЕТ' : 'Truth certified? NO';
    const binding = document.getElementById('bindingBadge');
    if (binding) {
      const current = binding.textContent.replace(/^Cryptographically bound\?\s*/i, '').replace(/^Криптографически привязано\?\s*/i, '');
      binding.textContent = language === 'ru' ? `Криптографически привязано? ${enumText(current)}` : `Cryptographically bound? ${enumText(current)}`;
    }
  }

  function translateEmptyMessages() {
    const fixed = new Map([
      ['No semantic errors detected by the browser validator.', 'Семантических ошибок браузерным валидатором не обнаружено.'],
      ['No browser-level warnings.', 'Предупреждений браузерного уровня нет.'],
      ['No Future Target in this record.', 'В этой записи Future Target отсутствует.'],
      ['No intelligence resources.', 'Ресурсы интеллекта отсутствуют.'],
      ['No authority relations.', 'Отношения полномочий отсутствуют.']
    ]);
    const reverse = new Map(Array.from(fixed.entries()).map(([en, ru]) => [ru, en]));
    document.querySelectorAll('.muted').forEach((node) => {
      const canonical = reverse.get(node.textContent) || node.textContent;
      if (fixed.has(canonical)) node.textContent = language === 'ru' ? fixed.get(canonical) : canonical;
    });
  }

  function translateMap() {
    document.querySelectorAll('.kv').forEach((row) => {
      const key = row.querySelector('span');
      const value = row.querySelector('strong');
      if (!key || !value) return;
      const canonical = canonicalLabel(key.textContent);
      if (labelMap[canonical]) key.textContent = language === 'ru' ? labelMap[canonical] : canonical;
      if (['Boundary status', 'Epistemic status', 'Outcome status', 'Intervention', 'Causal status', 'Artifact binding', 'Contestability channel'].includes(canonical)) value.textContent = enumText(value.textContent);
    });

    document.querySelectorAll('#resourceTable .table-row').forEach((row) => {
      const cells = row.querySelectorAll('span');
      if (cells[2]) cells[2].textContent = enumText(cells[2].textContent);
      if (cells[3]) cells[3].textContent = enumText(cells[3].textContent);
    });
    document.querySelectorAll('#authorityTable .table-row').forEach((row) => {
      const cells = row.querySelectorAll('span');
      if (cells[2]) cells[2].textContent = enumText(cells[2].textContent);
    });
  }

  function createLanguageSwitch() {
    if (document.querySelector('.language-switch')) return;
    const host = document.querySelector('.hero .wrap');
    if (!host) return;
    const group = document.createElement('div');
    group.className = 'language-switch';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Interface language / Язык интерфейса');
    ['en', 'ru'].forEach((code) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = code.toUpperCase();
      button.dataset.language = code;
      button.addEventListener('click', () => setLanguage(code));
      group.append(button);
    });
    host.append(group);
  }

  function syncLanguageSwitch() {
    document.querySelectorAll('[data-language]').forEach((button) => {
      const active = button.dataset.language === language;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function applyAll() {
    if (applying) return;
    applying = true;
    if (observer) observer.disconnect();
    translateStatic();
    translateSummary();
    translateBadges();
    translateEmptyMessages();
    translateMap();
    syncLanguageSwitch();
    if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    applying = false;
  }

  function setLanguage(next) {
    if (!supported.has(next)) return;
    language = next;
    localStorage.setItem(STORAGE_KEY, language);
    applyAll();
    document.dispatchEvent(new CustomEvent('poai:languagechange', { detail: { language } }));
  }

  function init() {
    createLanguageSwitch();
    observer = new MutationObserver(() => { if (!applying) queueMicrotask(applyAll); });
    applyAll();
  }

  window.PoAII18n = Object.freeze({
    getLanguage: () => language,
    setLanguage,
    enumText,
    apply: applyAll
  });

  document.addEventListener('DOMContentLoaded', init);
})();
