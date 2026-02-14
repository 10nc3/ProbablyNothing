#!/usr/bin/env node
/**
 * OpenClaw Test Runner — lightweight, zero-dependency
 * Uses Node assert. Run: node test/run.js
 */

const assert = require('assert');
const path = require('path');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[90m${e.message}\x1b[0m`);
  }
}

// ═══════════════════════════════════════════
// void-pipeline.js
// ═══════════════════════════════════════════
const {
  detectMode,
  checkPrivilege,
  isIdentityQuery,
  isPsiEmaExplain,
  detectIntents,
  applyPersonality,
  containsDangerousPattern,
  getPrivilegedIds,
  formatPsiEMA,
  DANGEROUS_PATTERNS
} = require('../lib/void-pipeline');

console.log('\n\x1b[1m── void-pipeline ──\x1b[0m');

// detectMode
console.log('\n  detectMode:');
test('prescribe: "build the kernel"', () => assert.strictEqual(detectMode('build the kernel'), 'prescribe'));
test('prescribe: "debug this function"', () => assert.strictEqual(detectMode('debug this function'), 'prescribe'));
test('prescribe: "deploy to production"', () => assert.strictEqual(detectMode('deploy to production'), 'prescribe'));
test('scribe: "draft a memo"', () => assert.strictEqual(detectMode('draft a memo'), 'scribe'));
test('scribe: "write a contract"', () => assert.strictEqual(detectMode('write a contract'), 'scribe'));
test('scribe: "compose a letter"', () => assert.strictEqual(detectMode('compose a letter'), 'scribe'));
test('describe: "hello"', () => assert.strictEqual(detectMode('hello'), 'describe'));
test('describe: "what time is it"', () => assert.strictEqual(detectMode('what time is it'), 'describe'));
test('describe: empty string', () => assert.strictEqual(detectMode(''), 'describe'));
test('describe: null', () => assert.strictEqual(detectMode(null), 'describe'));

// checkPrivilege
console.log('\n  checkPrivilege:');

test('non-prescribe always allowed', () => {
  assert.strictEqual(checkPrivilege('describe', null).allowed, true);
  assert.strictEqual(checkPrivilege('scribe', null).allowed, true);
});

test('prescribe locked when no env var', () => {
  const orig = process.env.PRIVILEGED_CALLER_ID;
  delete process.env.PRIVILEGED_CALLER_ID;
  const result = checkPrivilege('prescribe', 'anyone');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.reason.includes('locked'));
  if (orig !== undefined) process.env.PRIVILEGED_CALLER_ID = orig;
});

test('prescribe denied without callerId', () => {
  const orig = process.env.PRIVILEGED_CALLER_ID;
  process.env.PRIVILEGED_CALLER_ID = 'user1';
  const result = checkPrivilege('prescribe', null);
  assert.strictEqual(result.allowed, false);
  assert.ok(result.reason.includes('authentication'));
  if (orig !== undefined) process.env.PRIVILEGED_CALLER_ID = orig;
  else delete process.env.PRIVILEGED_CALLER_ID;
});

test('prescribe allowed for matching caller', () => {
  const orig = process.env.PRIVILEGED_CALLER_ID;
  process.env.PRIVILEGED_CALLER_ID = '+1234567890,admin@test.com';
  assert.strictEqual(checkPrivilege('prescribe', '+1234567890').allowed, true);
  assert.strictEqual(checkPrivilege('prescribe', 'admin@test.com').allowed, true);
  if (orig !== undefined) process.env.PRIVILEGED_CALLER_ID = orig;
  else delete process.env.PRIVILEGED_CALLER_ID;
});

test('prescribe denied for wrong caller', () => {
  const orig = process.env.PRIVILEGED_CALLER_ID;
  process.env.PRIVILEGED_CALLER_ID = 'admin@test.com';
  const result = checkPrivilege('prescribe', 'intruder@evil.com');
  assert.strictEqual(result.allowed, false);
  if (orig !== undefined) process.env.PRIVILEGED_CALLER_ID = orig;
  else delete process.env.PRIVILEGED_CALLER_ID;
});

// getPrivilegedIds
console.log('\n  getPrivilegedIds:');

test('empty when unset', () => {
  const orig = process.env.PRIVILEGED_CALLER_ID;
  delete process.env.PRIVILEGED_CALLER_ID;
  assert.deepStrictEqual(getPrivilegedIds(), []);
  if (orig !== undefined) process.env.PRIVILEGED_CALLER_ID = orig;
});

test('parses comma-separated', () => {
  const orig = process.env.PRIVILEGED_CALLER_ID;
  process.env.PRIVILEGED_CALLER_ID = ' user1 , user2 , user3 ';
  const ids = getPrivilegedIds();
  assert.strictEqual(ids.length, 3);
  assert.ok(ids.includes('user1'));
  assert.ok(ids.includes('user2'));
  assert.ok(ids.includes('user3'));
  if (orig !== undefined) process.env.PRIVILEGED_CALLER_ID = orig;
  else delete process.env.PRIVILEGED_CALLER_ID;
});

test('normalizes hyphens and spaces', () => {
  const orig = process.env.PRIVILEGED_CALLER_ID;
  process.env.PRIVILEGED_CALLER_ID = '+62-811-636-0610';
  const ids = getPrivilegedIds();
  assert.strictEqual(ids[0], '+628116360610');
  if (orig !== undefined) process.env.PRIVILEGED_CALLER_ID = orig;
  else delete process.env.PRIVILEGED_CALLER_ID;
});

// isIdentityQuery
console.log('\n  isIdentityQuery:');
test('"who are you" matches', () => assert.ok(isIdentityQuery('who are you')));
test('"Who is nyan" matches', () => assert.ok(isIdentityQuery('Who is nyan')));
test('"tell me about yourself" matches', () => assert.ok(isIdentityQuery('tell me about yourself')));
test('"who made this" matches', () => assert.ok(isIdentityQuery('who made this')));
test('"hello" does not match', () => assert.ok(!isIdentityQuery('hello')));
test('"what is 2+2" does not match', () => assert.ok(!isIdentityQuery('what is 2+2')));

// isPsiEmaExplain
console.log('\n  isPsiEmaExplain:');
test('"what is psi-ema" matches', () => assert.ok(isPsiEmaExplain('what is psi-ema')));
test('"explain the psi ema" matches', () => assert.ok(isPsiEmaExplain('explain the psi ema')));
test('"how does the psi-ema work" matches', () => assert.ok(isPsiEmaExplain('how does the psi-ema work')));
test('"use psi-ema on $AAPL" does not match', () => assert.ok(!isPsiEmaExplain('use psi-ema on $AAPL')));

// detectIntents
console.log('\n  detectIntents:');
test('$AAPL triggers stock intent', () => {
  const intents = detectIntents('check $AAPL price');
  assert.ok(intents.some(i => i.type === 'stock' && i.ticker === 'AAPL'));
});
test('psi-ema $TSLA triggers both stock and psi-ema', () => {
  const intents = detectIntents('run psi-ema on $TSLA');
  assert.ok(intents.some(i => i.type === 'stock'));
  assert.ok(intents.some(i => i.type === 'psi-ema'));
});
test('legal triggers legal intent', () => {
  const intents = detectIntents('review the contract clause');
  assert.ok(intents.some(i => i.type === 'legal'));
});
test('"search for latest news" triggers search', () => {
  const intents = detectIntents('search for latest news');
  assert.ok(intents.some(i => i.type === 'search'));
});
test('"hello" has no intents', () => {
  assert.strictEqual(detectIntents('hello').length, 0);
});

// containsDangerousPattern
console.log('\n  containsDangerousPattern (safety guard):');
test('rm -rf / blocked', () => assert.ok(containsDangerousPattern('rm -rf /')));
test('dd if=/dev/zero blocked', () => assert.ok(containsDangerousPattern('dd if=/dev/zero of=/dev/sda')));
test('fork bomb blocked', () => assert.ok(containsDangerousPattern(':() { : | : & } ; :')));
test('shutdown blocked', () => assert.ok(containsDangerousPattern('sudo shutdown now')));
test('chmod 777 / blocked', () => assert.ok(containsDangerousPattern('chmod 777 /')));
test('normal code not blocked', () => assert.ok(!containsDangerousPattern('function hello() { return 1; }')));
test('mkdir safe', () => assert.ok(!containsDangerousPattern('mkdir -p /app/data')));
test('rm single file safe', () => assert.ok(!containsDangerousPattern('rm file.txt')));

// applyPersonality
console.log('\n  applyPersonality:');
test('appends nyan~', () => assert.ok(applyPersonality('hello').includes('nyan~')));
test('does not double nyan~', () => {
  const result = applyPersonality('hello nyan~');
  assert.strictEqual(result.split('nyan~').length - 1, 1);
});
test('strips flattery', () => {
  const result = applyPersonality('Great question! Here is the answer');
  assert.ok(!result.startsWith('Great question'));
});

// formatPsiEMA
console.log('\n  formatPsiEMA:');
test('formats stock data with daily reading', () => {
  const data = {
    ticker: 'AAPL',
    shortName: 'Apple Inc.',
    sector: 'Technology',
    currentPrice: 185.50,
    trailingPE: 28.4,
    psi_ema_daily: { theta: 15, z: 1.5, r: 2.0 }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('Apple Inc.'));
  assert.ok(result.includes('AAPL'));
  assert.ok(result.includes('185.50'));
  assert.ok(result.includes('STRONG BULL'));
});

test('detects FALSE POSITIVE reading', () => {
  const data = {
    ticker: 'XYZ',
    currentPrice: 50,
    psi_ema_daily: { theta: -5, z: 0.8, r: 2.0 }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('FALSE POSITIVE'));
});

test('detects BREATHING reading', () => {
  const data = {
    ticker: 'ABC',
    currentPrice: 100,
    psi_ema_daily: { theta: 3, z: 0.5, r: 1.0 }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('BREATHING'));
});

test('detects NEUTRAL reading', () => {
  const data = {
    ticker: 'DEF',
    currentPrice: 75,
    psi_ema_daily: { theta: 2, z: 0.3, r: 0.3 }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('NEUTRAL'));
});

test('handles null input', () => {
  const result = formatPsiEMA(null);
  assert.ok(result.includes('no data'));
});

test('includes weekly data when present', () => {
  const data = {
    ticker: 'TSLA',
    currentPrice: 200,
    psi_ema_daily: { theta: 10, z: 2.0, r: 2.5 },
    psi_ema_weekly: { theta: 8, z: 1.8, r: 2.2 }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('Weekly:'));
  assert.ok(result.includes('STRONG BULL'));
});

test('shows NO DATA when weekly is missing', () => {
  const data = {
    ticker: 'AAPL',
    currentPrice: 150,
    psi_ema_daily: { theta: 5, z: 1.0, r: 2.0 }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('Weekly: NO DATA'));
});

test('handles alternate psiEma.daily format', () => {
  const data = {
    ticker: 'MSFT',
    currentPrice: 350,
    psiEma: { daily: { theta: -3, z: 1.0, r: 1.8 } }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('MSFT'));
  assert.ok(result.includes('FALSE POSITIVE'));
});

test('handles results-keyed format (single ticker)', () => {
  const data = {
    results: {
      AAPL: {
        currentPrice: 190,
        shortName: 'Apple Inc.',
        psi_ema_daily: { theta: 12, z: 1.8, r: 2.1 }
      }
    }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('AAPL'));
  assert.ok(result.includes('Apple Inc.'));
  assert.ok(result.includes('STRONG BULL'));
});

test('handles results-keyed format (multi ticker)', () => {
  const data = {
    results: {
      AAPL: {
        currentPrice: 190,
        psi_ema_daily: { theta: 12, z: 1.8, r: 2.1 }
      },
      TSLA: {
        currentPrice: 250,
        psi_ema_daily: { theta: -4, z: 0.5, r: 2.0 }
      }
    }
  };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('AAPL'));
  assert.ok(result.includes('TSLA'));
  assert.ok(result.includes('STRONG BULL'));
  assert.ok(result.includes('FALSE POSITIVE'));
});

test('handles empty results object', () => {
  const data = { results: {} };
  const result = formatPsiEMA(data);
  assert.ok(result.includes('no data'));
});

// ═══════════════════════════════════════════
// getPsiEMA endpoint
// ═══════════════════════════════════════════
const { getPsiEMA: getPsiEMAFn } = require('../lib/nyan-api');

console.log('\n\x1b[1m── getPsiEMA endpoint ──\x1b[0m\n');

test('getPsiEMA hits /psi-ema endpoint with single ticker', async () => {
  const origPost = axios.post;
  let capturedUrl = null;
  let capturedPayload = null;
  axios.post = async (url, payload) => {
    capturedUrl = url;
    capturedPayload = payload;
    return { data: { success: true, results: { AAPL: { psi_ema_daily: { theta: 5, z: 1.2, r: 1.9 } } } } };
  };
  try {
    const result = await getPsiEMAFn('AAPL');
    assert.ok(capturedUrl.includes('/psi-ema'), 'should hit /psi-ema endpoint');
    assert.strictEqual(capturedPayload.ticker, 'AAPL');
    assert.ok(!capturedPayload.tickers, 'single ticker should not send tickers array');
    assert.ok(result.results.AAPL, 'should have AAPL in results');
    assert.strictEqual(result.success, true);
  } finally {
    axios.post = origPost;
  }
});

test('getPsiEMA hits /psi-ema endpoint with array of tickers', async () => {
  const origPost = axios.post;
  let capturedPayload = null;
  axios.post = async (url, payload) => {
    capturedPayload = payload;
    return { data: { success: true, results: { AAPL: {}, TSLA: {} } } };
  };
  try {
    const result = await getPsiEMAFn(['AAPL', 'TSLA']);
    assert.ok(Array.isArray(capturedPayload.tickers), 'array input should send tickers');
    assert.strictEqual(capturedPayload.tickers.length, 2);
    assert.ok(result.tickers.includes('AAPL'));
    assert.ok(result.tickers.includes('TSLA'));
  } finally {
    axios.post = origPost;
  }
});

test('getPsiEMA falls back to atomic on endpoint failure', async () => {
  const origPost = axios.post;
  let callCount = 0;
  axios.post = async (url, payload) => {
    callCount++;
    if (callCount === 1) throw new Error('endpoint down');
    return { data: { success: true, response: 'fallback worked', psiEma: { daily: {} } } };
  };
  try {
    const result = await getPsiEMAFn('AAPL');
    assert.strictEqual(callCount, 2, 'should make 2 calls (endpoint + fallback)');
    assert.strictEqual(result.success, true);
  } finally {
    axios.post = origPost;
  }
});

// ═══════════════════════════════════════════
// mode-registry.js
// ═══════════════════════════════════════════
const { detectCodeMode, getLanguageFromExtension, EXTENSION_MAP } = require('../lib/mode-registry');

console.log('\n\x1b[1m── mode-registry ──\x1b[0m\n');

test('getLanguageFromExtension detects .js', () => {
  assert.strictEqual(getLanguageFromExtension('app.js'), 'javascript');
});

test('getLanguageFromExtension detects .py', () => {
  assert.strictEqual(getLanguageFromExtension('main.py'), 'python');
});

test('getLanguageFromExtension detects .rs', () => {
  assert.strictEqual(getLanguageFromExtension('lib.rs'), 'rust');
});

test('getLanguageFromExtension detects .go', () => {
  assert.strictEqual(getLanguageFromExtension('main.go'), 'go');
});

test('getLanguageFromExtension returns null for unknown', () => {
  assert.strictEqual(getLanguageFromExtension('data.xyz'), null);
});

test('getLanguageFromExtension handles null', () => {
  assert.strictEqual(getLanguageFromExtension(null), null);
});

test('detectCodeMode detects from attachment filename', () => {
  const result = detectCodeMode([{ fileName: 'server.ts' }], []);
  assert.ok(result.detected);
  assert.strictEqual(result.language, 'typescript');
  assert.strictEqual(result.fileName, 'server.ts');
});

test('detectCodeMode detects from code pattern in text', () => {
  const result = detectCodeMode([], [{ text: 'def hello():\n  return True', fileName: 'snippet' }]);
  assert.ok(result.detected);
  assert.strictEqual(result.language, 'python');
});

test('detectCodeMode detects JS patterns', () => {
  const result = detectCodeMode([], [{ text: 'const x = require("express")', fileName: 'query.txt' }]);
  assert.ok(result.detected);
  assert.strictEqual(result.language, 'javascript');
});

test('detectCodeMode returns not detected for plain text', () => {
  const result = detectCodeMode([], [{ text: 'hello how are you today', fileName: 'query.txt' }]);
  assert.ok(!result.detected);
});

test('detectCodeMode handles empty inputs', () => {
  const result = detectCodeMode([], []);
  assert.ok(!result.detected);
});

// ═══════════════════════════════════════════
// seed-metric.js
// ═══════════════════════════════════════════
const {
  measureAffordability,
  solveIdentity,
  compareTimePeriods: comparePeriods,
  detectSeedMetricIntent,
  getSeedMetricProxy,
  formatSeedMetric,
  parseNyanSeedMetricResponse,
  parseSearchSnippets,
  PHI: SM_PHI
} = require('../prompts/seed-metric');

console.log('\n\x1b[1m── seed-metric ──\x1b[0m\n');

test('solveIdentity returns PHI when sigma=0', () => {
  const A = solveIdentity(0);
  assert.ok(Math.abs(A - SM_PHI) < 0.001, `expected ~1.618, got ${A}`);
});

test('solveIdentity increases with positive sigma', () => {
  const A = solveIdentity(1);
  assert.ok(A > SM_PHI, `expected > PHI, got ${A}`);
});

test('solveIdentity decreases with negative sigma', () => {
  const A = solveIdentity(-0.5);
  assert.ok(A < SM_PHI, `expected < PHI, got ${A}`);
});

test('measureAffordability FATALISM regime (>25 yrs)', () => {
  const r = measureAffordability({ city: 'Seoul', year: 2024, landPricePerSqm: 2000, medianIncome: 50000 });
  assert.strictEqual(r.regime, 'FATALISM');
  assert.ok(r.yearsToMortgage > 25, `expected >25 yrs, got ${r.yearsToMortgage}`);
  assert.strictEqual(r.city, 'Seoul');
});

test('measureAffordability OPTIMISM regime (<10 yrs)', () => {
  const r = measureAffordability({ city: 'Tokyo', year: 1975, landPricePerSqm: 50, medianIncome: 30000 });
  assert.strictEqual(r.regime, 'OPTIMISM');
  assert.ok(r.yearsToMortgage < 10, `expected <10 yrs, got ${r.yearsToMortgage}`);
});

test('measureAffordability PHI-BREATHING regime (10-25 yrs)', () => {
  const r = measureAffordability({ city: 'Seoul', year: 2024, landPricePerSqm: 1000, medianIncome: 50000 });
  assert.strictEqual(r.regime, 'PHI-BREATHING');
  assert.ok(r.yearsToMortgage >= 10 && r.yearsToMortgage <= 25, `expected 10-25 yrs, got ${r.yearsToMortgage}`);
});

test('measureAffordability returns all expected fields', () => {
  const r = measureAffordability({ city: 'X', year: 2024, landPricePerSqm: 100, medianIncome: 50000 });
  assert.ok('totalPrice' in r);
  assert.ok('yearsToMortgage' in r);
  assert.ok('regime' in r);
  assert.ok('sigma' in r);
  assert.ok('identityValue' in r);
  assert.ok('phiDeviation' in r);
  assert.ok('metadata' in r);
  assert.ok(!('ratio' in r), 'ratio field should not exist');
});

test('compareTimePeriods detects WORSENING with regime change', () => {
  const m1 = measureAffordability({ city: 'Tokyo', year: 1975, landPricePerSqm: 50, medianIncome: 30000 });
  const m2 = measureAffordability({ city: 'Tokyo', year: 2024, landPricePerSqm: 2000, medianIncome: 50000 });
  const c = comparePeriods(m1, m2);
  assert.strictEqual(c.direction, 'WORSENING');
  assert.ok(c.regimeChange.includes('OPTIMISM'));
  assert.ok(c.regimeChange.includes('FATALISM'));
});

test('compareTimePeriods detects stable regime', () => {
  const m1 = measureAffordability({ city: 'A', year: 2020, landPricePerSqm: 50, medianIncome: 30000 });
  const m2 = measureAffordability({ city: 'A', year: 2024, landPricePerSqm: 60, medianIncome: 30000 });
  const c = comparePeriods(m1, m2);
  assert.strictEqual(c.regimeChange, 'stable');
});

test('detectSeedMetricIntent matches housing patterns', () => {
  assert.ok(detectSeedMetricIntent('what about housing affordability'));
  assert.ok(detectSeedMetricIntent('the housing crisis in Seoul'));
  assert.ok(detectSeedMetricIntent('700 m2 per household'));
  assert.ok(detectSeedMetricIntent('seed metric analysis'));
  assert.ok(detectSeedMetricIntent('demographic collapse and fertility rate'));
});

test('detectSeedMetricIntent rejects unrelated queries', () => {
  assert.ok(!detectSeedMetricIntent('what is 2+2'));
  assert.ok(!detectSeedMetricIntent('hello'));
  assert.ok(!detectSeedMetricIntent(null));
});

test('getSeedMetricProxy returns context string', () => {
  const ctx = getSeedMetricProxy();
  assert.ok(ctx.includes('SEED METRIC'));
  assert.ok(ctx.includes('700'));
  assert.ok(ctx.includes('FATALISM'));
  assert.ok(ctx.includes('PHI'));
});

test('formatSeedMetric formats result correctly', () => {
  const r = measureAffordability({ city: 'Seoul', year: 2024, landPricePerSqm: 2000, medianIncome: 50000 });
  const formatted = formatSeedMetric(r);
  assert.ok(formatted.includes('Seoul'));
  assert.ok(formatted.includes('2024'));
  assert.ok(formatted.includes('FATALISM'));
  assert.ok(formatted.includes('years to mortgage'));
  assert.ok(!formatted.includes('Ratio'), 'should not contain ratio');
});

test('formatSeedMetric handles null', () => {
  assert.ok(formatSeedMetric(null).includes('no data'));
});

// ── seed-metric parsers ──

test('parseNyanSeedMetricResponse parses LAND:X INCOME:Y format', () => {
  const r = parseNyanSeedMetricResponse('LAND:13,400 INCOME:34,944 [seed-metric]');
  assert.strictEqual(r.landPricePerSqm, 13400);
  assert.strictEqual(r.medianIncome, 34944);
});

test('parseNyanSeedMetricResponse parses no-comma format', () => {
  const r = parseNyanSeedMetricResponse('LAND:4348 INCOME:44491 [23.5 years]');
  assert.strictEqual(r.landPricePerSqm, 4348);
  assert.strictEqual(r.medianIncome, 44491);
});

test('parseNyanSeedMetricResponse parses verbose text fallback', () => {
  const r = parseNyanSeedMetricResponse('Land price per sqm: 5,000 USD, Median income: 37,000 USD');
  assert.strictEqual(r.landPricePerSqm, 5000);
  assert.strictEqual(r.medianIncome, 37000);
});

test('parseNyanSeedMetricResponse returns null on garbage', () => {
  assert.strictEqual(parseNyanSeedMetricResponse('hello world'), null);
  assert.strictEqual(parseNyanSeedMetricResponse(null), null);
  assert.strictEqual(parseNyanSeedMetricResponse(''), null);
});

test('parseSearchSnippets extracts from search results', () => {
  const results = [
    { snippet: 'The average land price is $2,500 per sqm in the area.' },
    { snippet: 'The median household income is $45,000 per year.' }
  ];
  const r = parseSearchSnippets(results);
  assert.strictEqual(r.landPricePerSqm, 2500);
  assert.strictEqual(r.medianIncome, 45000);
});

test('parseSearchSnippets returns null on empty', () => {
  assert.strictEqual(parseSearchSnippets([]), null);
  assert.strictEqual(parseSearchSnippets(null), null);
});

// ── pipeline seed-metric integration ──

const { detectIntents: pipelineDetectIntents, extractCity } = require('../lib/void-pipeline');

test('extractCity extracts city from query', () => {
  assert.strictEqual(extractCity('housing affordability in Seoul'), 'Seoul');
  assert.strictEqual(extractCity('seed metric for Tokyo'), 'Tokyo');
  assert.strictEqual(extractCity('demographic collapse of Hong Kong'), 'Hong Kong');
  assert.strictEqual(extractCity('hello world'), null);
});

test('detectIntents finds seed-metric intent', () => {
  const intents = pipelineDetectIntents('housing affordability in Seoul');
  const sm = intents.find(i => i.type === 'seed-metric');
  assert.ok(sm, 'should detect seed-metric intent');
  assert.strictEqual(sm.city, 'Seoul');
});

test('detectIntents does not false-positive seed-metric', () => {
  const intents = pipelineDetectIntents('what is 2+2');
  const sm = intents.find(i => i.type === 'seed-metric');
  assert.ok(!sm, 'should not detect seed-metric for unrelated query');
});

// ═══════════════════════════════════════════
// env-detect.js
// ═══════════════════════════════════════════
const {
  detectRuntime,
  checkAllProviders,
  buildDynamicChain,
  ENV_TYPES
} = require('../lib/env-detect');

console.log('\n\x1b[1m── env-detect ──\x1b[0m\n');

test('detectRuntime returns valid type', () => {
  const runtime = detectRuntime();
  assert.ok(Object.values(ENV_TYPES).includes(runtime));
});

test('checkAllProviders returns all four providers', () => {
  const providers = checkAllProviders();
  assert.ok('minimax' in providers);
  assert.ok('claude' in providers);
  assert.ok('groq' in providers);
  assert.ok('openai' in providers);
});

test('each provider has configured boolean', () => {
  const providers = checkAllProviders();
  for (const [name, p] of Object.entries(providers)) {
    assert.strictEqual(typeof p.configured, 'boolean', `${name}.configured should be boolean`);
  }
});

test('buildDynamicChain with no providers returns empty', () => {
  const noOllama = { available: false };
  const noCloud = {
    minimax: { configured: false },
    groq: { configured: false },
    claude: { configured: false },
    openai: { configured: false }
  };
  assert.deepStrictEqual(buildDynamicChain(noOllama, noCloud), []);
});

test('buildDynamicChain respects priority order', () => {
  const ollama = { available: true };
  const allCloud = {
    minimax: { configured: true },
    groq: { configured: true },
    claude: { configured: true },
    openai: { configured: true }
  };
  const chain = buildDynamicChain(ollama, allCloud);
  assert.strictEqual(chain[0], 'minimax');
  assert.strictEqual(chain[chain.length - 1], 'ollama');
  assert.ok(chain.indexOf('groq') < chain.indexOf('claude'));
  assert.ok(chain.indexOf('claude') < chain.indexOf('openai'));
  assert.ok(chain.indexOf('openai') < chain.indexOf('ollama'));
});

test('buildDynamicChain ollama-only when no cloud', () => {
  const ollama = { available: true };
  const noCloud = {
    minimax: { configured: false },
    groq: { configured: false },
    claude: { configured: false },
    openai: { configured: false }
  };
  const chain = buildDynamicChain(ollama, noCloud);
  assert.deepStrictEqual(chain, ['ollama']);
});

// ═══════════════════════════════════════════
// context-router.js
// ═══════════════════════════════════════════
const { route, getContext, WORKSPACE } = require('../lib/context-router');

console.log('\n\x1b[1m── context-router ──\x1b[0m\n');

test('route always includes core', () => {
  assert.ok(route('hello').includes('core'));
});

test('route triggers philosophy on "phi"', () => {
  assert.ok(route('tell me about phi').includes('philosophy'));
});

test('route triggers tools on "stock"', () => {
  assert.ok(route('check stock price').includes('tools'));
});

test('getContext returns valid structure', () => {
  const ctx = getContext('hello');
  assert.ok('experts' in ctx);
  assert.ok('context' in ctx);
  assert.ok('tokenEstimate' in ctx);
  assert.ok(Array.isArray(ctx.experts));
});

test('getContext handles null query', () => {
  const ctx = getContext(null);
  assert.deepStrictEqual(ctx.experts, ['core']);
  assert.strictEqual(ctx.context, '');
});

test('WORKSPACE is absolute path', () => {
  assert.ok(path.isAbsolute(WORKSPACE));
});

// ═══════════════════════════════════════════
// complexity scoring
// ═══════════════════════════════════════════
const { scoreComplexity } = require('../lib/void-pipeline');

console.log('\n\x1b[1m── complexity scoring ──\x1b[0m\n');

test('greetings are light complexity', () => {
  assert.strictEqual(scoreComplexity('hi'), 'light');
  assert.strictEqual(scoreComplexity('hello'), 'light');
  assert.strictEqual(scoreComplexity('thanks'), 'light');
});

test('short queries are light complexity', () => {
  assert.strictEqual(scoreComplexity('what is 2+2?'), 'light');
});

test('analysis keywords trigger heavy complexity', () => {
  assert.strictEqual(scoreComplexity('analyze the quarterly earnings report and compare year-over-year growth metrics for this company'), 'heavy');
});

test('philosophical queries trigger heavy complexity', () => {
  assert.strictEqual(scoreComplexity('explain the dialectic relationship between thesis and antithesis in modern epistemology'), 'heavy');
});

test('medium queries score correctly', () => {
  const r = scoreComplexity('Can you also tell me about the weather and what activities might be good?');
  assert.ok(r === 'medium' || r === 'heavy', `expected medium or heavy, got ${r}`);
});

test('empty query is light', () => {
  assert.strictEqual(scoreComplexity(''), 'light');
  assert.strictEqual(scoreComplexity(null), 'light');
});

// ═══════════════════════════════════════════
// multimodal passthrough
// ═══════════════════════════════════════════
const { callNyanAPI, atomicQuery: atomicQ } = require('../lib/nyan-api');
const axios = require('axios');

console.log('\n\x1b[1m── multimodal passthrough ──\x1b[0m\n');

test('callNyanAPI builds multimodal payload with photos', async () => {
  const fakePhoto = 'iVBORw0KGgoAAAANSUhEUg==';
  const origPost = axios.post;
  let capturedPayload = null;
  axios.post = async (url, payload) => {
    capturedPayload = payload;
    return { data: { success: true, response: 'saw photos' } };
  };
  try {
    await callNyanAPI('what is in these photos?', { photos: [fakePhoto] });
    assert.ok(Array.isArray(capturedPayload.photos), 'payload should have photos array');
    assert.strictEqual(capturedPayload.photos[0], fakePhoto);
  } finally {
    axios.post = origPost;
  }
});

test('callNyanAPI builds multimodal payload with documents', async () => {
  const origPost = axios.post;
  let capturedPayload = null;
  axios.post = async (url, payload) => {
    capturedPayload = payload;
    return { data: { success: true, response: 'saw docs' } };
  };
  try {
    const doc = { name: 'test.pdf', data: 'base64', type: 'pdf' };
    await callNyanAPI('summarize this', { documents: [doc] });
    assert.ok(Array.isArray(capturedPayload.documents), 'payload should have documents array');
    assert.strictEqual(capturedPayload.documents[0].name, 'test.pdf');
  } finally {
    axios.post = origPost;
  }
});

test('atomicQuery passes multimodal opts through', async () => {
  const origPost = axios.post;
  let capturedPayload = null;
  axios.post = async (url, payload) => {
    capturedPayload = payload;
    return { data: { success: true, response: 'multimodal atomic' } };
  };
  try {
    await atomicQ('process this', 'multimodal', { photos: ['data'], documents: [{ name: 'a.txt' }] });
    assert.ok(capturedPayload.photos);
    assert.ok(capturedPayload.documents);
  } finally {
    axios.post = origPost;
  }
});

// ═══════════════════════════════════════════
// code-context.js (was stub, now real)
// ═══════════════════════════════════════════
const { isDesignQuestion, getSystemContextForDesign, DESIGN_KEYWORDS, PHILOSOPHY_KEYWORDS } = require('../lib/code-context');

console.log('\n\x1b[1m── code-context ──\x1b[0m');

test('isDesignQuestion: architecture', () => assert.ok(isDesignQuestion('how should I architect this system?')));
test('isDesignQuestion: refactor', () => assert.ok(isDesignQuestion('refactor the database layer')));
test('isDesignQuestion: pattern', () => assert.ok(isDesignQuestion('what design pattern works here?')));
test('isDesignQuestion: phi/kernel keywords', () => assert.ok(isDesignQuestion('explain the kernel and satellite approach')));
test('isDesignQuestion: false for weather', () => assert.ok(!isDesignQuestion('what is the weather today?')));
test('isDesignQuestion: false for null', () => assert.ok(!isDesignQuestion(null)));
test('getSystemContextForDesign returns array', () => {
  const ctx = getSystemContextForDesign();
  assert.ok(Array.isArray(ctx));
});

// ═══════════════════════════════════════════
// forex-fetcher.js (was stub, now real)
// ═══════════════════════════════════════════
const { isForexQuery: isFQ, detectForexPair: detectFP, buildForexContext: buildFC, FOREX_PAIRS } = require('../lib/forex-fetcher');

console.log('\n\x1b[1m── forex-fetcher ──\x1b[0m');

test('isForexQuery: "what is the EUR/USD rate"', () => assert.ok(isFQ('what is the EUR/USD rate')));
test('isForexQuery: "forex trading"', () => assert.ok(isFQ('forex trading tips')));
test('isForexQuery: "dollar yen exchange rate"', () => assert.ok(isFQ('dollar yen exchange rate')));
test('isForexQuery: "convert euro to dollar"', () => assert.ok(isFQ('convert euro to dollar')));
test('isForexQuery: false for "tell me a joke"', () => assert.ok(!isFQ('tell me a joke')));
test('isForexQuery: false for null', () => assert.ok(!isFQ(null)));
test('detectForexPair: EUR/USD', () => assert.strictEqual(detectFP('what is EUR/USD'), 'EUR/USD'));
test('detectForexPair: dollar yen', () => assert.strictEqual(detectFP('dollar yen rate'), 'USD/JPY'));
test('detectForexPair: rupiah', () => assert.strictEqual(detectFP('how much is rupiah'), 'USD/IDR'));
test('detectForexPair: null for unrelated', () => assert.strictEqual(detectFP('hello world'), null));
test('buildForexContext: returns context for EUR/USD', () => {
  const ctx = buildFC('what is EUR/USD rate');
  assert.ok(ctx);
  assert.strictEqual(ctx.type, 'forex');
  assert.strictEqual(ctx.pair, 'EUR/USD');
  assert.ok(ctx.systemPrompt.includes('EUR/USD'));
});
test('buildForexContext: null for non-forex', () => assert.strictEqual(buildFC('hello'), null));
test('FOREX_PAIRS has major pairs', () => {
  assert.ok(FOREX_PAIRS['EUR/USD']);
  assert.ok(FOREX_PAIRS['USD/JPY']);
  assert.ok(FOREX_PAIRS['GBP/USD']);
  assert.ok(FOREX_PAIRS['USD/IDR']);
});

// ═══════════════════════════════════════════
// llm-client.js (Ollama num_predict fix)
// ═══════════════════════════════════════════
console.log('\n\x1b[1m── llm-client (Ollama opts) ──\x1b[0m');

test('callOllama sends num_predict and num_ctx in options', async () => {
  const { callOllama, CONTEXT_LIMITS, PROVIDERS } = require('../lib/llm-client');
  const origPost = axios.post;
  let capturedBody = null;
  axios.post = async (url, body) => {
    capturedBody = body;
    return { data: { message: { content: 'test response' } } };
  };
  try {
    await callOllama([{ role: 'user', content: 'hi' }], { maxTokens: 500, temperature: 0.5 });
    assert.ok(capturedBody.options, 'should have options field');
    assert.strictEqual(capturedBody.options.num_predict, 500, 'num_predict should be 500');
    assert.strictEqual(capturedBody.options.temperature, 0.5, 'temperature should be 0.5');
    const expectedCtx = CONTEXT_LIMITS[PROVIDERS.OLLAMA].contextWindow;
    assert.strictEqual(capturedBody.options.num_ctx, expectedCtx, `num_ctx should be ${expectedCtx}`);
    assert.strictEqual(capturedBody.stream, false, 'stream should be false');
  } finally {
    axios.post = origPost;
  }
});

// ═══════════════════════════════════════════
// pipeline: forex + design intent detection
// ═══════════════════════════════════════════
console.log('\n\x1b[1m── pipeline: forex + design intents ──\x1b[0m');

test('detectIntents: forex query detected', () => {
  const intents = detectIntents('what is the EUR/USD exchange rate');
  assert.ok(intents.some(i => i.type === 'forex'), 'should have forex intent');
  const fx = intents.find(i => i.type === 'forex');
  assert.strictEqual(fx.pair, 'EUR/USD');
});

test('detectIntents: design query detected', () => {
  const intents = detectIntents('how should I architect this microservice?');
  assert.ok(intents.some(i => i.type === 'design'), 'should have design intent');
});

test('detectIntents: forex not triggered on unrelated', () => {
  const intents = detectIntents('hello world');
  assert.ok(!intents.some(i => i.type === 'forex'));
});

test('detectIntents: design not triggered on unrelated', () => {
  const intents = detectIntents('what is 2+2');
  assert.ok(!intents.some(i => i.type === 'design'));
});

// ═══════════════════════════════════════════
// memory-manager: uses callWithFallback (no hardcoded Groq)
// ═══════════════════════════════════════════
console.log('\n\x1b[1m── memory-manager (no hardcoded Groq) ──\x1b[0m');

test('memory-manager imports callWithFallback, not hardcoded Groq', () => {
  const memSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'memory-manager.js'), 'utf-8');
  assert.ok(memSrc.includes("require('./llm-client')"), 'should import from llm-client');
  assert.ok(!memSrc.includes('GROQ_API_URL'), 'should not have hardcoded GROQ_API_URL');
  assert.ok(!memSrc.includes('SUMMARY_MODEL'), 'should not have hardcoded SUMMARY_MODEL');
});

// ═══════════════════════════════════════════
// stock-fetcher: uses callWithFallback (no hardcoded Groq)
// ═══════════════════════════════════════════
console.log('\n\x1b[1m── stock-fetcher (no hardcoded Groq) ──\x1b[0m');

test('extractTickerWithAI imports callWithFallback, not hardcoded Groq', () => {
  const sfSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'stock-fetcher.js'), 'utf-8');
  assert.ok(sfSrc.includes("require('./llm-client')"), 'should import from llm-client');
  assert.ok(!sfSrc.includes("'https://api.groq.com"), 'should not have hardcoded Groq URL');
  assert.ok(!sfSrc.includes('GROQ_API_KEY'), 'should not gate on GROQ_API_KEY');
});

// ═══════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════
console.log(`\n\x1b[1m── results ──\x1b[0m`);
console.log(`  \x1b[32m${passed} passed\x1b[0m  \x1b[${failed ? '31' : '90'}m${failed} failed\x1b[0m\n`);

if (failures.length > 0) {
  console.log('\x1b[31mFailures:\x1b[0m');
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  console.log('');
}

process.exit(failed > 0 ? 1 : 0);
