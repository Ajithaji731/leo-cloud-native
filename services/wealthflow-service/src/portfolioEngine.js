const { DEFAULT_INVEST_ASSETS, normalizeMonth, matchAsset } = require('./assetCatalog');

const INVEST_GAS_URL = process.env.INVEST_GAS_URL || 'https://script.google.com/macros/s/AKfycbwggOUodVCdLua57K3DVVIdmn8J12uZWClM47tlWz3xzOrkkI_cc62EeHazaVhrsHqT/exec';
const SECURE_ID = process.env.SECURE_ID || '2108';

let cachedInvestState = null;
let lastInvestFetchTime = 0;
let investFetchPromise = null;

async function refreshInvestFromCloud() {
  if (investFetchPromise) return investFetchPromise;
  investFetchPromise = (async () => {
    try {
      const res = await fetch(`${INVEST_GAS_URL}?userId=${SECURE_ID}&t=${Date.now()}`);
      const data = await res.json();
      let stateObj = data.records ? data : (data.state && data.state.records ? data.state : null);
      if (stateObj && stateObj.records && Object.keys(stateObj.records).length > 0) {
        if (!stateObj.assets || stateObj.assets.length === 0) stateObj.assets = DEFAULT_INVEST_ASSETS;
        cachedInvestState = stateObj;
        lastInvestFetchTime = Date.now();
        return stateObj;
      }
    } catch (e) {
      console.error("Failed to fetch cloud invest state:", e.message);
    } finally {
      investFetchPromise = null;
    }
    const fallback = {
      assets: DEFAULT_INVEST_ASSETS,
      records: {},
      lastModified: Date.now()
    };
    if (!cachedInvestState) cachedInvestState = fallback;
    return cachedInvestState || fallback;
  })();
  return investFetchPromise;
}

// Fetch live investment state: SRE 5-Second Cache (0ms instant return if within 5s, fresh sync from cloud when returning)
async function fetchInvestCloudState(force = false) {
  const now = Date.now();
  if (!force && cachedInvestState && cachedInvestState.records && Object.keys(cachedInvestState.records).length > 0 && (now - lastInvestFetchTime < 5000)) {
    return cachedInvestState;
  }
  return refreshInvestFromCloud();
}

