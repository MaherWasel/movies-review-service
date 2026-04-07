const Redis = require('ioredis');
const config = require('../config');
const logger = require('../logger');

let redis = null;

function getRedisClient() {
  if (redis) return redis;

  redis = new Redis({
    host: config.redisHost,
    port: config.redisPort,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  redis.on('connect', () => {
    logger.info('Connected to Redis');
  });

  return redis;
}

async function connectRedis() {
  const client = getRedisClient();
  try {
    await client.connect();
  } catch (err) {
    logger.warn({ err }, 'Redis connect failed — auth will skip cache');
  }
  return client;
}

async function disconnectRedis() {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
  }
}

module.exports = { getRedisClient, connectRedis, disconnectRedis };
