/**
 * LLM Client - Unified hybrid router
 * Local: Ollama (Qwen) on Mac Mini M4
 * Cloud: MiniMax, Claude, Groq
 * Fallback chain: configurable per-call or global
 *
 * PicoClaw-inspired: Self-healing strike system
 * — providers that fail 3x consecutively get demoted to back of chain
 * — auto-recovers after STRIKE_COOLDOWN_MS or on hot-reload
 */

const axios = require('axios');

const PROVIDERS = {
  MINIMAX: 'minimax',
  OLLAMA: 'ollama',
  GROQ: 'groq',
  CLAUDE: 'claude',
  OPENAI: 'openai'
};

const DEFAULT_CHAIN = [PROVIDERS.MINIMAX, PROVIDERS.GROQ, PROVIDERS.CLAUDE, PROVIDERS.OPENAI, PROVIDERS.OLLAMA];

const STRIKE_THRESHOLD = 3;
const STRIKE_COOLDOWN_MS = 5 * 60 * 1000;

const _strikes = {};

function recordStrike(provider) {
  if (!_strikes[provider]) {
    _strikes[provider] = { count: 0, lastFail: 0, demoted: false };
  }
  const s = _strikes[provider];
  s.count++;
  s.lastFail = Date.now();
  if (s.count >= STRIKE_THRESHOLD && !s.demoted) {
    s.demoted = true;
    console.warn(`[llm] STRIKE: ${provider} demoted after ${s.count} consecutive failures — moved to back of chain`);
  }
}

function recordSuccess(provider) {
  if (_strikes[provider]) {
    _strikes[provider] = { count: 0, lastFail: 0, demoted: false };
  }
}

function isProviderDemoted(provider) {
  const s = _strikes[provider];
  if (!s || !s.demoted) return false;
  if (Date.now() - s.lastFail > STRIKE_COOLDOWN_MS) {
    s.count = 0;
    s.demoted = false;
    console.log(`[llm] RECOVER: ${provider} cooldown expired — restored to chain position`);
    return false;
  }
  return true;
}

function getStrikeStatus() {
  const status = {};
  for (const [provider, s] of Object.entries(_strikes)) {
    if (s.count > 0) {
      status[provider] = {
        strikes: s.count,
        demoted: s.demoted,
        lastFail: new Date(s.lastFail).toISOString(),
        recoversIn: s.demoted ? Math.max(0, STRIKE_COOLDOWN_MS - (Date.now() - s.lastFail)) : 0
      };
    }
  }
  return status;
}

function resetStrikes() {
  for (const key of Object.keys(_strikes)) {
    delete _strikes[key];
  }
}

let _dynamicChain = null;

function setDynamicChain(chain) {
  _dynamicChain = chain;
  resetStrikes();
}

function getActiveChain() {
  const base = _dynamicChain || DEFAULT_CHAIN;
  const healthy = base.filter(p => !isProviderDemoted(p));
  const demoted = base.filter(p => isProviderDemoted(p));
  return [...healthy, ...demoted];
}

const CONTEXT_LIMITS = {
  [PROVIDERS.MINIMAX]: { contextWindow: 200000, maxOutputTokens: 16384 },
  [PROVIDERS.GROQ]: { contextWindow: 131072, maxOutputTokens: 8192 },
  [PROVIDERS.CLAUDE]: { contextWindow: 200000, maxOutputTokens: 8192 },
  [PROVIDERS.OPENAI]: { contextWindow: 128000, maxOutputTokens: 16384 },
  [PROVIDERS.OLLAMA]: { contextWindow: 32768, maxOutputTokens: 4096 }
};

function clampTokens(provider, requestedTokens) {
  const limits = CONTEXT_LIMITS[provider];
  if (!limits) return requestedTokens;
  const max = limits.maxOutputTokens;
  if (requestedTokens > max) {
    console.log(`[llm] clamping maxTokens ${requestedTokens} -> ${max} for ${provider} (limit: ${limits.contextWindow} ctx)`);
    return max;
  }
  return requestedTokens;
}

const DEFAULTS = {
  temperature: 0.7,
  maxTokens: 2000,
  timeout: 60000,
  models: {
    [PROVIDERS.OLLAMA]: 'qwen2.5-coder:7b',
    [PROVIDERS.MINIMAX]: 'MiniMax-M1',
    [PROVIDERS.GROQ]: 'llama-3.1-8b-instant',
    [PROVIDERS.CLAUDE]: 'claude-sonnet-4-20250514',
    [PROVIDERS.OPENAI]: 'gpt-4o-mini'
  }
};

