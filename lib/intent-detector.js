/**
 * Intent Detector — consolidated context routing, forex detection, design detection
 *
 * Merges context-router.js + forex-fetcher.js + code-context.js into one module.
 * Single regex compilation, cached file reads, unified export surface.
 *
 * Exports:
 *   getContext(query)         — MoE expert context { experts, context, intents, tokenEstimate }
 *   route(query)              — raw expert routing (returns expert names)
 *   isForexQuery(text)        — true if forex-related
 *   detectForexPair(text)     — returns pair string or null
 *   fetchForexRate(pair)      — async, returns { pair, rate, source, timestamp } or null
 *   buildForexContext(query)  — returns { type, pair, systemPrompt } or null
 *   isDesignQuestion(text)    — true if architecture/design/pattern question
 *   getDesignContext()        — returns system messages array with PHILOSOPHY.md + lib/README.md
 *   getSystemContextForDesign — alias for getDesignContext (backwards compat)
 */

const fs = require('fs');
const path = require('path');
const { atomicQuery } = require('./nyan-api');

const WORKSPACE = process.env.OPENCLAW_WORKSPACE
  ? path.resolve(process.env.OPENCLAW_WORKSPACE)
  : path.resolve(__dirname, '..');

// ─── file cache (read once, reuse) ───────────────────────────

const _fileCache = {};

function readFileCached(relPath) {
  if (_fileCache[relPath] !== undefined) return _fileCache[relPath];
  try {
    const fullPath = path.resolve(WORKSPACE, relPath);
    if (!fullPath.startsWith(WORKSPACE)) {
      console.warn(`[intent-detector] path traversal blocked: ${relPath}`);
      _fileCache[relPath] = null;
      return null;
    }
    if (fs.existsSync(fullPath)) {
      _fileCache[relPath] = fs.readFileSync(fullPath, 'utf8');
      return _fileCache[relPath];
    }
  } catch (e) { /* silent */ }
  _fileCache[relPath] = null;
  return null;
}

// ─── MoE context routing ─────────────────────────────────────

const EXPERTS = {
  core: ['IDENTITY.md', 'SOUL.md'],
  philosophy: ['PHILOSOPHY.md', 'IDENTITY.md'],
  memory: [],
  tools: ['TOOLS.md'],
  daily: []
};

const TRIGGERS = {
  philosophy: ['φ', 'phi', 'philosophy', 'nyan', 'fire', 'logos', 'genesis', 'peano', 'dimension', 'gougu', 'tetralemma', 'paticca', 'dependent', 'impermanence', 'suffering', 'awakening', 'dialectic', 'koan', 'void', 'ontology', 'substrate'],
  memory: ['remember', 'past', 'yesterday', 'earlier', 'before', 'context', 'what did we', 'history'],
  tools: ['price', 'weather', 'cpo', 'stock', 'psi-ema', 'model', 'ollama', 'openclaw', 'api', 'token'],
  daily: ['today', 'morning', 'afternoon', 'evening', 'now']
};

function getDailyFile() {
  const today = new Date().toISOString().split('T')[0];
  const dailyPath = path.join(WORKSPACE, 'memory', `${today}.md`);
  if (fs.existsSync(dailyPath)) return `memory/${today}.md`;
  return null;
}

function route(query) {
  const q = (query || '').toLowerCase();
  const experts = new Set(['core']);
  for (const [expert, keywords] of Object.entries(TRIGGERS)) {
    if (keywords.some(k => q.includes(k))) experts.add(expert);
  }
  const dailyFile = getDailyFile();
  if (dailyFile) EXPERTS.daily = [dailyFile];
  return Array.from(experts);
}

function getContext(query) {
  if (!query) return { experts: ['core'], context: '', tokenEstimate: 0 };
  try {
    const experts = route(query);
    const context = [];
    const seen = new Set();
    for (const expert of experts) {
      const files = EXPERTS[expert] || [];
      for (const file of files) {
        if (seen.has(file)) continue;
        seen.add(file);
        const content = readFileCached(file);
        if (content) context.push(`--- ${expert.toUpperCase()}: ${file} ---\n${content}`);
      }
    }
    return {
      experts,
      context: context.join('\n\n'),
      tokenEstimate: Math.ceil(context.join('').split(' ').length * 1.3)
    };
  } catch (e) {
    console.error('Context router error:', e.message);
    return { experts: ['core'], context: '', tokenEstimate: 0 };
  }
}

// ─── forex detection ─────────────────────────────────────────

const FOREX_PAIRS = {
  'EUR/USD': ['eur/usd', 'eurusd', 'euro dollar', 'euro usd', 'eur usd'],
  'GBP/USD': ['gbp/usd', 'gbpusd', 'pound dollar', 'gbp usd', 'sterling dollar'],
  'USD/JPY': ['usd/jpy', 'usdjpy', 'dollar yen', 'usd jpy'],
  'USD/CHF': ['usd/chf', 'usdchf', 'dollar franc', 'usd chf'],
  'AUD/USD': ['aud/usd', 'audusd', 'aussie dollar', 'aud usd'],
  'USD/CAD': ['usd/cad', 'usdcad', 'dollar loonie', 'usd cad'],
  'NZD/USD': ['nzd/usd', 'nzdusd', 'kiwi dollar', 'nzd usd'],
  'EUR/GBP': ['eur/gbp', 'eurgbp', 'euro pound', 'eur gbp'],
  'EUR/JPY': ['eur/jpy', 'eurjpy', 'euro yen', 'eur jpy'],
  'GBP/JPY': ['gbp/jpy', 'gbpjpy', 'pound yen', 'gbp jpy'],
  'USD/IDR': ['usd/idr', 'usdidr', 'dollar rupiah', 'usd idr', 'rupiah'],
  'USD/SGD': ['usd/sgd', 'usdsgd', 'dollar sgd', 'usd sgd', 'singapore dollar'],
  'USD/CNY': ['usd/cny', 'usdcny', 'dollar yuan', 'usd cny', 'yuan', 'renminbi', 'rmb'],
  'USD/KRW': ['usd/krw', 'usdkrw', 'dollar won', 'usd krw', 'korean won'],
  'XAU/USD': ['xau/usd', 'xauusd', 'gold price', 'gold usd', 'gold spot'],
};

