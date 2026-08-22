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
    ['Does not affect PASS', 'Не влияет на результат проверки (PASS)'],
    ['Separate experimental review artifact; the source PoAI JSON is not modified.', 'Отдельный экспериментальный артефакт рецензирования; исходный PoAI JSON не изменяется.'],

    // Level 4.0a.
    ['Deterministic binding', 'Детерминированная привязка'],
    ['DIGEST ONLY · NOT A SIGNATURE', 'ТОЛЬКО ДАЙДЖЕСТ · НЕ ПОДПИСЬ'],
    ['Compute SHA-256', 'Вычислить SHA-256'],
    ['Download Binding Receipt', 'Скачать квитанцию привязки'],
    ['RFC 8785 JCS → UTF-8 → SHA-256. A digest does not establish identity, authority, truth, or PoAI/V.', 'RFC 8785 JCS → UTF-8 → SHA-256. Дайджест не устанавливает идентичность, полномочия, истинность или PoAI/V.'],
    ['Load or paste JSON above.', 'Загрузите или вставьте JSON выше.'],

    // Level 4.0b.
    ['Ed25519 signature binding', 'Привязка подписью Ed25519'],
    ['EPHEMERAL KEY · NOT IDENTITY', 'ВРЕМЕННЫЙ КЛЮЧ · НЕ ИДЕНТИЧНОСТЬ'],
    ['Generate ephemeral key & sign', 'Создать временный ключ и подписать'],
    ['Verify signature', 'Проверить подпись'],
    ['Download Signature Envelope', 'Скачать конверт подписи'],
    ['Load Signature Envelope', 'Загрузить конверт подписи'],
    ['RFC 8785 + SHA-256 → domain-separated statement → Ed25519. A valid signature does not prove identity, authority, truth, or PoAI/V.', 'RFC 8785 + SHA-256 → доменно-разделённое утверждение → Ed25519. Валидная подпись не доказывает идентичность, полномочия, истинность или PoAI/V.'],
    ['The private key remains only in this tab memory and is not included in the downloaded envelope.', 'Закрытый ключ остаётся только в памяти этой вкладки и не включается в скачиваемый конверт.'],

    // Level 4.0c.
    ['Persistent local signer key', 'Постоянный локальный ключ подписанта'],
    ['LOCAL CONTINUITY · NOT IDENTITY', 'ЛОКАЛЬНАЯ НЕПРЕРЫВНОСТЬ · НЕ ИДЕНТИЧНОСТЬ'],
    ['Create / use persistent key', 'Создать / использовать постоянный ключ'],
    ['Sign with persistent key', 'Подписать постоянным ключом'],
    ['Verify continuity signature', 'Проверить подпись непрерывности'],
    ['Download Continuity Envelope', 'Скачать конверт непрерывности'],
    ['Load Continuity Envelope', 'Загрузить конверт непрерывности'],
    ['Rotate local key', 'Ротировать локальный ключ'],
    ['A non-exportable Ed25519 private CryptoKey is stored in IndexedDB for this origin. Same-key continuity over time does not prove identity or authority.', 'Неэкспортируемый закрытый CryptoKey Ed25519 хранится в IndexedDB для этого источника (origin). Непрерывность одного и того же ключа во времени не доказывает идентичность или полномочия.'],

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
    ['Binds the persistent key to a claimed external identifier. Public publication can provide observable account/repository-control evidence, but does not prove human/legal identity or create authority.', 'Связывает постоянный ключ с заявленным внешним идентификатором. Публичная публикация может дать наблюдаемое доказательство контроля аккаунта/репозитория, но не доказывает человеческую или юридическую идентичность и не создаёт полномочий.'],

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
    ['Load Authority Evidence', 'Загрузить доказательство полномочия'],
    ['Records a signed claim about a specific authority scope, target and validity window. Signature and publication show that evidence exists, but do not prove issuer entitlement or create materialization authority.', 'Фиксирует подписанное утверждение о конкретной области полномочия, целевом ресурсе и сроке действия. Подпись и публикация показывают существование доказательства, но не подтверждают право выдающей стороны предоставлять полномочие и не создают полномочие материализации.']
  ];

  // Earlier modules intentionally mixed protocol jargon with translated UI text.
  // Treat those strings as aliases so language switching can normalize them too.
  const aliases = new Map([
    // Level 3 legacy mixed controls.
    ['Скачать Review Sidecar', 'Download Review Sidecar'],
    ['Скачать Appeal Request Sidecar', 'Download Appeal Request Sidecar'],
    ['Скачать Adjudication Sidecar', 'Download Adjudication Sidecar'],
    ['Скачать Execution Sidecar', 'Download Execution Sidecar'],
    ['Скачать Verification Sidecar', 'Download Verification Sidecar'],
    ['Скачать Outcome Sidecar', 'Download Outcome Sidecar'],
    ['Скачать Successor Proposal', 'Download Successor Proposal'],
    ['Не влияет на PASS', 'Does not affect PASS'],
    ['Отдельный экспериментальный review artifact; исходный PoAI JSON не изменяется.', 'Separate experimental review artifact; the source PoAI JSON is not modified.'],

    // Level 4.0a legacy mixed UI.
    ['DIGEST ONLY · НЕ ПОДПИСЬ', 'DIGEST ONLY · NOT A SIGNATURE'],
    ['Скачать Binding Receipt', 'Download Binding Receipt'],
    ['RFC 8785 JCS → UTF-8 → SHA-256. Привязка не подтверждает личность, полномочие, истинность или PoAI/V.', 'RFC 8785 JCS → UTF-8 → SHA-256. A digest does not establish identity, authority, truth, or PoAI/V.'],

    // Level 4.0b legacy mixed UI.
    ['Подпись Ed25519', 'Ed25519 signature binding'],
    ['EPHEMERAL KEY · НЕ IDENTITY', 'EPHEMERAL KEY · NOT IDENTITY'],
    ['Скачать Signature Envelope', 'Download Signature Envelope'],
    ['Загрузить Signature Envelope', 'Load Signature Envelope'],
    ['RFC 8785 + SHA-256 → domain-separated statement → Ed25519. Корректная подпись не доказывает личность, полномочие, истинность или PoAI/V.', 'RFC 8785 + SHA-256 → domain-separated statement → Ed25519. A valid signature does not prove identity, authority, truth, or PoAI/V.'],

    // Level 4.0c legacy mixed UI.
    ['Постоянный локальный ключ', 'Persistent local signer key'],
    ['LOCAL CONTINUITY · НЕ IDENTITY', 'LOCAL CONTINUITY · NOT IDENTITY'],
    ['Проверить continuity signature', 'Verify continuity signature'],
    ['Скачать Continuity Envelope', 'Download Continuity Envelope'],
    ['Загрузить Continuity Envelope', 'Load Continuity Envelope'],
    ['Non-exportable Ed25519 private key хранится как CryptoKey в IndexedDB этого origin. Совпадение ключа во времени не доказывает личность или полномочия.', 'A non-exportable Ed25519 private CryptoKey is stored in IndexedDB for this origin. Same-key continuity over time does not prove identity or authority.'],

    // Level 4.0d legacy mixed UI.
    ['Создать подписанный identity claim', 'Create signed identity claim'],
    ['Проверить claim', 'Verify claim'],
    ['Скачать Identity Evidence', 'Download Identity Evidence'],
    ['Загрузить Identity Evidence', 'Load Identity Evidence'],
    ['CLAIM/EVIDENCE · НЕ LEGAL IDENTITY', 'CLAIM/EVIDENCE · NOT LEGAL IDENTITY'],
    ['Связывает persistent key с заявленным внешним идентификатором. Публичная публикация может дать наблюдаемое evidence контроля аккаунта/репозитория, но не доказывает человеческую или юридическую личность и не создаёт полномочия.', 'Binds the persistent key to a claimed external identifier. Public publication can provide observable account/repository-control evidence, but does not prove human/legal identity or create authority.'],

    // Level 4.0e legacy mixed UI.
    ['Создать подписанное authority evidence', 'Create signed authority evidence'],
    ['Проверить evidence', 'Verify evidence'],
    ['Скачать Authority Evidence', 'Download Authority Evidence'],
    ['Загрузить Authority Evidence', 'Load Authority Evidence'],
    ['EVIDENCE · НЕ VERIFIED AUTHORITY', 'EVIDENCE · NOT VERIFIED AUTHORITY'],
    ['Identity evidence issuer (необязательно)', 'Issuer identity evidence ref (optional)'],
    ['Фиксирует подписанное утверждение о конкретном полномочии, цели и сроке. Подпись и публикация показывают существование evidence, но не доказывают право issuer выдавать полномочие и не создают materialization authority.', 'Records a signed claim about a specific authority scope, target and validity window. Signature and publication show that evidence exists, but do not prove issuer entitlement or create materialization authority.']
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

    const keyEn = canonical.match(/^Key\s+(.+)$/);
    if (keyEn && language === 'ru') return `Ключ ${keyEn[1]}`;
    const keyRu = canonical.match(/^Ключ\s+(.+)$/);
    if (keyRu && language === 'en') return `Key ${keyRu[1]}`;

    const epochEn = canonical.match(/^epoch\s+(\d+)$/i);
    if (epochEn && language === 'ru') return `эпоха ${epochEn[1]}`;
    const epochRu = canonical.match(/^эпоха\s+(\d+)$/i);
    if (epochRu && language === 'en') return `epoch ${epochRu[1]}`;

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

  function translateHelperElement(element, language) {
    if (!element || element.children.length) return;
    let next = translateExactText(element.textContent, language);
    next = translateStatusText(next, language);
    if (next !== element.textContent) element.textContent = next;
  }

  function apply(languageValue) {
    if (typeof document === 'undefined') return;
    const language = languageValue || currentLanguage();

    document.querySelectorAll('button, label.file-label, .panel-head h2, .badge').forEach((element) => {
      translateElementExact(element, language);
    });
    document.querySelectorAll('.form-grid label').forEach((label) => translateLabelTextNodes(label, language));

    document.querySelectorAll('.summary, .footnote, .panel > p, .review-cues-note').forEach((element) => {
      translateHelperElement(element, language);
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
