const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..');

const DESIGN_KEYWORDS = /\b(architect(?:ure)?|design|pattern|refactor|structure|module|kernel|satellite|coupling|cohesion|separation|abstraction|interface|protocol|pipeline|layer|dependency|inject|composition|inheritance|encapsulat|decouple|solid|dry|kiss|yagni|clean code|code review|best practice|anti.?pattern|code smell|technical debt|monolith|microservice|event.?driven|pub.?sub|observer|factory|singleton|strategy|middleware|plugin|hook|extension)\b/i;

const PHILOSOPHY_KEYWORDS = /\b(phi|φ|golden ratio|fibonacci|fractal|emergence|substrate|void|nyan|kernel|satellite|pico.?claw|o\(n\)|single.?pass|moe|mixture of experts)\b/i;

function isDesignQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  return DESIGN_KEYWORDS.test(text) || PHILOSOPHY_KEYWORDS.test(text);
}

function getSystemContextForDesign() {
  const context = [];

  const philPath = path.join(WORKSPACE, 'PHILOSOPHY.md');
  try {
    if (fs.existsSync(philPath)) {
      const content = fs.readFileSync(philPath, 'utf-8');
      const trimmed = content.length > 4000 ? content.slice(0, 4000) + '\n...(truncated)' : content;
      context.push({
        role: 'system',
        content: `[DESIGN CONTEXT — PHILOSOPHY.md]\n${trimmed}`
      });
    }
  } catch (e) {
    console.warn('[code-context] could not read PHILOSOPHY.md:', e.message);
  }

  const readmePath = path.join(WORKSPACE, 'lib', 'README.md');
  try {
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      const trimmed = content.length > 2000 ? content.slice(0, 2000) + '\n...(truncated)' : content;
      context.push({
        role: 'system',
        content: `[DESIGN CONTEXT — Kernel+Satellites Architecture]\n${trimmed}`
      });
    }
  } catch (e) {
    console.warn('[code-context] could not read lib/README.md:', e.message);
  }

  return context;
}

module.exports = {
  isDesignQuestion,
  getSystemContextForDesign,
  DESIGN_KEYWORDS,
  PHILOSOPHY_KEYWORDS
};
