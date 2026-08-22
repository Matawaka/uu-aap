(function () {
  'use strict';

  const entries = [
    // Level 3 dynamic sidecar actions.
    ['Download Review Sidecar', 'Скачать сопроводительный артефакт проверки'],
    ['Download Appeal Request Sidecar', 'Скачать сопроводительный артефакт апелляции'],
    ['Download Adjudication Sidecar', 'Скачать сопроводительный артефакт решения'],
    ['Download Execution Sidecar', 'Скачать сопроводительный артефакт исполнения'],
    ['Download Verification Sidecar', 'Скачать сопроводительный артефакт верификации'],
    ['Download Outcome Sidecar', 'Скачать сопроводительный артефакт исхода'],
    ['Download Successor Proposal', 'Скачать предложение преемника'],

    // Level 4.0a.
    ['Deterministic binding', 'Детерминированная привязка'],
    ['DIGEST ONLY · NOT A SIGNATURE', 'ТОЛЬКО ДАЙДЖЕСТ · НЕ ПОДПИСЬ'],
    ['Compute SHA-256', 'Вычислить SHA-256'],
    ['Download Binding Receipt', 'Скачать квитанцию привязки'],

    // Level 4.0b.
    ['Ed25519 signature binding', 'Привязка подписью Ed25519'],
    ['EPHEMERAL KEY · NOT IDENTITY', 'ВРЕМЕННЫЙ КЛЮЧ · НЕ ИДЕНТИЧНОСТЬ'],
    ['Generate ephemeral key & sign', 'Создать временный ключ и подписать'],
    ['Verify signature', 'Проверить подпись'],
    ['Download Signature Envelope', 'Скачать конверт подписи'],
    ['Load Signature Envelope', 'Загрузить конверт подписи'],

    // Level 4.0c.
    ['Persistent local signer key', 'Постоянный локальный ключ подписанта'],
    ['LOCAL CONTINUITY · NOT IDENTITY', 'ЛОКАЛЬНАЯ НЕПРЕРЫВНОСТЬ · НЕ ИДЕНТИЧНОСТЬ'],
    ['Create / use persistent key', 'Создать / использовать постоянный ключ'],
    ['Sign with persistent key', 'Подписать постоянным ключом'],
    ['Verify continuity signature', 'Проверить подпись непрерывности'],
    ['Download Continuity Envelope', 'Скачать конверт непрерывности'],
    ['Load Continuity Envelope', 'Загрузить конверт непрерывности'],
    ['Rotate local key', 'Ротировать локальный ключ'],

    // Level 4.0d.
    ['Signed identity evidence', 'Подписанное доказательство идентификатора'],
    ['CLAIM/EVIDENCE · NOT LEGAL IDENTITY', 'УТВЕРЖДЕНИЕ/ДОКАЗАТЕЛЬСТВО · НЕ ЮРИДИЧЕСКАЯ ИДЕНТИЧНОСТЬ'],
    ['Identifier namespace', 'Пространство идентификатора'],
    ['GitHub identifier', 'GitHub-идентификатор'],
    ['Display name (optional)', 'Отображаемое имя (необязательно)'],
    ['Expected raw GitHub publication URL', 'Ожидаемый raw GitHub URL публикации'],
    ['Create signed identity claim', 'Создать подписанное утверждение об идентификаторе'],
    ['Verify claim', 'Проверить утверждение'],
    ['Check publication', 'Проверить публикацию'],
    ['Download Identity Evidence', 'Скачать доказательство идентификатора'],
    ['Load Identity Evidence', 'Загрузить доказательство идентификатора'],

    // Level 4.0e.
    ['Scoped authority evidence', 'Ограниченное доказательство полномочия'],
    ['EVIDENCE · NOT VERIFIED AUTHORITY', 'ДОКАЗАТЕЛЬСТВО · НЕ ПОДТВЕРЖДЁННОЕ ПОЛНОМОЧИЕ'],
    ['Issuer namespace', 'Пространство идентификатора выдающей стороны'],
    ['GitHub issuer', 'GitHub-идентификатор выдающей стороны'],
    ['Issuer display name (optional)', 'Имя выдающей стороны (необязательно)'],
    ['Authority scope', 'Область полномочия'],
    ['Target resource', 'Целевой ресурс'],
    ['Valid from', 'Действует с'],
    ['Valid until (optional)', 'Действует до (необязательно)'],
    ['Delegation mode', 'Делегируемость'],
    ['Issuer identity evidence ref (optional)', 'Ссылка на доказательство идентификатора выдающей стороны (необязательно)'],
    ['Create signed authority evidence', 'Создать подписанное доказательство полномочия'],
    ['Verify evidence', 'Проверить доказательство'],
    ['Download Authority Evidence', 'Скачать доказательство полномочия'],
    ['Load Authority Evidence', 'Загрузить доказательство полномочия']
  ];

  // Earlier modules intentionally mixed protocol jargon with translated UI text.
  // Treat those strings as aliases so language switching can normalize them too.
  const aliases = new Map([
    ['Создать подписанный identity claim', 'Create signed identity claim'],
    ['Проверить claim', 'Verify claim'],
    ['Скачать Identity Evidence', 'Download Identity Evidence'],
    ['Загрузить Identity Evidence', 'Load Identity Evidence'],
    ['CLAIM/EVIDENCE · НЕ LEGAL IDENTITY', 'CLAIM/EVIDENCE · NOT LEGAL IDENTITY'],
    ['Создать подписанное authority evidence', 'Create signed authority evidence'],
    ['Проверить evidence', 'Verify evidence'],
    ['Скачать Authority Evidence', 'Download Authority Evidence'],
    ['Загрузить Authority Evidence', 'Load Authority Evidence'],
    ['EVIDENCE · НЕ VERIFIED AUTHORITY', 'EVIDENCE · NOT VERIFIED AUTHORITY'],
    ['Identity evidence issuer (необязательно)', 'Issuer identity evidence ref (optional)']
  ]);

  const enToRu = new Map(entries);
  const ruToEn = new Map(entries.map(([en, ru]) => [ru, en]));

  const statusEntries = [
    ['SIGNATURE VALID', 'ПОДПИСЬ ВАЛИДНА'],
    ['SIGNATURE INVALID', 'ПОДПИСЬ НЕКОРРЕКТНА'],
    ['ARTIFACT MATCH', 'АРТЕФАКТ СОВПАДАЕТ'],
    ['ARTIFACT MISMATCH', 'АРТЕФАКТ НЕ СОВПАДАЕТ'],
    ['ACTIVE KEY MATCH', 'АКТИВНЫЙ КЛЮЧ СОВПАДАЕТ'],
    ['ACTIVE KEY MISMATCH', 'АКТИВНЫЙ КЛЮЧ НЕ СОВПАДАЕТ'],
    ['ACTIVE KEY NOT CHECKED', 'АКТИВНЫЙ КЛЮЧ НЕ ПРОВЕРЕН'],
    ['SIGNED CLAIM VALID', 'ПОДПИСАННОЕ УТВЕРЖДЕНИЕ ВАЛИДНО'],
    ['SIGNED CLAIM INVALID', 'ПОДПИСАННОЕ УТВЕРЖДЕНИЕ НЕКОРРЕКТНО'],
    ['ACTIVE SUBJECT KEY MATCH', 'АКТИВНЫЙ КЛЮЧ СУБЪЕКТА СОВПАДАЕТ'],
    ['ACTIVE SUBJECT KEY MISMATCH', 'АКТИВНЫЙ КЛЮЧ СУБЪЕКТА НЕ СОВПАДАЕТ'],
    ['ACTIVE SUBJECT KEY NOT CHECKED', 'АКТИВНЫЙ КЛЮЧ СУБЪЕКТА НЕ ПРОВЕРЕН'],
    ['PUBLICATION MATCH', 'ПУБЛИКАЦИЯ СОВПАДАЕТ'],
    ['PUBLICATION MISMATCH', 'ПУБЛИКАЦИЯ НЕ СОВПАДАЕТ'],
    ['PUBLICATION NOT CHECKED', 'ПУБЛИКАЦИЯ НЕ ПРОВЕРЕНА'],
    ['ACCOUNT-CONTROL EVIDENCE OBSERVED', 'ДОКАЗАТЕЛЬСТВО КОНТРОЛЯ АККАУНТА НАБЛЮДАЕТСЯ'],
    ['ACCOUNT-CONTROL EVIDENCE NOT ESTABLISHED', 'ДОКАЗАТЕЛЬСТВО КОНТРОЛЯ АККАУНТА НЕ УСТАНОВЛЕНО'],
    ['SIGNED AUTHORITY CLAIM VALID', 'ПОДПИСАННОЕ УТВЕРЖДЕНИЕ О ПОЛНОМОЧИИ ВАЛИДНО'],
    ['SIGNED AUTHORITY CLAIM INVALID', 'ПОДПИСАННОЕ УТВЕРЖДЕНИЕ О ПОЛНОМОЧИИ НЕКОРРЕКТНО'],
    ['AUTHORITY EVIDENCE OBSERVED', 'ДОКАЗАТЕЛЬСТВО ПОЛНОМОЧИЯ НАБЛЮДАЕТСЯ'],
    ['AUTHORITY EVIDENCE NOT ESTABLISHED', 'ДОКАЗАТЕЛЬСТВО ПОЛНОМОЧИЯ НЕ УСТАНОВЛЕНО'],
    ['PRIVATE NON-EXPORTABLE', 'ПРИВАТНЫЙ КЛЮЧ НЕЭКСПОРТИРУЕМЫЙ'],
    ['identity/authority: not established', 'идентичность/полномочия: не установлены'],
    ['local continuity only; identity/authority not established', 'только локальная непрерывность; идентичность/полномочия не установлены'],
    ['human identity/authority not established', 'человеческая идентичность/полномочия не установлены'],
    ['issuer entitlement/verified authority not established', 'право выдающей стороны предоставлять полномочие / подтверждённое полномочие не установлены']
  ];
  const statusEnToRu = new Map(statusEntries);
  const statusRuToEn = new Map(statusEntries.map(([en, ru]) => [ru, en]));
  const statusAliases = new Map([
    ['human identity/authority не установлены', 'human identity/authority not established'],
    ['issuer entitlement/verified authority не установлены', 'issuer entitlement/verified authority not established']
  ]);

  function currentLanguage() {
    if (globalThis.PoAII18n && typeof globalThis.PoAII18n.getLanguage === 'function') {
      return globalThis.PoAII18n.getLanguage();
    }
    if (typeof document !== 'undefined') return document.documentElement.lang === 'ru' ? 'ru' : 'en';
    return 'en';
  }

  function canonicalExact(value) {
    const text = String(value || '').trim();
    return aliases.get(text) || ruToEn.get(text) || text;
  }

  function translateExactText(value, language) {
    const canonical = canonicalExact(value);
    return language === 'ru' ? (enToRu.get(canonical) || canonical) : canonical;
  }

  function canonicalStatusSegment(value) {
    const text = String(value || '').trim();
    return statusAliases.get(text) || statusRuToEn.get(text) || text;
  }

  function translateStatusSegment(value, language) {
    const canonical = canonicalStatusSegment(value);
    const publicationUnavailable = canonical.match(/^PUBLICATION UNAVAILABLE(?:\s*\((.*)\))?$/);
    if (publicationUnavailable) {
      if (language === 'ru') return `ПУБЛИКАЦИЯ НЕДОСТУПНА${publicationUnavailable[1] ? ` (${publicationUnavailable[1]})` : ''}`;
      return canonical;
    }
    const ruPublicationUnavailable = canonical.match(/^ПУБЛИКАЦИЯ НЕДОСТУПНА(?:\s*\((.*)\))?$/);
    if (ruPublicationUnavailable && language === 'en') return `PUBLICATION UNAVAILABLE${ruPublicationUnavailable[1] ? ` (${ruPublicationUnavailable[1]})` : ''}`;

    const time = canonical.match(/^TIME\s+(ACTIVE|EXPIRED|NOT_YET_VALID|INDETERMINATE)$/);
    if (time) {
      if (language !== 'ru') return canonical;
      return {
        ACTIVE: 'ПЕРИОД ДЕЙСТВУЕТ',
        EXPIRED: 'ПЕРИОД ИСТЁК',
        NOT_YET_VALID: 'ПЕРИОД ЕЩЁ НЕ НАЧАЛСЯ',
        INDETERMINATE: 'ПЕРИОД НЕОПРЕДЕЛЁН'
      }[time[1]];
    }
    const reverseTime = {
      'ПЕРИОД ДЕЙСТВУЕТ': 'TIME ACTIVE',
      'ПЕРИОД ИСТЁК': 'TIME EXPIRED',
      'ПЕРИОД ЕЩЁ НЕ НАЧАЛСЯ': 'TIME NOT_YET_VALID',
      'ПЕРИОД НЕОПРЕДЕЛЁН': 'TIME INDETERMINATE'
    };
    if (language === 'en' && reverseTime[canonical]) return reverseTime[canonical];

    return language === 'ru' ? (statusEnToRu.get(canonical) || canonical) : canonical;
  }

  function translateStatusText(value, language) {
    return String(value || '').split(' · ').map((part) => translateStatusSegment(part, language)).join(' · ');
  }

  function translateElementExact(element, language) {
    if (!element || element.children.length) return;
    const next = translateExactText(element.textContent, language);
    if (next !== element.textContent) element.textContent = next;
  }

  function translateLabelTextNodes(label, language) {
    Array.from(label.childNodes || []).forEach((node) => {
      if (node.nodeType !== 3) return;
      const raw = node.textContent;
      const trimmed = raw.trim();
      if (!trimmed) return;
      const next = translateExactText(trimmed, language);
      if (next === trimmed) return;
      const leading = raw.match(/^\s*/)[0];
      const trailing = raw.match(/\s*$/)[0];
      node.textContent = `${leading}${next}${trailing}`;
    });
  }

  function apply(languageValue) {
    if (typeof document === 'undefined') return;
    const language = languageValue || currentLanguage();

    document.querySelectorAll('button, label.file-label, .panel-head h2, .panel-head .badge').forEach((element) => {
      translateElementExact(element, language);
    });
    document.querySelectorAll('.form-grid label').forEach((label) => translateLabelTextNodes(label, language));

    document.querySelectorAll('.summary').forEach((element) => {
      if (element.children.length) return;
      const next = translateStatusText(element.textContent, language);
      if (next !== element.textContent) element.textContent = next;
    });
  }

  let observer = null;
  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      apply();
    });
  }

  function init() {
    apply();
    document.addEventListener('poai:languagechange', (event) => {
      apply(event && event.detail && event.detail.language ? event.detail.language : currentLanguage());
    });
    observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  const api = Object.freeze({
    currentLanguage,
    translateExactText,
    translateStatusText,
    apply
  });
  globalThis.PoAIDynamicI18n = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})();
