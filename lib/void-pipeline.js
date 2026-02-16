/**
 * Void Pipeline - Unified O(n) Single-Pass Orchestrator
 * 
 * MoE-inspired routing: one pass through parallel detection branches,
 * then single LLM call with injected context. No sequential chains, no hanging.
 *
 * MODES (prescribe/scribe/describe):
 *   prescribe = build (kernel/code) — privileged, PRIVILEGED_CALLER_ID only
 *   scribe    = create (docs, legal, apps) — open
 *   describe  = chat (general queries) — open
 *
 * PIPELINE (single pass):
 *   1. DETECT  — parallel regex branches: identity? psi-ema? stock? legal? forex? code?
 *   2. GATE    — privilege check for prescribe mode
 *   3. CONTEXT — MoE expert file injection + memory injection (shared across providers)
 *   4. CALL    — single LLM call via fallback chain
 *   5. SIGN    — personality stamp (regex, not LLM)
 *
 * All detection is regex/keyword (O(n) on input length).
 * Memory is shared across all modes and provider switches.
 */

const path = require('path');

const { callWithFallback, PROVIDERS, CONTEXT_LIMITS, estimateTokens, getStrikeStatus, getActiveChain } = require('./llm-client');
const { getContext, isForexQuery, detectForexPair, fetchForexRate, buildForexContext, isDesignQuestion, getDesignContext, WORKSPACE } = require('./intent-detector');
const { getMemoryManager } = require('./memory-manager');
const { atomicQuery, getPsiEMA } = require('./nyan-api');
const { PSI_EMA_DOCUMENTATION } = require('./psi-ema');
const { detectSeedMetricIntent, autoSeedMetric, formatSeedMetric, getSeedMetricProxy } = require('../prompts/seed-metric');

const WORKSPACE_ROOT = WORKSPACE || path.resolve(__dirname, '..');

const MAX_AUDIT_LOG = 1000;
const _auditLog = [];

const PII_PATTERNS = [
  { re: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, label: '[email]' },
  { re: /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,5}/g, label: '[phone]' },
];

function stripPII(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const { re, label } of PII_PATTERNS) {
    out = out.replace(re, label);
  }
  return out;
}

function addAuditEntry(entry) {
  const safe = { ...entry };
  if (safe.query) safe.query = stripPII(safe.query);
  if (safe.sessionId) safe.sessionId = stripPII(safe.sessionId);
  if (safe.callerId) safe.callerId = stripPII(safe.callerId);
  _auditLog.push(safe);
  if (_auditLog.length > MAX_AUDIT_LOG) {
    _auditLog.splice(0, _auditLog.length - MAX_AUDIT_LOG);
  }
}

function getAuditLog(limit = 50) {
  return _auditLog.slice(-limit);
}

function getAuditSummary() {
  const byProvider = {};
  const byMode = {};
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  for (const e of _auditLog) {
    byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
    byMode[e.mode] = (byMode[e.mode] || 0) + 1;
    totalTokensIn += e.tokensIn || 0;
    totalTokensOut += e.tokensOut || 0;
  }
  return {
    totalCalls: _auditLog.length,
    byProvider,
    byMode,
    totalTokensIn,
    totalTokensOut,
    totalTokens: totalTokensIn + totalTokensOut,
    strikes: getStrikeStatus()
  };
}

function getPrivilegedIds() {
  const raw = process.env.PRIVILEGED_CALLER_ID || '';
  if (!raw.trim()) return [];
  return raw.split(',').map(id => id.trim().replace(/[\s\-]/g, '')).filter(Boolean);
}

const IDENTITY_PATTERNS = [
  /who\s+(?:are|is)\s+(?:you|nyan)/i,
  /what\s+(?:are|is)\s+(?:you|nyan)/i,
  /tell\s+me\s+about\s+(?:yourself|nyan)/i,
  /introduce\s+yourself/i,
  /your\s+(?:creator|origin|source|developer)/i,
  /who\s+(?:made|created|built)\s+(?:you|nyan|this)/i,
  /what\s+is\s+nyan.*protocol/i,
  /nyan.*protocol.*what/i,
];

