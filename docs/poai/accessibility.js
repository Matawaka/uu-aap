(function () {
  'use strict';

  function setupTabs() {
    const tablist = document.querySelector('.tabs');
    const tabs = Array.from(document.querySelectorAll('[data-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-panel]'));
    if (!tablist || !tabs.length) return;

    tablist.setAttribute('role', 'tablist');

    tabs.forEach((tab) => {
      const name = tab.dataset.tab;
      const panel = panels.find((item) => item.dataset.panel === name);
      const tabId = `tab-${name}`;
      const panelId = `panel-${name}`;
      const selected = tab.classList.contains('active');

      tab.id = tabId;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('aria-controls', panelId);
      tab.tabIndex = selected ? 0 : -1;

      if (panel) {
        panel.id = panelId;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabId);
      }

      tab.addEventListener('click', () => syncTabs(name));
    });

    tablist.addEventListener('keydown', (event) => {
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;

      let next = current;
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;

      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    });
  }

  function syncTabs(activeName) {
    document.querySelectorAll('[data-tab]').forEach((tab) => {
      const selected = tab.dataset.tab === activeName;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
  }

  function setupFileFocusProxy() {
    const input = document.getElementById('fileInput');
    const label = document.querySelector('label[for="fileInput"]');
    if (!input || !label) return;

    input.addEventListener('focus', () => label.classList.add('focus-proxy'));
    input.addEventListener('blur', () => label.classList.remove('focus-proxy'));
  }

  function loadReviewCueModule() {
    if (document.querySelector('script[data-poai-review-cues]')) return;
    const script = document.createElement('script');
    script.src = 'review-cues.js';
    script.dataset.poaiReviewCues = 'true';
    script.defer = true;
    document.body.append(script);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupFileFocusProxy();
    loadReviewCueModule();
  });
})();
