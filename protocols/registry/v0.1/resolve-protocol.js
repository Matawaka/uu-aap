'use strict';

const fs = require('fs');
const path = require('path');

const registry = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf8')
);

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  fail('Usage: node resolve-protocol.js <protocol_id> <exact_version>');
}

const [protocolId, version] = args;

if (protocolId === 'latest' || version === 'latest') {
  fail('Mutable latest resolution is not defined by registry v0.1');
}

const matches = registry.entries.filter(
  (entry) => entry.protocol_id === protocolId && entry.version === version
);

if (matches.length === 0) {
  fail(`No exact registry entry for ${protocolId}@${version}`);
}

if (matches.length !== 1) {
  fail(`Ambiguous registry result for ${protocolId}@${version}`);
}

const entry = matches[0];

process.stdout.write(JSON.stringify({
  logical_uri: entry.logical_uri,
  protocol_id: entry.protocol_id,
  version: entry.version,
  status: entry.status,
  semantic_source_status: entry.semantic_source_status,
  release: {
    tag: entry.release_tag,
    commit: entry.release_commit,
    tree: entry.release_tree,
    manifest: {
      path: entry.release_manifest_path,
      git_blob_sha: entry.release_manifest_git_blob_sha
    }
  },
  publication_checkpoint: {
    path: entry.publication_checkpoint_path,
    git_blob_sha: entry.publication_checkpoint_git_blob_sha
  },
  conformance_levels: entry.conformance_levels,
  resolution_policy: 'exact_protocol_id_and_version_only'
}, null, 2) + '\n');
