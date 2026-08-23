'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'likelihood', 'confidence_score',
  'readiness_score', 'responsibility_score', 'rating', 'weight'
]);

function assert(value, message) { if (!value) throw new Error(message); }
function uniqById(values) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    assert(value && typeof value.component_id === 'string' && value.component_id.length > 0,
      'KONTUR Server Health: component_id required');
    assert(!seen.has(value.component_id), `KONTUR Server Health: duplicate component ${value.component_id}`);
    seen.add(value.component_id);
    out.push({
      component_id: value.component_id,
      status: value.status,
      evidence_ref: value.evidence_ref
    });
  }
  return out.sort((a, b) => a.component_id.localeCompare(b.component_id));
}
function hasScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasScalarKey);
  return Object.entries(value).some(([key, child]) => SCALAR_KEYS.has(key) || hasScalarKey(child));
}
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}

async function observeServerHealth({ systemId, serverInstanceId, observedAt, components }) {
  assert(typeof systemId === 'string' && systemId.startsWith('urn:uu-aap:kontur:system:'),
    'KONTUR Server Health: valid system ID required');
  assert(typeof serverInstanceId === 'string' && serverInstanceId.startsWith('urn:uu-aap:kontur:server:'),
    'KONTUR Server Health: valid server instance ID required');
  assert(Number.isFinite(Date.parse(observedAt)), 'KONTUR Server Health: invalid observed_at');
  assert(!hasScalarKey(components), 'KONTUR Server Health: scalar readiness/responsibility scores prohibited');

  const normalized = uniqById(components);
  assert(normalized.length > 0, 'KONTUR Server Health: at least one component required');
  for (const component of normalized) {
    assert(['pass', 'degraded', 'fail'].includes(component.status),
      `KONTUR Server Health: invalid status for ${component.component_id}`);
    assert(typeof component.evidence_ref === 'string' && component.evidence_ref.length > 0,
      `KONTUR Server Health: evidence_ref required for ${component.component_id}`);
  }

  const statuses = normalized.map((item) => item.status);
  const status = statuses.includes('fail') ? 'critical' : statuses.includes('degraded') ? 'degraded' : 'healthy';
  const seed = `${systemId}|${serverInstanceId}|${observedAt}|${await digestJson(normalized)}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './kontur-server-health-observation.schema.json',
    artifact_type: 'KONTURServerHealthObservation',
    artifact_version: '0.1',
    observation_id: `urn:uu-aap:kontur:server-health:${idHash.slice(0, 24)}`,
    system_id: systemId,
    server_instance_id: serverInstanceId,
    observed_at: observedAt,
    status,
    components: normalized,
    claims: {
      server_health_observed: true,
      global_readiness_established: false,
      execution_authority_granted: false,
      responsibility_accepted: false,
      kernel_activated: false,
      legal_responsibility_determined: false,
      moral_blame_assigned: false,
      truth_certified: false,
      universal_canonicality_established: false
    }
  };
}

module.exports = { digestJson, observeServerHealth };
