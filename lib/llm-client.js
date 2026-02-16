/**
 * LLM Client - Unified interface for multiple providers
 * Supports: MiniMax, Groq, Claude, OpenAI, Ollama (substrate)
 * Dynamic chain built at startup via env-detect.js
 *
 * Self-healing strike system (prod-grade):
 * — providers that fail 3x consecutively get demoted to back of chain
 * — auto-recovers after STRIKE_COOLDOWN_MS or on hot-reload
 * — passive health stats tracked from real requests (no synthetic pings)
 */

const axios = require('axios');

const PROVIDERS = {
  MINIMAX: 'minimax',
  GROQ: 'groq',
  CLAUDE: 'claude',
  OPENAI: 'openai',
  OLLAMA: 'ollama'
};

const CONTEXT_LIMITS = {
  [PROVIDERS.MINIMAX]: { contextWindow: 200000 },
  [PROVIDERS.GROQ]: { contextWindow: 128000 },
  [PROVIDERS.CLAUDE]: { contextWindow: 200000, maxOutputTokens: 8192 },
  [PROVIDERS.OPENAI]: { contextWindow: 128000, maxOutputTokens: 16384 },
  [PROVIDERS.OLLAMA]: { contextWindow: 32768 }
};

let DYNAMIC_CHAIN = [PROVIDERS.MINIMAX, PROVIDERS.OLLAMA];

const STRIKE_THRESHOLD = 3;
const STRIKE_COOLDOWN_MS = 5 * 60 * 1000;
const LATENCY_WINDOW = 20;

const _strikes = {};
const _stats = {};

function _ensureStats(provider) {
  if (!_stats[provider]) {
    _stats[provider] = {
      totalCalls: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      lastSuccess: null,
      lastFailure: null,
      lastError: null,
      recentLatencies: [],
      status: 'unknown'
    };
  }
  return _stats[provider];
}

function recordStrike(provider, errorMsg) {
  provider = provider.toLowerCase();
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

  const st = _ensureStats(provider);
  st.totalCalls++;
  st.totalFailures++;
  st.lastFailure = Date.now();
  st.lastError = errorMsg || 'unknown';
  st.status = s.demoted ? 'demoted' : 'degraded';
}

function recordSuccess(provider, latencyMs) {
  provider = provider.toLowerCase();
  if (_strikes[provider]) {
    _strikes[provider] = { count: 0, lastFail: 0, demoted: false };
  }

  const st = _ensureStats(provider);
  st.totalCalls++;
  st.totalSuccesses++;
  st.lastSuccess = Date.now();
  st.lastError = null;
  st.status = 'healthy';
  if (typeof latencyMs === 'number') {
    st.recentLatencies.push(latencyMs);
    if (st.recentLatencies.length > LATENCY_WINDOW) {
      st.recentLatencies.shift();
    }
  }
}

