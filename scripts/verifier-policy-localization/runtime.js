(() => {
  "use strict";

  const CATALOG = __UUAAP_L10N_CATALOG__;
  const SUPPORTED = new Set(["en", "ru"]);

  function normalizeLocale(locale) {
    return SUPPORTED.has(locale) ? locale : "en";
  }

  function getMessage(locale, key) {
    const selected = normalizeLocale(locale);
    if (!Object.hasOwn(CATALOG[selected], key)) {
      throw new Error(`Unknown localization key: ${key}`);
    }
    return CATALOG[selected][key];
  }

  function applyLocale(locale, doc = globalThis.document) {
    const selected = normalizeLocale(locale);
    if (!doc) {
      return selected;
    }
    doc.documentElement.lang = selected;
    for (const node of doc.querySelectorAll("[data-i18n]")) {
      node.textContent = getMessage(selected, node.dataset.i18n);
    }
    for (const button of doc.querySelectorAll("[data-locale]")) {
      button.setAttribute("aria-pressed", String(button.dataset.locale === selected));
    }
    return selected;
  }

  function install(doc = globalThis.document) {
    if (!doc) {
      return;
    }
    for (const button of doc.querySelectorAll("[data-locale]")) {
      button.addEventListener("click", () => applyLocale(button.dataset.locale, doc));
    }
    applyLocale("en", doc);
  }

  globalThis.UUAAPL10N = {
    applyLocale,
    getMessage,
    normalizeLocale,
    supportedLocales: Object.freeze(["en", "ru"]),
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => install(document), { once: true });
    } else {
      install(document);
    }
  }
})();
