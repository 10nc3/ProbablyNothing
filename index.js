/**
 * OpenClaw - Hybrid AI Workspace
 * Entry point: Express server + module health
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { callWithFallback, callLLM, PROVIDERS, DEFAULT_CHAIN } = require('./lib/llm-client');
const { atomicQuery, getPsiEMA, callNyanAPI } = require('./lib/nyan-api');
const { webSearch } = require('./lib/web-search');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60000, max: 60 }));

app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    name: 'openclaw',
    providers: Object.values(PROVIDERS),
    chain: DEFAULT_CHAIN,
    nyanApi: !!process.env.NYAN_API_TOKEN,
    uptime: process.uptime()
  });
});

app.post('/api/chat', async (req, res) => {
  const { message, provider, system, model, temperature, maxTokens } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const result = await callWithFallback(message, {
      provider, system, model, temperature, maxTokens
    });
    res.json({ response: result });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/atomic', async (req, res) => {
  const { message, domain } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  try {
    const result = await atomicQuery(message, domain);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/psi-ema', async (req, res) => {
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

app.get('/api/modules', (req, res) => {
  const modules = [
    'llm-client', 'nyan-api', 'void-pipeline', 'preflight-router',
    'context-router', 'data-package', 'memory-manager', 'model-fallback',
    'mode-registry', 'code-context', 'stock-fetcher', 'financial-physics',
    'psi-ema', 'forex-fetcher', 'legal-analysis', 'web-search'
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[openclaw] listening on 0.0.0.0:${PORT}`);
});
