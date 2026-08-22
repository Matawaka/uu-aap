(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const value = (id) => ($(id) ? $(id).value : '');
  const checked = (id) => Boolean($(id) && $(id).checked);
  let resourceCounter = 1;

  const resourceTypes = ['human_judgment', 'ai_system', 'expert_group', 'document', 'dataset', 'retrieval_service', 'forecasting_model', 'simulation', 'institutional_process', 'other'];
  const availabilityValues = ['unknown', 'available', 'partial', 'unavailable', 'not_applicable'];
  const overallAvailability = ['unknown', 'available', 'partially_available', 'unavailable'];
  const considerationStates = ['unknown', 'not_invoked', 'invoked', 'output_received', 'considered', 'relied_upon', 'rejected', 'not_used'];
  const evidenceClasses = ['E0', 'E1', 'E2', 'E3', 'E4'];

  function options(values, selected) {
    return values.map((item) => `<option value="${item}"${item === selected ? ' selected' : ''}>${item}</option>`).join('');
  }

  function dimensionSelect(name) {
    return `<label>${name}<select data-dimension="${name}">${options(availabilityValues, 'unknown')}</select></label>`;
  }

  function makeResourceCard(index) {
    const card = document.createElement('article');
    card.className = 'resource-editor-card';
    card.dataset.resourceCard = String(index);
    card.innerHTML = `
      <div class="resource-editor-head">
        <strong><span class="en-only">Intelligence resource ${index}</span><span class="ru-only">Ресурс интеллекта ${index}</span></strong>
        <button type="button" class="resource-remove"><span class="en-only">Remove</span><span class="ru-only">Удалить</span></button>
      </div>
      <div class="form-grid compact">
        <label><span class="en-only">Resource label</span><span class="ru-only">Название ресурса</span><input data-field="label" placeholder="AI assistant / forecast / group"></label>
        <label><span class="en-only">Resource type</span><span class="ru-only">Тип ресурса</span><select data-field="type">${options(resourceTypes, 'ai_system')}</select></label>
        <label class="check-label wide"><input data-field="actorRef" data-auto="true" type="checkbox"><span class="en-only">Reference the decision-maker actor</span><span class="ru-only">Связать ресурс с участником, принимающим решение</span></label>
        <label class="wide"><span class="en-only">Resource notes</span><span class="ru-only">Примечание к ресурсу</span><input data-field="notes"></label>
        <label><span class="en-only">Overall availability</span><span class="ru-only">Общая доступность</span><select data-field="availabilityOverall">${options(overallAvailability, 'unknown')}</select></label>
        <label><span class="en-only">Consideration state</span><span class="ru-only">Статус рассмотрения</span><select data-field="considerationStatus">${options(considerationStates, 'unknown')}</select></label>
        <label class="wide"><span class="en-only">Consideration summary</span><span class="ru-only">Краткое описание рассмотрения</span><input data-field="considerationSummary"></label>
        <label><span class="en-only">Evidence class</span><span class="ru-only">Класс доказательств</span><select data-field="evidenceClass">${options(evidenceClasses, 'E0')}</select></label>
        <label><span class="en-only">Evidence type</span><span class="ru-only">Тип доказательства</span><input data-field="evidenceType" value="self_declaration"></label>
        <label><span class="en-only">Evidence availability</span><span class="ru-only">Доступность доказательства</span><input data-field="evidenceAvailability" value="builder_session"></label>
        <label><span class="en-only">Evidence location / reference</span><span class="ru-only">Местоположение / ссылка</span><input data-field="evidenceLocation"></label>
        <label class="wide"><span class="en-only">Evidence notes</span><span class="ru-only">Примечание к доказательству</span><input data-field="evidenceNotes"></label>
      </div>
      <div class="dimension-grid resource-dimensions">
        ${['identity', 'discoverability', 'reachability', 'authorization', 'temporal_fit', 'context_sufficiency', 'execution_capability', 'delivery'].map(dimensionSelect).join('')}
      </div>`;

    const type = card.querySelector('[data-field="type"]');
    const actorRef = card.querySelector('[data-field="actorRef"]');
    type.addEventListener('change', () => {
      if (actorRef.dataset.auto === 'true') actorRef.checked = type.value === 'human_judgment';
    });
    actorRef.addEventListener('change', () => { actorRef.dataset.auto = 'false'; });
    card.querySelector('.resource-remove').addEventListener('click', () => card.remove());
    return card;
  }

  function installResourceEditor() {
    const section = document.querySelector('[data-panel="builder"] .builder-section');
    if (!section || $('builderAdditionalResources')) return;

    const actorRef = document.createElement('label');
    actorRef.className = 'check-label first-resource-actor-ref';
    actorRef.innerHTML = '<input id="builderResourceActorRef" data-auto="true" type="checkbox" checked><span class="en-only">Reference the decision-maker actor</span><span class="ru-only">Связать ресурс с участником, принимающим решение</span>';
    const firstGrid = section.querySelector('.form-grid');
    if (firstGrid) firstGrid.append(actorRef);

    const firstType = $('builderResourceType');
    if (firstType) firstType.addEventListener('change', () => {
      const checkbox = $('builderResourceActorRef');
      if (checkbox && checkbox.dataset.auto === 'true') checkbox.checked = firstType.value === 'human_judgment';
    });
    $('builderResourceActorRef').addEventListener('change', (event) => { event.target.dataset.auto = 'false'; });

    const host = document.createElement('div');
    host.id = 'builderAdditionalResources';
    host.className = 'resource-editor-list';

    const toolbar = document.createElement('div');
    toolbar.className = 'resource-editor-toolbar';
    toolbar.innerHTML = `
      <button id="builderAddResource" type="button"><span class="en-only">+ Add intelligence resource</span><span class="ru-only">+ Добавить ресурс интеллекта</span></button>
      <span class="muted"><span class="en-only">Each resource keeps its own availability, consideration and evidence. Better information does not grant authority.</span><span class="ru-only">У каждого ресурса свои доступность, рассмотрение и доказательства. Лучшее знание не создаёт полномочия.</span></span>`;

    section.append(toolbar, host);
    $('builderAddResource').addEventListener('click', () => {
      resourceCounter += 1;
      host.append(makeResourceCard(resourceCounter));
    });
  }

  function firstResource() {
    return {
      label: value('builderResourceLabel'),
      type: value('builderResourceType'),
      notes: value('builderResourceNotes'),
      actorRef: checked('builderResourceActorRef'),
      availabilityOverall: value('builderAvailabilityOverall'),
      availability: {
        identity: value('builderAvailabilityIdentity'),
        discoverability: value('builderAvailabilityDiscoverability'),
        reachability: value('builderAvailabilityReachability'),
        authorization: value('builderAvailabilityAuthorization'),
        temporalFit: value('builderAvailabilityTemporalFit'),
        contextSufficiency: value('builderAvailabilityContextSufficiency'),
        executionCapability: value('builderAvailabilityExecutionCapability'),
        delivery: value('builderAvailabilityDelivery')
      },
      considerationStatus: value('builderConsiderationStatus'),
      considerationSummary: value('builderConsiderationSummary'),
      evidenceClass: value('builderEvidenceClass'),
      evidenceType: value('builderEvidenceType'),
      evidenceAvailability: value('builderEvidenceAvailability'),
      evidenceLocation: value('builderEvidenceLocation'),
      evidenceNotes: value('builderEvidenceNotes')
    };
  }

  function cardResource(card) {
    const field = (name) => {
      const node = card.querySelector(`[data-field="${name}"]`);
      return node ? node.value : '';
    };
    const dimension = (name) => {
      const node = card.querySelector(`[data-dimension="${name}"]`);
      return node ? node.value : 'unknown';
    };
    const actorRef = card.querySelector('[data-field="actorRef"]');
    return {
      label: field('label'),
      type: field('type'),
      notes: field('notes'),
      actorRef: Boolean(actorRef && actorRef.checked),
      availabilityOverall: field('availabilityOverall'),
      availability: {
        identity: dimension('identity'),
        discoverability: dimension('discoverability'),
        reachability: dimension('reachability'),
        authorization: dimension('authorization'),
        temporalFit: dimension('temporal_fit'),
        contextSufficiency: dimension('context_sufficiency'),
        executionCapability: dimension('execution_capability'),
        delivery: dimension('delivery')
      },
      considerationStatus: field('considerationStatus'),
      considerationSummary: field('considerationSummary'),
      evidenceClass: field('evidenceClass'),
      evidenceType: field('evidenceType'),
      evidenceAvailability: field('evidenceAvailability'),
      evidenceLocation: field('evidenceLocation'),
      evidenceNotes: field('evidenceNotes')
    };
  }

  function collectResources() {
    const additional = Array.from(document.querySelectorAll('[data-resource-card]')).map(cardResource);
    return [firstResource(), ...additional];
  }

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
      resources: collectResources(),
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
      ? 'Добавляйте несколько ресурсов, не смешивая их происхождение. Для <code>human_judgment</code> используйте смысл «оценочный вклад человека», а не «чистое мышление без ИИ». Каждая доступность остаётся <code>unknown</code>, пока вы явно не заявите иное.'
      : 'Add multiple resources without collapsing provenance. Treat <code>human_judgment</code> as a human-origin evaluative contribution, not proof of unaided cognition. Every availability dimension remains <code>unknown</code> unless explicitly declared.';
    if (notes[1]) notes[1].textContent = ru
      ? 'Выбор E1–E4 является вашим утверждением; конструктор не подтверждает этот класс доказательств.'
      : 'Selecting E1–E4 is a claim you make; the Builder does not verify that class.';
  }

  function install() {
    const original = $('buildBtn');
    if (!original || !window.PoAIBuilder) return;

    installResourceEditor();
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

  window.PoAIBuilderUI = Object.freeze({ collectResources, collectInput });
  document.addEventListener('DOMContentLoaded', install);
})();
