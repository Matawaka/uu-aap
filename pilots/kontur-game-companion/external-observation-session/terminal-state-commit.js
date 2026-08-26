"use strict";

const crypto = require("crypto");
const fs = require("fs");

const RETRYABLE_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);
const DEFAULT_RENAME_ATTEMPTS = 41;
const DEFAULT_VERIFICATION_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 25;

class TerminalStateCommitError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "TerminalStateCommitError";
    this.code = code;
  }
}

function boundedInteger(value, fallback, minimum, maximum, name) {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < minimum || result > maximum) {
    throw new TypeError(`${name} outside bounded range`);
  }
  return result;
}

function defaultWait(milliseconds) {
  if (milliseconds === 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function retryable(error) {
  return error && RETRYABLE_CODES.has(error.code);
}

function commitTerminalJson(file, value, options = {}) {
  const renameAttemptsLimit = boundedInteger(
    options.maxRenameAttempts,
    DEFAULT_RENAME_ATTEMPTS,
    1,
    100,
    "maxRenameAttempts",
  );
  const verificationAttemptsLimit = boundedInteger(
    options.maxVerificationAttempts,
    DEFAULT_VERIFICATION_ATTEMPTS,
    1,
    20,
    "maxVerificationAttempts",
  );
  const retryDelayMs = boundedInteger(
    options.retryDelayMs,
    DEFAULT_RETRY_DELAY_MS,
    0,
    100,
    "retryDelayMs",
  );
  const renameSync = options.renameSync ?? fs.renameSync;
  const readFileSync = options.readFileSync ?? fs.readFileSync;
  const wait = options.wait ?? defaultWait;
  if (typeof renameSync !== "function" || typeof readFileSync !== "function" || typeof wait !== "function") {
    throw new TypeError("terminal state commit functions required");
  }

  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${file}.terminal-${process.pid}-${crypto.randomBytes(8).toString("hex")}.tmp`;
  let descriptor = null;
  let renamed = false;
  let renameAttempts = 0;
  let verificationAttempts = 0;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, payload, { encoding: "utf8" });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;

    while (!renamed) {
      renameAttempts += 1;
      try {
        renameSync(temporary, file);
        renamed = true;
      } catch (error) {
        if (!retryable(error) || renameAttempts >= renameAttemptsLimit) throw error;
        wait(retryDelayMs);
      }
    }

    while (verificationAttempts < verificationAttemptsLimit) {
      verificationAttempts += 1;
      try {
        const observed = readFileSync(file, "utf8");
        if (observed !== payload) {
          throw new TerminalStateCommitError(
            "terminal state exact payload verification failed",
            "ESTATEVERIFY",
          );
        }
        return {
          fsync_completed: true,
          rename_attempts: renameAttempts,
          verification_attempts: verificationAttempts,
          exact_payload_verified: true,
        };
      } catch (error) {
        if (!retryable(error) || verificationAttempts >= verificationAttemptsLimit) throw error;
        wait(retryDelayMs);
      }
    }
    throw new TerminalStateCommitError("terminal state verification unavailable", "ESTATEVERIFY");
  } finally {
    if (descriptor !== null) {
      try { fs.closeSync(descriptor); } catch (_error) { /* best-effort descriptor close */ }
    }
    if (!renamed) {
      try { fs.unlinkSync(temporary); } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
}

module.exports = {
  DEFAULT_RENAME_ATTEMPTS,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_VERIFICATION_ATTEMPTS,
  RETRYABLE_CODES,
  TerminalStateCommitError,
  commitTerminalJson,
};
