const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(config.nodeEnv === 'development' && {
    transport: { target: 'pino-pretty' },
  }),
});

module.exports = logger;
