'use strict';

const cp = require('child_process');
const path = require('path');

const resolver = path.join(__dirname, 'resolve-protocol.js');

function run(args) {
  return cp.spawnSync(process.execPath, [resolver, ...args], {
    encoding: 'utf8'
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ok = run(['CCRP', '0.1']);
assert(ok.status === 0, `Expected CCRP@0.1 to resolve: ${ok.stderr}`);
const resolved = JSON.parse(ok.stdout);
assert(resolved.logical_uri === 'urn:uu-aap:protocol:ccrp:0.1', 'Unexpected logical URI');
assert(resolved.release.tag === 'poai-ccrp-v0.1', 'Unexpected release tag');
assert(resolved.release.commit === '2c98d34ebfb5e86491bffb29a27e5a55b4db707e', 'Unexpected release commit');
assert(resolved.release.tree === '52207c5c0c1b516462221a47a3791ad97b02cc5f', 'Unexpected release tree');
assert(resolved.release.manifest.git_blob_sha === '78250d9dbfe08b5f340c05ac821fbae4ef263a86', 'Unexpected release manifest blob');

const unknownVersion = run(['CCRP', '9.9']);
assert(unknownVersion.status !== 0, 'Unknown exact version must fail closed');
assert(unknownVersion.stderr.includes('No exact registry entry'), 'Unknown version must explain exact-resolution failure');

const lowerCaseId = run(['ccrp', '0.1']);
assert(lowerCaseId.status !== 0, 'Protocol ID matching must remain exact');

const latestVersion = run(['CCRP', 'latest']);
assert(latestVersion.status !== 0, 'latest version must not resolve');
assert(latestVersion.stderr.includes('Mutable latest resolution is not defined'), 'latest rejection must be explicit');

const missingArgument = run(['CCRP']);
assert(missingArgument.status !== 0, 'Missing exact version must fail');

console.log(JSON.stringify({
  resolver_vectors: 5,
  exact_resolution: 'passed',
  fail_closed_vectors: 'passed'
}, null, 2));
