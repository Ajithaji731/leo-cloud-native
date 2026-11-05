const express = require('express');
const router = express.Router();
const { getHabitsState, updateHabits, calculateStreak, getLocalDateISO } = require('./habitsEngine');

// SRE Metrics Counter
const startTime = Date.now();
let requestCount = 0;
let errorCount = 0;

// Middleware to track metrics
router.use((req, res, next) => {
  requestCount++;
  next();
});

// --- SRE Endpoints ---

// Liveness & Readiness Probe (Targeted by Kubernetes)
router.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'habit-service',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

// SRE Metrics Probe (Prometheus / Observability standard)
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

// GET /api/v1/habits?date=YYYY-MM-DD
// Returns all habits, marked completed/pending for given date, with streak counters
router.get('/api/v1/habits', async (req, res) => {
  try {
    const targetDate = req.query.date || getLocalDateISO();
    const { habits } = await getHabitsState(req.query.force === 'true');

    const completed = [];
    const pending = [];

    const enriched = habits.map(h => {
      const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
      const isDone = dates.includes(targetDate);
      const streakInfo = calculateStreak(dates);

      const item = {
        id: h.id,
        name: h.name,
        completedToday: isDone,
        currentStreak: streakInfo.currentStreak,
        totalCompleted: streakInfo.totalCompleted
      };

      if (isDone) completed.push(item);
      else pending.push(item);

      return item;
    });

    res.status(200).json({
      date: targetDate,
      totalHabits: enriched.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      completionRate: enriched.length > 0 ? Math.round((completed.length / enriched.length) * 100) : 0,
      completed,
      pending,
      all: enriched
    });
  } catch (err) {
    errorCount++;
    res.status(500).json({ error: 'Failed to retrieve habits', message: err.message });
  }
});

// POST /api/v1/habits/update
// Body: { habitIds: ["Workout", "SRE"], action: "check"|"uncheck", date: "YYYY-MM-DD" }
router.post('/api/v1/habits/update', async (req, res) => {
  try {
    const { habitIds, habit_ids, habit_id, action = 'check', date } = req.body;
    const idsToUpdate = habitIds || habit_ids || habit_id;

    if (!idsToUpdate) {
      return res.status(400).json({ error: 'habitIds is required' });
    }

    const result = await updateHabits({
      habitIds: idsToUpdate,
      action: action.toLowerCase(),
      date
    });

    res.status(200).json(result);
  } catch (err) {
    errorCount++;
    res.status(500).json({ error: 'Failed to update habits', message: err.message });
  }
});

// GET /api/v1/habits/summary?date=YYYY-MM-DD
// Returns concise plain-text for instant consumption by AI Agent
router.get('/api/v1/habits/summary', async (req, res) => {
  try {
    const targetDate = req.query.date || getLocalDateISO();
    const { habits } = await getHabitsState();

    const completed = [];
    const pending = [];

    habits.forEach(h => {
      const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
      if (dates.includes(targetDate)) {
        completed.push(h.name);
      } else {
        pending.push(h.name);
      }
    });

    const summaryText = `Date: ${targetDate}\nCompleted (${completed.length}): ${completed.join(', ') || 'None'}\nPending (${pending.length}): ${pending.join(', ') || 'All complete! 🎉'}`;
    res.status(200).json({ summary: summaryText, completed, pending, date: targetDate });
  } catch (err) {
    errorCount++;
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
