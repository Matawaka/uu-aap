'use strict';

const fs = require('fs');

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch: expected=${expected} actual=${actual}`);
}

function requireArrayEqual(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    throw new Error(`${label} length mismatch`);
  }
  for (let i = 0; i < expected.length; i += 1) requireEqual(actual[i], expected[i], `${label}[${i}]`);
}

function buildObservation(profile, mainRef, commit, tagRef, tagObject) {
  const mainSha = mainRef?.object?.sha;
  requireEqual(mainSha, profile.workbench_main_commit, 'workbench main');
  requireEqual(mainRef?.object?.type, 'commit', 'workbench main ref type');
  requireEqual(commit?.sha, profile.workbench_main_commit, 'workbench commit object');
  requireEqual(commit?.tree?.sha, profile.workbench_main_tree, 'workbench main tree');
  requireArrayEqual((commit?.parents || []).map((p) => p.sha), profile.workbench_ordered_parents, 'workbench ordered parents');

  requireEqual(tagRef?.ref, profile.workbench_tag_ref, 'accepted tag ref');
  requireEqual(tagRef?.object?.type, 'tag', 'accepted tag object type');
  requireEqual(tagRef?.object?.sha, profile.workbench_tag_object, 'accepted tag object');
  requireEqual(tagObject?.sha, profile.workbench_tag_object, 'annotated tag object');
  requireEqual(tagObject?.tag, profile.workbench_tag_ref.replace('refs/tags/', ''), 'annotated tag name');
  requireEqual(tagObject?.object?.type, 'commit', 'annotated tag target type');
  requireEqual(tagObject?.object?.sha, profile.workbench_tag_target_commit, 'annotated tag target');
  requireEqual(Boolean(tagObject?.verification?.verified), profile.workbench_tag_signature_verified, 'tag signature verified');
  requireEqual(String(tagObject?.verification?.reason || ''), profile.workbench_tag_signature_reason, 'tag signature reason');
  requireEqual(mainSha, tagObject.object.sha, 'main/tag convergence');

  return {
    schema: profile.source_observation_schema,
    tracking_issue: profile.tracking_issue,
    observed_repository: profile.workbench_repository,
    observed_release: profile.workbench_tag_ref.replace('refs/tags/', ''),
    public_main: {
      commit: mainSha,
      tree: commit.tree.sha,
      ordered_parents: commit.parents.map((p) => p.sha)
    },
    accepted_tag: {
      ref: tagRef.ref,
      object_type: tagRef.object.type,
      tag_object: tagRef.object.sha,
      peeled_commit: tagObject.object.sha,
      signature_verification: {
        verified: Boolean(tagObject.verification?.verified),
        reason: String(tagObject.verification?.reason || '')
      }
    },
    claims: {
      public_main_observed: true,
      accepted_tag_observed: true,
      main_equals_peeled_accepted_tag: true,
      exact_two_parent_order_observed: true,
      annotated_tag_signature_verified: false,
      historical_operator_publication_receipt_reconstructed: false,
      publication_authority_proven: false,
      truth_certified: false,
      c2pa_inclusion_in_original_release_proven: false,
      model_invocation_authority_created: false,
      runtime_execution_authority_created: false,
      response_authority_created: false,
      action_permit_created: false,
      successor_permit_created: false,
      historical_decision_time_availability_proven: false
    },
    automatic_action: false,
    external_mutation_performed: false,
    verdict: profile.source_observation_verdict
  };
}

if (require.main === module) {
  const [profilePath, mainRefPath, commitPath, tagRefPath, tagObjectPath, sourcePath, outputPath] = process.argv.slice(2);
  if (![profilePath, mainRefPath, commitPath, tagRefPath, tagObjectPath, sourcePath, outputPath].every(Boolean)) {
    console.error('usage: node verify-live-workbench.js <profile> <main-ref> <commit> <tag-ref> <tag-object> <source-observation> <output>');
    process.exit(2);
  }
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const observation = buildObservation(
    profile,
    JSON.parse(fs.readFileSync(mainRefPath, 'utf8')),
    JSON.parse(fs.readFileSync(commitPath, 'utf8')),
    JSON.parse(fs.readFileSync(tagRefPath, 'utf8')),
    JSON.parse(fs.readFileSync(tagObjectPath, 'utf8'))
  );
  const bytes = Buffer.from(`${JSON.stringify(observation, null, 2)}\n`);
  const source = fs.readFileSync(sourcePath);
  if (!bytes.equals(source)) throw new Error('live Workbench observation does not reproduce immutable source observation exact bytes');
  fs.writeFileSync(outputPath, bytes);
  process.stdout.write('WORKBENCH_V0552_PUBLIC_RELEASE_LIVE_REOBSERVATION: PASS\n');
}

module.exports = { buildObservation };
