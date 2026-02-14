/**
 * Environment Detector
 * Probes local Ollama, checks API keys, detects runtime environment.
 * Returns structured report for startup TUI and dynamic chain building.
 */

const axios = require('axios');

const ENV_TYPES = {
  LOCAL: 'local',
  CLOUD: 'cloud',
  REPLIT_DEV: 'replit-dev'
};

function detectRuntime() {
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) {
    return ENV_TYPES.REPLIT_DEV;
  }
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER_SERVICE_ID || process.env.FLY_APP_NAME || process.env.HEROKU_APP_NAME) {
    return ENV_TYPES.CLOUD;
  }
  return ENV_TYPES.LOCAL;
}

async function probeOllama() {
  const url = process.env.OLLAMA_URL || 'http://localhost:11434';
  const apiUrl = url.replace(/\/api\/chat$/, '');
  try {
    const res = await axios.get(`${apiUrl}/api/tags`, { timeout: 3000 });
    const models = (res.data.models || []).map(m => m.name);
    return { available: true, url: apiUrl, models, latency: 'local' };
  } catch (e) {
    return { available: false, url: apiUrl, models: [], error: e.message };
  }
}

function checkProvider(name, keyEnvVar, altKeyEnvVar) {
  const key = process.env[keyEnvVar] || (altKeyEnvVar ? process.env[altKeyEnvVar] : null);
  return {
    name,
    configured: !!key,
    keySource: key ? keyEnvVar : null
  };
}

function checkAllProviders() {
  return {
    minimax: checkProvider('MiniMax', 'MINIMAX_API_KEY'),
    claude: checkProvider('Claude', 'ANTHROPIC_API_KEY'),
    groq: checkProvider('Groq', 'GROQ_API_KEY', 'PLAYGROUND_GROQ_TOKEN'),
    openai: checkProvider('OpenAI', 'OPENAI_API_KEY')
  };
}

async function canaryProbe(providerName) {
  const CANARY_TIMEOUT = 8000;
  try {
    switch (providerName) {
      case 'minimax': {
        const key = process.env.MINIMAX_API_KEY;
        if (!key) return { alive: false, reason: 'no key' };
        const url = process.env.MINIMAX_URL || 'https://api.minimax.chat/v1/text/chatcompletion_pro';
        const res = await axios.post(url, {
          model: 'MiniMax-M1',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        }, {
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          timeout: CANARY_TIMEOUT
        });
        return { alive: true, latencyMs: 0 };
      }
      case 'groq': {
        const key = process.env.GROQ_API_KEY || process.env.PLAYGROUND_GROQ_TOKEN;
        if (!key) return { alive: false, reason: 'no key' };
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        }, {
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          timeout: CANARY_TIMEOUT
        });
        return { alive: true, latencyMs: 0 };
      }
      case 'claude': {
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) return { alive: false, reason: 'no key' };
        const res = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        }, {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          timeout: CANARY_TIMEOUT
        });
        return { alive: true, latencyMs: 0 };
      }
      case 'openai': {
        const key = process.env.OPENAI_API_KEY;
        if (!key) return { alive: false, reason: 'no key' };
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        }, {
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          timeout: CANARY_TIMEOUT
        });
        return { alive: true, latencyMs: 0 };
      }
      default:
        return { alive: false, reason: 'unknown provider' };
    }
  } catch (e) {
    const status = e.response?.status;
    if (status === 401 || status === 403) {
      return { alive: false, reason: `auth failed (${status})` };
    }
    return { alive: false, reason: e.message };
  }
}

async function probeAllProviders(providers, options = {}) {
  const { canary = false } = options;
  if (!canary) return providers;

  const probed = { ...providers };
  const names = Object.keys(probed).filter(k => probed[k].configured);

  const results = await Promise.allSettled(
    names.map(async (name) => {
      const t0 = Date.now();
      const result = await canaryProbe(name);
      result.latencyMs = Date.now() - t0;
      return { name, result };
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { name, result } = r.value;
      probed[name] = {
        ...probed[name],
        alive: result.alive,
        canaryLatencyMs: result.latencyMs,
        canaryError: result.alive ? null : result.reason
      };
      if (result.alive) {
        console.log(`[canary] ${name} alive (${result.latencyMs}ms)`);
      } else {
        console.warn(`[canary] ${name} DEAD: ${result.reason}`);
      }
    }
  }

  return probed;
}

function buildDynamicChain(ollamaStatus, providers) {
  const chain = [];

  for (const name of ['minimax', 'groq', 'claude', 'openai']) {
    const p = providers[name];
    if (!p || !p.configured) continue;
    if (p.alive === false) continue;
    chain.push(name);
  }

  if (ollamaStatus.available) {
    chain.push('ollama');
  }

  return chain;
}

async function detectEnvironment(options = {}) {
  const { canary = false } = options;
  const runtime = detectRuntime();
  const ollama = await probeOllama();
  let providers = checkAllProviders();

  if (canary) {
    providers = await probeAllProviders(providers, { canary: true });
  }

  const chain = buildDynamicChain(ollama, providers);
  const nyanApi = !!process.env.NYAN_API_TOKEN;

  return {
    runtime,
    ollama,
    providers,
    chain,
    nyanApi,
    canary,
    ready: chain.length > 0,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  detectEnvironment,
  detectRuntime,
  probeOllama,
  checkAllProviders,
  buildDynamicChain,
  canaryProbe,
  probeAllProviders,
  ENV_TYPES
};
