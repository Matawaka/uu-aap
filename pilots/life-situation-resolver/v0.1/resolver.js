#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const CADENCE_TO_ANNUAL = Object.freeze({
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  annual: 1,
  one_time: 0,
});

function fail(message) {
  const err = new Error(message);
  err.name = 'LSRValidationError';
  throw err;
}

function finiteNonNegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${label} must be a finite non-negative number`);
  }
  return value;
}

function annualize(amount, cadence) {
  if (!(cadence in CADENCE_TO_ANNUAL)) fail(`unsupported cadence: ${cadence}`);
  return amount * CADENCE_TO_ANNUAL[cadence];
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function monthDiffCeil(asOf, maturity) {
  const start = new Date(`${asOf}T00:00:00Z`);
  const end = new Date(`${maturity}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  if (end <= start) return 0;
  const days = (end - start) / 86400000;
  return Math.ceil(days / 30.4375);
}

function validateBasicInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('input must be an object');
  if (input.artifact_type !== 'LSRHouseholdState' || input.version !== '0.1') fail('unsupported household state');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.as_of || '')) fail('as_of must be YYYY-MM-DD');
  if (!/^[A-Z]{3}$/.test(input.base_currency || '')) fail('base_currency must be ISO-like 3-letter uppercase code');
  for (const key of ['evidence_sources', 'liquid_resources', 'recurring_income', 'recurring_expenses']) {
    if (!Array.isArray(input[key])) fail(`${key} must be an array`);
  }
  if (!input.resilience_policy || typeof input.resilience_policy !== 'object') fail('resilience_policy required');
  const sourceIds = new Set();
  for (const source of input.evidence_sources) {
    if (!source || typeof source.id !== 'string' || !source.id) fail('every evidence source requires a non-empty id');
    if (sourceIds.has(source.id)) fail(`duplicate evidence source id: ${source.id}`);
    sourceIds.add(source.id);
  }
  const itemIds = new Set();
  for (const [collectionName, items] of [
    ['liquid_resources', input.liquid_resources],
    ['recurring_income', input.recurring_income],
    ['recurring_expenses', input.recurring_expenses],
  ]) {
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id) fail(`${collectionName} item requires a non-empty id`);
      const scoped = `${collectionName}:${item.id}`;
      if (itemIds.has(scoped)) fail(`duplicate item id in ${collectionName}: ${item.id}`);
      itemIds.add(scoped);
      if (!item.evidence || !sourceIds.has(item.evidence.source_ref)) {
        fail(`${collectionName}.${item.id} references unknown evidence source`);
      }
    }
  }
  const rm = input.resilience_policy.reserve_months;
  if (!rm) fail('reserve_months required');
  for (const k of ['minimum', 'preferred', 'strong']) finiteNonNegative(rm[k], `reserve_months.${k}`);
  if (!(rm.minimum <= rm.preferred && rm.preferred <= rm.strong)) {
    fail('reserve_months must satisfy minimum <= preferred <= strong');
  }
  const threshold = input.resilience_policy.max_single_provider_share_percent;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
    fail('max_single_provider_share_percent must be in (0, 100]');
  }
}

function assertBaseCurrency(items, baseCurrency, label) {
  for (const item of items) {
    if (item.currency !== baseCurrency) {
      fail(`${label} ${item.id || '<unknown>'} currency ${item.currency} != base_currency ${baseCurrency}; FX conversion is not implemented in v0.1`);
    }
  }
}

