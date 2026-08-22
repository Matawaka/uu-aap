(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIBuilder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EVIDENCE_CLASSES = ['E0', 'E1', 'E2', 'E3', 'E4'];
  const RESOURCE_TYPES = ['human_judgment', 'ai_system', 'expert_group', 'document', 'dataset', 'retrieval_service', 'forecasting_model', 'simulation', 'institutional_process', 'other'];
  const AVAILABILITY_VALUES = ['available', 'unavailable', 'partial', 'unknown', 'not_applicable'];
  const OVERALL_AVAILABILITY = ['available', 'partially_available', 'unavailable', 'unknown'];
  const CONSIDERATION_STATES = ['not_invoked', 'invoked', 'output_received', 'considered', 'relied_upon', 'rejected', 'not_used', 'unknown'];
  const AUTHORITY_STATUSES = ['accepted', 'shared', 'limited', 'declined', 'unknown'];
  const AUTHORITY_SCOPES = ['observe', 'request_analysis', 'recommend', 'decide', 'approve', 'block', 'execute', 'review', 'appeal'];
  const EPISTEMIC_STATUSES = ['asserted', 'probable', 'provisional', 'speculative', 'disputed', 'unknown', 'not_verified', 'unavailable'];
  const OUTCOME_STATUSES = ['not_yet_observable', 'realized', 'not_realized_without_intervention', 'not_realized_after_intervention', 'indeterminate', 'not_applicable'];
  const BOUNDARY_STATUSES = ['live_record', 'historical_reconstruction', 'mixed'];

  function trim(value) { return typeof value === 'string' ? value.trim() : ''; }
  function pick(value, allowed, fallback) { return allowed.includes(value) ? value : fallback; }
  function bool(value) { return value === true; }

  function slug(value, fallback) {
    const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');
    return normalized || fallback;
  }

  function isoFromLocal(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function probability(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
  }

  function scopes(value) {
    const requested = Array.isArray(value) ? value : [];
    const filtered = requested.filter((item, index) => AUTHORITY_SCOPES.includes(item) && requested.indexOf(item) === index);
    return filtered.length ? filtered : ['observe'];
  }

  function buildRecord(input) {
    const source = input && typeof input === 'object' ? input : {};
    const label = trim(source.label) || 'Untitled decision';
    const actorName = trim(source.actorName) || 'Undisclosed human actor';
    const subjectId = trim(source.subjectId) || `decision:${slug(label, 'untitled')}`;
    const recordId = trim(source.recordId) || `urn:poai:record:${slug(label, 'untitled')}:1`;
    const actorId = `human:${slug(actorName, 'actor')}`;
    const decisionSlug = slug(label, 'decision-context');
    const resourceId = `resource:${decisionSlug}:1`;
    const evidenceId = `evidence:${decisionSlug}:1`;

    const evidenceClass = pick(source.evidenceClass, EVIDENCE_CLASSES, 'E0');
    const resourceType = pick(source.resourceType, RESOURCE_TYPES, 'human_judgment');
    const overallStatus = pick(source.availabilityOverall, OVERALL_AVAILABILITY, 'unknown');
    const considerationStatus = pick(source.considerationStatus, CONSIDERATION_STATES, 'unknown');
    const authorityStatus = pick(source.authorityStatus, AUTHORITY_STATUSES, 'unknown');
    const boundaryStatus = pick(source.boundaryStatus, BOUNDARY_STATUSES, 'live_record');

    const dimension = (name) => pick(source[name], AVAILABILITY_VALUES, 'unknown');
    const evidenceRefs = [evidenceId];
    const opened = isoFromLocal(source.opened);
    const cutoff = isoFromLocal(source.cutoff);
    const closed = isoFromLocal(source.closed);

    const resourceLabel = trim(source.resourceLabel) || 'Declared intelligence resource';
    const evidenceType = trim(source.evidenceType) || 'self_declaration';
    const evidenceAvailability = trim(source.evidenceAvailability) || 'builder_session';
    const evidenceLocation = trim(source.evidenceLocation) || null;

    const alternativeLabel = trim(source.alternativeLabel);
    const constraintLabel = trim(source.constraintLabel);

    const futureLabel = trim(source.futureLabel);
    const futureEnabled = bool(source.futureEnabled) || Boolean(futureLabel);
    const futureTarget = futureEnabled ? {
      future_target_id: `future:${decisionSlug}:1`,
      label: futureLabel || 'Unlabeled Future Target',
      epistemic_status: pick(source.futureEpistemicStatus, EPISTEMIC_STATUSES, 'unknown'),
      probability: probability(source.futureProbability)
    } : null;

    const outcomeStatus = pick(source.outcomeStatus, OUTCOME_STATUSES, futureTarget ? 'not_yet_observable' : 'not_applicable');
    const interventionPresent = bool(source.interventionPresent);
    const intervention = interventionPresent ? {
      status: 'recorded',
      description: trim(source.interventionDescription) || null,
      causal_status: trim(source.causalStatus) || 'unknown'
    } : null;

    const contestabilityChannel = trim(source.contestabilityChannel) || 'https://github.com/Matawaka/uu-aap/issues';

    return {
      protocol: 'PoAI',
      protocol_version: '0.0.1',
      profile: 'T',
      record_id: recordId,
      subject: {
        type: 'decision',
        id: subjectId,
        label,
        description: trim(source.description) || null
      },
      decision_boundary: {
        opened_at: opened,
        closed_at: closed,
        knowledge_cutoff: cutoff,
        precision: opened || cutoff || closed ? 'minute' : 'unknown',
        timezone: 'UTC',
        status: boundaryStatus,
        notes: 'Generated by the experimental Level 3.1 Record Builder; review before use.'
      },
      future_target: futureTarget,
      actors: [{
        actor_id: actorId,
        actor_type: 'human',
        name: actorName,
        notes: 'Self-declared by builder user.'
      }],
      intelligence_resources: [{
        resource_id: resourceId,
        resource_type: resourceType,
        label: resourceLabel,
        actor_refs: resourceType === 'human_judgment' ? [actorId] : [],
        notes: trim(source.resourceNotes) || null
      }],
      availability: [{
        availability_id: `availability:${decisionSlug}:1`,
        resource_id: resourceId,
        subject_id: subjectId,
        dimensions: {
          identity: dimension('availabilityIdentity'),
          discoverability: dimension('availabilityDiscoverability'),
          reachability: dimension('availabilityReachability'),
          authorization: dimension('availabilityAuthorization'),
          temporal_fit: dimension('availabilityTemporalFit'),
          context_sufficiency: dimension('availabilityContextSufficiency'),
          execution_capability: dimension('availabilityExecutionCapability'),
          delivery: dimension('availabilityDelivery')
        },
        overall_status: overallStatus,
        evidence_class: evidenceClass,
        evidence_refs: evidenceRefs,
        notes: 'Availability values are user-declared; the Builder does not infer them from resource existence.'
      }],
      consideration: [{
        consideration_id: `consideration:${decisionSlug}:1`,
        resource_id: resourceId,
        status: considerationStatus,
        summary: trim(source.considerationSummary) || null,
        evidence_class: evidenceClass,
        evidence_refs: evidenceRefs
      }],
      alternatives: alternativeLabel ? [{
        alternative_id: `alternative:${decisionSlug}:1`,
        label: alternativeLabel,
        status: 'declared',
        evidence_refs: evidenceRefs
      }] : [],
      authority: [{
        actor_id: actorId,
        scopes: scopes(source.authorityScopes),
        status: authorityStatus,
        notes: 'Authority status is a user declaration and must be independently supported for consequential use.'
      }],
      constraints: constraintLabel ? [{
        constraint_id: `constraint:${decisionSlug}:1`,
        label: constraintLabel,
        status: 'declared'
      }] : [],
      uncertainty: [{
        type: 'builder_default',
        notes: 'The Builder preserves uncertainty. Filled fields are not automatically promoted to stronger evidence or authority.'
      }],
      evidence: [{
        evidence_id: evidenceId,
        class: evidenceClass,
        type: evidenceType,
        location: evidenceLocation,
        availability: evidenceAvailability,
        notes: trim(source.evidenceNotes) || 'Declared in the local Builder session.'
      }],
      artifact_binding: {
        status: 'not_bound',
        sha256: null,
        signature: null,
        c2pa: null,
        notes: 'No cryptographic binding is performed by Level 3.1.'
      },
      contestability: {
        channel_available: true,
        channel: contestabilityChannel,
        appeal_available: bool(source.appealAvailable),
        notes: trim(source.contestabilityNotes) || 'Declared contestability channel.'
      },
      outcome: {
        status: outcomeStatus,
        observed_at: isoFromLocal(source.outcomeObservedAt),
        intervention,
        successor_record: trim(source.successorRecord) || null,
        notes: trim(source.outcomeNotes) || null
      },
      links: {
        related_decisions: [subjectId],
        external: []
      },
      versioning: {
        record_version: 1,
        previous_record: null,
        successor_record: trim(source.successorRecord) || null,
        change_summary: 'Initial deeper-authoring draft generated by PoAI Level 3.1 Record Builder.'
      }
    };
  }

  return { buildRecord, slug, isoFromLocal };
});
