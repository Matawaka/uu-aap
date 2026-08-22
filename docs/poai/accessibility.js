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

  const moduleChain = [
    ['PoAIReviewCues', 'review-cues.js', 'review-cues'],
    ['PoAIReviewSidecar', 'review-sidecar.js', 'review-sidecar'],
    ['PoAIAppealSidecar', 'appeal-sidecar.js', 'appeal-sidecar'],
    ['PoAIAdjudicationSidecar', 'adjudication-sidecar.js', 'adjudication-sidecar'],
    ['PoAIExecutionSidecar', 'execution-sidecar.js', 'execution-sidecar'],
    ['PoAIExecutionVerificationSidecar', 'execution-verification-sidecar.js', 'execution-verification-sidecar'],
    ['PoAIObservedOutcomeSidecar', 'outcome-sidecar.js', 'observed-outcome-sidecar'],
    ['PoAISuccessorProposalSidecar', 'successor-proposal-sidecar.js', 'successor-proposal-sidecar'],
    ['PoAIBindingReceipt', 'binding-receipt.js', 'binding-receipt'],
    ['PoAISignatureEnvelope', 'signature-envelope.js', 'signature-envelope'],
    ['PoAIKeyContinuity', 'key-continuity.js', 'key-continuity'],
    ['PoAIIdentityEvidence', 'identity-evidence.js', 'identity-evidence'],
    ['PoAIAuthorityEvidence', 'authority-evidence.js', 'authority-evidence'],
    ['PoAIDynamicI18n', 'dynamic-i18n.js', 'dynamic-i18n']
  ];

  function loadModule(index) {
    if (index >= moduleChain.length) return;
    const [globalName, src, marker] = moduleChain[index];
    if (globalThis[globalName]) {
      loadModule(index + 1);
      return;
    }

    const selector = `script[data-poai-module="${marker}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
      if (existing.dataset.loaded === 'true') loadModule(index + 1);
      else existing.addEventListener('load', () => loadModule(index + 1), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.dataset.poaiModule = marker;
    script.defer = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      loadModule(index + 1);
    }, { once: true });
    document.body.append(script);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupFileFocusProxy();
    loadModule(0);
  });
})();
