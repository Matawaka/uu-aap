'use strict';

// Native JSON grammar plus decoded duplicate-key and structural checks.
// JSON is data; no source text or caller-selected code is evaluated.
const { preflight, limits, AgentError } = require('./agent-core.js');

function parseRequest(raw) {
  if (Buffer.byteLength(raw) > limits.max_request_bytes) throw new AgentError('REQUEST_LIMIT', 'Request byte limit exceeded.');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    const containers = [];
    for (let at = 0; at < text.length;) {
      const c = text[at];
      if (c === '"') {
        const start = at++;
        while (at < text.length) {
          const x = text[at++];
          if (x === '\\') { at++; continue; }
          if (x === '"') break;
        }
        const top = containers.at(-1);
        if (top?.object && top.keyExpected) {
          const key = JSON.parse(text.slice(start, at));
          if (top.keys.has(key)) throw new AgentError('INVALID_JSON', 'Duplicate decoded JSON key.');
          top.keys.add(key); top.keyExpected = false;
        }
      } else {
        if (c === '{' || c === '[') {
          containers.push({ object: c === '{', keyExpected: c === '{', keys: new Set() });
          if (containers.length > limits.max_depth) throw new AgentError('REQUEST_LIMIT', 'JSON depth limit exceeded.');
        } else if (c === '}' || c === ']') containers.pop();
        else if (c === ',' && containers.at(-1)?.object) containers.at(-1).keyExpected = true;
        at++;
      }
    }
    const value = JSON.parse(text);
    preflight(value);
    return value;
  } catch (error) {
    if (error instanceof AgentError) throw error;
    throw new AgentError('INVALID_JSON', 'Request is not strict UTF-8 JSON.');
  }
}

module.exports = { parseRequest };
