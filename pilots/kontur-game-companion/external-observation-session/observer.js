#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { commitTerminalJson } = require("./terminal-state-commit");

function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("invalid argument pair");
    result[key.slice(2)] = value;
  }
  return result;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value) {
  return crypto.createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function hashFileBounded(file) {
  const digest = crypto.createHash("sha256");
  const buffer = Buffer.alloc(65536);
  const descriptor = fs.openSync(file, "r");
  try {
    let read;
    do {
      read = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (read > 0) digest.update(buffer.subarray(0, read));
    } while (read > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return digest.digest("hex");
}

function ordinaryDirectory(directory) {
  const stat = fs.lstatSync(directory);
  assert(stat.isDirectory(), "ordinary directory required");
  assert(!stat.isSymbolicLink(), "symbolic directory denied");
}

function createJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function writeState(file, value) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  fs.renameSync(temporary, file);
}

const args = parseArgs(process.argv);
for (const required of [
  "game-root", "sidecar", "state-dir", "session-id", "policy",
  "runtime-config", "max-seconds", "control-token",
]) assert(args[required], `missing --${required}`);
assert(/^[a-z0-9-]{12,80}$/.test(args["session-id"]), "bounded session id required");
assert(/^[0-9a-f]{64}$/.test(args["control-token"]), "bounded control token required");

const config = JSON.parse(fs.readFileSync(args["runtime-config"], "utf8"));
assert.strictEqual(config.schema_version, "kontur-game-companion-external-observation-session-runtime-v0.1");
assert.strictEqual(config.runtime_mode, "BOUNDED_EXTERNAL_SANITIZED_LOG_OBSERVATION");
for (const field of [
  "raw_log_persistence", "identifier_value_persistence", "game_launch",
  "game_process_attach", "game_process_memory_read", "network_access",
  "screen_capture", "audio_capture", "microphone_capture", "input_emulation",
  "game_file_modification", "recommendation_generation", "message_send",
  "game_action_execution", "automatic_retry",
]) assert.strictEqual(config[field], false, `runtime non-effect ${field}`);

const gameRoot = fs.realpathSync(args["game-root"]);
const releaseRoot = fs.realpathSync(path.join(gameRoot, "Release"));
const logRoot = fs.realpathSync(path.join(gameRoot, "Logs"));
const sidecarRoot = fs.realpathSync(args.sidecar);
const stateDir = fs.realpathSync(args["state-dir"]);
for (const directory of [gameRoot, releaseRoot, logRoot, sidecarRoot, stateDir]) ordinaryDirectory(directory);
assert.strictEqual(
  sidecarRoot.toLowerCase(),
  path.join(releaseRoot, config.sidecar_directory_name).toLowerCase(),
  "sidecar placement mismatch",
);

const policyPath = fs.realpathSync(args.policy);
assert.strictEqual(path.dirname(policyPath).toLowerCase(), sidecarRoot.toLowerCase(), "policy placement mismatch");
const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
assert.strictEqual(policy.policy_id, "kontur-scrap-mechanic-bounded-log-session-v0.1");
assert.strictEqual(policy.session.manual_start, true);
assert.strictEqual(policy.session.game_launch_by_observer, false);
assert.strictEqual(policy.session.single_active_session, true);
assert.strictEqual(policy.session.automatic_retry, false);
assert.strictEqual(policy.observation.existing_log_bytes_at_start_skipped, true);
assert.strictEqual(policy.observation.new_log_bytes_only, true);
assert.strictEqual(policy.observation.raw_lines_retained_after_classification, false);
assert.strictEqual(policy.observation.numeric_user_identifier_values_retained, false);
assert.strictEqual(policy.unlisted_capability_policy, "denied");
assert.strictEqual(policy.safe_effect, "sanitized_observation_receipts_only");
const maxSeconds = Number(args["max-seconds"]);
assert(Number.isInteger(maxSeconds) && maxSeconds > 0);
assert(maxSeconds <= policy.session.maximum_duration_seconds && maxSeconds <= config.max_duration_seconds);

const statePath = path.join(stateDir, "state.json");
const stopPath = path.join(stateDir, "stop.request");
const sessionsRoot = path.join(sidecarRoot, "sessions");
if (!fs.existsSync(sessionsRoot)) fs.mkdirSync(sessionsRoot);
ordinaryDirectory(sessionsRoot);
const sessionDir = path.join(sessionsRoot, args["session-id"]);
fs.mkdirSync(sessionDir);
ordinaryDirectory(sessionDir);

const startedAt = new Date();
const policySha256 = hashFileBounded(policyPath);
const executablePath = path.join(releaseRoot, "ScrapMechanic.exe");
const executableStat = fs.statSync(executablePath);
assert(executableStat.isFile(), "game executable evidence file required");
const executableSha256 = hashFileBounded(executablePath);
const controlTokenDigest = hashValue({ kind: "KONTUR_OBSERVER_CONTROL_TOKEN_V0.1", token: args["control-token"] });

const terms = ["player", "inventory", "character", "quest", "survival", "world", "save", "error", "warning"];
const lifecycleMatchers = [
  ["player_manager_initialized", /Initializing PlayerManager/i],
  ["world_added", /Added world .* RequestManager/i],
  ["player_loaded", /Loaded player/i],
  ["join_accepted", /Join request accepted/i],
  ["world_removed", /Removed world .* RequestManager/i],
  ["player_manager_cleanup", /Cleaning up PlayerManager/i],
];
const aggregate = {
  bytes_processed: 0,
  lines_processed: 0,
  log_files_observed: new Set(),
  sensitive_identifier_line_count: 0,
  severity_counts: { error: 0, warning: 0 },
  term_counts: Object.fromEntries(terms.map((term) => [term, 0])),
  lifecycle_counts: Object.fromEntries(lifecycleMatchers.map(([name]) => [name, 0])),
};
const offsets = new Map();
const partial = new Map();
const logAliases = new Map();
let activityStartedAt = null;
let lastActivityAt = null;
let lastCheckpointAt = startedAt;
let lastCheckpointLines = 0;
let checkpointSequence = 0;
let finalizing = false;
let finalized = false;
let logWatcher;
let reconcileTimer;
let controlTimer;
let deadlineTimer;
let resourceTimer;
let activitySinceResourceSample = false;
let idleCpuViolations = 0;
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = process.hrtime.bigint();
let lastResource = { idle_total_cpu_percent: 0, working_set_mib: process.memoryUsage().rss / 1048576 };
let maxWorkingSet = lastResource.working_set_mib;

function listLogs() {
  const values = fs.readdirSync(logRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".log"))
    .map((entry) => entry.name)
    .sort();
  assert(values.length <= config.max_log_files, "log file count budget exceeded");
  return values;
}

function safeLogAlias(name) {
  if (!logAliases.has(name)) {
    assert(logAliases.size < config.max_log_files, "log alias budget exceeded");
    logAliases.set(name, `log-${String(logAliases.size + 1).padStart(3, "0")}.log`);
  }
  return logAliases.get(name);
}

const baselineLogs = listLogs();
let baselineBytes = 0;
for (const name of baselineLogs) {
  const stat = fs.statSync(path.join(logRoot, name));
  offsets.set(name, stat.size);
  safeLogAlias(name);
  baselineBytes += stat.size;
}

function snapshotAggregate() {
  return {
    bytes_processed: aggregate.bytes_processed,
    lines_processed: aggregate.lines_processed,
    log_files_observed: [...aggregate.log_files_observed].sort(),
    sensitive_identifier_line_count: aggregate.sensitive_identifier_line_count,
    identifier_values_stored: false,
    raw_lines_stored: false,
    severity_counts: { ...aggregate.severity_counts },
    term_counts: { ...aggregate.term_counts },
    lifecycle_counts: { ...aggregate.lifecycle_counts },
  };
}

function nonEffects() {
  return {
    game_launched: false,
    game_process_attached: false,
    process_memory_read: false,
    network_traffic_observed: false,
    input_emulated: false,
    raw_log_persisted: false,
    recommendation_generated: false,
    game_action_executed: false,
    kontur_activated: false,
    pilot_approved: false,
  };
}

function state(status, extra = {}) {
  return {
    schema_version: "kontur-external-observation-runtime-state-v0.1",
    session_id: args["session-id"],
    observer_pid: process.pid,
    control_token_digest: controlTokenDigest,
    status,
    game_start_allowed: status === "ready_for_game_start" || status === "collecting",
    started_at: startedAt.toISOString(),
    activity_started_at: activityStartedAt?.toISOString() ?? null,
    last_activity_at: lastActivityAt?.toISOString() ?? null,
    heartbeat_at: new Date().toISOString(),
    sidecar_session_relative_path: `sessions/${args["session-id"]}`,
    aggregate: snapshotAggregate(),
    resources: {
      ...lastResource,
      max_working_set_mib: maxWorkingSet,
      idle_cpu_consecutive_violations: idleCpuViolations,
      idle_cpu_percent_limit: config.idle_cpu_percent_limit,
      working_set_mib_limit: config.working_set_mib_limit,
    },
    non_effects: nonEffects(),
    ...extra,
  };
}

function processLine(line) {
  aggregate.lines_processed += 1;
  if (/\b\d{17}\b/.test(line)) aggregate.sensitive_identifier_line_count += 1;
  if (/\[Error\]/i.test(line)) aggregate.severity_counts.error += 1;
  if (/\[Warning\]/i.test(line)) aggregate.severity_counts.warning += 1;
  const lower = line.toLowerCase();
  for (const term of terms) if (lower.includes(term)) aggregate.term_counts[term] += 1;
  for (const [name, matcher] of lifecycleMatchers) if (matcher.test(line)) aggregate.lifecycle_counts[name] += 1;
}

function consumeText(name, text) {
  let combined = (partial.get(name) ?? "") + text;
  const lines = combined.split(/\r?\n/);
  combined = lines.pop() ?? "";
  for (const line of lines) processLine(line);
  while (combined.length > config.max_partial_line_chars) {
    processLine(combined.slice(0, config.max_partial_line_chars));
    combined = combined.slice(config.max_partial_line_chars);
  }
  partial.set(name, combined);
}

function readAppend(name) {
  const filePath = path.join(logRoot, name);
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return { changed: false, pending: false, bytes: 0 };
    throw error;
  }
  if (!stat.isFile()) return { changed: false, pending: false, bytes: 0 };
  if (!offsets.has(name)) offsets.set(name, 0);
  let offset = offsets.get(name);
  if (stat.size < offset) {
    offset = 0;
    offsets.set(name, 0);
    partial.delete(name);
  }
  if (stat.size === offset) return { changed: false, pending: false, bytes: 0 };
  const remainingBudget = config.max_session_bytes - aggregate.bytes_processed;
  if (remainingBudget <= 0) throw new Error("session byte budget exceeded");
  const length = Math.min(stat.size - offset, config.max_read_chunk_bytes, remainingBudget);
  const buffer = Buffer.alloc(length);
  const descriptor = fs.openSync(filePath, "r");
  try {
    const actual = fs.readSync(descriptor, buffer, 0, length, offset);
    offsets.set(name, offset + actual);
    aggregate.bytes_processed += actual;
    aggregate.log_files_observed.add(safeLogAlias(name));
    consumeText(name, buffer.subarray(0, actual).toString("utf8"));
    activitySinceResourceSample = true;
    return { changed: actual > 0, pending: offset + actual < stat.size, bytes: actual };
  } finally {
    fs.closeSync(descriptor);
  }
}

