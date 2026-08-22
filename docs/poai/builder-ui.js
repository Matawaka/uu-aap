(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const value = (id) => ($(id) ? $(id).value : '');
  const checked = (id) => Boolean($(id) && $(id).checked);

  function collectInput() {
    const authorityScopes = Array.from(document.querySelectorAll('input[name="builderScope"]:checked')).map((node) => node.value);
    return {
      label: value('builderLabel'),
      actorName: value('builderActor'),
      subjectId: value('builderSubjectId'),
      recordId: value('builderRecordId'),
      description: value('builderDescription'),
      opened: value('builderOpened'),
      cutoff: value('builderCutoff'),
      closed: value('builderClosed'),
      boundaryStatus: value('builderBoundaryStatus'),

      resourceLabel: value('builderResourceLabel'),
      resourceType: value('builderResourceType'),
      resourceNotes: value('builderResourceNotes'),
      availabilityOverall: value('builderAvailabilityOverall'),
      availabilityIdentity: value('builderAvailabilityIdentity'),
      availabilityDiscoverability: value('builderAvailabilityDiscoverability'),
      availabilityReachability: value('builderAvailabilityReachability'),
      availabilityAuthorization: value('builderAvailabilityAuthorization'),
      availabilityTemporalFit: value('builderAvailabilityTemporalFit'),
      availabilityContextSufficiency: value('builderAvailabilityContextSufficiency'),
      availabilityExecutionCapability: value('builderAvailabilityExecutionCapability'),
      availabilityDelivery: value('builderAvailabilityDelivery'),
      considerationStatus: value('builderConsiderationStatus'),
      considerationSummary: value('builderConsiderationSummary'),

      evidenceClass: value('builderEvidenceClass'),
      evidenceType: value('builderEvidenceType'),
      evidenceAvailability: value('builderEvidenceAvailability'),
      evidenceLocation: value('builderEvidenceLocation'),
      evidenceNotes: value('builderEvidenceNotes'),
      authorityStatus: value('builderAuthorityStatus'),
      authorityScopes,
      alternativeLabel: value('builderAlternativeLabel'),
      constraintLabel: value('builderConstraintLabel'),

      futureEnabled: checked('builderFutureEnabled'),
      futureLabel: value('builderFutureLabel'),
      futureEpistemicStatus: value('builderFutureEpistemicStatus'),
      futureProbability: value('builderFutureProbability'),
      outcomeStatus: value('builderOutcomeStatus'),
      outcomeObservedAt: value('builderOutcomeObservedAt'),
      interventionPresent: checked('builderInterventionPresent'),
      interventionDescription: value('builderInterventionDescription'),
      causalStatus: value('builderCausalStatus'),
      successorRecord: value('builderSuccessorRecord'),
      outcomeNotes: value('builderOutcomeNotes'),

      contestabilityChannel: value('builderContestabilityChannel'),
      appealAvailable: checked('builderAppealAvailable'),
      contestabilityNotes: value('builderContestabilityNotes')
    };
  }

  function isolateSectionHelp() {
    document.querySelectorAll('.builder-section > .footnote').forEach((node) => {
      node.classList.remove('footnote');
      node.classList.add('muted', 'builder-section-help');
    });
  }

  function syncSectionHelp() {
    const ru = document.documentElement.lang === 'ru';
    const notes = document.querySelectorAll('.builder-section-help');
    if (notes[0]) notes[0].innerHTML = ru
      ? 'В первом инкременте — один ресурс. Каждое измерение доступности остаётся <code>unknown</code>, пока вы явно не укажете иное.'
      : 'One resource in this first increment. Every availability dimension defaults to <code>unknown</code> unless you explicitly state otherwise.';
    if (notes[1]) notes[1].textContent = ru
      ? 'Выбор E1–E4 является вашим утверждением; конструктор не подтверждает этот класс доказательств.'
      : 'Selecting E1–E4 is a claim you make; the Builder does not verify that class.';
  }

  function install() {
    const original = $('buildBtn');
    if (!original || !window.PoAIBuilder) return;

    isolateSectionHelp();
    syncSectionHelp();

    const replacement = original.cloneNode(true);
    original.replaceWith(replacement);

    replacement.addEventListener('click', () => {
      const record = window.PoAIBuilder.buildRecord(collectInput());
      $('jsonInput').value = JSON.stringify(record, null, 2);
      $('validateBtn').click();
      const verifierTab = document.querySelector('[data-tab="verifier"]');
      if (verifierTab) verifierTab.click();
    });

    document.addEventListener('poai:languagechange', syncSectionHelp);
  }

  document.addEventListener('DOMContentLoaded', install);
})();
