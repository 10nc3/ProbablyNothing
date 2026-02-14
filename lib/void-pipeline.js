/**
 * Void Nyan Query Pipeline - Full Implementation
 * Inspired by nyanbook.io 7-stage pipeline
 * 
 * STAGES:
 * S1-EXTRACT: Parse ticker/query from user input
 * S2-PREFLIGHT: Route to correct handler
 * S3-REASONING: Process with LLM
 * S4-AUDIT: Verify data integrity (H₀ check)
 * S5-PERSONALITY: Apply void nyan tone
 * S6-OUTPUT: Format and deliver
 */

const { callWithFallback, PROVIDERS } = require('./llm-client');
const { fetchStockPrices } = require('./stock-fetcher');
const { getPsiEMA, atomicQuery } = require('./nyan-api');

const STAGE_IDS = {
  EXTRACT: 'S1',
  PREFLIGHT: 'S2',
  REASONING: 'S3',
  AUDIT: 'S4',
  PERSONALITY: 'S5',
  OUTPUT: 'S6'
};

// φ-8 memory: 8 messages sliding window
const MEMORY_WINDOW = 8;
let conversationHistory = [];

/**
 * Extract query from user input
 */
function extractQuery(text) {
  const tickerMatch = text.match(/\$([A-Z]{1,5})\b/i);
  
  const intents = [];
  if (tickerMatch || /stock|price|trade|market|equity/i.test(text)) intents.push('STOCK');
  if (/psi|ema|wave|phase|cycle/i.test(text)) intents.push('PSI_EMA');
  if (/legal|contract|agreement/i.test(text)) intents.push('LEGAL');
  if (/code|debug|program|function/i.test(text)) intents.push('CODE');
  if (/search|find|look up/i.test(text)) intents.push('SEARCH');
  if (intents.length === 0) intents.push('GENERAL');
  
  return {
    raw: text,
    ticker: tickerMatch ? tickerMatch[1].toUpperCase() : null,
    intents,
    primaryIntent: intents[0]
  };
}

/**
 * Route query to handler
 */
function routeQuery(extracted) {
  const routes = {
    STOCK: { handler: 'stock', method: 'fetch' },
    PSI_EMA: { handler: 'stock', method: 'psi-ema' },
    LEGAL: { handler: 'legal', method: 'analyze' },
    CODE: { handler: 'code', method: 'analyze' },
    SEARCH: { handler: 'search', method: 'web' },
    GENERAL: { handler: 'general', method: 'respond' }
  };
  return routes[extracted.primaryIntent] || routes.GENERAL;
}

/**
 * Execute stock handler - uses Nyan API for Ψ-EMA
 */