function calculate(input) {
  validateBasicInput(input);
  assertBaseCurrency(input.liquid_resources, input.base_currency, 'liquid resource');
  assertBaseCurrency(input.recurring_income, input.base_currency, 'income');
  assertBaseCurrency(input.recurring_expenses, input.base_currency, 'expense');

  let immediate = 0;
  let timeLocked = 0;
  let restricted = 0;
  let unknownAccess = 0;
  const providerTotals = new Map();
  const maturityResources = [];

  for (const r of input.liquid_resources) {
    const amount = finiteNonNegative(r.amount, `liquid_resources.${r.id}.amount`);
    providerTotals.set(r.provider_ref, (providerTotals.get(r.provider_ref) || 0) + amount);
    const mode = r.access && r.access.mode;
    if (mode === 'immediate') immediate += amount;
    else if (mode === 'notice' || mode === 'maturity') {
      timeLocked += amount;
      maturityResources.push({
        id: r.id,
        amount,
        mode,
        maturity_date: r.access.maturity_date || null,
        notice_days: r.access.notice_days ?? null,
      });
    } else if (mode === 'restricted') restricted += amount;
    else unknownAccess += amount;
  }

  const totalStated = immediate + timeLocked + restricted + unknownAccess;
  const resourceSchedule = input.liquid_resources
    .map(r => ({
      id: r.id,
      provider_ref: r.provider_ref,
      kind: r.kind,
      principal: roundMoney(r.amount),
      access_mode: r.access.mode,
      maturity_date: r.access.maturity_date || null,
      notice_days: r.access.notice_days ?? null,
      early_withdrawal: r.access.early_withdrawal,
      annual_rate_percent: r.interest.annual_rate_percent,
      rate_type: r.interest.rate_type,
      payout: r.interest.payout,
      evidence_status: r.evidence.status,
      evidence_confidence: r.evidence.confidence,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const incomeByType = {};
  let activeIncomeAnnual = 0;
  let nonEmploymentIncomeAnnual = 0;
  let uncertainIncomeAnnual = 0;
  for (const i of input.recurring_income) {
    const amount = finiteNonNegative(i.amount, `recurring_income.${i.id}.amount`);
    const annual = annualize(amount, i.cadence);
    if (!i.active) continue;
    activeIncomeAnnual += annual;
    incomeByType[i.source_type] = (incomeByType[i.source_type] || 0) + annual;
    if (i.source_type !== 'employment') nonEmploymentIncomeAnnual += annual;
    if (i.reliability === 'uncertain' || i.evidence?.status === 'inferred' || i.evidence?.confidence === 'low' || i.evidence?.confidence === 'unknown') {
      uncertainIncomeAnnual += annual;
    }
  }

  const expenseAnnualByClass = {
    essential: 0,
    committed: 0,
    deferrable: 0,
    discretionary: 0,
    unknown: 0,
  };
  const inferredExpenseIds = [];
  for (const e of input.recurring_expenses) {
    const amount = finiteNonNegative(e.amount, `recurring_expenses.${e.id}.amount`);
    const annual = annualize(amount, e.cadence);
    if (!e.active) continue;
    if (!(e.need_class in expenseAnnualByClass)) fail(`unsupported need_class: ${e.need_class}`);
    expenseAnnualByClass[e.need_class] += annual;
    if (e.classification_status === 'inferred' || e.need_class === 'unknown') inferredExpenseIds.push(e.id);
  }

  const protectedAnnual = expenseAnnualByClass.essential + expenseAnnualByClass.committed;
  const lifestyleAnnual = protectedAnnual + expenseAnnualByClass.deferrable + expenseAnnualByClass.discretionary + expenseAnnualByClass.unknown;
  const protectedMonthly = protectedAnnual / 12;
  const lifestyleMonthly = lifestyleAnnual / 12;
  const nonEmploymentMonthly = nonEmploymentIncomeAnnual / 12;
  const activeIncomeMonthly = activeIncomeAnnual / 12;
  const protectedGap = Math.max(0, protectedMonthly - nonEmploymentMonthly);

  function runway(principal) {
    if (protectedMonthly === 0) return {status: 'NO_PROTECTED_BURN', months: null};
    if (protectedGap === 0) return {status: 'SELF_SUSTAINING_AT_STATED_BASELINE', months: null};
    return {status: 'FINITE', months: roundRatio(principal / protectedGap)};
  }

  const immediateRunway = runway(immediate);
  const totalRunway = runway(totalStated);
  const rm = input.resilience_policy.reserve_months;
  const reserveCorridors = {};
  for (const label of ['minimum', 'preferred', 'strong']) {
    const target = protectedMonthly * rm[label];
    reserveCorridors[label] = {
      months: rm[label],
      target_amount: roundMoney(target),
      immediate_gap: roundMoney(Math.max(0, target - immediate)),
      immediate_surplus: roundMoney(Math.max(0, immediate - target)),
    };
  }

  const attention = [];
  function addAttention(lane, code, severity, message, refs = []) {
    attention.push({lane, code, severity, message, refs});
  }

  if (inferredExpenseIds.length) {
    addAttention(
      'EVIDENCE_GAP',
      'UNCONFIRMED_EXPENSE_CLASSIFICATION',
      'review',
      'One or more active recurring expenses are inferred or unknown; protected-burn conclusions may change after human classification.',
      inferredExpenseIds
    );
  }

  const nonMonthlyRecurringIds = [
    ...input.recurring_income.filter(x => x.active && !['monthly', 'one_time'].includes(x.cadence)).map(x => `income:${x.id}`),
    ...input.recurring_expenses.filter(x => x.active && !['monthly', 'one_time'].includes(x.cadence)).map(x => `expense:${x.id}`),
  ];
  if (nonMonthlyRecurringIds.length) {
    addAttention(
      'CASHFLOW',
      'NON_MONTHLY_TIMING_ANNUALIZED_NOT_CALENDARIZED',
      'review',
      'Weekly, quarterly, or annual recurring items are annualized in v0.1; exact within-year payment timing is not simulated.',
      nonMonthlyRecurringIds
    );
  }

  if (uncertainIncomeAnnual > 0) {
    addAttention(
      'EVIDENCE_GAP',
      'UNCERTAIN_ACTIVE_INCOME',
      'review',
      'Part of active income is uncertain or weakly evidenced; the non-employment baseline may be optimistic if it includes those items.'
    );
  }

  if (protectedGap > 0) {
    addAttention(
      'CASHFLOW',
      'NON_EMPLOYMENT_INCOME_BELOW_PROTECTED_BURN',
      'material',
      `Stated active non-employment income is below protected burn by ${roundMoney(protectedGap)} ${input.base_currency} per month.`
    );
  }

  if (protectedMonthly > 0 && immediate < reserveCorridors.minimum.target_amount) {
    addAttention(
      'LIQUIDITY',
      'IMMEDIATE_RESERVE_BELOW_MINIMUM_CORRIDOR',
      'material',
      'Immediate liquidity is below the user-defined minimum reserve corridor.'
    );
  }

  if (immediateRunway.status === 'FINITE') {
    for (const r of maturityResources) {
      if (r.maturity_date) {
        const maturityMonths = monthDiffCeil(input.as_of, r.maturity_date);
        if (maturityMonths !== null && maturityMonths > immediateRunway.months) {
          addAttention(
            'MATURITY',
            'RESOURCE_MATURES_AFTER_IMMEDIATE_RUNWAY',
            'material',
            `Resource ${r.id} matures after the current immediate-liquidity runway boundary.`,
            [r.id]
          );
        }
      }
    }
  }

  const threshold = input.resilience_policy.max_single_provider_share_percent;
  if (totalStated > 0) {
    for (const [provider, amount] of providerTotals.entries()) {
      const share = (amount / totalStated) * 100;
      if (share > threshold) {
        addAttention(
          'CONCENTRATION',
          'PROVIDER_SHARE_ABOVE_ATTENTION_THRESHOLD',
          'review',
          `Provider ${provider} holds ${roundRatio(share)}% of stated liquid principal, above the user-defined ${threshold}% attention threshold.`,
          [provider]
        );
      }
    }
  }

  if (unknownAccess > 0 || restricted > 0) {
    addAttention(
      'EVIDENCE_GAP',
      'LIQUIDITY_ACCESS_NOT_IMMEDIATE',
      'review',
      'Some stated liquid principal is restricted or has unknown access semantics and is not counted as immediate liquidity.'
    );
  }

  attention.sort((a, b) => {
    const rank = {material: 0, review: 1, informational: 2};
    return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.lane.localeCompare(b.lane) || a.code.localeCompare(b.code);
  });

  return {
    artifact_type: 'LSRFamilyResilienceAssessment',
    version: '0.1',
    as_of: input.as_of,
    base_currency: input.base_currency,
    liquidity: {
      immediate_principal: roundMoney(immediate),
      time_locked_principal: roundMoney(timeLocked),
      restricted_principal: roundMoney(restricted),
      unknown_access_principal: roundMoney(unknownAccess),
      total_stated_liquid_principal: roundMoney(totalStated),
      provider_shares: Object.fromEntries(
        [...providerTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, amount]) => [p, {
          amount: roundMoney(amount),
          share_percent: totalStated === 0 ? 0 : roundRatio((amount / totalStated) * 100),
        }])
      ),
      resources: resourceSchedule,
    },
    cashflow: {
      active_income_monthly: roundMoney(activeIncomeMonthly),
      active_income_annual: roundMoney(activeIncomeAnnual),
      active_non_employment_income_monthly: roundMoney(nonEmploymentMonthly),
      active_non_employment_income_annual: roundMoney(nonEmploymentIncomeAnnual),
      active_income_annual_by_type: Object.fromEntries(
        Object.entries(incomeByType).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, roundMoney(v)])
      ),
      expense_monthly_by_class: Object.fromEntries(
        Object.entries(expenseAnnualByClass).map(([k, v]) => [k, roundMoney(v / 12)])
      ),
      expense_annual_by_class: Object.fromEntries(
        Object.entries(expenseAnnualByClass).map(([k, v]) => [k, roundMoney(v)])
      ),
      protected_monthly_burn: roundMoney(protectedMonthly),
      protected_annual_burn: roundMoney(protectedAnnual),
      current_lifestyle_monthly_burn: roundMoney(lifestyleMonthly),
      current_lifestyle_annual_burn: roundMoney(lifestyleAnnual),
      protected_monthly_gap_after_non_employment_income: roundMoney(protectedGap),
      primary_employment_assumed: input.primary_employment_assumed,
    },
    reserve_corridors: reserveCorridors,
    runway: {
      basis: 'protected_monthly_burn_minus_active_non_employment_income',
      immediate_principal: immediateRunway,
      total_stated_liquid_principal: totalRunway,
    },
    attention,
    assumptions: [
      'All monetary inputs are already normalized to base_currency; v0.1 performs no FX conversion.',
      'Recurring cadence is annualized as weekly=52, monthly=12, quarterly=4, annual=1, one_time=0.',
      'Runway uses stated principal only; nominal interest is not added.',
      'Protected burn includes only active essential and committed recurring expenses.',
      'Runway subtracts active non-employment recurring income regardless of reliability class, while uncertain income is surfaced separately as an evidence gap.',
      'Taxes, inflation, credit availability, asset-sale proceeds, investment returns and unstated obligations are not inferred.',
    ],
    non_effects: [
      'assessment != financial advice',
      'scenario != forecast != intent != authorization',
      'priority attention != required action',
      'runway estimate != guarantee',
      'liquid resource != immediately available cash',
      'nominal rate != realized return',
      'classification inference != verified family need',
      'reserve corridor != universal recommendation',
      'surplus over a corridor != investment authorization',
      'resolver output != ActionPermit',
    ],
  };
}

function main(argv) {
  if (argv.length !== 3) {
    console.error('usage: node resolver.js <household-state.json>');
    process.exitCode = 2;
    return;
  }
  const input = JSON.parse(fs.readFileSync(argv[2], 'utf8'));
  const output = calculate(input);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main(process.argv);

module.exports = {calculate, annualize};
