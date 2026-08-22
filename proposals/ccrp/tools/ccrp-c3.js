'use strict';

const crypto = require('crypto');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  throw new Error(`unsupported canonical value type: ${typeof value}`);
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalize(value), 'utf8').digest('hex')}`;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function canonicalUniqueSorted(values) {
  const byCanonical = new Map();
  for (const value of values) byCanonical.set(canonicalize(value), clone(value));
  return [...byCanonical.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}

function decodePointer(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.length < 2) throw new Error('invalid_json_pointer');
  const segments = path.slice(1).split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (segments.some((segment) => segment.length === 0)) throw new Error('empty_json_pointer_segment');
  return segments;
}

function getAtPath(root, path) {
  let cursor = root;
  for (const segment of decodePointer(path)) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function setAtPath(root, path, value) {
  const segments = decodePointer(path);
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) cursor[segment] = {};
    if (cursor[segment] === null || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
      throw new Error(`non_object_parent:${segments.slice(0, index + 1).join('/')}`);
    }
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = clone(value);
}

function pathsOverlap(left, right) {
  if (left === right) return true;
  return left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function operationBoundaryErrors(operation) {
  const errors = [];
  if (!operation || operation.artifact_type !== 'CCRPCollaborationOperation') errors.push('not_ccrp_collaboration_operation');
  if (!operation || operation.conformance_level !== 'CCRP/C3') errors.push('wrong_conformance_level');
  if (!operation || typeof operation.operation_id !== 'string') errors.push('missing_operation_id');
  if (!operation || !operation.context_ref) errors.push('missing_context_ref');
  if (!operation || typeof operation.target !== 'string') errors.push('missing_target');
  if (!operation || typeof operation.base_revision !== 'string') errors.push('missing_base_revision');
  if (!operation || !['commutative', 'mergeable', 'exclusive'].includes(operation.concurrency_class)) errors.push('invalid_concurrency_class');
  if (!operation || typeof operation.idempotency_key !== 'string') errors.push('missing_idempotency_key');
  if (!operation || !Array.isArray(operation.mutations) || operation.mutations.length === 0) errors.push('missing_mutations');
  if (!operation || !operation.claims || operation.claims.context_bound !== true) errors.push('context_not_bound');
  if (!operation || !operation.claims || operation.claims.source_intent_preserved !== true) errors.push('source_intent_not_preserved');
  if (operation && Array.isArray(operation.mutations)) {
    for (const mutation of operation.mutations) {
      try { decodePointer(mutation && mutation.path); } catch (error) { errors.push(`invalid_mutation_path:${error.message}`); }
      if (!mutation || !['set', 'set_add'].includes(mutation.kind)) errors.push('invalid_mutation_kind');
      if (mutation && mutation.kind === 'set_add' && (!Array.isArray(mutation.values) || mutation.values.length === 0)) errors.push('set_add_requires_values');
    }
  }
  return uniqueSorted(errors);
}

function intentProjection(operation) {
  const ref = operation && operation.context_ref || {};
  return `${ref.intent_id || ''}|${ref.intent_revision || ''}|${ref.intent_digest || ''}`;
}

function commonOrMultiple(values) {
  const unique = uniqueSorted(values);
  return unique.length === 1 ? unique[0] : `multiple:${unique.join('|')}`;
}

function resultId({ decision, baseRevision, inputDigest, operationRefs }) {
  const seed = `${decision}|${baseRevision}|${inputDigest}|${operationRefs.join('|')}`;
  return `urn:ccrp:reconciliation-result:${crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 24)}`;
}

function buildResult({
  decision,
  operations,
  inputState,
  evaluatedAt,
  reasonCodes = [],
  conflictPaths = [],
  projection = null
}) {
  const operationRefs = uniqueSorted(operations.map((operation) => operation.operation_id));
  const contextRefs = uniqueSorted(operations.map((operation) => operation.context_ref && operation.context_ref.context_id).filter(Boolean));
  const baseRevision = commonOrMultiple(operations.map((operation) => operation.base_revision));
  const inputDigest = digest(inputState);
  const merged = decision === 'merge';
  return {
    artifact_type: 'CCRPReconciliationResult',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C3',
    result_id: resultId({ decision, baseRevision, inputDigest, operationRefs }),
    evaluated_at: evaluatedAt || new Date().toISOString(),
    base_revision: baseRevision,
    input_state_digest: inputDigest,
    source_operation_refs: operationRefs,
    source_context_refs: contextRefs,
    deterministic_operation_order: operationRefs,
    decision,
    reason_codes: uniqueSorted(reasonCodes),
    conflict_paths: uniqueSorted(conflictPaths),
    source_operations_preserved: true,
    provisional_converged_projection: merged ? clone(projection) : null,
    provisional_converged_projection_digest: merged ? digest(projection) : null,
    claims: {
      reconciliation_checked: true,
      deterministic_convergence_established: merged,
      coordination_relative_convergence_established: merged,
      human_resolution_required: decision === 'human_resolution_required',
      execution_admitted: false,
      materialization_permitted: false,
      canonical_state_established: false,
      poai_authority_established: false,
      policy_relative_canonicality_established: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    }
  };
}

function reconcileC3({ operations, inputState, evaluatedAt }) {
  const source = Array.isArray(operations) ? operations : [];
  if (source.length < 2) throw new Error('C3 reconciliation requires at least two operations');
  const ordered = [...source].sort((a, b) => String(a.operation_id).localeCompare(String(b.operation_id)));

  const boundaryErrors = uniqueSorted(ordered.flatMap(operationBoundaryErrors));
  if (boundaryErrors.length > 0) {
    return buildResult({ decision: 'reject', operations: ordered, inputState, evaluatedAt, reasonCodes: boundaryErrors });
  }

  if (ordered.some((operation) => operation.concurrency_class === 'exclusive')) {
    return buildResult({
      decision: 'reject',
      operations: ordered,
      inputState,
      evaluatedAt,
      reasonCodes: ['exclusive_operation_requires_c2_fencing']
    });
  }

  if (new Set(ordered.map((operation) => operation.idempotency_key)).size !== ordered.length) {
    return buildResult({
      decision: 'reject',
      operations: ordered,
      inputState,
      evaluatedAt,
      reasonCodes: ['duplicate_idempotency_key']
    });
  }

  if (new Set(ordered.map((operation) => operation.target)).size !== 1) {
    return buildResult({ decision: 'reject', operations: ordered, inputState, evaluatedAt, reasonCodes: ['target_mismatch'] });
  }

  if (new Set(ordered.map(intentProjection)).size !== 1) {
    return buildResult({ decision: 'reject', operations: ordered, inputState, evaluatedAt, reasonCodes: ['intent_binding_mismatch'] });
  }

  if (new Set(ordered.map((operation) => operation.base_revision)).size !== 1) {
    return buildResult({
      decision: 'hold',
      operations: ordered,
      inputState,
      evaluatedAt,
      reasonCodes: ['base_revision_mismatch_rebase_required']
    });
  }

  const entries = [];
  for (const operation of ordered) {
    for (const mutation of operation.mutations) entries.push({ operation, mutation });
  }

  const paths = uniqueSorted(entries.map((entry) => entry.mutation.path));
  const overlappingDifferentPaths = [];
  for (let left = 0; left < paths.length; left += 1) {
    for (let right = left + 1; right < paths.length; right += 1) {
      if (pathsOverlap(paths[left], paths[right])) overlappingDifferentPaths.push(paths[left], paths[right]);
    }
  }
  if (overlappingDifferentPaths.length > 0) {
    return buildResult({
      decision: 'human_resolution_required',
      operations: ordered,
      inputState,
      evaluatedAt,
      reasonCodes: ['semantic_path_overlap'],
      conflictPaths: overlappingDifferentPaths
    });
  }

  const byPath = new Map();
  for (const entry of entries) {
    const list = byPath.get(entry.mutation.path) || [];
    list.push(entry);
    byPath.set(entry.mutation.path, list);
  }

  const conflictPaths = [];
  for (const [path, pathEntries] of byPath.entries()) {
    const kinds = new Set(pathEntries.map((entry) => entry.mutation.kind));
    if (kinds.size > 1) {
      conflictPaths.push(path);
      continue;
    }
    if (kinds.has('set')) {
      const values = new Set(pathEntries.map((entry) => canonicalize(entry.mutation.value)));
      if (values.size > 1) conflictPaths.push(path);
    }
  }
  if (conflictPaths.length > 0) {
    return buildResult({
      decision: 'human_resolution_required',
      operations: ordered,
      inputState,
      evaluatedAt,
      reasonCodes: ['semantic_write_conflict'],
      conflictPaths
    });
  }

  const projection = clone(inputState);
  try {
    for (const path of [...byPath.keys()].sort()) {
      const pathEntries = byPath.get(path);
      const kind = pathEntries[0].mutation.kind;
      if (kind === 'set') {
        setAtPath(projection, path, pathEntries[0].mutation.value);
      } else {
        const existing = getAtPath(projection, path);
        if (existing !== undefined && !Array.isArray(existing)) {
          return buildResult({
            decision: 'human_resolution_required',
            operations: ordered,
            inputState,
            evaluatedAt,
            reasonCodes: ['set_add_target_not_array'],
            conflictPaths: [path]
          });
        }
        const additions = pathEntries.flatMap((entry) => entry.mutation.values);
        setAtPath(projection, path, canonicalUniqueSorted([...(existing || []), ...additions]));
      }
    }
  } catch (error) {
    return buildResult({
      decision: 'human_resolution_required',
      operations: ordered,
      inputState,
      evaluatedAt,
      reasonCodes: [`mutation_application_conflict:${error.message}`],
      conflictPaths: paths
    });
  }

  return buildResult({ decision: 'merge', operations: ordered, inputState, evaluatedAt, projection });
}

const FALSE_C3_ASSURANCE_CLAIMS = [
  'execution_admitted',
  'materialization_permitted',
  'canonical_state_established',
  'poai_authority_established',
  'policy_relative_canonicality_established',
  'universal_canonicality_established',
  'truth_certified',
  'causal_proof_certified',
  'legal_responsibility_determined',
  'moral_correctness_established',
  'legal_effect_established',
  'poai_v_conformance_established'
];

function validateC3Boundary(result) {
  const errors = [];
  if (!result || result.artifact_type !== 'CCRPReconciliationResult') errors.push('not_ccrp_reconciliation_result');
  if (!result || result.conformance_level !== 'CCRP/C3') errors.push('wrong_conformance_level');
  if (!result || result.source_operations_preserved !== true) errors.push('source_operations_not_preserved');
  if (!result || !result.claims || result.claims.reconciliation_checked !== true) errors.push('reconciliation_not_checked');
  for (const claim of FALSE_C3_ASSURANCE_CLAIMS) {
    if (!result || !result.claims || result.claims[claim] !== false) errors.push(`c3_claim_must_remain_false:${claim}`);
  }
  if (result && result.decision === 'merge') {
    if (!result.claims || result.claims.deterministic_convergence_established !== true) errors.push('merge_requires_deterministic_convergence');
    if (!result.claims || result.claims.coordination_relative_convergence_established !== true) errors.push('merge_requires_coordination_convergence');
    if (!result.provisional_converged_projection || !result.provisional_converged_projection_digest) errors.push('merge_requires_provisional_projection');
    if (result.claims && result.claims.human_resolution_required !== false) errors.push('merge_must_not_require_human_resolution');
  } else if (result) {
    if (!result.claims || result.claims.deterministic_convergence_established !== false) errors.push('non_merge_must_not_claim_convergence');
    if (!result.claims || result.claims.coordination_relative_convergence_established !== false) errors.push('non_merge_must_not_claim_coordination_convergence');
    if (result.provisional_converged_projection !== null || result.provisional_converged_projection_digest !== null) errors.push('non_merge_must_not_emit_converged_projection');
  }
  if (result && result.decision === 'human_resolution_required' && (!result.claims || result.claims.human_resolution_required !== true)) {
    errors.push('human_resolution_decision_requires_claim');
  }
  return uniqueSorted(errors);
}

module.exports = {
  FALSE_C3_ASSURANCE_CLAIMS,
  canonicalize,
  digest,
  operationBoundaryErrors,
  reconcileC3,
  validateC3Boundary
};
