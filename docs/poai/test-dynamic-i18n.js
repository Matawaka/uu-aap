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

const authorityEn = 'SIGNED AUTHORITY CLAIM VALID · ACTIVE SUBJECT KEY MATCH · TIME ACTIVE · PUBLICATION MATCH · AUTHORITY EVIDENCE OBSERVED · issuer entitlement/verified authority not established';
const authorityRu = 'ПОДПИСАННОЕ УТВЕРЖДЕНИЕ О ПОЛНОМОЧИИ ВАЛИДНО · АКТИВНЫЙ КЛЮЧ СУБЪЕКТА СОВПАДАЕТ · ПЕРИОД ДЕЙСТВУЕТ · ПУБЛИКАЦИЯ СОВПАДАЕТ · ДОКАЗАТЕЛЬСТВО ПОЛНОМОЧИЯ НАБЛЮДАЕТСЯ · право выдающей стороны предоставлять полномочие / подтверждённое полномочие не установлены';
assert.equal(i18n.translateStatusText(authorityEn, 'ru'), authorityRu);
assert.equal(i18n.translateStatusText(authorityRu, 'en'), authorityEn);

const mixedIdentity = 'SIGNED CLAIM VALID · ACTIVE KEY MATCH · PUBLICATION NOT CHECKED · ACCOUNT-CONTROL EVIDENCE NOT ESTABLISHED · human identity/authority не установлены';
assert.equal(
  i18n.translateStatusText(mixedIdentity, 'ru'),
  'ПОДПИСАННОЕ УТВЕРЖДЕНИЕ ВАЛИДНО · АКТИВНЫЙ КЛЮЧ СОВПАДАЕТ · ПУБЛИКАЦИЯ НЕ ПРОВЕРЕНА · ДОКАЗАТЕЛЬСТВО КОНТРОЛЯ АККАУНТА НЕ УСТАНОВЛЕНО · человеческая идентичность/полномочия не установлены'
);

console.log('dynamic i18n tests passed');
