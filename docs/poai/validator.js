(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoAIValidator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PROHIBITED_KEYS = new Set(['intelligence_score', 'trust_score']);
  const TRACEABLE_PROFILES = new Set(['T', 'V', 'R']);
  const VERIFIABLE_PROFILES = new Set(['V', 'R']);

  function problem(code, message, path) {
    return { code, message, path: path || '$' };
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function scanProhibitedKeys(value, path, errors) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => scanProhibitedKeys(item, `${path}[${index}]`, errors));
      return;
    }
    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (PROHIBITED_KEYS.has(key)) {
        errors.push(problem('prohibited_scalar_score', `Protocol-defined scalar field '${key}' is prohibited.`, childPath));
      }
      scanProhibitedKeys(child, childPath, errors);
    }
  }

  function collectUnique(items, key, path, errors) {
    const values = new Set();
    asArray(items).forEach((item, index) => {
      if (!isObject(item)) return;
      const value = item[key];
      if (typeof value !== 'string' || !value) return;
      if (values.has(value)) {
        errors.push(problem('duplicate_id', `Duplicate ${key}: ${value}`, `${path}[${index}].${key}`));
      }
      values.add(value);
    });
    return values;
  }

  function requireTopLevel(record, errors) {
    const required = [
      'protocol', 'protocol_version', 'profile', 'record_id', 'subject', 'decision_boundary',
      'actors', 'intelligence_resources', 'availability', 'consideration', 'authority',
      'constraints', 'uncertainty', 'evidence', 'artifact_binding', 'contestability',
      'outcome', 'links', 'versioning'
    ];
    required.forEach((key) => {
      if (!(key in record)) errors.push(problem('missing_field', `Missing required top-level field '${key}'.`, `$.${key}`));
    });
  }

  function parseTimestamp(value) {
    if (typeof value !== 'string' || !value) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }

  function validatePoAI(record) {
    const errors = [];
    const warnings = [];

    if (!isObject(record)) {
      return { valid: false, errors: [problem('record_type', 'PoAI record must be a JSON object.')], warnings, summary: {} };
    }

    requireTopLevel(record, errors);
    scanProhibitedKeys(record, '$', errors);

    if (record.protocol !== 'PoAI') errors.push(problem('protocol', 'protocol must equal "PoAI".', '$.protocol'));
    if (!['0.0', '0.0.1'].includes(record.protocol_version)) {
      errors.push(problem('protocol_version', 'protocol_version must be 0.0 or 0.0.1.', '$.protocol_version'));
    }
    if (!['D', 'T', 'V', 'R'].includes(record.profile)) {
      errors.push(problem('profile', 'profile must be one of D, T, V, R.', '$.profile'));
    }

    const subjectId = isObject(record.subject) ? record.subject.id : null;
    if (typeof subjectId !== 'string' || !subjectId) {
      errors.push(problem('subject_id', 'subject.id must be a non-empty string.', '$.subject.id'));
    }

    const actorIds = collectUnique(record.actors, 'actor_id', '$.actors', errors);
    const resourceIds = collectUnique(record.intelligence_resources, 'resource_id', '$.intelligence_resources', errors);
    const evidenceIds = collectUnique(record.evidence, 'evidence_id', '$.evidence', errors);
    collectUnique(record.availability, 'availability_id', '$.availability', errors);
    collectUnique(record.consideration, 'consideration_id', '$.consideration', errors);

    asArray(record.intelligence_resources).forEach((resource, index) => {
      asArray(resource && resource.actor_refs).forEach((ref, refIndex) => {
        if (!actorIds.has(ref)) {
          errors.push(problem('dangling_actor_ref', `Unknown actor reference '${ref}'.`, `$.intelligence_resources[${index}].actor_refs[${refIndex}]`));
        }
      });
    });

    asArray(record.availability).forEach((claim, index) => {
      if (!isObject(claim)) return;
      if (!resourceIds.has(claim.resource_id)) {
        errors.push(problem('dangling_resource_ref', `Availability references unknown resource '${claim.resource_id}'.`, `$.availability[${index}].resource_id`));
      }
      if (subjectId && claim.subject_id !== subjectId) {
        errors.push(problem('availability_subject_mismatch', `availability.subject_id must match subject.id '${subjectId}'.`, `$.availability[${index}].subject_id`));
      }
      asArray(claim.evidence_refs).forEach((ref, refIndex) => {
        if (!evidenceIds.has(ref)) {
          errors.push(problem('dangling_evidence_ref', `Unknown evidence reference '${ref}'.`, `$.availability[${index}].evidence_refs[${refIndex}]`));
        }
      });
    });

    asArray(record.consideration).forEach((item, index) => {
      if (!isObject(item)) return;
      if (!resourceIds.has(item.resource_id)) {
        errors.push(problem('dangling_resource_ref', `Consideration references unknown resource '${item.resource_id}'.`, `$.consideration[${index}].resource_id`));
      }
      asArray(item.evidence_refs).forEach((ref, refIndex) => {
        if (!evidenceIds.has(ref)) {
          errors.push(problem('dangling_evidence_ref', `Unknown evidence reference '${ref}'.`, `$.consideration[${index}].evidence_refs[${refIndex}]`));
        }
      });
    });

    asArray(record.alternatives).forEach((item, index) => {
      asArray(item && item.evidence_refs).forEach((ref, refIndex) => {
        if (!evidenceIds.has(ref)) {
          errors.push(problem('dangling_evidence_ref', `Unknown evidence reference '${ref}'.`, `$.alternatives[${index}].evidence_refs[${refIndex}]`));
        }
      });
    });

    asArray(record.authority).forEach((item, index) => {
      if (!isObject(item)) return;
      if (!actorIds.has(item.actor_id)) {
        errors.push(problem('dangling_actor_ref', `Authority references unknown actor '${item.actor_id}'.`, `$.authority[${index}].actor_id`));
      }
    });

    if (isObject(record.decision_boundary)) {
      const cutoff = parseTimestamp(record.decision_boundary.knowledge_cutoff);
      const closed = parseTimestamp(record.decision_boundary.closed_at);
      if (cutoff !== null && closed !== null && cutoff > closed) {
        errors.push(problem('hindsight_injection', 'knowledge_cutoff must not occur after closed_at.', '$.decision_boundary.knowledge_cutoff'));
      }
      if (record.decision_boundary.knowledge_cutoff && cutoff === null) {
        warnings.push(problem('timestamp_unparsed', 'knowledge_cutoff is present but could not be parsed as a timestamp.', '$.decision_boundary.knowledge_cutoff'));
      }
      if (record.decision_boundary.closed_at && closed === null) {
        warnings.push(problem('timestamp_unparsed', 'closed_at is present but could not be parsed as a timestamp.', '$.decision_boundary.closed_at'));
      }
    }

    if (isObject(record.outcome) && record.outcome.status === 'not_realized_after_intervention' && !record.outcome.intervention) {
      errors.push(problem('missing_intervention', 'not_realized_after_intervention requires an intervention object.', '$.outcome.intervention'));
    }

    if (TRACEABLE_PROFILES.has(record.profile)) {
      if (asArray(record.availability).length === 0) errors.push(problem('traceability', `${record.profile} profile requires at least one availability claim.`, '$.availability'));
      if (asArray(record.consideration).length === 0) errors.push(problem('traceability', `${record.profile} profile requires at least one consideration record.`, '$.consideration'));
      if (asArray(record.evidence).length === 0) errors.push(problem('traceability', `${record.profile} profile requires evidence.`, '$.evidence'));
      if (!isObject(record.contestability) || record.contestability.channel_available !== true) {
        errors.push(problem('contestability', `${record.profile} profile requires an available contestability channel.`, '$.contestability.channel_available'));
      }
    }

    if (VERIFIABLE_PROFILES.has(record.profile)) {
      if (!isObject(record.artifact_binding) || record.artifact_binding.status === 'not_bound') {
        errors.push(problem('artifact_binding', `${record.profile} profile cannot use artifact_binding.status = not_bound.`, '$.artifact_binding.status'));
      }
    }

    const boundStatus = isObject(record.artifact_binding) ? record.artifact_binding.status : 'unknown';
    const summary = {
      actors: asArray(record.actors).length,
      resources: asArray(record.intelligence_resources).length,
      availability_claims: asArray(record.availability).length,
      consideration_records: asArray(record.consideration).length,
      evidence_items: asArray(record.evidence).length,
      profile: record.profile || 'unknown',
      artifact_binding: boundStatus || 'unknown'
    };

    return { valid: errors.length === 0, errors, warnings, summary };
  }

  return { validatePoAI };
});
