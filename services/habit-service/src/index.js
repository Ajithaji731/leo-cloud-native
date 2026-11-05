require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 8081;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/', routes);

const { getHabitsState } = require('./habitsEngine');

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [habit-service] Running on http://0.0.0.0:${PORT}`);
  console.log(`🩺 [habit-service] Health check available at http://0.0.0.0:${PORT}/healthz`);
  console.log(`⚡ [habit-service] Pre-warming in-memory habit cache...`);
  getHabitsState()
    .then(({ habits }) => console.log(`✅ [habit-service] Cache pre-warmed: ${habits.length} habits ready in RAM!`))
    .catch(err => console.warn(`⚠️ [habit-service] Cache pre-warm failed: ${err.message}`));
});

// SRE Graceful Shutdown (Essential for Kubernetes rolling updates)
function gracefulShutdown(signal) {
  console.log(`⚠️ Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    console.log('✅ Closed all active HTTP connections. Process exiting.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if connections hang
  setTimeout(() => {
    console.error('❌ Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