function maybeCheckpoint(force = false, kind = "checkpoint") {
  if (!activityStartedAt) return;
  const now = new Date();
  const enoughLines = aggregate.lines_processed - lastCheckpointLines >= policy.checkpoint.line_interval;
  const enoughTime = (now - lastCheckpointAt) / 1000 >= policy.checkpoint.maximum_seconds_between_active_checkpoints;
  if (!force && !enoughLines && !enoughTime) return;
  assert(checkpointSequence < config.max_checkpoints, "checkpoint budget exceeded");
  checkpointSequence += 1;
  const receipt = {
    schema_version: "0.1",
    receipt_type: "sanitized_log_aggregate_checkpoint",
    session_id: args["session-id"],
    sequence: checkpointSequence,
    kind,
    observed_at: now.toISOString(),
    aggregate: snapshotAggregate(),
    source_scope: "newly_appended_log_bytes_after_session_baseline",
    content_hash: null,
    non_effects: nonEffects(),
  };
  receipt.content_hash = `sha256:${hashValue({ ...receipt, content_hash: null })}`;
  createJson(path.join(sessionDir, `checkpoint-${String(checkpointSequence).padStart(6, "0")}.json`), receipt);
  lastCheckpointAt = now;
  lastCheckpointLines = aggregate.lines_processed;
}

