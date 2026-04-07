const http = require('http');
const { PubSub } = require('@google-cloud/pubsub');
const { Firestore } = require('@google-cloud/firestore');
const pino = require('pino');

const config = {
  projectId: process.env.GCP_PROJECT_ID,
  subscriptionName: process.env.PUBSUB_SUBSCRIPTION || 'review-events-sub',
  nodeEnv: process.env.NODE_ENV || 'development',
};

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(config.nodeEnv === 'development' && {
    transport: { target: 'pino-pretty' },
  }),
});

const firestore = new Firestore({ projectId: config.projectId });
const pubsub = new PubSub({ projectId: config.projectId });

async function recalculateMovieRating(movieId) {
  const snapshot = await firestore
    .collection('reviews')
    .where('movieId', '==', movieId)
    .get();

  const reviews = snapshot.docs.map((doc) => doc.data());
  const reviewCount = reviews.length;

  if (reviewCount === 0) {
    await firestore.collection('movies').doc(movieId).update({
      rating: 0,
      reviewCount: 0,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  const avgRating = Math.round((totalRating / reviewCount) * 10) / 10;

  await firestore.collection('movies').doc(movieId).update({
    rating: avgRating,
    reviewCount,
    updatedAt: new Date().toISOString(),
  });

  logger.info({ movieId, avgRating, reviewCount }, 'Recalculated movie rating');
}

async function handleMessage(message) {
  const data = JSON.parse(message.data.toString());
  const eventType = message.attributes.eventType;

  logger.info({ eventType, data }, 'Processing Pub/Sub message');

  try {
    switch (eventType) {
      case 'REVIEW_CREATED':
      case 'REVIEW_DELETED':
        await recalculateMovieRating(data.data.movieId);
        break;
      default:
        logger.warn({ eventType }, 'Unknown event type');
    }

    message.ack();
  } catch (err) {
    logger.error({ err, eventType }, 'Failed to process message');
    message.nack();
  }
}

async function start() {
  // Cloud Run requires an HTTP server for health checks
  const port = process.env.PORT || 8080;
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'review-worker' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(port, () => {
    logger.info({ port }, 'Worker health server started');
  });

  const subscription = pubsub.subscription(config.subscriptionName);

  subscription.on('message', handleMessage);
  subscription.on('error', (err) => {
    logger.error({ err }, 'Subscription error');
  });

  logger.info({ subscription: config.subscriptionName }, 'Worker listening for messages');
}

// Graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, 'Worker shutting down');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
