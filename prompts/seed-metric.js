const PHI = 1.618;
const LAND_QUANTA = 700;

/**
 * Solve A = 1 + 1/A + sigma
 * Rearranges to: A^2 - A(1 + sigma) - 1 = 0
 * @param {number} sigma - Substrate stress parameter
 * @returns {number} Positive real solution
 */
function solveIdentity(sigma = 0) {
  const a = 1;
  const b = -(1 + sigma);
  const c = -1;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return PHI;
  }

  const A_pos = (-b + Math.sqrt(discriminant)) / (2 * a);
  const A_neg = (-b - Math.sqrt(discriminant)) / (2 * a);

  return A_pos > 0 ? A_pos : A_neg;
}

/**
 * Measure affordability for a city
 * @param {Object} params
 * @param {string} params.city - City name
 * @param {number} params.year - Year to analyze
 * @param {number} params.landPricePerSqm - Price per m^2 (USD)
 * @param {number} params.medianIncome - Median HH income (USD/year)
 * @returns {Object} Affordability analysis
 */
function measureAffordability({ city, year, landPricePerSqm, medianIncome }) {
  const totalPrice = landPricePerSqm * LAND_QUANTA;
  const ratio = totalPrice / medianIncome;
  const yearsToMortgage = ratio;

  let regime, sigma;

  if (ratio > 8 || yearsToMortgage > 25) {
    regime = 'FATALISM';
    sigma = (ratio - 3.5) / 3.5;
  } else if (ratio < 3) {
    regime = 'OPTIMISM';
    sigma = -(3 - ratio) / 3;
  } else {
    regime = 'PHI-BREATHING';
    sigma = 0;
  }

  const A = solveIdentity(sigma);

  return {
    city,
    year,
    landPricePerSqm,
    medianIncome,
    totalPrice,
    ratio: parseFloat(ratio.toFixed(2)),
    yearsToMortgage: parseFloat(yearsToMortgage.toFixed(1)),
    regime,
    sigma: parseFloat(sigma.toFixed(4)),
    identityValue: parseFloat(A.toFixed(4)),
    phiDeviation: parseFloat(Math.abs(A - PHI).toFixed(4)),
    metadata: {
      landQuanta: LAND_QUANTA,
      threshold: { fatalism: 8, optimism: 3 },
      fertilityWindow: 25
    }
  };
}

/**
 * Compare two measurements (same city across time, or two cities)
 * @param {Object} m1 - First measurement
 * @param {Object} m2 - Second measurement
 * @returns {Object} Comparison result
 */
function compareTimePeriods(m1, m2) {
  const deltaRatio = m2.ratio - m1.ratio;
  const deltaYears = m2.yearsToMortgage - m1.yearsToMortgage;
  const regimeChange = m1.regime !== m2.regime;

  return {
    city: m1.city === m2.city ? m1.city : `${m1.city} vs ${m2.city}`,
    period: `${m1.year} -> ${m2.year}`,
    deltaRatio: parseFloat(deltaRatio.toFixed(2)),
    deltaYears: parseFloat(deltaYears.toFixed(1)),
    regimeChange: regimeChange ? `${m1.regime} -> ${m2.regime}` : 'stable',
    direction: deltaRatio > 0 ? 'WORSENING' : 'IMPROVING',
    measurements: [m1, m2]
  };
}

/**
 * Detect seed metric intent in query text
 * @param {string} text - User query
 * @returns {boolean}
 */
function detectSeedMetricIntent(text) {
  if (!text) return false;

  const patterns = [
    /\b(700\s*m[²2]|700\s*square\s*meters?)\b/i,
    /\b(affordability|affordable|price[\s-]to[\s-]income|housing\s*crisis)\b/i,
    /\b(fatalism|optimism|phi[\s\-]?breathing)\b/i,
    /\b(land\s*quanta|substrate\s*metric)\b/i,
    /\b(fertility\s*window|25\s*years?)\b/i,
    /\b(seed[\s\-]?metric|human\s*substrate)\b/i,
    /\b(demographic\s*collapse|population\s*decline|tfr|fertility\s*rate)\b/i,
  ];

  return patterns.some(p => p.test(text));
}

/**
 * Get seed metric context for LLM prompt injection
 * @returns {string} Seed metric documentation for MoE context
 */
function getSeedMetricProxy() {
  return [
    '# SEED METRIC: Human Substrate Measurement',
    '',
    'Formula: Years of median single-earner income to mortgage 700 m^2/HH',
    '',
    'Thresholds:',
    '  FATALISM:      ratio >8x OR >25 years to mortgage',
    '  PHI-BREATHING: ratio 3-8x (golden zone)',
    '  OPTIMISM:      ratio <3x',
    '',
    'Physical constraints:',
    '  700 m^2/HH: Minimum land quanta (3-gen household)',
    '  25 years:   Human fertility window (age 20-45)',
    '  3.5x:       Mortgage affordability ceiling',
    '',
    'Identity equation: A = 1 + 1/A + sigma',
    '  sigma = 0     -> A = PHI (1.618) -> equilibrium',
    '  sigma > 0     -> FATALISM (substrate stress)',
    '  sigma < 0     -> OPTIMISM (substrate abundance)',
    '',
    'Examples:',
    '  Tokyo  1975: $50/m^2,  $30k income -> 1.2x -> OPTIMISM',
    '  Tokyo  2024: $800/m^2, $60k income -> 9.3x -> FATALISM',
    '  Seoul  2024: $1000/m^2,$50k income -> 14x  -> FATALISM (TFR 0.72)',
    '',
    'When user asks about housing, fertility, demographic collapse,',
    'or land affordability, use this metric.',
  ].join('\n');
}

/**
 * Format seed metric result for display
 * @param {Object} result - measureAffordability output
 * @returns {string} Formatted display
 */
function formatSeedMetric(result) {
  if (!result) return '[seed-metric] no data';

  const lines = [
    `--- ${result.city} (${result.year}) ---`,
    '',
    `Land:   USD ${result.landPricePerSqm}/m^2 x ${LAND_QUANTA}m^2 = USD ${result.totalPrice.toLocaleString()}`,
    `Income: USD ${result.medianIncome.toLocaleString()}/yr`,
    `Ratio:  ${result.ratio}x | ${result.yearsToMortgage} years to mortgage`,
    '',
    `Regime:   ${result.regime}`,
    `Sigma:    ${result.sigma}`,
    `Identity: A = ${result.identityValue} (PHI dev: ${result.phiDeviation})`,
  ];

  return lines.join('\n');
}

module.exports = {
  measureAffordability,
  solveIdentity,
  compareTimePeriods,
  detectSeedMetricIntent,
  getSeedMetricProxy,
  formatSeedMetric,
  PHI,
  LAND_QUANTA
};
