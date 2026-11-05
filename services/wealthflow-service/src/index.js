require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 8082;

app.use(cors());
app.use(express.json());
app.use('/', routes);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [wealthflow-service] Running on http://0.0.0.0:${PORT}`);
  console.log(`🩺 [wealthflow-service] Health check available at http://0.0.0.0:${PORT}/healthz`);
});

// SRE Graceful Shutdown
function gracefulShutdown(signal) {
  console.log(`⚠️ Received ${signal}. Starting graceful shutdown...`);
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
