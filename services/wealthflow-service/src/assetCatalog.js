// Asset Master Catalog and Disambiguation Engine for WealthFlow
const DEFAULT_INVEST_ASSETS = [
  { id: 'st_tata_cap', name: 'TATA Capital', category: 'Stocks/ETFs', sector: 'Financial Services (NBFC)' },
  { id: 'st_tatsilv', name: 'TATSILV', category: 'Stocks/ETFs', sector: 'Commodities - Silver' },
  { id: 'st_goldietf', name: 'GOLDIETF', category: 'Stocks/ETFs', sector: 'Commodities - Gold' },
  { id: 'st_hdfc', name: 'HDFC BANK', category: 'Stocks/ETFs', sector: 'Banking - Private Sector' },
  { id: 'st_bpcl', name: 'BPCL', category: 'Stocks/ETFs', sector: 'Oil & Gas' },
  { id: 'st_icici', name: 'ICICI BANK', category: 'Stocks/ETFs', sector: 'Banking - Private Sector' },
  { id: 'st_metalietf', name: 'METALIETF', category: 'Stocks/ETFs', sector: 'Metals & Mining' },
  { id: 'st_southbank', name: 'SOUTHBANK', category: 'Stocks/ETFs', sector: 'Banking - Private Sector' },
  { id: 'st_nippon_it', name: 'Nippon India ETF IT', category: 'Stocks/ETFs', sector: 'Information Technology' },
  { id: 'mf_parag_parikh', name: 'Parag parikh flexi cap fund - Direct', category: 'Mutual Funds', sector: 'Flexi Cap' },
  { id: 'mf_icici_n50', name: 'ICICI Prudential Nifty 50 Index Fund - Direct', category: 'Mutual Funds', sector: 'Index Fund' },
  { id: 'mf_bandhan_small', name: 'Bandhan Small Cap Fund - Direct', category: 'Mutual Funds', sector: 'Small Cap' },
  { id: 'epf_balance', name: 'EPF Balance', category: 'EPF', sector: 'Retirement' },
  { id: 'ppf_balance', name: 'PPF Balance', category: 'PPF', sector: 'Retirement' },
  { id: 'nps_tier1', name: 'NPS Tier 1', category: 'NPS', sector: 'Retirement' },
  { id: 'nps_tier2', name: 'NPS Tier 2', category: 'NPS', sector: 'Retirement' },
  { id: 'goal_emergency_fund', name: 'Emergency Fund', category: 'Emergency Fund', sector: 'Emergency Savings' },
  { id: 'goal_car_fund', name: 'Car Fund', category: 'Goals', sector: 'Car Purchase 2028' },
  { id: 'goal_digi_gold', name: 'Digi Gold', category: 'Gold Investment', sector: 'Gold Investments' }
];

// Normalize month strings (e.g., "september", "sept 2026", "2026-09" -> "2026-09")
function normalizeMonth(monthInput) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  
  if (!monthInput) return `${currentYear}-${currentMonth}`;
  const input = typeof monthInput === 'string' ? monthInput.toLowerCase().trim() : '';
  if (/^\d{4}-\d{2}$/.test(input)) return input;

  const months = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05', 'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sept': '09', 'sep': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12'
  };

  for (const [mName, mNum] of Object.entries(months)) {
    if (input.includes(mName)) {
      const yearMatch = input.match(/\b(20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : currentYear;
      return `${year}-${mNum}`;
    }
  }
  return `${currentYear}-${currentMonth}`;
}

// Fuzzy & Disambiguation Asset Matcher
function matchAsset(assetsList = DEFAULT_INVEST_ASSETS, identifier) {
  if (!identifier || !Array.isArray(assetsList)) return null;
  const raw = identifier.toLowerCase().trim();
  const clean = raw.replace(/[^a-z0-9]/g, '');
  if (!clean) return null;

  // 1. Exact ID
  let match = assetsList.find(a => a.id && (a.id.toLowerCase() === raw || a.id.toLowerCase().replace(/[^a-z0-9]/g, '') === clean));
  if (match) return match;

  // 2. Exact Name
  match = assetsList.find(a => a.name && (a.name.toLowerCase() === raw || a.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean));
  if (match) return match;

  // 3. Smart Priority Disambiguation
  if (clean.includes('digigold') || (clean.includes('digi') && clean.includes('gold')) || clean.includes('digitalgold')) {
    return assetsList.find(a => a.id === 'goal_digi_gold') || null;
  }
  if (clean.includes('icici') && (clean.includes('nifty') || clean.includes('50') || clean.includes('n50') || clean.includes('fund') || clean.includes('index') || clean.includes('mf'))) {
    return assetsList.find(a => a.id === 'mf_icici_n50') || null;
  }
  if (clean.includes('nifty50') || clean === 'nifty' || clean.includes('n50')) {
    return assetsList.find(a => a.id === 'mf_icici_n50') || null;
  }
  if (clean.includes('parag') || clean.includes('parikh') || clean.includes('pariek') || clean.includes('ppfas') || clean.includes('flexicap')) {
    return assetsList.find(a => a.id === 'mf_parag_parikh') || null;
  }
  if (clean.includes('bandhan') || clean.includes('bandan') || clean.includes('bandana') || clean.includes('smallcap') || clean.includes('small')) {
    return assetsList.find(a => a.id === 'mf_bandhan_small') || null;
  }
  if (clean.includes('emergency') || clean.includes('emergencyfund')) {
    return assetsList.find(a => a.id === 'goal_emergency_fund') || null;
  }
  if (clean.includes('car') || clean.includes('carfund')) {
    return assetsList.find(a => a.id === 'goal_car_fund') || null;
  }
  if (clean === 'epf' || clean.includes('epf') || clean === 'pf' || clean.includes('provident')) {
    return assetsList.find(a => a.id === 'epf_balance') || null;
  }
  if (clean === 'ppf' || clean.includes('ppf') || clean.includes('publicprovident')) {
    return assetsList.find(a => a.id === 'ppf_balance') || null;
  }
  if (clean.includes('npstier2') || (clean.includes('nps') && (clean.includes('tier2') || clean.includes('t2')))) {
    return assetsList.find(a => a.id === 'nps_tier2') || null;
  }
  if (clean.includes('npstier1') || clean === 'nps' || clean.includes('nps')) {
    return assetsList.find(a => a.id === 'nps_tier1') || null;
  }
  if (clean.includes('goldietf') || (clean.includes('gold') && clean.includes('etf'))) {
    return assetsList.find(a => a.id === 'st_goldietf') || null;
  }
  if (clean.includes('silver') || clean.includes('tatsilv')) {
    return assetsList.find(a => a.id === 'st_tatsilv') || null;
  }

  // 4. Substring fallback
  return assetsList.find(a => a.name.toLowerCase().includes(raw) || raw.includes(a.name.toLowerCase())) || null;
}

module.exports = {
  DEFAULT_INVEST_ASSETS,
  normalizeMonth,
  matchAsset
};
