#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const runtimePath = path.resolve(process.argv[2]);
require(runtimePath);
const api = globalThis.UUAAPL10N;
assert(api, "compiled localization runtime must expose UUAAPL10N");
assert.deepEqual(api.supportedLocales, ["en", "ru"]);
assert.equal(api.normalizeLocale("ru"), "ru");
assert.equal(api.normalizeLocale("de"), "en");
assert.equal(api.getMessage("ru", "common.language_label"), "Язык интерфейса");

const localizedNode = { dataset: { i18n: "root.heading" }, textContent: "UU-AAP Layered Verifier" };
const userNode = { dataset: {}, textContent: "Пользовательский evidence: НЕ ПЕРЕВОДИТЬ / integrity" };
const enButton = {
  dataset: { locale: "en" },
  state: {},
  setAttribute(name, value) { this.state[name] = value; },
};
const ruButton = {
  dataset: { locale: "ru" },
  state: {},
  setAttribute(name, value) { this.state[name] = value; },
};
const fakeDocument = {
  documentElement: { lang: "en" },
  querySelectorAll(selector) {
    if (selector === "[data-i18n]") return [localizedNode];
    if (selector === "[data-locale]") return [enButton, ruButton];
    return [];
  },
};

api.applyLocale("ru", fakeDocument);
assert.equal(fakeDocument.documentElement.lang, "ru");
assert.equal(localizedNode.textContent, "Многоуровневый верификатор UU-AAP");
assert.equal(userNode.textContent, "Пользовательский evidence: НЕ ПЕРЕВОДИТЬ / integrity");
assert.equal(enButton.state["aria-pressed"], "false");
assert.equal(ruButton.state["aria-pressed"], "true");

api.applyLocale("unsupported", fakeDocument);
assert.equal(fakeDocument.documentElement.lang, "en");
assert.equal(localizedNode.textContent, "UU-AAP Layered Verifier");

console.log("P1.6 localized static node only: PASS");
console.log("user/evidence text outside data-i18n -> unchanged");
