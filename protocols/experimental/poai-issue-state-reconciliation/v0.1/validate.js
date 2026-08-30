const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../../../../');
const closure = JSON.parse(fs.readFileSync(path.join(__dirname, 'closure.json'), 'utf8'));

function blobSha(buf) {
  const header = Buffer.from(`blob ${buf.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, buf])).digest('hex');
}
function readJson(rel) {
  const p = path.join(root, rel);
  const bytes = fs.readFileSync(p);
  return { json: JSON.parse(bytes.toString('utf8')), sha: blobSha(bytes) };
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

assert(closure.type === 'LegacyPoAIIssueStateClosure', 'unexpected closure type');
assert(closure.version === '0.1', 'unexpected version');
assert(closure.issue === '#765', 'wrong authorization issue');
assert(closure.origin_frontier === '5d4b3d878e0872be31ad282d50bd17cea052cf71', 'origin frontier drift');

const source = readJson(closure.source_map.path);
const resolution = readJson(closure.resolution_overlay.path);
assert(source.sha === closure.source_map.blob_sha, 'source map byte binding mismatch');
assert(resolution.sha === closure.resolution_overlay.blob_sha, 'resolution overlay byte binding mismatch');

const expectedIssues = ['#84', '#88', '#93', '#104'];
assert(JSON.stringify(closure.closure_candidates.map(x => x.issue)) === JSON.stringify(expectedIssues), 'closure candidate set/order drift');
assert(new Set(closure.closure_candidates.map(x => x.issue)).size === expectedIssues.length, 'duplicate closure candidate');

for (const candidate of closure.closure_candidates) {
  const prior = source.json.entries.find(e => e.family === candidate.family);
  assert(prior, `missing prior family ${candidate.family}`);
  assert(prior.relation === candidate.required_prior_relation, `prior relation drift for ${candidate.family}`);
  assert(Array.isArray(prior.legacy_issues) && prior.legacy_issues.length === 1 && prior.legacy_issues[0] === candidate.issue, `legacy issue binding drift for ${candidate.family}`);

  const resolved = resolution.json.resolved_entries.find(e => e.family === candidate.family);
  assert(resolved, `missing resolution family ${candidate.family}`);
  assert(resolved.prior_relation === candidate.required_prior_relation, `resolution prior relation drift for ${candidate.family}`);
  assert(resolved.resolved_relation === candidate.required_resolution_relation, `resolution relation drift for ${candidate.family}`);
  assert(Array.isArray(resolved.current_refs) && resolved.current_refs.length > 0, `missing successor refs for ${candidate.family}`);
  for (const rel of resolved.current_refs) {
    assert(fs.existsSync(path.join(root, rel)), `missing successor path ${rel}`);
  }
}

assert(resolution.json.unresolved_successor_families.length === 0, 'successor family remains unresolved');
assert(closure.closure_action.state === 'closed' && closure.closure_action.state_reason === 'completed', 'closure action drift');
assert(closure.closure_action.authorized_only_after_merged_green_pr === true, 'pre-merge closure authority forbidden');
assert(closure.closure_action.preserve_issue_body === true, 'issue body must be preserved');
assert(closure.closure_action.preserve_historical_artifacts === true, 'historical artifacts must be preserved');

for (const [claim, value] of Object.entries(closure.non_claims)) {
  assert(value === false, `forbidden claim enabled: ${claim}`);
}
assert(closure.non_claims.closure_of_unlisted_issues === false, 'unlisted issue closure must remain forbidden');
assert(source.json.non_effects.automatic_issue_closure_authorized === false, 'historical source must not authorize issue closure');
assert(resolution.json.non_effects.historical_issue_state_inferred === false, 'resolution overlay must not infer issue state');
assert(resolution.json.non_effects.external_effect_authority_created === false, 'resolution overlay authority drift');

console.log('PASS legacy PoAI issue-state reconciliation v0.1');