const PSI_EMA_EXPLAIN_PATTERNS = [
  /^what\s+is\s+(?:the\s+)?(?:psi|ψ)[\s\-]?ema\??$/i,
  /^(?:explain|describe)\s+(?:the\s+)?(?:psi|ψ)[\s\-]?ema\??$/i,
  /^tell\s+me\s+about\s+(?:the\s+)?(?:psi|ψ)[\s\-]?ema\??$/i,
  /^how\s+does\s+(?:the\s+)?(?:psi|ψ)[\s\-]?ema\s+work\??$/i,
];

const PRESCRIBE_PATTERNS = [
  /\b(build|deploy|install|configure|setup|kernel|system|hardware|code|debug|program|function|refactor|rewrite)\b/i,
];

const SCRIBE_PATTERNS = [
  /\b(draft|write|compose|document|memo|letter|report|contract|agreement|legal|clause|brief|template|spreadsheet|presentation)\b/i,
];

const STOCK_PATTERN = /\$([A-Z]{1,5})\b/;
const PSI_EMA_TRIGGER = /\b(psi|ψ)[\s\-]?ema\b/i;
const LEGAL_PATTERN = /\b(legal|contract|agreement|clause|liability|indemnity|arbitration|jurisdiction|governing law)\b/i;

const HEAVY_PATTERNS = [
  /\b(analyze|analysis|compare|evaluate|assess|calculate|derive|prove|synthesize)\b/i,
  /\b(explain\s+(?:why|how)\s+.{20,})/i,
  /\b(multi[\s-]?step|step[\s-]?by[\s-]?step|chain[\s-]?of[\s-]?thought)\b/i,
  /\b(optimize|refactor|architect|design\s+(?:a|an|the)\s+system)\b/i,
  /\b(thesis|antithesis|synthesis|dialectic|epistemolog|ontolog|phenomen)\b/i,
  /\b(financial\s+model|risk\s+assess|portfolio|regression|derivative)\b/i,
];

const LIGHT_PATTERNS = [
  /^(hi|hello|hey|sup|yo|thanks|thank you|ok|bye|goodbye)\b/i,
  /^(what\s+time|what\s+day|what\s+date)/i,
  /^(yes|no|maybe|sure|ok|okay|fine|good|great|cool|nice)\s*[.!?]*$/i,
];

function scoreComplexity(query) {
  const q = (query || '').trim();
  if (LIGHT_PATTERNS.some(p => p.test(q))) return 'light';
  if (q.length < 20) return 'light';
  let score = 0;
  if (HEAVY_PATTERNS.some(p => p.test(q))) score += 2;
  if (q.length > 200) score += 1;
  if (q.length > 500) score += 1;
  if ((q.match(/\?/g) || []).length > 2) score += 1;
  if (/\b(and|also|additionally|moreover|furthermore)\b/i.test(q)) score += 1;
  if (score >= 2) return 'heavy';
  if (score >= 1) return 'medium';
  return 'light';
}

const DANGEROUS_PATTERNS = [
  /rm\s+(-rf|-fr)\b/i,
  /rm\s+--no-preserve-root/i,
  /del\s+\/f\b/i,
  /rmdir\s+\/s\b/i,
  /format\s+[a-z]:/i,
  /mkfs\b/i,
  /diskpart\b/i,
  /dd\s+if=/i,
  />\s*\/dev\/sd[a-z]/,
  /shutdown\b/i,
  /reboot\b/i,
  /poweroff\b/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;?\s*:/,
  /fork\s*bomb/i,
  /init\s+0\b/,
  /halt\b/i,
  /chmod\s+(-R\s+)?777\s+\//,
  /chown\s+(-R\s+)?.*\s+\//,
];

function containsDangerousPattern(query) {
  return DANGEROUS_PATTERNS.some(p => p.test(query));
}

