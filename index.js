/**
 * OpenClaw - Hybrid AI Workspace
 * Entry point: env detect -> TUI banner -> Express server
 *
 * NOT Replit-powered. Runs on local Ollama or cloud LLM providers.
 * Replit is dev environment only. Production = your own infra.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { PROVIDERS, DEFAULT_CHAIN, setDynamicChain, getProviderStats, getStrikeStatus } = require('./lib/llm-client');
const { atomicQuery, getPsiEMA } = require('./lib/nyan-api');
const { webSearch } = require('./lib/web-search');
const { runPipeline, getAuditLog, getAuditSummary } = require('./lib/void-pipeline');
const { measureAffordability, compareTimePeriods, autoSeedMetric, detectSeedMetricIntent, formatSeedMetric } = require('./prompts/seed-metric');
const { detectEnvironment } = require('./lib/env-detect');
const { printBanner } = require('./lib/startup-tui');
const { startDiscordGateway, stopDiscordGateway, getDiscordStatus } = require('./lib/discord-gateway');

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
    providerHealth: getProviderStats(),
    strikes: getStrikeStatus(),
    ollama: envReport?.ollama?.available || false,
    nyanApi: envReport?.nyanApi || false,
    discord: getDiscordStatus(),
    uptime: process.uptime()
  });
});

app.get('/api/env', async (req, res) => {
  if (req.query.reload === 'true') {
    try {
      const freshReport = await detectEnvironment({ force: true });
      envReport = freshReport;
      if (freshReport.chain.length > 0) {
        setDynamicChain(freshReport.chain);
        console.log(`[openclaw] chain hot-reloaded: ${freshReport.chain.join(' -> ')}`);
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
    providerHealth: getProviderStats(),
    strikes: getStrikeStatus(),
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

app.post('/api/seed-metric', trustGate, async (req, res) => {
  const { city, year, landPrice, income, compare } = req.body;
  if (!city) {
    return res.status(400).json({ error: 'city is required. Optionally provide landPrice and income, or omit them to auto-fetch.' });
  }

  try {
    let result;

    if (landPrice && income) {
      result = measureAffordability({
        city,
        year: year || new Date().getFullYear(),
        landPricePerSqm: Number(landPrice),
        medianIncome: Number(income)
      });
    } else {
      result = await autoSeedMetric(city, year);
      if (result.error) {
        return res.status(502).json(result);
      }
    }

    if (compare) {
      let result2;
      if (compare.landPrice && compare.income) {
        result2 = measureAffordability({
          city: compare.city || city,
          year: compare.year || new Date().getFullYear(),
          landPricePerSqm: Number(compare.landPrice),
          medianIncome: Number(compare.income)
        });
      } else if (compare.city) {
        result2 = await autoSeedMetric(compare.city, compare.year);
        if (result2.error) {
          return res.status(502).json(result2);
        }
      } else {
        return res.status(400).json({ error: 'compare requires at least a city name' });
      }
      return res.json(compareTimePeriods(result, result2));
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    'intent-detector', 'data-package', 'memory-manager',
    'mode-registry', 'stock-fetcher', 'financial-physics',
    'psi-ema', 'legal-analysis', 'web-search',
    'env-detect', 'startup-tui', 'discord-gateway'
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

  startDiscordGateway({ chain: envReport.chain });
}

process.on('SIGINT', () => {
  stopDiscordGateway();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopDiscordGateway();
  process.exit(0);
});

boot().catch(e => {
  console.error(`[openclaw] boot failed: ${e.message}`);
  process.exit(1);
});
