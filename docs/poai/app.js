(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = { record: null, result: null };

  const demoRecord = {
    protocol: 'PoAI', protocol_version: '0.0.1', profile: 'T', record_id: 'urn:poai:demo:level3:1',
    subject: { type: 'decision', id: 'decision:demo', label: 'Demo decision', description: 'Browser-only demonstration record.' },
    decision_boundary: { opened_at: '2026-08-22T08:00:00Z', closed_at: '2026-08-22T08:30:00Z', knowledge_cutoff: '2026-08-22T08:25:00Z', precision: 'minute', timezone: 'UTC', status: 'live_record', notes: null },
    future_target: null,
    actors: [{ actor_id: 'human:demo', actor_type: 'human', name: 'Demo decision-maker' }],
    intelligence_resources: [{ resource_id: 'resource:demo', resource_type: 'document', label: 'Demo evidence packet', actor_refs: [] }],
    availability: [{ availability_id: 'availability:demo', resource_id: 'resource:demo', subject_id: 'decision:demo', dimensions: { identity: 'available', discoverability: 'available', reachability: 'available', authorization: 'available', temporal_fit: 'available', context_sufficiency: 'partial', execution_capability: 'not_applicable', delivery: 'available' }, overall_status: 'partially_available', evidence_class: 'E0', evidence_refs: ['evidence:demo'] }],
    consideration: [{ consideration_id: 'consideration:demo', resource_id: 'resource:demo', status: 'considered', evidence_class: 'E0', evidence_refs: ['evidence:demo'], summary: 'Demonstration only.' }],
    alternatives: [],
    authority: [{ actor_id: 'human:demo', scopes: ['observe', 'decide'], status: 'accepted' }],
    constraints: [], uncertainty: [{ type: 'demo', notes: 'This is a synthetic interface example, not evidence of a real-world event.' }],
    evidence: [{ evidence_id: 'evidence:demo', class: 'E0', type: 'self_declaration', availability: 'embedded_demo' }],
    artifact_binding: { status: 'not_bound', sha256: null },
    contestability: { channel_available: true, channel: 'https://github.com/Matawaka/uu-aap/discussions/10', appeal_available: false },
    outcome: { status: 'not_applicable', observed_at: null, intervention: null, successor_record: null },
    links: { related_decisions: [], external: [] },
    versioning: { record_version: 1, previous_record: null, successor_record: null, change_summary: 'Embedded Level 3 demo.' }
  };

  function pretty(value) { return JSON.stringify(value, null, 2); }
  function text(value, fallback) { return value === null || value === undefined || value === '' ? (fallback || '—') : String(value); }
  function escapeText(value) { return text(value); }

  function setRecord(record) {
    state.record = record;
    $('jsonInput').value = pretty(record);
    validateCurrent();
  }

  function parseInput() {
    try {
      return { record: JSON.parse($('jsonInput').value), error: null };
    } catch (error) {
      return { record: null, error };
    }
  }

  function validateCurrent() {
    const parsed = parseInput();
    if (parsed.error) {
      state.record = null;
      state.result = null;
      renderParseError(parsed.error);
      return;
    }
    state.record = parsed.record;
    state.result = window.PoAIValidator.validatePoAI(parsed.record);
    renderAll();
  }

  function renderParseError(error) {
    $('statusBadge').className = 'badge bad';
    $('statusBadge').textContent = 'INVALID JSON';
    $('summaryLine').textContent = error.message;
    $('issues').replaceChildren(issueNode({ code: 'json_parse', path: '$', message: error.message }, true));
    $('warnings').replaceChildren();
    clearVisualization();
  }

  function issueNode(item, isError) {
    const div = document.createElement('div');
    div.className = `issue ${isError ? 'error' : 'warning'}`;
    const strong = document.createElement('strong');
    strong.textContent = item.code;
    const code = document.createElement('code');
    code.textContent = item.path || '$';
    const p = document.createElement('p');
    p.textContent = item.message;
    div.append(strong, code, p);
    return div;
  }

  function renderAll() {
    const result = state.result;
    const record = state.record;
    $('statusBadge').className = `badge ${result.valid ? 'good' : 'bad'}`;
    $('statusBadge').textContent = result.valid ? 'PASS' : 'FAIL';
    $('summaryLine').textContent = `${result.errors.length} error(s), ${result.warnings.length} warning(s) · profile ${text(result.summary.profile, 'unknown')}`;

    $('issues').replaceChildren(...result.errors.map((item) => issueNode(item, true)));
    if (!result.errors.length) $('issues').append(emptyNode('No semantic errors detected by the browser validator.'));
    $('warnings').replaceChildren(...result.warnings.map((item) => issueNode(item, false)));
    if (!result.warnings.length) $('warnings').append(emptyNode('No browser-level warnings.'));

    $('truthBadge').textContent = 'Truth certified? NO';
    $('bindingBadge').textContent = `Cryptographically bound? ${text(result.summary.artifact_binding, 'unknown')}`;
    $('privacyBadge').textContent = 'Upload destination: this browser only';

    renderVisualization(record);
  }

  function emptyNode(message) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = message;
    return p;
  }

  function clearVisualization() {
    ['decisionCard','futureCard','resourceTable','authorityTable','outcomeCard','evidenceCard'].forEach((id) => $(id).replaceChildren());
  }

  function kv(container, label, value) {
    const row = document.createElement('div');
    row.className = 'kv';
    const k = document.createElement('span');
    k.textContent = label;
    const v = document.createElement('strong');
    v.textContent = escapeText(value);
    row.append(k, v);
    container.append(row);
  }

  function renderVisualization(record) {
    clearVisualization();
    const boundary = record.decision_boundary || {};
    kv($('decisionCard'), 'Subject', record.subject && record.subject.label);
    kv($('decisionCard'), 'Opened', boundary.opened_at);
    kv($('decisionCard'), 'Knowledge cutoff', boundary.knowledge_cutoff);
    kv($('decisionCard'), 'Closed', boundary.closed_at);
    kv($('decisionCard'), 'Boundary status', boundary.status);

    if (record.future_target) {
      kv($('futureCard'), 'Future Target', record.future_target.label);
      kv($('futureCard'), 'Epistemic status', record.future_target.epistemic_status);
      kv($('futureCard'), 'Probability', record.future_target.probability);
    } else {
      $('futureCard').append(emptyNode('No Future Target in this record.'));
    }

    renderResources(record);
    renderAuthority(record);
    const outcome = record.outcome || {};
    const intervention = outcome.intervention || null;
    kv($('outcomeCard'), 'Outcome status', outcome.status);
    kv($('outcomeCard'), 'Observed at', outcome.observed_at);
    kv($('outcomeCard'), 'Intervention', intervention ? 'present' : 'none');
    kv($('outcomeCard'), 'Causal status', intervention && intervention.causal_status);
    kv($('outcomeCard'), 'Successor', outcome.successor_record);

    const evidence = Array.isArray(record.evidence) ? record.evidence : [];
    kv($('evidenceCard'), 'Evidence items', evidence.length);
    kv($('evidenceCard'), 'Artifact binding', record.artifact_binding && record.artifact_binding.status);
    kv($('evidenceCard'), 'Contestability channel', record.contestability && record.contestability.channel_available ? 'available' : 'not confirmed');
  }

  function renderResources(record) {
    const table = $('resourceTable');
    const resources = Array.isArray(record.intelligence_resources) ? record.intelligence_resources : [];
    const availability = Array.isArray(record.availability) ? record.availability : [];
    const consideration = Array.isArray(record.consideration) ? record.consideration : [];
    if (!resources.length) { table.append(emptyNode('No intelligence resources.')); return; }
    resources.forEach((resource) => {
      const claim = availability.find((item) => item.resource_id === resource.resource_id);
      const considered = consideration.find((item) => item.resource_id === resource.resource_id);
      const row = document.createElement('div'); row.className = 'table-row';
      [resource.label, resource.resource_type, claim && claim.overall_status, considered && considered.status].forEach((value) => {
        const cell = document.createElement('span'); cell.textContent = text(value); row.append(cell);
      });
      table.append(row);
    });
  }

  function renderAuthority(record) {
    const table = $('authorityTable');
    const actors = new Map((Array.isArray(record.actors) ? record.actors : []).map((actor) => [actor.actor_id, actor]));
    const authority = Array.isArray(record.authority) ? record.authority : [];
    if (!authority.length) { table.append(emptyNode('No authority relations.')); return; }
    authority.forEach((item) => {
      const actor = actors.get(item.actor_id) || {};
      const row = document.createElement('div'); row.className = 'table-row authority';
      [actor.name || item.actor_id, (item.scopes || []).join(', '), item.status].forEach((value) => {
        const cell = document.createElement('span'); cell.textContent = text(value); row.append(cell);
      });
      table.append(row);
    });
  }

  function isoFromLocal(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function slug(value, fallback) {
    const result = String(value || '').trim().toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');
    return result || fallback;
  }

  function buildRecord() {
    const label = $('builderLabel').value.trim() || 'Untitled decision';
    const actorName = $('builderActor').value.trim() || 'Undisclosed human actor';
    const subjectId = $('builderSubjectId').value.trim() || `decision:${slug(label, 'untitled')}`;
    const recordId = $('builderRecordId').value.trim() || `urn:poai:record:${slug(label, 'untitled')}:1`;
    const actorId = `human:${slug(actorName, 'actor')}`;
    const resourceId = `resource:${slug(label, 'decision-context')}:human-judgment`;
    const evidenceId = `evidence:${slug(label, 'decision-context')}:self-declaration`;
    const opened = isoFromLocal($('builderOpened').value);
    const cutoff = isoFromLocal($('builderCutoff').value);
    const closed = isoFromLocal($('builderClosed').value);

    return {
      protocol: 'PoAI', protocol_version: '0.0.1', profile: 'T', record_id: recordId,
      subject: { type: 'decision', id: subjectId, label, description: $('builderDescription').value.trim() || null },
      decision_boundary: { opened_at: opened, closed_at: closed, knowledge_cutoff: cutoff, precision: opened || cutoff || closed ? 'minute' : 'unknown', timezone: 'UTC', status: 'live_record', notes: 'Generated by the experimental Level 3 Record Builder; review before use.' },
      future_target: null,
      actors: [{ actor_id: actorId, actor_type: 'human', name: actorName, notes: 'Self-declared by builder user.' }],
      intelligence_resources: [{ resource_id: resourceId, resource_type: 'human_judgment', label: 'Human judgment / decision context', actor_refs: [actorId], identity_status: 'known', notes: 'Builder seed resource; expand with actual documents, models, datasets or experts.' }],
      availability: [{ availability_id: `availability:${slug(label, 'decision-context')}:human-judgment`, resource_id: resourceId, subject_id: subjectId, dimensions: { identity: 'available', discoverability: 'not_applicable', reachability: 'not_applicable', authorization: 'unknown', temporal_fit: 'unknown', context_sufficiency: 'unknown', execution_capability: 'unknown', delivery: 'not_applicable' }, overall_status: 'unknown', evidence_class: 'E0', evidence_refs: [evidenceId], notes: 'Availability dimensions default to unknown where the builder cannot prove them.' }],
      consideration: [{ consideration_id: `consideration:${slug(label, 'decision-context')}:human-judgment`, resource_id: resourceId, status: 'considered', summary: 'Self-declared human decision context.', evidence_class: 'E0', evidence_refs: [evidenceId] }],
      alternatives: [],
      authority: [{ actor_id: actorId, scopes: ['observe', 'decide'], status: 'unknown', notes: 'Builder default; authority must be verified for consequential use.' }],
      constraints: [],
      uncertainty: [{ type: 'builder_default', notes: 'This record begins as an E0 self-declaration. Unknown fields must not be upgraded without evidence.' }],
      evidence: [{ evidence_id: evidenceId, class: 'E0', type: 'self_declaration', location: null, availability: 'builder_session', notes: 'Generated locally in the browser.' }],
      artifact_binding: { status: 'not_bound', sha256: null, signature: null, c2pa: null, notes: 'No cryptographic binding performed by Level 3 builder.' },
      contestability: { channel_available: true, channel: 'https://github.com/Matawaka/uu-aap/issues', discussion_channel: 'https://github.com/Matawaka/uu-aap/discussions/10', open_disputes: 0, appeal_available: false, notes: 'Repository-level contestability only.' },
      outcome: { status: 'not_applicable', observed_at: null, intervention: null, successor_record: null, notes: null },
      links: { uu_aap_manifest: null, uu_aap_pilot: null, related_decisions: [subjectId], external: [] },
      versioning: { record_version: 1, previous_record: null, successor_record: null, change_summary: 'Initial E0 record generated by PoAI Level 3 Record Builder.' }
    };
  }

  function downloadRecord() {
    if (!state.record) return;
    const blob = new Blob([pretty(state.record)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(state.record.record_id, 'poai-record')}.poai.json`;
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function selectTab(name) {
    document.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
    document.querySelectorAll('[data-panel]').forEach((panel) => panel.hidden = panel.dataset.panel !== name);
  }

  function wire() {
    $('validateBtn').addEventListener('click', validateCurrent);
    $('demoBtn').addEventListener('click', () => setRecord(demoRecord));
    $('clearBtn').addEventListener('click', () => { $('jsonInput').value = ''; state.record = null; state.result = null; clearVisualization(); $('issues').replaceChildren(); $('warnings').replaceChildren(); $('statusBadge').textContent = 'WAITING'; $('statusBadge').className = 'badge'; $('summaryLine').textContent = 'Paste or load a PoAI JSON record.'; });
    $('downloadBtn').addEventListener('click', downloadRecord);
    $('fileInput').addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      $('jsonInput').value = await file.text(); validateCurrent();
    });
    $('buildBtn').addEventListener('click', () => { setRecord(buildRecord()); selectTab('verifier'); });
    document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.tab)));
    setRecord(demoRecord);
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
