'use strict';

const crypto = require('node:crypto');

function stableDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function meaningfulProgress(previous, next) {
  if (!previous) return true;
  const keys = ['current_phase','progress_kind','waiting_on','next_observable_event','checkpoint_ref'];
  return keys.some((k) => JSON.stringify(previous[k] ?? null) !== JSON.stringify(next[k] ?? null));
}

function createProgressReceipt(input, previous = null) {
  if (!input || typeof input !== 'object') throw new Error('progress input required');
  if (!input.run_id || !Number.isInteger(input.run_epoch) || input.run_epoch < 0) throw new Error('run identity required');
  if (!input.observed_at) throw new Error('observed_at required');
  const meaningful = meaningfulProgress(previous, input);
  return {
    type: 'ProgressReceipt',
    run_id: input.run_id,
    run_epoch: input.run_epoch,
    observed_at: input.observed_at,
    current_phase: input.current_phase ?? null,
    progress_kind: input.progress_kind ?? null,
    waiting_on: input.waiting_on ?? null,
    next_observable_event: input.next_observable_event ?? null,
    checkpoint_ref: input.checkpoint_ref ?? null,
    meaningful_progress: meaningful,
    extends_liveness_lease: meaningful,
    hidden_reasoning_disclosed: false,
    external_effect_authority_created: false,
    receipt_digest: stableDigest({
      run_id: input.run_id,
      run_epoch: input.run_epoch,
      observed_at: input.observed_at,
      current_phase: input.current_phase ?? null,
      progress_kind: input.progress_kind ?? null,
      waiting_on: input.waiting_on ?? null,
      next_observable_event: input.next_observable_event ?? null,
      checkpoint_ref: input.checkpoint_ref ?? null,
      meaningful_progress: meaningful
    })
  };
}

module.exports = { stableDigest, meaningfulProgress, createProgressReceipt };
