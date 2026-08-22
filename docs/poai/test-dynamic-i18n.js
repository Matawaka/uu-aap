'use strict';

const assert = require('node:assert/strict');
require('./dynamic-i18n.js');

const i18n = globalThis.PoAIDynamicI18n;
assert.ok(i18n, 'PoAIDynamicI18n must be exported');

assert.equal(
  i18n.translateExactText('Create signed authority evidence', 'ru'),
  'Создать подписанное доказательство полномочия'
);
assert.equal(
  i18n.translateExactText('Создать подписанное authority evidence', 'en'),
  'Create signed authority evidence'
);
assert.equal(
  i18n.translateExactText('Download Identity Evidence', 'ru'),
  'Скачать доказательство идентификатора'
);
assert.equal(
  i18n.translateExactText('Скачать доказательство идентификатора', 'en'),
  'Download Identity Evidence'
);
assert.equal(
  i18n.translateExactText('Generate ephemeral key & sign', 'ru'),
  'Создать временный ключ и подписать'
);
assert.equal(
  i18n.translateExactText('Скачать сопроводительный артефакт исхода', 'en'),
  'Download Outcome Sidecar'
);
assert.equal(
  i18n.translateExactText('CLAIM/EVIDENCE · НЕ LEGAL IDENTITY', 'ru'),
  'УТВЕРЖДЕНИЕ/ДОКАЗАТЕЛЬСТВО · НЕ ЮРИДИЧЕСКАЯ ИДЕНТИЧНОСТЬ'
);
assert.equal(
  i18n.translateExactText('EVIDENCE · НЕ VERIFIED AUTHORITY', 'en'),
  'EVIDENCE · NOT VERIFIED AUTHORITY'
);
assert.equal(
  i18n.translateExactText('Identity evidence issuer (необязательно)', 'ru'),
  'Ссылка на доказательство идентификатора выдающей стороны (необязательно)'
);

assert.equal(
  i18n.translateExactText(
    'RFC 8785 JCS → UTF-8 → SHA-256. A digest does not establish identity, authority, truth, or PoAI/V.',
    'ru'
  ),
  'RFC 8785 JCS → UTF-8 → SHA-256. Дайджест не устанавливает идентичность, полномочия, истинность или PoAI/V.'
);
assert.equal(
  i18n.translateExactText(
    'RFC 8785 + SHA-256 → domain-separated statement → Ed25519. A valid signature does not prove identity, authority, truth, or PoAI/V.',
    'ru'
  ),
  'RFC 8785 + SHA-256 → доменно-разделённое утверждение → Ed25519. Валидная подпись не доказывает идентичность, полномочия, истинность или PoAI/V.'
);
assert.equal(
  i18n.translateExactText(
    'A non-exportable Ed25519 private CryptoKey is stored in IndexedDB for this origin. Same-key continuity over time does not prove identity or authority.',
    'ru'
  ),
  'Неэкспортируемый закрытый CryptoKey Ed25519 хранится в IndexedDB для этого источника (origin). Непрерывность одного и того же ключа во времени не доказывает идентичность или полномочия.'
);
assert.equal(
  i18n.translateExactText(
    'Binds the persistent key to a claimed external identifier. Public publication can provide observable account/repository-control evidence, but does not prove human/legal identity or create authority.',
    'ru'
  ),
  'Связывает постоянный ключ с заявленным внешним идентификатором. Публичная публикация может дать наблюдаемое доказательство контроля аккаунта/репозитория, но не доказывает человеческую или юридическую идентичность и не создаёт полномочий.'
);
assert.equal(
  i18n.translateExactText(
    'Связывает постоянный ключ с заявленным внешним идентификатором. Публичная публикация может дать наблюдаемое доказательство контроля аккаунта/репозитория, но не доказывает человеческую или юридическую идентичность и не создаёт полномочий.',
    'en'
  ),
  'Binds the persistent key to a claimed external identifier. Public publication can provide observable account/repository-control evidence, but does not prove human/legal identity or create authority.'
);
assert.equal(
  i18n.translateExactText('Load or paste JSON above.', 'ru'),
  'Загрузите или вставьте JSON выше.'
);
assert.equal(
  i18n.translateExactText(
    'The private key remains only in this tab memory and is not included in the downloaded envelope.',
    'ru'
  ),
  'Закрытый ключ остаётся только в памяти этой вкладки и не включается в скачиваемый конверт.'
);

const authorityEn = 'SIGNED AUTHORITY CLAIM VALID · ACTIVE SUBJECT KEY MATCH · TIME ACTIVE · PUBLICATION MATCH · AUTHORITY EVIDENCE OBSERVED · issuer entitlement/verified authority not established';
const authorityRu = 'ПОДПИСАННОЕ УТВЕРЖДЕНИЕ О ПОЛНОМОЧИИ ВАЛИДНО · АКТИВНЫЙ КЛЮЧ СУБЪЕКТА СОВПАДАЕТ · ПЕРИОД ДЕЙСТВУЕТ · ПУБЛИКАЦИЯ СОВПАДАЕТ · ДОКАЗАТЕЛЬСТВО ПОЛНОМОЧИЯ НАБЛЮДАЕТСЯ · право выдающей стороны предоставлять полномочие / подтверждённое полномочие не установлены';
assert.equal(i18n.translateStatusText(authorityEn, 'ru'), authorityRu);
assert.equal(i18n.translateStatusText(authorityRu, 'en'), authorityEn);

const mixedIdentity = 'SIGNED CLAIM VALID · ACTIVE KEY MATCH · PUBLICATION NOT CHECKED · ACCOUNT-CONTROL EVIDENCE NOT ESTABLISHED · human identity/authority не установлены';
assert.equal(
  i18n.translateStatusText(mixedIdentity, 'ru'),
  'ПОДПИСАННОЕ УТВЕРЖДЕНИЕ ВАЛИДНО · АКТИВНЫЙ КЛЮЧ СОВПАДАЕТ · ПУБЛИКАЦИЯ НЕ ПРОВЕРЕНА · ДОКАЗАТЕЛЬСТВО КОНТРОЛЯ АККАУНТА НЕ УСТАНОВЛЕНО · человеческая идентичность/полномочия не установлены'
);

const keyMetadataEn = 'Key 6bASxF6xsQnl · epoch 2 · PRIVATE NON-EXPORTABLE · identity/authority: not established';
const keyMetadataRu = 'Ключ 6bASxF6xsQnl · эпоха 2 · ПРИВАТНЫЙ КЛЮЧ НЕЭКСПОРТИРУЕМЫЙ · идентичность/полномочия: не установлены';
assert.equal(i18n.translateStatusText(keyMetadataEn, 'ru'), keyMetadataRu);
assert.equal(i18n.translateStatusText(keyMetadataRu, 'en'), keyMetadataEn);

console.log('dynamic i18n tests passed');
