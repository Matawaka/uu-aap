#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { commitTerminalJson } = require("./terminal-state-commit");

function retryError(code) {
  const error = new Error(`synthetic ${code}`);
  error.code = code;
  return error;
}

function initialState(file) {
  const value = { status: "finalizing", game_start_allowed: false };
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return fs.readFileSync(file);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "kontur-terminal-state-commit-"));
try {
  const transientRenamePath = path.join(root, "transient-rename.json");
  initialState(transientRenamePath);
  let transientRenameFailures = 3;
  let transientRenameWaits = 0;
  const stopped = { status: "stopped", game_start_allowed: false, tail_catchup_complete: true };
  const renameReceipt = commitTerminalJson(transientRenamePath, stopped, {
    maxRenameAttempts: 5,
    retryDelayMs: 0,
    renameSync(source, target) {
      if (transientRenameFailures > 0) {
        transientRenameFailures -= 1;
        throw retryError("EPERM");
      }
      fs.renameSync(source, target);
    },
    wait() { transientRenameWaits += 1; },
  });
  assert.strictEqual(renameReceipt.fsync_completed, true);
  assert.strictEqual(renameReceipt.rename_attempts, 4);
  assert.strictEqual(renameReceipt.verification_attempts, 1);
  assert.strictEqual(renameReceipt.exact_payload_verified, true);
  assert.strictEqual(transientRenameWaits, 3);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(transientRenamePath, "utf8")), stopped);

  const transientReadPath = path.join(root, "transient-read.json");
  initialState(transientReadPath);
  let transientReadFailures = 2;
  let transientReadWaits = 0;
  const readReceipt = commitTerminalJson(transientReadPath, stopped, {
    maxVerificationAttempts: 3,
    retryDelayMs: 0,
    readFileSync(file, encoding) {
      if (transientReadFailures > 0) {
        transientReadFailures -= 1;
        throw retryError("EACCES");
      }
      return fs.readFileSync(file, encoding);
    },
    wait() { transientReadWaits += 1; },
  });
  assert.strictEqual(readReceipt.rename_attempts, 1);
  assert.strictEqual(readReceipt.verification_attempts, 3);
  assert.strictEqual(transientReadWaits, 2);

  const persistentPath = path.join(root, "persistent.json");
  const persistentBefore = initialState(persistentPath);
  let persistentWaits = 0;
  assert.throws(
    () => commitTerminalJson(persistentPath, stopped, {
      maxRenameAttempts: 3,
      retryDelayMs: 0,
      renameSync() { throw retryError("EBUSY"); },
      wait() { persistentWaits += 1; },
    }),
    (error) => error.code === "EBUSY",
  );
  assert.strictEqual(persistentWaits, 2);
  assert.deepStrictEqual(fs.readFileSync(persistentPath), persistentBefore);

  const nonRetryablePath = path.join(root, "non-retryable.json");
  const nonRetryableBefore = initialState(nonRetryablePath);
  let nonRetryableWaits = 0;
  assert.throws(
    () => commitTerminalJson(nonRetryablePath, stopped, {
      maxRenameAttempts: 5,
      retryDelayMs: 0,
      renameSync() { throw retryError("ENOSPC"); },
      wait() { nonRetryableWaits += 1; },
    }),
    (error) => error.code === "ENOSPC",
  );
  assert.strictEqual(nonRetryableWaits, 0);
  assert.deepStrictEqual(fs.readFileSync(nonRetryablePath), nonRetryableBefore);

  const leftovers = fs.readdirSync(root).filter((name) => name.includes(".terminal-") && name.endsWith(".tmp"));
  assert.deepStrictEqual(leftovers, []);
  assert.throws(
    () => commitTerminalJson(path.join(root, "invalid-bound.json"), stopped, { maxRenameAttempts: 0 }),
    /outside bounded range/,
  );

  console.log(
    "KONTUR terminal state commit: PASS; transient_rename_failures=3; "
    + "transient_verification_failures=2; persistent_retryable_fail_closed=1; "
    + "non_retryable_fail_closed=1; temporary_files_remaining=0; fsync_and_exact_verify=true",
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