function scanLogs() {
  if (finalized) return { changed: false, pending: false, bytes: 0 };
  let changed = false;
  let pending = false;
  let bytes = 0;
  for (const name of listLogs()) {
    const result = readAppend(name);
    changed = changed || result.changed;
    pending = pending || result.pending;
    bytes += result.bytes;
  }
  if (!changed) return { changed, pending, bytes };
  const now = new Date();
  if (!activityStartedAt) {
    activityStartedAt = now;
    createJson(path.join(sessionDir, "collection-started.json"), {
      schema_version: "0.1",
      receipt_type: "game_log_activity_observed",
      session_id: args["session-id"],
      observed_at: now.toISOString(),
      source_scope: "newly_appended_log_bytes_after_session_baseline",
      raw_lines_stored: false,
      game_start_inferred_from_log_activity_only: true,
      game_process_attached: false,
    });
  }
  lastActivityAt = now;
  maybeCheckpoint(false);
  writeState(statePath, state(finalizing ? "finalizing" : "collecting"));
  return { changed, pending, bytes };
}

function sampleResources() {
  if (finalized || finalizing) return;
  const nowCpu = process.cpuUsage();
  const nowTime = process.hrtime.bigint();
  const elapsedMicros = Number(nowTime - lastCpuTime) / 1000;
  const cpuMicros = (nowCpu.user - lastCpuUsage.user) + (nowCpu.system - lastCpuUsage.system);
  const cpuPercent = elapsedMicros > 0 ? 100 * cpuMicros / (elapsedMicros * Math.max(1, os.cpus().length)) : 0;
  const workingSet = process.memoryUsage().rss / 1048576;
  maxWorkingSet = Math.max(maxWorkingSet, workingSet);
  lastResource = {
    idle_total_cpu_percent: Number(cpuPercent.toFixed(4)),
    working_set_mib: Number(workingSet.toFixed(2)),
  };
  if (!activitySinceResourceSample && cpuPercent > config.idle_cpu_percent_limit) idleCpuViolations += 1;
  else idleCpuViolations = 0;
  activitySinceResourceSample = false;
  lastCpuUsage = nowCpu;
  lastCpuTime = nowTime;
  writeState(statePath, state(activityStartedAt ? "collecting" : "ready_for_game_start"));
  if (workingSet > config.working_set_mib_limit || idleCpuViolations >= config.idle_cpu_consecutive_limit) {
    finalize("budget_violation", 0);
  }
}