const FOREX_GENERAL_REGEX = /\b(forex|fx|exchange rate|currency|foreign exchange|currency pair|spot rate)\b/i;
const FOREX_CURRENCY_REGEX = /\b(usd|eur|gbp|jpy|chf|aud|cad|nzd|idr|sgd|cny|krw|xau|dollar|euro|pound|yen|franc|rupiah|yuan|won)\b/i;

function isForexQuery(text) {
  if (!text || typeof text !== 'string') return false;
  if (FOREX_GENERAL_REGEX.test(text)) return true;
  const lower = text.toLowerCase();
  for (const aliases of Object.values(FOREX_PAIRS)) {
    if (aliases.some(a => lower.includes(a))) return true;
  }
  const currencies = lower.match(FOREX_CURRENCY_REGEX);
  if (currencies) {
    const rateWords = /\b(rate|price|convert|exchange|how much|worth|value|against|to|vs|versus)\b/i;
    if (rateWords.test(text)) return true;
  }
  return false;
}

function detectForexPair(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const [pair, aliases] of Object.entries(FOREX_PAIRS)) {
    if (aliases.some(a => lower.includes(a))) return pair;
  }
  const slashMatch = text.match(/\b([A-Z]{3})\s*[\/\\]\s*([A-Z]{3})\b/i);
  if (slashMatch) return `${slashMatch[1].toUpperCase()}/${slashMatch[2].toUpperCase()}`;
  return null;
}

async function fetchForexRate(pair) {
  if (!pair) return null;
  try {
    const result = await atomicQuery(
      `Current ${pair} exchange rate. Reply with ONLY the number (e.g. 1.0842). No text, no explanation.`,
      'forex'
    );
    if (!result || !result.success) return null;
    const numMatch = (result.response || '').match(/[\d]+\.[\d]+/);
    if (numMatch) {
      return { pair, rate: parseFloat(numMatch[0]), source: 'nyanbook.io', timestamp: new Date().toISOString(), raw: result.response };
    }
    return { pair, rate: null, source: 'nyanbook.io', timestamp: new Date().toISOString(), raw: result.response };
  } catch (e) {
    console.error(`[forex] fetchForexRate(${pair}) failed:`, e.message);
    return null;
  }
}

function buildForexContext(text) {
  const pair = detectForexPair(text);
  if (!pair) return null;
  return {
    type: 'forex',
    pair,
    systemPrompt: `The user is asking about the ${pair} currency pair. Provide current rate context, recent trend if known, and any relevant factors affecting this pair. Be concise and data-focused.`
  };
}

// ─── design question detection ───────────────────────────────

const DESIGN_KEYWORDS = /\b(architect(?:ure)?|design|pattern|refactor|structure|module|kernel|satellite|coupling|cohesion|separation|abstraction|interface|protocol|pipeline|layer|dependency|inject|composition|inheritance|encapsulat|decouple|solid|dry|kiss|yagni|clean code|code review|best practice|anti.?pattern|code smell|technical debt|monolith|microservice|event.?driven|pub.?sub|observer|factory|singleton|strategy|middleware|plugin|hook|extension)\b/i;

const PHILOSOPHY_KEYWORDS = /\b(phi|φ|golden ratio|fibonacci|fractal|emergence|substrate|void|nyan|kernel|satellite|pico.?claw|o\(n\)|single.?pass|moe|mixture of experts)\b/i;

function isDesignQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  return DESIGN_KEYWORDS.test(text) || PHILOSOPHY_KEYWORDS.test(text);
}

function getDesignContext() {
  const context = [];
  const philContent = readFileCached('PHILOSOPHY.md');
  if (philContent) {
    const trimmed = philContent.length > 4000 ? philContent.slice(0, 4000) + '\n...(truncated)' : philContent;
    context.push({ role: 'system', content: `[DESIGN CONTEXT — PHILOSOPHY.md]\n${trimmed}` });
  }
  const readmeContent = readFileCached(path.join('lib', 'README.md'));
  if (readmeContent) {
    const trimmed = readmeContent.length > 2000 ? readmeContent.slice(0, 2000) + '\n...(truncated)' : readmeContent;
    context.push({ role: 'system', content: `[DESIGN CONTEXT — Kernel+Satellites Architecture]\n${trimmed}` });
  }
  return context;
}

module.exports = {
  route,
  getContext,
  EXPERTS,
  TRIGGERS,
  WORKSPACE,

  isForexQuery,
  detectForexPair,
  fetchForexRate,
  buildForexContext,
  FOREX_PAIRS,

  isDesignQuestion,
  getDesignContext,
  getSystemContextForDesign: getDesignContext,
  DESIGN_KEYWORDS,
  PHILOSOPHY_KEYWORDS,
};
