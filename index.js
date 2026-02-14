/**
 * OpenClaw - Hybrid AI Workspace
 * Entry point: env detect -> TUI banner -> Express server
 *
 * NOT Replit-powered. Runs on local Ollama or cloud LLM providers.
 * Replit is dev environment only. Production = your own infra.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { PROVIDERS, DEFAULT_CHAIN, setDynamicChain } = require('./lib/llm-client');
const { atomicQuery, getPsiEMA } = require('./lib/nyan-api');
const { webSearch } = require('./lib/web-search');
const { runPipeline, getAuditLog, getAuditSummary } = require('./lib/void-pipeline');
const { detectEnvironment } = require('./lib/env-detect');
const { printBanner } = require('./lib/startup-tui');

const net = require('net');

const app = express();
const PORT = process.env.PORT || 5000;

let envReport = null;

function isLocalhost(ip) {
  if (!ip) return false;
  const cleaned = ip.replace(/^::ffff:/, '');
  if (cleaned === '127.0.0.1' || cleaned === '::1' || cleaned === 'localhost') return true;
  if (net.isIPv4(cleaned)) {
    const parts = cleaned.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

function trustGate(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || '';
  if (isLocalhost(ip)) return next();
  const auth = req.headers.authorization;
  const token = process.env.SESSION_SECRET;
  if (!token) return next();
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'authentication required from public IP' });
  }
  if (auth.slice(7) !== token) {
    return res.status(403).json({ error: 'invalid token' });
  }
  next();
}

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60000, max: 60 }));

app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    name: 'openclaw',
    runtime: envReport?.runtime || 'unknown',
    modes: ['prescribe', 'scribe', 'describe'],
    chain: envReport?.chain || DEFAULT_CHAIN,
    providers: Object.keys(envReport?.providers || {}).filter(k => envReport.providers[k].configured),
    ollama: envReport?.ollama?.available || false,
    nyanApi: envReport?.nyanApi || false,
    uptime: process.uptime()
  });
});

app.get('/api/env', async (req, res) => {
  if (req.query.reload === 'true') {
    try {
      const canary = req.query.canary === 'true';
      const freshReport = await detectEnvironment({ canary });
      envReport = freshReport;
      if (freshReport.chain.length > 0) {
        setDynamicChain(freshReport.chain);
        console.log(`[openclaw] chain hot-reloaded${canary ? ' (canary)' : ''}: ${freshReport.chain.join(' -> ')}`);
      }
    } catch (e) {
      console.error(`[openclaw] chain reload failed: ${e.message}`);
    }
  }
  if (!envReport) return res.status(503).json({ error: 'env detection not complete' });
  res.json({
    runtime: envReport.runtime,
    ollama: {
      available: envReport.ollama.available,
      models: envReport.ollama.models,
      url: envReport.ollama.url
    },
    providers: Object.fromEntries(
      Object.entries(envReport.providers).map(([k, v]) => [k, { configured: v.configured }])
    ),
    chain: envReport.chain,
    nyanApi: envReport.nyanApi,
    ready: envReport.ready,
    reloaded: req.query.reload === 'true' ? true : undefined,
    note: envReport.runtime === 'replit-dev'
      ? 'Running in Replit dev environment. For production, deploy with Ollama locally or cloud API keys.'
      : null
  });
});

app.post('/api/chat', trustGate, async (req, res) => {
  const { message, provider, model, temperature, maxTokens, callerId, photos, documents } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const sessionId = req.ip || req.headers['x-forwarded-for'] || 'default';

  try {
    const result = await runPipeline({
      query: message,
      sessionId,
      callerId: callerId || null,
      chain: envReport?.chain?.length ? envReport.chain : undefined,
      photos: photos || [],
      documents: documents || [],
      options: { provider, model, temperature, maxTokens }
    });

    res.json({
      response: result.response,
      mode: result.mode,
      provider: result.provider,
      complexity: result.complexity || null,
      shortcut: result.shortcut || null,
      intents: result.intents,
      memory: result.memory || null,
      audit: result.audit || null
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/atomic', trustGate, async (req, res) => {
  const { message, domain } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const result = await atomicQuery(message, domain);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/psi-ema', trustGate, async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });
  try {
    const result = await getPsiEMA(ticker);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/search', async (req, res) => {
  const { query, count } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  try {
    const result = await webSearch(query, { count });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/audit', trustGate, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const mode = req.query.mode || 'full';
  if (mode === 'summary') {
    return res.json(getAuditSummary());
  }
  res.json({
    log: getAuditLog(limit),
    summary: getAuditSummary()
  });
});

app.get('/api/modules', (req, res) => {
  const modules = [
    'llm-client', 'nyan-api', 'void-pipeline', 'preflight-router',
    'context-router', 'data-package', 'memory-manager', 'model-fallback',
    'mode-registry', 'code-context', 'stock-fetcher', 'financial-physics',
    'psi-ema', 'forex-fetcher', 'legal-analysis', 'web-search',
    'env-detect', 'startup-tui'
  ];
  const status = {};
  for (const m of modules) {
    try {
      require(`./lib/${m}`);
      status[m] = 'ok';
    } catch (e) {
      status[m] = `fail: ${e.message}`;
    }
  }
  res.json(status);
});

async function boot() {
  envReport = await detectEnvironment();

  if (envReport.chain.length > 0) {
    setDynamicChain(envReport.chain);
  }

  printBanner(envReport, PORT);

  if (envReport.chain.length > 0) {
    console.log(`[openclaw] dynamic chain: ${envReport.chain.join(' -> ')}`);
  } else {
    console.log('[openclaw] WARNING: no LLM providers available — shortcuts only');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[openclaw] listening on 0.0.0.0:${PORT}`);
  });
}

boot().catch(e => {
  console.error(`[openclaw] boot failed: ${e.message}`);
  process.exit(1);
});
