'use strict';

const { handle, errorResponse, limits, AgentError } = require('./agent-core.js');
const { parseRequest } = require('./json-input.js');

async function main() {
  let response;
  try {
    if (process.argv.length !== 2) throw new AgentError('INVALID_REQUEST', 'Use one JSON document on stdin; no command arguments.');
    const chunks = []; let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > limits.max_request_bytes) throw new AgentError('REQUEST_LIMIT', 'Request byte limit exceeded.');
      chunks.push(chunk);
    }
    response = handle(parseRequest(Buffer.concat(chunks)));
  } catch (error) {
    response = errorResponse(null, error instanceof AgentError ? error.code : 'INTERNAL_ERROR',
      error instanceof AgentError ? error.message : 'Internal CLI error.');
  }
  process.stdout.write(JSON.stringify(response) + '\n');
  process.exitCode = response.execution_status === 'COMPLETED' ? 0 : 2;
}

if (require.main === module) void main();
