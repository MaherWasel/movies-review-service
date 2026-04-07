const express = require('express');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./logger');
const reviewsRouter = require('./routes/reviews');
const likesRouter = require('./routes/likes');
const authMiddleware = require('./middleware/auth');
const { connectRedis, disconnectRedis } = require('./services/redis');

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

// Health check — no auth required
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'review-service', timestamp: new Date().toISOString() });
});

// Protected routes
app.use('/reviews', authMiddleware, reviewsRouter);
app.use('/movies', authMiddleware, likesRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

let server;

async function start() {
  await connectRedis();

  server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Review service started');
  });
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  await disconnectRedis();
  logger.info('Cleanup complete — exiting');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error({ err }, 'Failed to start');
  process.exit(1);
});
