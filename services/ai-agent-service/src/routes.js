const express = require('express');
const router = express.Router();
const { processChat } = require('./orchestrator');
const { getUnifiedQuickOverview } = require('./serviceClients');
const cache = require('./cache');

// SRE Metrics Counter
const startTime = Date.now();
let requestCount = 0;
let chatCount = 0;
let errorCount = 0;

router.use((req, res, next) => {
  requestCount++;
  next();
});

// --- SRE Probes ---

// Liveness & Readiness Probe
router.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ai-agent-service',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

// SRE Metrics Probe
router.get('/metrics', (req, res) => {
  const memory = process.memoryUsage();
  res.status(200).json({
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    totalRequests: requestCount,
    totalChatQueries: chatCount,
    errorCount: errorCount,
    cachedKeysCount: cache.store.size,
    memoryUsageMB: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024)
    }
  });
});

// --- Business & AI Endpoints ---

// POST /api/v1/chat
// Body: { message: "what did i do today?", history: [...] }
router.post('/api/v1/chat', async (req, res) => {
  const t0 = Date.now();
  chatCount++;
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await processChat({ message, history });
    const latencyMs = Date.now() - t0;

    res.status(200).json({
      ...result,
      latencyMs
    });
  } catch (err) {
    errorCount++;
    console.error("Chat error:", err);
    res.status(500).json({
      response: `⚠️ Error communicating with microservices: ${err.message}`,
      latencyMs: Date.now() - t0
    });
  }
});

// GET /api/v1/quick-status
// Instant sub-5ms unified status for UI chips and dashboard cards
router.get('/api/v1/quick-status', async (req, res) => {
  try {
    const overview = await getUnifiedQuickOverview();
    res.status(200).json(overview);
  } catch (err) {
    errorCount++;
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/cache/clear (SRE cache flush)
router.post('/api/v1/cache/clear', (req, res) => {
  cache.clear();
  res.status(200).json({ status: 'cleared', message: 'In-memory cache wiped.' });
});

module.exports = router;
