const config = {
  port: parseInt(process.env.PORT, 10) || 8080,
  projectId: process.env.GCP_PROJECT_ID,
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT, 10) || 6379,
  tokenCacheTTL: parseInt(process.env.TOKEN_CACHE_TTL, 10) || 3600,
  pubsubTopic: process.env.PUBSUB_TOPIC || 'review-events',
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = config;
