const axios = require('axios');
const { validateURL } = require('./ssrf-guard');

async function webSearch(query, options = {}) {
  const { count = 5 } = options;
  
  try {
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveKey) {
      const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: { q: query, count },
        headers: { 'X-Subscription-Token': braveKey },
        timeout: 15000
      });
      const results = (res.data.web?.results || []).slice(0, count);
      return {
        query,
        results: results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.description
        })).filter(r => {
          if (!r.url) return true;
          const check = validateURL(r.url);
          return check.allowed;
        }),
        count: results.length
      };
    }

    const { atomicQuery } = require('./nyan-api');
    const result = await atomicQuery(`web search: ${query}`);
    return { query, results: [{ title: 'nyanbook.io', url: '', snippet: result }], count: 1 };
  } catch (e) {
    console.error('[web-search]', e.message);
    return { error: e.message, query };
  }
}

function formatSearchResults(searchResult) {
  if (searchResult.error) return `Search error: ${searchResult.error}`;
  const lines = [`**Search: ${searchResult.query}**`, ''];
  searchResult.results.forEach((r, i) => {
    lines.push(`${i + 1}. [${r.title}](${r.url})`);
    lines.push(`   ${r.snippet?.slice(0, 150)}...`);
    lines.push('');
  });
  return lines.join('\n');
}

module.exports = { webSearch, formatSearchResults };
