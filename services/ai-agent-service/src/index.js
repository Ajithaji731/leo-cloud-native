require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const { getUnifiedQuickOverview } = require('./serviceClients');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Serve static UI assets from public/ folder
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/', routes);

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🦁 [ai-agent-service] Running on http://0.0.0.0:${PORT}`);
  console.log(`🩺 [ai-agent-service] Health check available at http://0.0.0.0:${PORT}/healthz`);
  
  // Background Warm-up: pre-load today's habits and net worth into RAM immediately!
  setTimeout(() => {
    console.log(`⚡ Pre-warming hot memory cache from microservices...`);
    getUnifiedQuickOverview()
      .then(overview => console.log(`✅ Cache pre-warmed in ${overview.latencyMs}ms! Total Net Worth: ₹${overview.wealth?.totalNetWorth?.toLocaleString('en-IN') || 0}, Habits: ${overview.habits?.totalHabits || 0}`))
      .catch(err => console.warn(`Cache pre-warm note: ${err.message}`));
  }, 2000);
});

// SRE Graceful Shutdown
function gracefulShutdown(signal) {
  console.log(`⚠️ Received ${signal}. Shutting down ai-agent-service gracefully...`);
  server.close(() => {
    console.log('✅ Closed all active HTTP connections. Process exiting.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('❌ Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