// Persist state to Google Sheets cloud
async function saveInvestCloudState(stateObj) {
  cachedInvestState = stateObj;
  lastInvestFetchTime = Date.now();
  stateObj.lastModified = Date.now();
  const payload = {
    action: "sync",
    userId: SECURE_ID,
    state: stateObj
  };
  return fetch(`${INVEST_GAS_URL}?userId=${SECURE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(r => r.json()).catch(err => console.warn("Cloud save error:", err.message));
}

// Calculate Net Worth and breakdown for a target month
async function getPortfolioSummary(targetMonthInput) {
  const targetMonth = normalizeMonth(targetMonthInput);
  const state = await fetchInvestCloudState();
  const assets = state.assets && state.assets.length > 0 ? state.assets : DEFAULT_INVEST_ASSETS;
  const monthData = (state.records && state.records[targetMonth]) ? state.records[targetMonth] : {};

  let totalNetWorth = 0;
  let totalCore = 0;
  let emergencyFund = 0;
  let carFund = 0;
  let categoryTotals = {};
  let holdings = [];

  assets.forEach(asset => {
    const rec = monthData[asset.id];
    const val = (rec && rec.invested) ? Number(rec.invested) : 0;
    if (val > 0) {
      totalNetWorth += val;
      if (asset.category !== 'Goals' && asset.category !== 'Emergency Fund' && asset.category !== 'Gold Investment') {
        totalCore += val;
      }
      if (asset.id === 'goal_emergency_fund') emergencyFund += val;
      if (asset.id === 'goal_car_fund') carFund += val;

      categoryTotals[asset.category] = (categoryTotals[asset.category] || 0) + val;
      holdings.push({
        id: asset.id,
        name: asset.name,
        category: asset.category,
        invested: val
      });
    }
  });

  return {
    month: targetMonth,
    totalNetWorth,
    coreInvestments: totalCore,
    emergencyFund,
    carFund,
    categoryTotals,
    holdingsCount: holdings.length,
    holdings
  };
}

// Add or update investment records for a month
async function recordInvestments({ month, investments }) {
  const monthStr = normalizeMonth(month);
  let state = cachedInvestState;
  if (!state || !state.records) {
    state = await fetchInvestCloudState();
  }
  if (!state.records) state.records = {};

  // Exact Original Leo Agent Logic:
  // If target month does not exist, carry over baseline from previous month
  const existingMonths = Object.keys(state.records).sort();
  const priorMonths = existingMonths.filter(m => m < monthStr && Object.keys(state.records[m] || {}).length > 0);
  const latestPriorMonth = priorMonths.length > 0 ? priorMonths[priorMonths.length - 1] : null;
  const priorRecords = latestPriorMonth ? (state.records[latestPriorMonth] || {}) : {};

  if (!state.records[monthStr]) {
    // Deep clone prior month balances as the starting baseline for the new month
    state.records[monthStr] = JSON.parse(JSON.stringify(priorRecords));
  } else if (latestPriorMonth) {
    // If target month already exists, ensure all baseline assets from prior month are present
    for (const [priorAssetId, priorRec] of Object.entries(priorRecords)) {
      if (!state.records[monthStr][priorAssetId]) {
        state.records[monthStr][priorAssetId] = JSON.parse(JSON.stringify(priorRec));
      }
    }
  }

  const assetsList = state.assets || DEFAULT_INVEST_ASSETS;
  let updatedSummary = [];

  for (const item of investments) {
    if (!item.asset_id && !item.asset) continue;
    const identifier = item.asset_id || item.asset;
    const matched = matchAsset(assetsList, identifier);
    const assetId = matched ? matched.id : identifier;
    const assetName = matched ? matched.name : identifier;
    const amount = Number(item.amount) || 0;
    const mode = (item.mode || 'add').toLowerCase();

    // Fetch baseline amount from target month or prior month
    const currentVal = (state.records[monthStr][assetId] && state.records[monthStr][assetId].invested !== undefined)
      ? Number(state.records[monthStr][assetId].invested)
      : (priorRecords[assetId] && priorRecords[assetId].invested !== undefined ? Number(priorRecords[assetId].invested) : 0);

    const newVal = mode === 'set' ? amount : (currentVal + amount);
    state.records[monthStr][assetId] = {
      ...(state.records[monthStr][assetId] || {}),
      invested: newVal,
      current: (state.records[monthStr][assetId] && state.records[monthStr][assetId].current) || (priorRecords[assetId] && priorRecords[assetId].current) || 0,
      updatedAt: Date.now()
    };
    updatedSummary.push(`${assetName}: ₹${newVal.toLocaleString('en-IN')}`);
  }

  saveInvestCloudState(state);
  return {
    status: "success",
    month: monthStr,
    updatedCount: updatedSummary.length,
    summary: updatedSummary
  };
}

// Safely remove records for a specified month
async function removeMonthRecords(month, assetId = null) {
  const monthStr = normalizeMonth(month);
  let state = cachedInvestState;
  if (!state || !state.records) {
    state = await fetchInvestCloudState();
  }

  if (state && state.records) {
    if (assetId) {
      const matched = matchAsset(state.assets || DEFAULT_INVEST_ASSETS, assetId);
      const targetId = matched ? matched.id : assetId;
      if (state.records[monthStr] && state.records[monthStr][targetId]) {
        delete state.records[monthStr][targetId];
      }
    } else {
      delete state.records[monthStr];
    }
    saveInvestCloudState(state);
  }

  return {
    status: "success",
    month: monthStr,
    message: `Removed all records for month ${monthStr} alone. All other months remain safe.`
  };
}

module.exports = {
  getPortfolioSummary,
  recordInvestments,
  removeMonthRecords,
  fetchInvestCloudState
};