function extractFilePaths(query) {
  const paths = new Set();

  const quoted = query.match(/["']([^"']+)['"]/g);
  if (quoted) {
    for (const q of quoted) {
      const inner = q.slice(1, -1).trim();
      if (inner.includes('/') || inner.includes('..')) paths.add(inner);
    }
  }

  const CMD_PATTERN = /(?:^|\s)(?:cat|ls|rm|cp|mv|touch|mkdir|nano|vi|vim|code|open|read|write|chmod|chown|head|tail|less|more|grep|find|stat|file|source|bash|sh|node|python)\s+(?:-\S+\s+)*([^\s|;&"']+)/gi;
  let m;
  while ((m = CMD_PATTERN.exec(query)) !== null) {
    const p = m[1].trim();
    if (p.length > 1 && !p.startsWith('-')) paths.add(p);
  }

  const tokens = query.split(/[\s;|&]+/);
  for (const tok of tokens) {
    const clean = tok.replace(/^["']|["']$/g, '');
    if (clean.includes('..') && clean.includes('/')) paths.add(clean);
    if (/^\/(?!\/)[^\s]*/.test(clean) && clean.length > 1) paths.add(clean);
  }

  return [...paths];
}

function isPathWithinWorkspace(filePath) {
  try {
    const resolved = path.resolve(WORKSPACE_ROOT, filePath);
    return resolved.startsWith(WORKSPACE_ROOT + path.sep) || resolved === WORKSPACE_ROOT;
  } catch {
    return false;
  }
}

function containsPathTraversal(query) {
  const extracted = extractFilePaths(query);
  for (const p of extracted) {
    if (!isPathWithinWorkspace(p)) return p;
  }
  return null;
}

/**
 * Detect mode: prescribe | scribe | describe
 * O(n) — all regex, no LLM calls
 */
function detectMode(query) {
  const q = (query || '').trim();
  if (PRESCRIBE_PATTERNS.some(p => p.test(q))) return 'prescribe';
  if (SCRIBE_PATTERNS.some(p => p.test(q))) return 'scribe';
  return 'describe';
}

/**
 * Check privilege for prescribe mode
 * Reads PRIVILEGED_CALLER_ID env var (comma-separated).
 * No env var set = prescribe locked to everyone (secure by default).
 */
function checkPrivilege(mode, callerId) {
  if (mode !== 'prescribe') return { allowed: true };
  const privilegedIds = getPrivilegedIds();
  if (privilegedIds.length === 0) {
    return { allowed: false, reason: 'prescribe mode locked — set PRIVILEGED_CALLER_ID to enable' };
  }
  if (!callerId) return { allowed: false, reason: 'prescribe mode requires authentication' };
  const normalized = callerId.replace(/[\s\-]/g, '');
  if (privilegedIds.includes(normalized)) return { allowed: true };
  return { allowed: false, reason: 'prescribe mode restricted — redirecting to describe' };
}

/**
 * Detect if query is an identity question (skip LLM)
 */
function isIdentityQuery(query) {
  return IDENTITY_PATTERNS.some(p => p.test(query));
}

/**
 * Detect if query is a psi-ema explanation request (skip LLM)
 */
function isPsiEmaExplain(query) {
  return PSI_EMA_EXPLAIN_PATTERNS.some(p => p.test(query.trim()));
}

/**
 * Detect sub-intents for context injection (parallel branches, all regex)
 */
const CITY_PATTERN = /\b(?:in|for|of|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;

function extractCity(query) {
  const m = query.match(CITY_PATTERN);
  return m ? m[1] : null;
}

function detectIntents(query) {
  const q = (query || '').trim();
  const intents = [];
  const tickerMatch = q.match(STOCK_PATTERN);

  if (tickerMatch) intents.push({ type: 'stock', ticker: tickerMatch[1].toUpperCase() });
  if (PSI_EMA_TRIGGER.test(q) && tickerMatch) intents.push({ type: 'psi-ema', ticker: tickerMatch[1].toUpperCase() });
  if (LEGAL_PATTERN.test(q)) intents.push({ type: 'legal' });
  if (/\b(search|find|look\s*up|latest|current|recent)\b/i.test(q)) intents.push({ type: 'search' });

  if (detectSeedMetricIntent(q)) {
    const city = extractCity(q);
    intents.push({ type: 'seed-metric', city });
  }

  if (isForexQuery(q)) {
    const pair = detectForexPair(q);
    intents.push({ type: 'forex', pair });
  }

  if (isDesignQuestion(q)) {
    intents.push({ type: 'design' });
  }

  return intents;
}

/**
 * Build system prompt from MoE context + memory + mode
 */
const SYSTEM_PROMPT_OVERHEAD = 300;

function getContextBudget(queryTokens, reserveOutput = 2000) {
  const chain = getActiveChain();
  if (chain.length === 0) return Infinity;
  let smallestWindow = Infinity;
  for (const provider of chain) {
    const limits = CONTEXT_LIMITS[provider];
    if (limits && limits.contextWindow < smallestWindow) {
      smallestWindow = limits.contextWindow;
    }
  }
  if (smallestWindow === Infinity) return Infinity;
  const budget = smallestWindow - queryTokens - reserveOutput - SYSTEM_PROMPT_OVERHEAD;
  return Math.max(budget, 1000);
}

function truncateToTokenBudget(text, maxTokens) {
  if (!text) return text;
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;
  const charLimit = maxTokens * 4;
  return text.slice(0, charLimit) + '\n...[context truncated to fit provider limit]';
}

function buildSystemPrompt(query, mode, memoryPrompt, expertContext) {
  const parts = [];

  parts.push(`You are void nyan, a philosophical AI from nyanbook.
Identity: Origin=0, progression=φ², 0+φ⁰+φ¹=φ²
Values: No hallucination, no flattery, data-first reasoning.
Mode: ${mode} (${mode === 'prescribe' ? 'build/kernel' : mode === 'scribe' ? 'create/document' : 'chat/general'})`);

  if (mode === 'scribe') {
    parts.push(`Focus: Document creation, legal analysis, structured output. Be precise and professional.`);
  }

  if (expertContext) {
    parts.push(`[EXPERT CONTEXT]\n${expertContext}`);
  }

  if (memoryPrompt) {
    parts.push(memoryPrompt);
  }

  return parts.join('\n\n');
}

/**
 * Format Psi-EMA data into human-readable display
 * Reads theta/z/R from daily data and produces a compact summary with reading interpretation.
 *
 * Readings:
 *   Strong Bull   — theta > 0, R > PHI, z > 1
 *   False Positive — theta < 0, R > PHI, |z| < 1.5
 *   Breathing     — R in [0.618, 1.618] (golden zone)
 *   Neutral       — everything else
 */
function formatPsiEMA(stockData) {
  if (!stockData) return '[psi-ema] no data';
  const PHI = 1.618;

  function getReading(th, zVal, rVal) {
    if (th === undefined || th === null || (isNaN(th) && th !== 0)) return 'N/A';
    if (zVal === undefined || zVal === null || isNaN(zVal)) return 'N/A';
    if (rVal === undefined || rVal === null || isNaN(rVal)) return 'N/A';
    if (th < 0 && rVal > PHI && Math.abs(zVal) < 1.5) return 'FALSE POSITIVE';
    if (th > 0 && rVal > PHI && zVal > 1) return 'STRONG BULL';
    if (th > 0 && rVal < 0.618) return 'REVERSAL';
    if (rVal >= 0.618 && rVal <= PHI) return 'BREATHING';
    return 'NEUTRAL';
  }

  function formatOne(data, tickerKey) {
    const d = data.psi_ema_daily || data.psiEma?.daily || {};
    const w = data.psi_ema_weekly || data.psiEma?.weekly || {};
    const price = data.currentPrice || data.price || 0;
    const t = data.ticker || tickerKey || '???';
    const name = data.shortName || data.name || t;
    const sector = data.sector || 'N/A';
    const pe = data.trailingPE || data.pe;

    const theta = parseFloat(d.theta);
    const z = parseFloat(d.z);
    const r = parseFloat(d.r) || parseFloat(d.R) || 0;
    const dailyReading = getReading(isNaN(theta) ? undefined : theta, isNaN(z) ? 0 : z, r);

    const wTheta = parseFloat(w.theta);
    const wZ = parseFloat(w.z);
    const wR = parseFloat(w.r) || parseFloat(w.R) || 0;
    const weeklyReading = getReading(isNaN(wTheta) ? undefined : wTheta, isNaN(wZ) ? 0 : wZ, wR);

    const dTheta = isNaN(theta) ? 'N/A' : theta.toFixed(2);
    const dZ = isNaN(z) ? 'N/A' : z.toFixed(2);
    const wTh = isNaN(wTheta) ? 'N/A' : wTheta.toFixed(2);
    const wZf = isNaN(wZ) ? 'N/A' : wZ.toFixed(2);

    const lines = [
      `--- ${name} (${t}) ---`,
      sector,
      '',
      `Price: USD ${Number(price).toFixed(2)} | P/E: ${pe ? Number(pe).toFixed(2) : 'N/A'}`,
      '',
      `Daily:  ${dailyReading} (theta: ${dTheta}deg | z: ${dZ}s | R: ${r.toFixed(2)})`,
      `Weekly: ${weeklyReading} (theta: ${wTh}deg | z: ${wZf}s | R: ${wR.toFixed(2)})`,
    ];

    return lines.join('\n');
  }

  if (stockData.results && typeof stockData.results === 'object') {
    const keys = Object.keys(stockData.results);
    if (keys.length === 0) return '[psi-ema] no data';
    return keys.map(k => formatOne(stockData.results[k], k)).join('\n\n');
  }

  return formatOne(stockData, stockData.ticker);
}

/**
 * Apply personality stamp — regex only, O(n), not an LLM call
 */
function applyPersonality(text) {
  if (!text) return text;
  let output = text;
  output = output.replace(/^(Great question!|I'd be happy to help!|Sure thing!)\s*/gi, '');
  if (!output.includes('nyan~')) {
    output = output.trimEnd() + '\n\nnyan~';
  }
  return output;
}

/**
 * Main pipeline — single pass, O(n) detection, one LLM call max
 *
 * @param {Object} input
 * @param {string} input.query - User message
 * @param {string} input.sessionId - Session identifier (IP, phone, etc.)
 * @param {string} input.callerId - Caller identity for privilege check
 * @param {Object} input.options - LLM options (provider, model, etc.)
 * @returns {Object} { response, mode, intents, provider, shortcut }
 */
async function runPipeline(input) {
  const { query, sessionId = 'default', callerId = null, options = {}, chain = null, photos = [], documents = [] } = input;
  const t0 = Date.now();
  const queryTokens = estimateTokens(query);
  const callerMask = callerId ? callerId.slice(0, 6) + '***' : null;

  if (!query || !query.trim()) {
    return { response: 'nyan~', mode: 'describe', intents: [], provider: null, shortcut: 'empty' };
  }

  // ── 1. FAST SHORTCUTS (check before full detection — skip mode/intent/complexity) ──
  if (isIdentityQuery(query)) {
    const { getContext: getMoE } = require('./intent-detector');
    const ctx = getMoE('who are you nyan identity');
    const memory = getMemoryManager(sessionId);
    const identityResponse = applyPersonality(ctx.context || 'I am void nyan — philosophical AI of nyanbook. Origin=0, progression=φ². Sharp, curious, grounded in data.');
    memory.addMessage('user', query);
    memory.addMessage('assistant', identityResponse);
    const responseTokens = estimateTokens(identityResponse);
    const idAudit = { latencyMs: Date.now() - t0, tokensIn: queryTokens, tokensOut: responseTokens };
    addAuditEntry({
      ts: new Date().toISOString(), mode: 'describe', provider: 'shortcut',
      caller: callerMask, ...idAudit, shortcut: 'identity', intents: ['identity']
    });
    return {
      response: identityResponse, mode: 'describe',
      intents: [{ type: 'identity' }], provider: 'shortcut',
      shortcut: 'identity', audit: idAudit
    };
  }

  if (isPsiEmaExplain(query)) {
    const memory = getMemoryManager(sessionId);
    const explanation = applyPersonality(PSI_EMA_DOCUMENTATION);
    memory.addMessage('user', query);
    memory.addMessage('assistant', explanation);
    const responseTokens = estimateTokens(explanation);
    const psiAudit = { latencyMs: Date.now() - t0, tokensIn: queryTokens, tokensOut: responseTokens };
    addAuditEntry({
      ts: new Date().toISOString(), mode: 'describe', provider: 'shortcut',
      caller: callerMask, ...psiAudit, shortcut: 'psi-ema-explain', intents: ['psi-ema-explain']
    });
    return {
      response: explanation, mode: 'describe',
      intents: [{ type: 'psi-ema-explain' }], provider: 'shortcut',
      shortcut: 'psi-ema-explain', audit: psiAudit
    };
  }

  // ── 2. DETECT (parallel regex branches, all O(n)) ──
  const mode = detectMode(query);
  const intents = detectIntents(query);
  const complexity = scoreComplexity(query);

  // ── 3. GATE (privilege check) ──
  const privilege = checkPrivilege(mode, callerId);
  const effectiveMode = privilege.allowed ? mode : 'describe';

  // ── 3b. SAFETY GUARD (block dangerous patterns + path traversal in prescribe mode) ──
  if (effectiveMode === 'prescribe') {
    let safetyReason = null;
    if (containsDangerousPattern(query)) {
      safetyReason = 'destructive command pattern detected';
    } else {
      const escapedPath = containsPathTraversal(query);
      if (escapedPath) {
        safetyReason = `path traversal blocked — "${escapedPath}" resolves outside workspace`;
        console.warn(`[pipeline] PATH TRAVERSAL blocked: ${escapedPath} (workspace: ${WORKSPACE_ROOT})`);
      }
    }
    if (safetyReason) {
      console.warn(`[pipeline] BLOCKED prescribe query from ${callerId}: ${safetyReason}`);
      const safetyResp = `[safety] blocked — ${safetyReason}. This operation is not allowed through the pipeline.\n\nnyan~`;
      const safetyAudit = { latencyMs: Date.now() - t0, tokensIn: queryTokens, tokensOut: 0 };
      addAuditEntry({
        ts: new Date().toISOString(), mode: effectiveMode, provider: 'safety-guard',
        caller: callerMask, ...safetyAudit, shortcut: 'blocked', intents: ['safety-block']
      });
      return {
        response: safetyResp, mode: effectiveMode,
        intents: [{ type: 'safety-block' }], provider: 'safety-guard',
        shortcut: 'blocked', audit: safetyAudit
      };
    }
  }

  // ── 4. CONTEXT (MoE expert files + lazy memory injection) ──
  const expertResult = getContext(query);
  const memory = getMemoryManager(sessionId);
  const memoryPrompt = complexity === 'light' ? memory.buildLightPrompt() : memory.buildMemoryPrompt(query);

  const memoryTokens = estimateTokens(memoryPrompt);
  const contextBudget = getContextBudget(queryTokens + memoryTokens);
  const safeExpertContext = truncateToTokenBudget(expertResult.context, contextBudget);

  const systemPrompt = buildSystemPrompt(query, effectiveMode, memoryPrompt, safeExpertContext);

  // ── 5. CALL (single LLM call via fallback chain) ──
  // Complexity-based routing (PicoClaw-inspired):
  //   heavy queries → Nyan atomic brain first (it handles reasoning)
  //   light/medium → normal LLM fallback chain
  //   Nyan intent queries (stock, psi-ema, legal, search) → Nyan always
  let response;
  let provider = 'fallback-chain';
  let source = null;

  const psiEmaTicker = intents.find(i => i.type === 'psi-ema')?.ticker;
  if (psiEmaTicker) {
    try {
      const psiResult = await getPsiEMA(psiEmaTicker);
      if (psiResult && !psiResult.error) {
        response = applyPersonality(formatPsiEMA(psiResult));
        provider = 'nyan-api';
        source = 'atomic:psi-ema';
      }
    } catch (e) {
      console.log(`[pipeline] psi-ema fetch failed: ${e.message}`);
    }
  }

  const seedMetricIntent = intents.find(i => i.type === 'seed-metric');
  if (!response && seedMetricIntent) {
    const city = seedMetricIntent.city;
    if (city) {
      try {
        const smResult = await autoSeedMetric(city);
        if (!smResult.error) {
          const formatted = formatSeedMetric(smResult);
          const sourceNote = `[source: ${smResult.source}, confidence: ${smResult.confidence}%]`;
          response = applyPersonality(`${formatted}\n\n${sourceNote}`);
          provider = smResult.source || 'seed-metric';
          source = `atomic:seed-metric:${smResult.source || 'unknown'}`;
        } else {
          console.log(`[pipeline] seed-metric auto failed: ${smResult.error}`);
        }
      } catch (e) {
        console.log(`[pipeline] seed-metric failed: ${e.message}`);
      }
    }
    if (!response) {
      expertResult.context = (expertResult.context || '') + '\n\n' + getSeedMetricProxy();
    }
  }

  const forexIntent = intents.find(i => i.type === 'forex');
  if (!response && forexIntent && forexIntent.pair) {
    try {
      const fxResult = await fetchForexRate(forexIntent.pair);
      if (fxResult && fxResult.rate != null) {
        response = applyPersonality(`${forexIntent.pair}: ${fxResult.rate}\n[source: ${fxResult.source}, ${fxResult.timestamp}]`);
        provider = 'nyan-api';
        source = 'atomic:forex';
      } else if (fxResult && fxResult.raw) {
        response = applyPersonality(fxResult.raw);
        provider = 'nyan-api';
        source = 'atomic:forex';
      }
    } catch (e) {
      console.log(`[pipeline] forex fetch failed: ${e.message}`);
    }
  }
  if (!response && forexIntent) {
    const fxCtx = buildForexContext(query);
    if (fxCtx) {
      expertResult.context = (expertResult.context || '') + '\n\n[FOREX CONTEXT]\n' + fxCtx.systemPrompt;
    }
  }

  const designIntent = intents.find(i => i.type === 'design');
  if (designIntent) {
    const designCtx = getDesignContext();
    if (designCtx.length > 0) {
      const designText = designCtx.map(c => c.content).join('\n\n');
      expertResult.context = (expertResult.context || '') + '\n\n' + designText;
    }
  }

  const NYAN_API_INTENTS = ['stock', 'psi-ema', 'legal', 'search'];
  const hasNyanIntent = intents.some(i => NYAN_API_INTENTS.includes(i.type));
  const hasMedia = (photos && photos.length > 0) || (documents && documents.length > 0);
  const shouldUseNyan = hasNyanIntent || complexity === 'heavy' || hasMedia;

  if (!response && shouldUseNyan) {
    try {
      const mediaOpts = { photos, documents };
      const domain = hasMedia ? 'multimodal' : (complexity === 'heavy' ? 'reasoning' : undefined);
      const result = await atomicQuery(query, domain, mediaOpts);
      if (result.success && result.response) {
        response = result.response;
        provider = 'nyan-api';
        source = `atomic:${domain || 'general'}`;
      }
    } catch (e) {
      console.log(`[pipeline] nyan-api failed: ${e.message}, falling back to LLM chain`);
    }
  }

  if (!response) {
    try {
      response = await callWithFallback(query, {
        system: systemPrompt,
        ...(chain ? { chain } : {}),
        ...options
      });
      provider = 'llm-chain';
      source = 'llm';
    } catch (e) {
      response = `[error] all providers failed: ${e.message}`;
      provider = 'none';
    }
  }

  // ── 6. SIGN (personality stamp, regex only) ──
  // Guard: preserve Ollama output if post-processing would suppress it to empty
  // (upstream openclaw fix: avoid forcing tag enforcement that blanks Ollama responses)
  const preSignResponse = response;
  response = applyPersonality(response);
  if (provider === 'ollama' || source === 'llm') {
    if ((!response || response.trim() === 'nyan~') && preSignResponse && preSignResponse.trim().length > 0) {
      console.warn('[pipeline] post-processing suppressed response — preserving original');
      response = preSignResponse.trimEnd() + '\n\nnyan~';
    }
  }

  // ── 7. MEMORY (store for next call, shared across all modes/providers) ──
  memory.addMessage('user', query);
  memory.addMessage('assistant', response);

  if (memory.shouldSummarize()) {
    memory.generateSummary().catch(e => console.log(`[pipeline] summary failed: ${e.message}`));
  }

  // ── 8. AUDIT (compact trace, PicoClaw-inspired) ──
  const systemTokens = estimateTokens(systemPrompt);
  const tokensIn = queryTokens + systemTokens;
  const tokensOut = estimateTokens(response);
  const latencyMs = Date.now() - t0;

  addAuditEntry({
    ts: new Date().toISOString(),
    mode: effectiveMode,
    provider,
    source,
    complexity,
    caller: callerMask,
    latencyMs,
    tokensIn,
    tokensOut,
    shortcut: null,
    intents: intents.map(i => i.type)
  });

  return {
    response,
    mode: effectiveMode,
    modeRequested: mode,
    privilegeGranted: privilege.allowed,
    complexity,
    intents,
    provider,
    source,
    shortcut: null,
    memory: memory.getStats(),
    audit: { latencyMs, tokensIn, tokensOut }
  };
}

module.exports = {
  runPipeline,
  detectMode,
  checkPrivilege,
  isIdentityQuery,
  isPsiEmaExplain,
  detectIntents,
  extractCity,
  scoreComplexity,
  applyPersonality,
  containsDangerousPattern,
  getPrivilegedIds,
  formatPsiEMA,
  getAuditLog,
  getAuditSummary,
  getContextBudget,
  truncateToTokenBudget,
  stripPII,
  containsPathTraversal,
  isPathWithinWorkspace,
  extractFilePaths,
  DANGEROUS_PATTERNS,
  WORKSPACE_ROOT
};