function validStopRequested() {
  if (!fs.existsSync(stopPath)) return false;
  const value = fs.readFileSync(stopPath, "utf8").trim();
  return value.length === 64 && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(args["control-token"]));
}

function closeRuntime() {
  logWatcher?.close();
  if (reconcileTimer) clearInterval(reconcileTimer);
  if (controlTimer) clearInterval(controlTimer);
  if (resourceTimer) clearInterval(resourceTimer);
  if (deadlineTimer) clearTimeout(deadlineTimer);
}

function finalize(reason, exitCode = 0) {
  if (finalizing || finalized) return;
  finalizing = true;
  let finalReceiptCreated = false;
  try {
    writeState(statePath, state("finalizing"));
    let catchup = 0;
    let stablePasses = 0;
    while (stablePasses < 2) {
      const result = scanLogs();
      catchup += result.bytes;
      stablePasses = result.pending || result.changed ? 0 : stablePasses + 1;
      if (catchup >= config.max_final_catchup_bytes) throw new Error("final catch-up budget exceeded");
      if (stablePasses < 2) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
      }
    }
    for (const [name, fragment] of partial.entries()) {
      if (fragment.length > 0) processLine(fragment);
      partial.set(name, "");
    }
    maybeCheckpoint(activityStartedAt !== null, "final_checkpoint");
    const endedAt = new Date();
    const finalReceipt = {
      schema_version: "0.1",
      receipt_type: "bounded_log_observation_session_final",
      session_id: args["session-id"],
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      stop_reason: reason,
      policy_id: policy.policy_id,
      policy_sha256: policySha256,
      aggregate: snapshotAggregate(),
      raw_lines_stored: false,
      identifier_values_stored: false,
      game_action_executed: false,
      recommendation_generated: false,
      performance_claim_verified: false,
      content_hash: null,
      non_effects: nonEffects(),
    };
    finalReceipt.content_hash = `sha256:${hashValue({ ...finalReceipt, content_hash: null })}`;
    createJson(path.join(sessionDir, "session-final.json"), finalReceipt);
    finalReceiptCreated = true;
    commitTerminalJson(statePath, state("stopped", {
      ended_at: endedAt.toISOString(),
      stop_reason: reason,
      final_receipt_relative_path: `sessions/${args["session-id"]}/session-final.json`,
      tail_catchup_complete: true,
    }));
    finalized = true;
  } catch (error) {
    finalized = true;
    if (!finalReceiptCreated) {
      try {
        commitTerminalJson(statePath, state("faulted", {
          fault_at: new Date().toISOString(),
          fault_class: error.name,
          tail_catchup_complete: false,
        }));
      } catch (_commitError) {
        // Preserve finalizing for manual review when even bounded fault commit fails.
      }
    }
    exitCode = 1;
  } finally {
    closeRuntime();
    process.exitCode = exitCode;
  }
}