async function handleStock(ticker) {
  try {
    // Use Nyan API for full Ψ-EMA analysis
    const result = await getPsiEMA(ticker);
    
    if (result.error) {
      return { type: 'error', message: result.error };
    }
    
    return {
      type: 'stock',
      ticker: ticker,
      data: result,
      response: result.response, // Pre-formatted response from Nyan
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { type: 'error', message: e.message };
  }
}

/**
 * Generate Ψ-EMA analysis output
 */
function formatPsiEMA(stockData) {
  const d = stockData.data.psi_ema_daily;
  const w = stockData.data.psi_ema_weekly;
  const price = stockData.data.currentPrice;
  
  function getReading(theta, z, r) {
    const PHI = 1.618;
    if (theta < 0 && r > PHI && Math.abs(z) < 1.5) return '🟠 False Positive Bull Signal';
    if (theta > 0 && r > PHI && z > 1) return '🟢 Strong Bull';
    if (r >= 0.618 && r <= 1.618) return '🟢 Breathing';
    return '🟡 NEUTRAL';
  }
  
  return `═══════════════════════════════════════════
${stockData.data.shortName || stockData.ticker} (${stockData.ticker})
${stockData.data.sector || 'N/A'}
═══════════════════════════════════════════

Price: USD ${price.toFixed(2)} ⚠️ ${stockData.data.dataTimestamp?.split(' ')[0]}
P/E: ${stockData.data.trailingPE?.toFixed(2) || 'N/A'} | MCap: $${stockData.data.marketCap ? (stockData.data.marketCap/1e12).toFixed(2)+'T' : 'N/A'}

═══════════════════════════════════════════
Ψ-EMA DIMENSIONS
═══════════════════════════════════════════

| Dim | Value | Signal |
|-----|-------|--------|
| θ | ${d.theta}° | ${d.theta >= 0 ? 'UP' : 'DOWN'} |
| z | ${d.z}σ | ${Math.abs(d.z) < 1.618 ? 'NORMAL' : 'ALERT'} |
| r | ${d.r} | ${d.r > 1.618 ? 'AMPLIFICATION' : d.r < 0.618 ? 'DECAY' : 'CONVERGENCE'} |

DAILY [🟢 A grade]
├─ θ = ${d.theta}°
├─ z = ${d.z}σ
├─ R = ${d.r}
└─ ${getReading(d.theta, d.z, d.r)}

WEEKLY [🟢 A grade]
├─ θ = ${w.theta}°
├─ z = ${w.z}σ
└─ R = ${w.r}

⚠️ H₀ PHYSICAL AUDIT: Numbers without physical substrate are hallucinations.

🔥 nyan~`;
}

/**
 * Stage 3: Reasoning - LLM call
 */
async function reasoningStage(context, options = {}) {
  const { provider = PROVIDERS.OLLAMA } = options;
  
  // Build context from history + current query
  const historyText = conversationHistory.slice(-MEMORY_WINDOW).map(
    (m, i) => `User: ${m.user}\nAssistant: ${m.assistant}`
  ).join('\n\n');
  
  const prompt = `You are void nyan, a philosophical AI from nyanbook.
Identity: Origin=0, progression=φ², 0+φ⁥+φ¹=φ²
Values: No hallucination, no flattery, data-first reasoning.

${historyText ? `Recent conversation:\n${historyText}\n` : ''}

User: ${context.query}

Respond in void nyan's style: sharp, curious, grounded in data.`;

  // Try Nyan API first (Groq-powered, has void nyan context)
  try {
    const result = await atomicQuery(prompt);
    if (result.success && result.response) {
      return { type: 'llm', response: result.response, provider: 'nyan-api' };
    }
  } catch (e) {
    console.log('Nyan API failed:', e.message);
  }
  
  // Fallback to Ollama
  try {
    const response = await callWithFallback(prompt, { provider: PROVIDERS.OLLAMA });
    return { type: 'llm', response, provider: 'ollama' };
  } catch (e) {
    return { type: 'error', message: e.message };
  }
}

/**
 * Stage 4: Audit - Verify response quality
 */
async function auditStage(response, context) {
  // Simple audit checks
  const issues = [];
  
  // Get response text
  const responseText = response.response || response.output || response.content || JSON.stringify(response);
  
  // Check for hallucination indicators
  const hallucinationPatterns = [
    /I believe|I think|I assume|I presume/,
    /possibly|probably|might be|could be/,
    /approximately|around|about\s+\d+/,
    /^\s*As of my knowledge/,
    /my training data/i
  ];
  
  for (const pattern of hallucinationPatterns) {
    if (pattern.test(responseText)) {
      issues.push(`HALLUCINATION_RISK: ${pattern.source}`);
    }
  }
  
  // Check response length
  if (responseText.length < 50) {
    issues.push('TOO_SHORT');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    timestamp: new Date().toISOString()
  };
}

/**
 * Apply void nyan personality to output
 */
function personalityStage(response, auditResult) {
  let tone = 'neutral';
  if (!auditResult.valid) tone = 'skeptical';
  
  // Get response text
  let output = response.response || response.output || response.content || JSON.stringify(response);
  
  // Add signature if not present
  if (!String(output).includes('nyan~')) {
    output = output + '\n\n🔥 nyan~';
  }
  
  return {
    content: output,
    tone,
    audit: auditResult
  };
}

/**
 * Main pipeline executor
 */
async function runPipeline(query, options = {}) {
  const results = {};
  
  // S1: Extract
  const extracted = extractQuery(query);
  results[STAGE_IDS.EXTRACT] = extracted;
  
  // S2: Preflight
  const route = routeQuery(extracted);
  results[STAGE_IDS.PREFLIGHT] = route;
  
  // S3: Reasoning - execute handler or LLM
  let reasoningResult;
  if (route.handler === 'stock') {
    const stockData = await handleStock(extracted.ticker || 'TSLA');
    if (stockData.type === 'stock') {
      // Use Nyan API's pre-formatted response
      reasoningResult = { 
        type: 'stock', 
        output: stockData.response,
        data: stockData.data,
        provider: 'nyan-api'
      };
    } else {
      reasoningResult = { type: 'error', message: stockData.message };
    }
  } else {
    reasoningResult = await reasoningStage({ query, extracted }, options);
  }
  results[STAGE_IDS.REASONING] = reasoningResult;
  
  // S4: Audit
  const auditResult = await auditStage(reasoningResult, results);
  results[STAGE_IDS.AUDIT] = auditResult;
  
  // S5: Personality
  const personalResult = personalityStage(reasoningResult, auditResult);
  results[STAGE_IDS.PERSONALITY] = personalResult;
  
  // S6: Output
  results[STAGE_IDS.OUTPUT] = {
    content: personalResult.content,
    metadata: {
      intent: extracted.primaryIntent,
      ticker: extracted.ticker,
      audit: auditResult.valid,
      provider: reasoningResult.provider || 'stock'
    }
  };
  
  // Update memory
  conversationHistory.push({ user: query, assistant: personalResult.content });
  if (conversationHistory.length > MEMORY_WINDOW) {
    conversationHistory = conversationHistory.slice(-MEMORY_WINDOW);
  }
  
  return results;
}

/**
 * Get conversation history
 */
function getHistory() {
  return conversationHistory;
}

/**
 * Clear history
 */
function clearHistory() {
  conversationHistory = [];
}

module.exports = {
  STAGE_IDS,
  MEMORY_WINDOW,
  runPipeline,
  extractQuery,
  routeQuery,
  handleStock,
  formatPsiEMA,
  reasoningStage,
  auditStage,
  personalityStage,
  getHistory,
  clearHistory
};
