/**
 * Void Pipeline - Unified O(n) Single-Pass Orchestrator
 * 
 * MoE-inspired routing: one pass through parallel detection branches,
 * then single LLM call with injected context. No sequential chains, no hanging.
 *
 * MODES (prescribe/scribe/describe):
 *   prescribe = build (kernel/code) — privileged, +628116360610 only
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

const { callWithFallback, PROVIDERS, DEFAULT_CHAIN } = require('./llm-client');
const { getContext } = require('./context-router');
const { getMemoryManager } = require('./memory-manager');
const { atomicQuery, getPsiEMA } = require('./nyan-api');
const { PSI_EMA_DOCUMENTATION } = require('./psi-ema');

const PRIVILEGED_NUMBER = '+628116360610';

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
 */
function checkPrivilege(mode, callerId) {
  if (mode !== 'prescribe') return { allowed: true };
  if (!callerId) return { allowed: false, reason: 'prescribe mode requires authentication' };
  const normalized = callerId.replace(/[\s\-]/g, '');
  if (normalized === PRIVILEGED_NUMBER) return { allowed: true };
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
  const { query, sessionId = 'default', callerId = null, options = {}, chain = null } = input;

  if (!query || !query.trim()) {
    return { response: 'nyan~', mode: 'describe', intents: [], provider: null, shortcut: 'empty' };
  }

  // ── 1. DETECT (parallel regex branches, all O(n)) ──
  const mode = detectMode(query);
  const intents = detectIntents(query);
  const identityHit = isIdentityQuery(query);
  const psiEmaExplainHit = isPsiEmaExplain(query);

  // ── 2. GATE (privilege check) ──
  const privilege = checkPrivilege(mode, callerId);
  const effectiveMode = privilege.allowed ? mode : 'describe';

  // ── 3. SHORTCUTS (no LLM call needed) ──
  if (identityHit) {
    const { getContext: getMoE } = require('./context-router');
    const ctx = getMoE('who are you nyan identity');
    const memory = getMemoryManager(sessionId);
    const identityResponse = applyPersonality(ctx.context || 'I am void nyan — philosophical AI of nyanbook. Origin=0, progression=φ². Sharp, curious, grounded in data.');
    memory.addMessage('user', query);
    memory.addMessage('assistant', identityResponse);
    return {
      response: identityResponse,
      mode: effectiveMode,
      intents: [{ type: 'identity' }],
      provider: 'shortcut',
      shortcut: 'identity'
    };
  }

  if (psiEmaExplainHit) {
    const memory = getMemoryManager(sessionId);
    const explanation = applyPersonality(PSI_EMA_DOCUMENTATION);
    memory.addMessage('user', query);
    memory.addMessage('assistant', explanation);
    return {
      response: explanation,
      mode: effectiveMode,
      intents: [{ type: 'psi-ema-explain' }],
      provider: 'shortcut',
      shortcut: 'psi-ema-explain'
    };
  }

  // ── 4. CONTEXT (MoE expert files + session memory) ──
  const expertResult = getContext(query);
  const memory = getMemoryManager(sessionId);
  const memoryPrompt = memory.buildMemoryPrompt(query);
  const systemPrompt = buildSystemPrompt(query, effectiveMode, memoryPrompt, expertResult.context);

  // ── 5. CALL (single LLM call via fallback chain) ──
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

  if (!response) {
    try {
      const result = await atomicQuery(query);
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

  return {
    response,
    mode: effectiveMode,
    modeRequested: mode,
    privilegeGranted: privilege.allowed,
    intents,
    provider,
    shortcut: null,
    memory: memory.getStats()
  };
}

module.exports = {
  runPipeline,
  detectMode,
  checkPrivilege,
  isIdentityQuery,
  isPsiEmaExplain,
  detectIntents,
  applyPersonality,
  PRIVILEGED_NUMBER
};
