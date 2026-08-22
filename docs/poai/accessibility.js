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

  function loadObservedOutcomeSidecarModule() {
    if (globalThis.PoAIObservedOutcomeSidecar || document.querySelector('script[data-poai-observed-outcome-sidecar]')) return;
    const script = document.createElement('script');
    script.src = 'outcome-sidecar.js';
    script.dataset.poaiObservedOutcomeSidecar = 'true';
    script.defer = true;
    document.body.append(script);
  }

  function loadExecutionVerificationSidecarModule() {
    if (globalThis.PoAIExecutionVerificationSidecar) {
      loadObservedOutcomeSidecarModule();
      return;
    }
    const existing = document.querySelector('script[data-poai-execution-verification-sidecar]');
    if (existing) {
      existing.addEventListener('load', loadObservedOutcomeSidecarModule, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'execution-verification-sidecar.js';
    script.dataset.poaiExecutionVerificationSidecar = 'true';
    script.defer = true;
    script.addEventListener('load', loadObservedOutcomeSidecarModule, { once: true });
    document.body.append(script);
  }

  function loadExecutionSidecarModule() {
    if (globalThis.PoAIExecutionSidecar) {
      loadExecutionVerificationSidecarModule();
      return;
    }
    const existing = document.querySelector('script[data-poai-execution-sidecar]');
    if (existing) {
      existing.addEventListener('load', loadExecutionVerificationSidecarModule, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'execution-sidecar.js';
    script.dataset.poaiExecutionSidecar = 'true';
    script.defer = true;
    script.addEventListener('load', loadExecutionVerificationSidecarModule, { once: true });
    document.body.append(script);
  }

  function loadAdjudicationSidecarModule() {
    if (globalThis.PoAIAdjudicationSidecar) {
      loadExecutionSidecarModule();
      return;
    }
    const existing = document.querySelector('script[data-poai-adjudication-sidecar]');
    if (existing) {
      existing.addEventListener('load', loadExecutionSidecarModule, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'adjudication-sidecar.js';
    script.dataset.poaiAdjudicationSidecar = 'true';
    script.defer = true;
    script.addEventListener('load', loadExecutionSidecarModule, { once: true });
    document.body.append(script);
  }

  function loadAppealSidecarModule() {
    if (globalThis.PoAIAppealSidecar) {
      loadAdjudicationSidecarModule();
      return;
    }
    const existing = document.querySelector('script[data-poai-appeal-sidecar]');
    if (existing) {
      existing.addEventListener('load', loadAdjudicationSidecarModule, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'appeal-sidecar.js';
    script.dataset.poaiAppealSidecar = 'true';
    script.defer = true;
    script.addEventListener('load', loadAdjudicationSidecarModule, { once: true });
    document.body.append(script);
  }

  function loadReviewSidecarModule() {
    if (globalThis.PoAIReviewSidecar) {
      loadAppealSidecarModule();
      return;
    }
    const existing = document.querySelector('script[data-poai-review-sidecar]');
    if (existing) {
      existing.addEventListener('load', loadAppealSidecarModule, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'review-sidecar.js';
    script.dataset.poaiReviewSidecar = 'true';
    script.defer = true;
    script.addEventListener('load', loadAppealSidecarModule, { once: true });
    document.body.append(script);
  }

  function loadReviewCueModule() {
    if (globalThis.PoAIReviewCues) {
      loadReviewSidecarModule();
      return;
    }
    const existing = document.querySelector('script[data-poai-review-cues]');
    if (existing) {
      existing.addEventListener('load', loadReviewSidecarModule, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'review-cues.js';
    script.dataset.poaiReviewCues = 'true';
    script.defer = true;
    script.addEventListener('load', loadReviewSidecarModule, { once: true });
    document.body.append(script);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupFileFocusProxy();
    loadReviewCueModule();
  });
})();