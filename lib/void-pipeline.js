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

const { callWithFallback, PROVIDERS, DEFAULT_CHAIN, estimateTokens, getStrikeStatus } = require('./llm-client');
const { getContext } = require('./context-router');
const { getMemoryManager } = require('./memory-manager');
const { atomicQuery, getPsiEMA } = require('./nyan-api');
const { PSI_EMA_DOCUMENTATION } = require('./psi-ema');

const MAX_AUDIT_LOG = 200;
const _auditLog = [];

function addAuditEntry(entry) {
  _auditLog.push(entry);
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
function detectIntents(query) {
  const q = (query || '').trim();
  const intents = [];
  const tickerMatch = q.match(STOCK_PATTERN);

  if (tickerMatch) intents.push({ type: 'stock', ticker: tickerMatch[1].toUpperCase() });
  if (PSI_EMA_TRIGGER.test(q) && tickerMatch) intents.push({ type: 'psi-ema', ticker: tickerMatch[1].toUpperCase() });
  if (LEGAL_PATTERN.test(q)) intents.push({ type: 'legal' });
  if (/\b(search|find|look\s*up|latest|current|recent)\b/i.test(q)) intents.push({ type: 'search' });

  return intents;
}

/**
 * Build system prompt from MoE context + memory + mode
 */
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

  if (!query || !query.trim()) {
    return { response: 'nyan~', mode: 'describe', intents: [], provider: null, shortcut: 'empty' };
  }

  // ── 1. DETECT (parallel regex branches, all O(n)) ──
  const mode = detectMode(query);
  const intents = detectIntents(query);
  const identityHit = isIdentityQuery(query);
  const psiEmaExplainHit = isPsiEmaExplain(query);
  const complexity = scoreComplexity(query);

  // ── 2. GATE (privilege check) ──
  const privilege = checkPrivilege(mode, callerId);
  const effectiveMode = privilege.allowed ? mode : 'describe';

  // ── 2b. SAFETY GUARD (block dangerous patterns in prescribe mode) ──
  if (effectiveMode === 'prescribe' && containsDangerousPattern(query)) {
    console.warn(`[pipeline] BLOCKED dangerous pattern in prescribe query from ${callerId}`);
    const safetyResp = '[safety] blocked — destructive command pattern detected. This operation is not allowed through the pipeline.\n\nnyan~';
    const safetyAudit = { latencyMs: Date.now() - t0, tokensIn: estimateTokens(query), tokensOut: 0 };
    addAuditEntry({
      ts: new Date().toISOString(), mode: effectiveMode, provider: 'safety-guard',
      caller: callerId ? callerId.slice(0, 6) + '***' : null,
      ...safetyAudit, shortcut: 'blocked', intents: ['safety-block']
    });
    return {
      response: safetyResp,
      mode: effectiveMode,
      intents: [{ type: 'safety-block' }],
      provider: 'safety-guard',
      shortcut: 'blocked',
      audit: safetyAudit
    };
  }

  // ── 3. SHORTCUTS (no LLM call needed) ──
  if (identityHit) {
    const { getContext: getMoE } = require('./context-router');
    const ctx = getMoE('who are you nyan identity');
    const memory = getMemoryManager(sessionId);
    const identityResponse = applyPersonality(ctx.context || 'I am void nyan — philosophical AI of nyanbook. Origin=0, progression=φ². Sharp, curious, grounded in data.');
    memory.addMessage('user', query);
    memory.addMessage('assistant', identityResponse);
    const idAudit = {
      latencyMs: Date.now() - t0, tokensIn: estimateTokens(query), tokensOut: estimateTokens(identityResponse)
    };
    addAuditEntry({
      ts: new Date().toISOString(), mode: effectiveMode, provider: 'shortcut',
      caller: callerId ? callerId.slice(0, 6) + '***' : null,
      ...idAudit, shortcut: 'identity', intents: ['identity']
    });
    return {
      response: identityResponse,
      mode: effectiveMode,
      intents: [{ type: 'identity' }],
      provider: 'shortcut',
      shortcut: 'identity',
      audit: idAudit
    };
  }

  if (psiEmaExplainHit) {
    const memory = getMemoryManager(sessionId);
    const explanation = applyPersonality(PSI_EMA_DOCUMENTATION);
    memory.addMessage('user', query);
    memory.addMessage('assistant', explanation);
    const psiAudit = {
      latencyMs: Date.now() - t0, tokensIn: estimateTokens(query), tokensOut: estimateTokens(explanation)
    };
    addAuditEntry({
      ts: new Date().toISOString(), mode: effectiveMode, provider: 'shortcut',
      caller: callerId ? callerId.slice(0, 6) + '***' : null,
      ...psiAudit, shortcut: 'psi-ema-explain', intents: ['psi-ema-explain']
    });
    return {
      response: explanation,
      mode: effectiveMode,
      intents: [{ type: 'psi-ema-explain' }],
      provider: 'shortcut',
      shortcut: 'psi-ema-explain',
      audit: psiAudit
    };
  }

  // ── 4. CONTEXT (MoE expert files + session memory) ──
  const expertResult = getContext(query);
  const memory = getMemoryManager(sessionId);
  const memoryPrompt = memory.buildMemoryPrompt(query);
  const systemPrompt = buildSystemPrompt(query, effectiveMode, memoryPrompt, expertResult.context);

  // ── 5. CALL (single LLM call via fallback chain) ──
  // Complexity-based routing (PicoClaw-inspired):
  //   heavy queries → Nyan atomic brain first (it handles reasoning)
  //   light/medium → normal LLM fallback chain
  //   Nyan intent queries (stock, psi-ema, legal, search) → Nyan always
  let response;
  let provider = 'fallback-chain';

  const psiEmaTicker = intents.find(i => i.type === 'psi-ema')?.ticker;
  if (psiEmaTicker) {
    try {
      const psiResult = await getPsiEMA(psiEmaTicker);
      if (psiResult && !psiResult.error) {
        response = applyPersonality(psiResult.response || JSON.stringify(psiResult));
        provider = 'nyan-api';
      }
    } catch (e) {
      console.log(`[pipeline] psi-ema fetch failed: ${e.message}`);
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
    } catch (e) {
      response = `[error] all providers failed: ${e.message}`;
      provider = 'none';
    }
  }

  // ── 6. SIGN (personality stamp, regex only) ──
  response = applyPersonality(response);

  // ── 7. MEMORY (store for next call, shared across all modes/providers) ──
  memory.addMessage('user', query);
  memory.addMessage('assistant', response);

  if (memory.shouldSummarize()) {
    memory.generateSummary().catch(e => console.log(`[pipeline] summary failed: ${e.message}`));
  }

  // ── 8. AUDIT (compact trace, PicoClaw-inspired) ──
  const tokensIn = estimateTokens(query) + estimateTokens(systemPrompt);
  const tokensOut = estimateTokens(response);
  const latencyMs = Date.now() - t0;

  addAuditEntry({
    ts: new Date().toISOString(),
    mode: effectiveMode,
    provider,
    complexity,
    caller: callerId ? callerId.slice(0, 6) + '***' : null,
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
  scoreComplexity,
  applyPersonality,
  containsDangerousPattern,
  getPrivilegedIds,
  getAuditLog,
  getAuditSummary,
  DANGEROUS_PATTERNS
};
