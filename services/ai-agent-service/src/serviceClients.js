const cache = require('./cache');

// Microservice Base URLs (Support localhost for Mac, and container DNS for Docker network)
const HABIT_SERVICE_URL = process.env.HABIT_SERVICE_URL || 'http://localhost:8081';
const WEALTHFLOW_SERVICE_URL = process.env.WEALTHFLOW_SERVICE_URL || 'http://localhost:8082';

// 1. Fast Habit Retrieval (Cache-First)
async function fetchHabits({ date, force = false } = {}) {
  const cacheKey = `habits_${date || 'today'}`;
  if (!force) {
    const cached = cache.get(cacheKey);
    if (cached) return { data: cached, fromCache: true };
  }

  const url = `${HABIT_SERVICE_URL}/api/v1/habits${date ? `?date=${encodeURIComponent(date)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Habit service error: ${res.statusText}`);
  const data = await res.json();

  // Cache for 5 seconds for rapid chat queries
  cache.set(cacheKey, data, 5);
  return { data, fromCache: false };
}

// 2. Fast Habit Update
async function updateHabits({ habitIds, action = 'check', date }) {
  const url = `${HABIT_SERVICE_URL}/api/v1/habits/update`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habitIds, action, date })
  });
  if (!res.ok) throw new Error(`Habit update error: ${res.statusText}`);
  const result = await res.json();

  // Invalidate cache immediately on write and re-warm silently in background
  cache.invalidate('habits_');
  fetchHabits({ force: true }).catch(() => {});
  return result;
}

// 3. Fast WealthFlow Summary (Cache-First)
async function fetchWealthSummary({ month, force = false } = {}) {
  const cacheKey = `wealth_${month || 'current'}`;
  if (!force) {
    const cached = cache.get(cacheKey);
    if (cached) return { data: cached, fromCache: true };
  }

  const url = `${WEALTHFLOW_SERVICE_URL}/api/v1/wealth/summary${month ? `?month=${encodeURIComponent(month)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WealthFlow service error: ${res.statusText}`);
  const data = await res.json();

  // Cache for 5 seconds for rapid chat queries
  cache.set(cacheKey, data, 5);
  return { data, fromCache: false };
}

// 4. Fast WealthFlow Investment Logging
async function recordInvestments({ month, investments }) {
  const url = `${WEALTHFLOW_SERVICE_URL}/api/v1/wealth/record`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, investments })
  });
  if (!res.ok) throw new Error(`WealthFlow record error: ${res.statusText}`);
  const result = await res.json();

  // Invalidate cache on write
  cache.invalidate('wealth_');
  return result;
}

// 5. Fast WealthFlow Deletion
async function removeInvestmentData({ month, assetId = null }) {
  const url = `${WEALTHFLOW_SERVICE_URL}/api/v1/wealth/month/${encodeURIComponent(month)}${assetId ? `?assetId=${encodeURIComponent(assetId)}` : ''}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`WealthFlow delete error: ${res.statusText}`);
  const result = await res.json();

  cache.invalidate('wealth_');
  return result;
}

// 6. SRE PERFORMANCE SUPERPOWER: Parallel Concurrent Fetching!
// Fetches both Habits and WealthFlow at the exact same millisecond
async function getUnifiedQuickOverview() {
  const t0 = Date.now();
  const [habitsResult, wealthResult] = await Promise.all([
    fetchHabits(),
    fetchWealthSummary()
  ]);
  const latencyMs = Date.now() - t0;

  return {
    latencyMs,
    habits: habitsResult.data,
    wealth: wealthResult.data,
    cached: habitsResult.fromCache && wealthResult.fromCache
  };
}

module.exports = {
  fetchHabits,
  updateHabits,
  fetchWealthSummary,
  recordInvestments,
  removeInvestmentData,
  getUnifiedQuickOverview
};
