const { atomicQuery } = require('./nyan-api');

const FOREX_PAIRS = {
  'EUR/USD': ['eur/usd', 'eurusd', 'euro dollar', 'euro usd', 'eur usd'],
  'GBP/USD': ['gbp/usd', 'gbpusd', 'pound dollar', 'gbp usd', 'sterling dollar'],
  'USD/JPY': ['usd/jpy', 'usdjpy', 'dollar yen', 'usd jpy'],
  'USD/CHF': ['usd/chf', 'usdchf', 'dollar franc', 'usd chf'],
  'AUD/USD': ['aud/usd', 'audusd', 'aussie dollar', 'aud usd'],
  'USD/CAD': ['usd/cad', 'usdcad', 'dollar loonie', 'usd cad'],
  'NZD/USD': ['nzd/usd', 'nzdusd', 'kiwi dollar', 'nzd usd'],
  'EUR/GBP': ['eur/gbp', 'eurgbp', 'euro pound', 'eur gbp'],
  'EUR/JPY': ['eur/jpy', 'eurjpy', 'euro yen', 'eur jpy'],
  'GBP/JPY': ['gbp/jpy', 'gbpjpy', 'pound yen', 'gbp jpy'],
  'USD/IDR': ['usd/idr', 'usdidr', 'dollar rupiah', 'usd idr', 'rupiah'],
  'USD/SGD': ['usd/sgd', 'usdsgd', 'dollar sgd', 'usd sgd', 'singapore dollar'],
  'USD/CNY': ['usd/cny', 'usdcny', 'dollar yuan', 'usd cny', 'yuan', 'renminbi', 'rmb'],
  'USD/KRW': ['usd/krw', 'usdkrw', 'dollar won', 'usd krw', 'korean won'],
  'XAU/USD': ['xau/usd', 'xauusd', 'gold price', 'gold usd', 'gold spot'],
};

const FOREX_GENERAL_REGEX = /\b(forex|fx|exchange rate|currency|foreign exchange|currency pair|spot rate)\b/i;
const FOREX_CURRENCY_REGEX = /\b(usd|eur|gbp|jpy|chf|aud|cad|nzd|idr|sgd|cny|krw|xau|dollar|euro|pound|yen|franc|rupiah|yuan|won)\b/i;

function isForexQuery(text) {
  if (!text || typeof text !== 'string') return false;
  if (FOREX_GENERAL_REGEX.test(text)) return true;
  const lower = text.toLowerCase();
  for (const aliases of Object.values(FOREX_PAIRS)) {
    if (aliases.some(a => lower.includes(a))) return true;
  }
  const currencies = lower.match(FOREX_CURRENCY_REGEX);
  if (currencies) {
    const rateWords = /\b(rate|price|convert|exchange|how much|worth|value|against|to|vs|versus)\b/i;
    if (rateWords.test(text)) return true;
  }
  return false;
}

function detectForexPair(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const [pair, aliases] of Object.entries(FOREX_PAIRS)) {
    if (aliases.some(a => lower.includes(a))) return pair;
  }
  const slashMatch = text.match(/\b([A-Z]{3})\s*[\/\\]\s*([A-Z]{3})\b/i);
  if (slashMatch) {
    return `${slashMatch[1].toUpperCase()}/${slashMatch[2].toUpperCase()}`;
  }
  return null;
}

async function fetchForexRate(pair) {
  if (!pair) return null;
  try {
    const result = await atomicQuery(
      `Current ${pair} exchange rate. Reply with ONLY the number (e.g. 1.0842). No text, no explanation.`,
      'forex'
    );
    if (!result || !result.success) return null;

    const numMatch = (result.response || '').match(/[\d]+\.[\d]+/);
    if (numMatch) {
      return {
        pair,
        rate: parseFloat(numMatch[0]),
        source: 'nyanbook.io',
        timestamp: new Date().toISOString(),
        raw: result.response
      };
    }
    return {
      pair,
      rate: null,
      source: 'nyanbook.io',
      timestamp: new Date().toISOString(),
      raw: result.response
    };
  } catch (e) {
    console.error(`[forex] fetchForexRate(${pair}) failed:`, e.message);
    return null;
  }
}

function buildForexContext(text) {
  const pair = detectForexPair(text);
  if (!pair) return null;
  return {
    type: 'forex',
    pair,
    systemPrompt: `The user is asking about the ${pair} currency pair. Provide current rate context, recent trend if known, and any relevant factors affecting this pair. Be concise and data-focused.`
  };
}

module.exports = {
  detectForexPair,
  isForexQuery,
  fetchForexRate,
  buildForexContext,
  FOREX_PAIRS
};
