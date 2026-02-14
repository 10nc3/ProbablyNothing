/**
 * Context Router - MoE-inspired context selection
 * Routes queries to relevant expert modules (loads identity/philosophy files)
 *
 * Usage:
 *   const { getContext } = require('./context-router');
 *   const result = getContext("your query");
 *   // result = { experts: [...], context: "...", tokenEstimate: N }
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.OPENCLAW_WORKSPACE
  ? path.resolve(process.env.OPENCLAW_WORKSPACE)
  : path.resolve(__dirname, '..');

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
  if (fs.existsSync(dailyPath)) {
    return `memory/${today}.md`;
  }
  return null;
}

function readFile(filePath) {
  try {
    const fullPath = path.resolve(WORKSPACE, filePath);
    if (!fullPath.startsWith(WORKSPACE)) {
      console.warn(`[context-router] path traversal blocked: ${filePath}`);
      return null;
    }
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
  } catch (e) {
    // silent
  }
  return null;
}

function route(query) {
  const q = (query || '').toLowerCase();
  const experts = new Set(['core']);

  for (const [expert, keywords] of Object.entries(TRIGGERS)) {
    if (keywords.some(k => q.includes(k))) {
      experts.add(expert);
    }
  }

  const dailyFile = getDailyFile();
  if (dailyFile) {
    EXPERTS.daily = [dailyFile];
  }

  return Array.from(experts);
}

function getContext(query) {
  if (!query) {
    return { experts: ['core'], context: '', tokenEstimate: 0 };
  }

  try {
    const experts = route(query);
    const context = [];
    const seen = new Set();

    for (const expert of experts) {
      const files = EXPERTS[expert] || [];
      for (const file of files) {
        if (seen.has(file)) continue;
        seen.add(file);
        const content = readFile(file);
        if (content) {
          context.push(`--- ${expert.toUpperCase()}: ${file} ---\n${content}`);
        }
      }
    }

    return {
      experts,
      context: context.join('\n\n'),
      tokenEstimate: Math.ceil(context.join('').split(' ').length * 1.3)
    };
  } catch (e) {
    console.error('Context router error:', e.message);
    return {
      experts: ['core'],
      context: '',
      tokenEstimate: 0
    };
  }
}

module.exports = { route, getContext, EXPERTS, TRIGGERS, WORKSPACE };
