#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {calculate} = require('./resolver.js');

const examplePath = path.join(__dirname, 'examples', 'synthetic-household.json');
const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
const result = calculate(example);

assert.equal(result.artifact_type, 'LSRFamilyResilienceAssessment');
assert.equal(result.liquidity.immediate_principal, 600000);
assert.equal(result.liquidity.time_locked_principal, 1200000);
assert.equal(result.liquidity.total_stated_liquid_principal, 1800000);
assert.equal(result.liquidity.resources.find(x => x.id === 'deposit-a').annual_rate_percent, 15.5);
assert.equal(result.liquidity.resources.find(x => x.id === 'deposit-a').maturity_date, '2027-08-15');
assert.equal(result.cashflow.active_non_employment_income_monthly, 30000);
assert.equal(result.cashflow.protected_monthly_burn, 125000);
assert.equal(result.cashflow.current_lifestyle_monthly_burn, 165000);
assert.equal(result.cashflow.protected_monthly_gap_after_non_employment_income, 95000);
assert.equal(result.reserve_corridors.minimum.target_amount, 750000);
assert.equal(result.reserve_corridors.preferred.target_amount, 1500000);
assert.equal(result.runway.immediate_principal.status, 'FINITE');
assert.equal(result.runway.immediate_principal.months, 6.3158);
assert.equal(result.runway.total_stated_liquid_principal.months, 18.9474);
assert(result.attention.some(x => x.code === 'IMMEDIATE_RESERVE_BELOW_MINIMUM_CORRIDOR'));
assert(result.attention.some(x => x.code === 'RESOURCE_MATURES_AFTER_IMMEDIATE_RUNWAY'));
assert(result.attention.some(x => x.code === 'PROVIDER_SHARE_ABOVE_ATTENTION_THRESHOLD'));
assert(result.attention.some(x => x.code === 'UNCONFIRMED_EXPENSE_CLASSIFICATION'));
assert(result.non_effects.includes('surplus over a corridor != investment authorization'));

// Fail closed on broken evidence binding.
const badEvidence = structuredClone(example);
badEvidence.recurring_expenses[0].evidence.source_ref = 'missing-source';
assert.throws(() => calculate(badEvidence), /unknown evidence source/);

// Fail closed on silent FX conversion.
const fx = structuredClone(example);
fx.liquid_resources[0].currency = 'USD';
assert.throws(() => calculate(fx), /FX conversion is not implemented/);

// Fail closed on incoherent reserve corridor ordering.
const badReserve = structuredClone(example);
badReserve.resilience_policy.reserve_months = {minimum: 12, preferred: 6, strong: 18};
assert.throws(() => calculate(badReserve), /minimum <= preferred <= strong/);

// Self-sustaining baseline is represented as a state, not Infinity.
const sustaining = structuredClone(example);
sustaining.recurring_income = [{
  id: 'rental-stable', source_type: 'rental', amount: 130000, currency: 'RUB', cadence: 'monthly', active: true,
  reliability: 'contractual', evidence: {source_ref: 'manual-plan', status: 'user_asserted', confidence: 'high'}
}];
const sustainingResult = calculate(sustaining);
assert.equal(sustainingResult.runway.immediate_principal.status, 'SELF_SUSTAINING_AT_STATED_BASELINE');
assert.equal(sustainingResult.runway.immediate_principal.months, null);

// Unknown/restricted liquidity never becomes immediate by aggregation.
const access = structuredClone(example);
access.liquid_resources.push({
  id: 'restricted-x', provider_ref: 'provider-c', kind: 'other', amount: 400000, currency: 'RUB',
  access: {mode: 'restricted', maturity_date: null, notice_days: null, early_withdrawal: 'unknown'},
  interest: {annual_rate_percent: null, rate_type: 'unknown', payout: 'unknown'},
  evidence: {source_ref: 'manual-plan', status: 'user_asserted', confidence: 'medium'}
});
const accessResult = calculate(access);
assert.equal(accessResult.liquidity.immediate_principal, 600000);
assert.equal(accessResult.liquidity.restricted_principal, 400000);
assert(accessResult.attention.some(x => x.code === 'LIQUIDITY_ACCESS_NOT_IMMEDIATE'));

// Nominal interest does not manufacture runway.
const highRate = structuredClone(example);
highRate.liquid_resources[1].interest.annual_rate_percent = 99;
const highRateResult = calculate(highRate);
assert.equal(highRateResult.runway.immediate_principal.months, result.runway.immediate_principal.months);
assert.equal(highRateResult.runway.total_stated_liquid_principal.months, result.runway.total_stated_liquid_principal.months);

// One-time cashflow is not silently annualized as recurring.
const oneTime = structuredClone(example);
oneTime.recurring_income.push({
  id: 'sale-one-time', source_type: 'other', amount: 1000000, currency: 'RUB', cadence: 'one_time', active: true,
  reliability: 'uncertain', evidence: {source_ref: 'manual-plan', status: 'user_asserted', confidence: 'medium'}
});
assert.equal(calculate(oneTime).cashflow.active_income_monthly, result.cashflow.active_income_monthly);

console.log('LIFE_SITUATION_RESOLVER_V0_1_PASS');