function getConfig(provider) {
  switch (provider) {
    case PROVIDERS.OLLAMA:
      return {
        url: process.env.OLLAMA_URL || 'http://localhost:11434/api/chat',
        key: null
      };
    case PROVIDERS.MINIMAX:
      return {
        url: process.env.MINIMAX_URL || 'https://api.minimax.chat/v1/text/chatcompletion_pro',
        key: process.env.MINIMAX_API_KEY
      };
    case PROVIDERS.GROQ:
      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY || process.env.PLAYGROUND_GROQ_TOKEN
      };
    case PROVIDERS.CLAUDE:
      return {
        url: 'https://api.anthropic.com/v1/messages',
        key: process.env.ANTHROPIC_API_KEY
      };
    case PROVIDERS.OPENAI:
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        key: process.env.OPENAI_API_KEY
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOllama(messages, opts) {
  const cfg = getConfig(PROVIDERS.OLLAMA);
  const body = {
    model: opts.model || DEFAULTS.models[PROVIDERS.OLLAMA],
    messages,
    stream: false,
    options: {}
  };
  if (opts.temperature != null) body.options.temperature = opts.temperature;
  if (opts.maxTokens) body.options.num_predict = opts.maxTokens;
  const ctxLimit = CONTEXT_LIMITS[PROVIDERS.OLLAMA]?.contextWindow;
  if (ctxLimit) body.options.num_ctx = ctxLimit;
  const res = await axios.post(cfg.url, body, { timeout: opts.timeout || 120000 });
  return res.data.message?.content || '';
}

async function callOpenAICompat(provider, messages, opts) {
  const cfg = getConfig(provider);
  if (!cfg.key) throw new Error(`${provider}: no API key`);
  const res = await axios.post(cfg.url, {
    model: opts.model || DEFAULTS.models[provider],
    messages,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens
  }, {
    headers: {
      'Authorization': `Bearer ${cfg.key}`,
      'Content-Type': 'application/json'
    },
    timeout: opts.timeout || DEFAULTS.timeout
  });
  return res.data.choices?.[0]?.message?.content || '';
}

async function callClaude(messages, opts) {
  const cfg = getConfig(PROVIDERS.CLAUDE);
  if (!cfg.key) throw new Error('claude: no API key');
  const system = messages.find(m => m.role === 'system')?.content || '';
  const userMsgs = messages.filter(m => m.role !== 'system');
  const res = await axios.post(cfg.url, {
    model: opts.model || DEFAULTS.models[PROVIDERS.CLAUDE],
    max_tokens: opts.maxTokens || DEFAULTS.maxTokens,
    system: system || undefined,
    messages: userMsgs
  }, {
    headers: {
      'x-api-key': cfg.key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    timeout: opts.timeout || DEFAULTS.timeout
  });
  return res.data.content?.[0]?.text || '';
}

async function callProvider(provider, messages, opts = {}) {
  const clamped = { ...opts };
  if (clamped.maxTokens) {
    clamped.maxTokens = clampTokens(provider, clamped.maxTokens);
  }
  switch (provider) {
    case PROVIDERS.OLLAMA:
      return await callOllama(messages, clamped);
    case PROVIDERS.CLAUDE:
      return await callClaude(messages, clamped);
    case PROVIDERS.MINIMAX:
    case PROVIDERS.GROQ:
    case PROVIDERS.OPENAI:
      return await callOpenAICompat(provider, messages, clamped);
    default:
      throw new Error(`Unknown: ${provider}`);
  }
}

function buildMessages(prompt, systemPrompt) {
  const msgs = [];
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
  if (typeof prompt === 'string') {
    msgs.push({ role: 'user', content: prompt });
  } else if (Array.isArray(prompt)) {
    msgs.push(...prompt);
  }
  return msgs;
}

async function callLLM(prompt, options = {}) {
  const {
    provider = PROVIDERS.OLLAMA,
    system = null,
    model = null,
    temperature = DEFAULTS.temperature,
    maxTokens = DEFAULTS.maxTokens,
    timeout = DEFAULTS.timeout
  } = options;

  const messages = buildMessages(prompt, system);
  return await callProvider(provider, messages, { model, temperature, maxTokens, timeout });
}

async function callWithFallback(prompt, options = {}) {
  const {
    chain = getActiveChain(),
    system = null,
    model = null,
    temperature = DEFAULTS.temperature,
    maxTokens = DEFAULTS.maxTokens,
    timeout = DEFAULTS.timeout
  } = options;

  if (options.provider) {
    const start = Date.now();
    try {
      const result = await callLLM(prompt, options);
      recordSuccess(options.provider);
      return result;
    } catch (e) {
      recordStrike(options.provider);
      throw e;
    }
  }

  const messages = buildMessages(prompt, system);
  let lastError = null;
  let usedProvider = null;

  for (const provider of chain) {
    try {
      const result = await callProvider(provider, messages, { model, temperature, maxTokens, timeout });
      recordSuccess(provider);
      usedProvider = provider;
      return result;
    } catch (e) {
      console.error(`[llm] ${provider} failed: ${e.message}`);
      recordStrike(provider);
      lastError = e;
    }
  }

  throw lastError || new Error('All providers failed');
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

module.exports = {
  PROVIDERS,
  DEFAULTS,
  DEFAULT_CHAIN,
  CONTEXT_LIMITS,
  STRIKE_THRESHOLD,
  STRIKE_COOLDOWN_MS,
  callLLM,
  callProvider,
  callWithFallback,
  callOllama,
  callClaude,
  buildMessages,
  setDynamicChain,
  getActiveChain,
  clampTokens,
  recordStrike,
  recordSuccess,
  isProviderDemoted,
  getStrikeStatus,
  resetStrikes,
  estimateTokens
};