createJson(path.join(sessionDir, "session-start.json"), {
  schema_version: "0.1",
  receipt_type: "bounded_log_observation_session_start",
  session_id: args["session-id"],
  started_at: startedAt.toISOString(),
  policy_id: policy.policy_id,
  policy_sha256: policySha256,
  executable: {
    relative_path: "Release/ScrapMechanic.exe",
    size: executableStat.size,
    sha256: executableSha256,
  },
  baseline: {
    existing_log_file_count: baselineLogs.length,
    existing_log_total_bytes_skipped: baselineBytes,
    historical_bytes_processed: 0,
  },
  capability: {
    allowed: ["game.log.observe_new_bytes", "game.log.aggregate_sanitized_counts"],
    unlisted_policy: "denied",
    safe_effect: "sanitized_observation_receipts_only",
  },
  non_effects: nonEffects(),
});

logWatcher = fs.watch(logRoot, { persistent: true }, () => {
  try { scanLogs(); } catch (_error) { finalize("observer_error", 1); }
});
reconcileTimer = setInterval(() => {
  try { scanLogs(); } catch (_error) { finalize("observer_error", 1); }
}, config.polling_fallback_seconds * 1000);
controlTimer = setInterval(() => {
  try {
    if (validStopRequested()) finalize("stop_requested", 0);
  } catch (_error) {
    finalize("observer_error", 1);
  }
}, config.control_signal_seconds * 1000);
resourceTimer = setInterval(sampleResources, config.resource_sample_seconds * 1000);
deadlineTimer = setTimeout(() => finalize("maximum_duration_reached", 0), maxSeconds * 1000);
process.on("SIGINT", () => finalize("stop_requested", 0));
process.on("SIGTERM", () => finalize("stop_requested", 0));
process.on("uncaughtException", () => finalize("observer_error", 1));
writeState(statePath, state("ready_for_game_start"));
