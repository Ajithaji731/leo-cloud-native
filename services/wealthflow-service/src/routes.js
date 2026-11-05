const express = require('express');
const router = express.Router();
const { getPortfolioSummary, recordInvestments, removeMonthRecords } = require('./portfolioEngine');
const { DEFAULT_INVEST_ASSETS } = require('./assetCatalog');

// SRE Metrics Counter
const startTime = Date.now();
let requestCount = 0;
let errorCount = 0;

router.use((req, res, next) => {
  requestCount++;
  next();
});

// --- SRE Endpoints ---

// Liveness & Readiness Probe
router.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'wealthflow-service',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

// SRE Observability Metrics
router.get('/metrics', (req, res) => {
  const memory = process.memoryUsage();
  res.status(200).json({
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    totalRequests: requestCount,
    errorCount: errorCount,
    memoryUsageMB: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024)
    }
  });
});

// --- Business Endpoints ---

// GET /api/v1/wealth/summary?month=YYYY-MM
router.get('/api/v1/wealth/summary', async (req, res) => {
  try {
    const month = req.query.month;
    const summary = await getPortfolioSummary(month);
    res.status(200).json(summary);
  } catch (err) {
    errorCount++;
    res.status(500).json({ error: 'Failed to calculate portfolio summary', message: err.message });
  }
});

// GET /api/v1/wealth/assets
router.get('/api/v1/wealth/assets', (req, res) => {
  res.status(200).json({ assets: DEFAULT_INVEST_ASSETS });
});

// POST /api/v1/wealth/record
// Body: { month: "2026-09", investments: [{ asset_id: "mf_parag_parikh", amount: 5000, mode: "add" }] }
router.post('/api/v1/wealth/record', async (req, res) => {
  try {
    const { month, investments } = req.body;
    if (!investments || !Array.isArray(investments)) {
      return res.status(400).json({ error: 'investments array is required' });
    }
    const result = await recordInvestments({ month, investments });
    res.status(200).json(result);
  } catch (err) {
    errorCount++;
    res.status(500).json({ error: 'Failed to record investments', message: err.message });
  }
});

// DELETE /api/v1/wealth/month/:month?assetId=...
router.delete('/api/v1/wealth/month/:month', async (req, res) => {
  try {
    const month = req.params.month;
    const assetId = req.query.assetId || null;
    const result = await removeMonthRecords(month, assetId);
    res.status(200).json(result);
  } catch (err) {
    errorCount++;
    res.status(500).json({ error: 'Failed to delete month records', message: err.message });
  }
});

module.exports = router;