function isProviderDemoted(provider) {
  const s = _strikes[provider];
  if (!s || !s.demoted) return false;
  if (Date.now() - s.lastFail > STRIKE_COOLDOWN_MS) {
    s.count = 0;
    s.demoted = false;
    const st = _ensureStats(provider);
    st.status = 'recovered';
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

function getProviderStats() {
  const result = {};
  for (const [provider, st] of Object.entries(_stats)) {
    const latencies = st.recentLatencies;
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    result[provider] = {
      totalCalls: st.totalCalls,
      successes: st.totalSuccesses,
      failures: st.totalFailures,
      successRate: st.totalCalls > 0 ? Math.round((st.totalSuccesses / st.totalCalls) * 100) : null,
      avgLatencyMs: avgLatency,
      lastSuccess: st.lastSuccess ? new Date(st.lastSuccess).toISOString() : null,
      lastFailure: st.lastFailure ? new Date(st.lastFailure).toISOString() : null,
      lastError: st.lastError,
      status: st.status
    };
  }
  return result;
}

function resetStrikes() {
  for (const key of Object.keys(_strikes)) {
    delete _strikes[key];
  }
}

function setDynamicChain(chain) {
  if (chain && Array.isArray(chain) && chain.length > 0) {
    DYNAMIC_CHAIN = chain.map(p => p.toLowerCase());
    resetStrikes();
    console.log('[llm-client] Dynamic chain set:', DYNAMIC_CHAIN.join(' -> '));
  }
}

function getActiveChain() {
  const base = [...DYNAMIC_CHAIN];
  const demotedSet = new Set();
  for (const p of base) {
    if (isProviderDemoted(p)) demotedSet.add(p);
  }
  const healthy = base.filter(p => !demotedSet.has(p));
  const demoted = base.filter(p => demotedSet.has(p));
  return [...healthy, ...demoted];
}

function buildMessages(systemPrompt, userPrompt) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

function isEmptyResponse(result) {
  return !result || (typeof result === 'string' && result.trim().length === 0);
}

async function callLLM(prompt, options = {}) {
  const {
    provider = null,
    system = null,
    model = null,
    temperature = 0.7,
    maxTokens = 2000
  } = options;

  if (provider) {
    const t0 = Date.now();
    try {
      const result = await routeToProvider(provider, prompt, { system, model, temperature, maxTokens });
      if (isEmptyResponse(result)) {
        const emptyMsg = `${provider} returned empty response (no chunks)`;
        console.warn(`[llm-client] ${emptyMsg}`);
        recordStrike(provider, emptyMsg);
        throw new Error(emptyMsg);
      }
      recordSuccess(provider, Date.now() - t0);
      return result;
    } catch (e) {
      if (!e.message?.includes('returned empty response')) {
        recordStrike(provider, e.message);
      }
      throw e;
    }
  }

  const chain = getActiveChain();
  const errors = [];
  for (const prov of chain) {
    const t0 = Date.now();
    try {
      const result = await routeToProvider(prov, prompt, { system, model, temperature, maxTokens });
      if (isEmptyResponse(result)) {
        const emptyMsg = `${prov} returned empty response (no chunks)`;
        console.warn(`[llm-client] ${emptyMsg} — treating as timeout-class failure`);
        recordStrike(prov, emptyMsg);
        errors.push(`${prov}: ${emptyMsg}`);
        continue;
      }
      recordSuccess(prov, Date.now() - t0);
      return result;
    } catch (e) {
      console.log(`[llm-client] ${prov} failed: ${e.message}, trying next...`);
      recordStrike(prov, e.message);
      errors.push(`${prov}: ${e.message}`);
    }
  }

  throw new Error(`All ${errors.length} providers failed: ${errors.join(' | ')}`);
}

async function routeToProvider(provider, prompt, options) {
  const { system, model, temperature, maxTokens } = options;
  const prov = provider.toLowerCase();

  if (prov === 'minimax') {
    return await callMiniMax(prompt, { system, model, temperature, maxTokens });
  } else if (prov === 'groq') {
    return await callGroq(prompt, { system, model, temperature, maxTokens });
  } else if (prov === 'claude') {
    return await callClaude(prompt, { system, model, temperature, maxTokens });
  } else if (prov === 'openai') {
    return await callOpenAI(prompt, { system, model, temperature, maxTokens });
  } else if (prov === 'ollama') {
    return await callOllama(prompt, { system, model, temperature, maxTokens });
  }

  throw new Error(`Unknown provider: ${provider}`);
}

async function callMiniMax(prompt, options = {}) {
  const { system, model = 'MiniMax-M2.5', temperature = 0.7, maxTokens = 2000 } = options;
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY not set');
  }

  const response = await axios.post('https://api.minimax.io/v1/text/chatcompletion_v2', {
    model,
    messages: buildMessages(system, prompt),
    temperature,
    max_tokens: maxTokens
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices?.[0]?.message?.content || '';
}

async function callGroq(prompt, options = {}) {
  const { system, model = 'llama-3.1-70b-versatile', temperature = 0.7, maxTokens = 2000 } = options;
  const apiKey = process.env.GROQ_API_KEY || process.env.PLAYGROUND_GROQ_TOKEN;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set');
  }

  const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
    model,
    messages: buildMessages(system, prompt),
    temperature,
    max_tokens: maxTokens
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices?.[0]?.message?.content || '';
}

async function callClaude(prompt, options = {}) {
  const { system, model = 'claude-sonnet-4-20250514', temperature = 0.7, maxTokens = 2000 } = options;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const messages = [{ role: 'user', content: prompt }];

  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model,
    system,
    messages,
    temperature,
    max_tokens: maxTokens
  }, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });

  return response.data.content?.[0]?.text || '';
}

async function callOpenAI(prompt, options = {}) {
  const { system, model = 'gpt-4o', temperature = 0.7, maxTokens = 2000 } = options;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model,
    messages: buildMessages(system, prompt),
    temperature,
    max_tokens: maxTokens
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices?.[0]?.message?.content || '';
}

async function callOllama(prompt, options = {}) {
  const { system, model = 'qwen2.5-coder:7b', temperature = 0.7, maxTokens = 2000 } = options;
  const ctxLimit = CONTEXT_LIMITS[PROVIDERS.OLLAMA]?.contextWindow;

  const endpoint = 'http://localhost:11434/api/chat';

  const body = {
    model,
    messages: buildMessages(system, prompt),
    temperature,
    stream: false,
    options: {}
  };
  if (maxTokens) body.options.num_predict = maxTokens;
  if (ctxLimit) body.options.num_ctx = ctxLimit;

  const response = await axios.post(endpoint, body, { timeout: 120000 });
  return response.data.message?.content || '';
}

async function callWithFallback(prompt, options = {}) {
  return await callLLM(prompt, options);
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function getMinContextLimit(chain = DYNAMIC_CHAIN) {
  let min = Infinity;
  for (const prov of chain) {
    const limit = CONTEXT_LIMITS[prov]?.contextWindow;
    if (limit && limit < min) min = limit;
  }
  return min === Infinity ? 128000 : min;
}

function truncateToTokens(text, maxTokens) {
  if (!text || !maxTokens) return text;
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;
  const targetLen = maxTokens * 4;
  return text.slice(0, targetLen) + '\n...(truncated)';
}

module.exports = {
  PROVIDERS,
  CONTEXT_LIMITS,
  STRIKE_THRESHOLD,
  STRIKE_COOLDOWN_MS,
  estimateTokens,
  getMinContextLimit,
  truncateToTokens,
  callLLM,
  callWithFallback,
  setDynamicChain,
  getActiveChain,
  buildMessages,
  callMiniMax,
  callGroq,
  callClaude,
  callOpenAI,
  callOllama,
  recordStrike,
  recordSuccess,
  isProviderDemoted,
  getStrikeStatus,
  getProviderStats,
  resetStrikes
};
